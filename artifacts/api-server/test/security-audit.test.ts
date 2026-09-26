import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { build } from "esbuild";
import type { Request, Express } from "express";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { clearRateLimitStore, clientKey } from "../src/lib/rate-limit.ts";

type AppModule = { default: Express };

function fakeRequest(overrides: Record<string, unknown> = {}) {
  return {
    socket: { remoteAddress: "203.0.113.1" },
    headers: {},
    ...overrides,
  } as unknown as Request;
}

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * app.ts's own tree pulls in cookie-parser/cors/pino-http/pino, whose CJS
 * builds do their own `require("crypto")` (and similar Node-builtin
 * requires) internally -- esbuild's ESM output mishandles that require()
 * once those packages get bundled in. Marking them external leaves them as
 * normal runtime imports Node resolves itself, sidestepping the issue,
 * while everything else (including @workspace/api-zod and this project's
 * own extensionless relative imports, which plain Node ESM can't resolve on
 * its own) still gets bundled by esbuild -- same split route-harness.ts
 * uses for every other route module, just with a few more externals since
 * app.ts (unlike a single route file) pulls in the logging/CORS/cookie
 * middleware stack too.
 */
async function importAppModule(): Promise<AppModule> {
  const entryPoint = path.join(testDirectory, "..", "src", "app.ts");
  const outputDirectory = await mkdtemp(path.join(testDirectory, ".security-audit-bundle-"));
  const outputFile = path.join(outputDirectory, "app.mjs");
  try {
    await build({
      entryPoints: [entryPoint],
      bundle: true,
      external: ["express", "pg", "@workspace/db", "@workspace/db/*", "cookie-parser", "cors", "pino-http", "pino"],
      format: "esm",
      logLevel: "silent",
      outfile: outputFile,
      platform: "node",
      sourcemap: false,
    });
    return (await import(pathToFileURL(outputFile).href)) as AppModule;
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
}

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
  NODE_ENV: process.env["NODE_ENV"],
};

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function startApp(databaseUrl = "postgres://security-audit-test") {
  process.env["ADMIN_PASSWORD"] = "security-audit-test-password";
  process.env["DATABASE_URL"] = databaseUrl;
  process.env["SESSION_SECRET"] = "security-audit-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];

  const appModule = await importAppModule();
  const app = appModule.default;
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Security-audit test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

before(() => {
  process.env["NODE_ENV"] = "test";
});

after(restoreEnv);

// ---- Area 3: Admin Authorization & Route Guard --------------------------

describe("Area 3: admin route guards", () => {
  it("returns 401 for every checked admin endpoint with no session cookie at all", async () => {
    const server = await startApp();
    try {
      const endpoints = ["/api/admin/leads", "/api/admin/basins", "/api/admin/team", "/api/admin/ai-cost-center"];
      for (const endpoint of endpoints) {
        const response = await fetch(`${server.url}${endpoint}`);
        assert.equal(response.status, 401, `${endpoint} should require authentication`);
      }
    } finally {
      await server.close();
    }
  });

  it("returns 403 when an authenticated session lacks the required permission", async () => {
    const server = await startApp();
    try {
      process.env["ADMIN_ROLE"] = "staff";
      process.env["ADMIN_PERMISSIONS"] = "basins"; // deliberately excludes "leads"
      const cookie = `knight_admin_session=${createAdminToken()}`;

      const leadsResponse = await fetch(`${server.url}/api/admin/leads`, { headers: { cookie } });
      assert.equal(leadsResponse.status, 403, "a staff session without the 'leads' permission must be rejected");

      // No real Postgres is available in this test, so the handler itself may
      // still 500 past the guard -- what this asserts is narrower and doesn't
      // need one: the permission check specifically must let it through
      // (never 401/403), proving the guard keys off the actual granted
      // permission rather than blanket-denying the whole session.
      const basinsResponse = await fetch(`${server.url}/api/admin/basins`, { headers: { cookie } });
      assert.notEqual(basinsResponse.status, 401, "an authenticated session must not be treated as unauthenticated");
      assert.notEqual(basinsResponse.status, 403, "the 'basins' permission the session DOES have must not be denied");
    } finally {
      delete process.env["ADMIN_ROLE"];
      delete process.env["ADMIN_PERMISSIONS"];
      await server.close();
    }
  });

  it("returns 403 for an owner-only route when the session is not an owner", async () => {
    const server = await startApp();
    try {
      process.env["ADMIN_ROLE"] = "staff";
      process.env["ADMIN_PERMISSIONS"] = "leads,basins,installed-stones,sheet-stones";
      const cookie = `knight_admin_session=${createAdminToken()}`;

      const response = await fetch(`${server.url}/api/admin/team`, { headers: { cookie } });
      assert.equal(response.status, 403, "only the owner role may manage the admin team");
    } finally {
      delete process.env["ADMIN_ROLE"];
      delete process.env["ADMIN_PERMISSIONS"];
      await server.close();
    }
  });
});

// ---- Area 1: API Abuse & Cost Bleeding -----------------------------------

describe("Area 1: admin-login rate limiting", () => {
  it("returns 429 on the 6th login attempt from the same apparent IP within the window", async () => {
    const server = await startApp();
    try {
      let lastStatus = 0;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await fetch(`${server.url}/api/admin/session`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: "wrong-password" }),
        });
        lastStatus = response.status;
        if (attempt < 5) assert.equal(response.status, 401, `attempt ${attempt + 1} should just be a wrong-password rejection`);
      }
      assert.equal(lastStatus, 429, "the 6th attempt within the window must be rate limited");
    } finally {
      await server.close();
    }
  });

  it("FIXED (job-86): rotating X-Forwarded-For from a direct connection no longer bypasses the limiter", async () => {
    // Task 84 Finding #1: app.ts's `trust proxy: 1` made createRateLimiter's
    // old default key (Express's own req.ip) follow whatever the caller put
    // in X-Forwarded-For. This test's HTTP client connects directly to the
    // loopback test server -- exactly like an attacker who never went
    // through this deployment's real nginx container would -- so the
    // hardened clientKey() in lib/rate-limit.ts must now ignore the header
    // entirely and bucket every one of these by the same raw socket peer,
    // regardless of what X-Forwarded-For claims.
    const server = await startApp();
    try {
      let lastStatus = 0;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await fetch(`${server.url}/api/admin/session`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": `198.51.100.${attempt + 1}`,
          },
          body: JSON.stringify({ password: "wrong-password" }),
        });
        lastStatus = response.status;
        if (attempt < 5) assert.equal(response.status, 401, `attempt ${attempt + 1} should just be a wrong-password rejection`);
      }
      assert.equal(lastStatus, 429, "a rotating X-Forwarded-For header must not create a fresh bucket per request");
    } finally {
      await server.close();
    }
  });
});

describe("Area 1: clientKey() IP resolution (unit)", () => {
  before(() => clearRateLimitStore());
  after(() => clearRateLimitStore());

  it("ignores X-Forwarded-For entirely when the socket peer is not the trusted nginx hop", () => {
    const directPublicPeer = fakeRequest({ socket: { remoteAddress: "8.8.8.8" }, headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    const directLoopbackPeer = fakeRequest({ socket: { remoteAddress: "127.0.0.1" }, headers: { "x-forwarded-for": "1.2.3.4" } });
    assert.ok(clientKey(directPublicPeer).startsWith("8.8.8.8#"), "an untrusted public peer must resolve to its own socket address, not the header");
    assert.ok(clientKey(directLoopbackPeer).startsWith("127.0.0.1#"), "loopback is never the nginx container, so it must fall back to the socket address too");
  });

  it("reads the real client from X-Forwarded-For only when the socket peer is nginx's own private-network container", () => {
    // nginx.conf's $proxy_add_x_forwarded_for always appends nginx's own
    // observed peer as the LAST entry -- the real client is the one before it.
    const throughNginx = fakeRequest({
      socket: { remoteAddress: "172.20.0.5" },
      headers: { "x-forwarded-for": "203.0.113.9, 172.20.0.5" },
    });
    assert.ok(clientKey(throughNginx).startsWith("203.0.113.9#"), "must extract the entry nginx itself received, not nginx's own appended IP");
  });

  it("a rotating X-Forwarded-For value through the trusted nginx peer cannot change the resolved IP on its own", () => {
    // Even if a caller controlled the leftmost entry, it's the SECOND entry
    // (nginx's own observed peer) that anchors trust -- rotating only the
    // leftmost entry while the real nginx-observed peer stays the same
    // real attacker IP still collapses to one bucket.
    const keys = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      const req = fakeRequest({
        socket: { remoteAddress: "172.20.0.5" },
        headers: { "x-forwarded-for": `attacker-fake-${i}, 172.20.0.5` },
      });
      keys.add(clientKey(req));
    }
    // The spoofed leftmost entries aren't valid IPs (looksLikeIp rejects
    // "attacker-fake-N"), so every one of these falls back to the trusted
    // nginx peer address itself -- all 5 must collapse to the same key.
    assert.equal(keys.size, 1, `expected every malformed-header attempt to collapse to one bucket, got ${keys.size}`);
  });

  it("folds a User-Agent fingerprint into the key as a secondary defense-in-depth layer", () => {
    const chrome = fakeRequest({ headers: { "user-agent": "Mozilla/5.0 Chrome" } });
    const curl = fakeRequest({ headers: { "user-agent": "curl/8.0" } });
    assert.notEqual(clientKey(chrome), clientKey(curl), "different User-Agents on the same IP should not silently share a bucket");
  });
});

// ---- Final Security Sign-off Verification (Task 87) ----------------------
//
// End-to-end sanity pass against the real bundled app.ts, run once both
// patches (Task 86 / Finding #1, and the sketch-vision Finding #2 fix) had
// landed on main -- exercising the exact API surface job-87 names, on top
// of (not instead of) the targeted regression tests above.

function sketchAnalyzeForm(fileCount: number) {
  const form = new FormData();
  for (let i = 0; i < fileCount; i += 1) {
    form.append("file", new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" }), `sketch-${i}.png`);
  }
  return form;
}

describe("Final sign-off: POST /api/sketch/analyze", () => {
  it("accepts a normal upload (within the 3-file cap) and returns 200", async () => {
    const server = await startApp();
    try {
      const response = await fetch(`${server.url}/api/sketch/analyze`, { method: "POST", body: sketchAnalyzeForm(1) });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { items?: unknown[] };
      assert.equal(body.items?.length, 1);
    } finally {
      await server.close();
    }
  });

  it("rejects more than 3 files with 400", async () => {
    const server = await startApp();
    try {
      const response = await fetch(`${server.url}/api/sketch/analyze`, { method: "POST", body: sketchAnalyzeForm(4) });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("returns 429 once called more than 5 times in the 10-minute window", async () => {
    const server = await startApp();
    try {
      let lastStatus = 0;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await fetch(`${server.url}/api/sketch/analyze`, { method: "POST", body: sketchAnalyzeForm(1) });
        lastStatus = response.status;
        if (attempt < 5) assert.equal(response.status, 200, `attempt ${attempt + 1} should still be within quota`);
      }
      assert.equal(lastStatus, 429, "the 6th attempt within the window must be rate limited");
    } finally {
      await server.close();
    }
  });
});

describe("Final sign-off: GET /api/places/autocomplete", () => {
  it("rejects an empty/too-short search value with 400", async () => {
    const server = await startApp();
    try {
      const empty = await fetch(`${server.url}/api/places/autocomplete?input=`);
      assert.equal(empty.status, 400);
      const tooShort = await fetch(`${server.url}/api/places/autocomplete?input=ab`);
      assert.equal(tooShort.status, 400);
    } finally {
      await server.close();
    }
  });

  it("returns 429 once called more than 30 times in the 1-minute window", async () => {
    const server = await startApp();
    try {
      let lastStatus = 0;
      for (let attempt = 0; attempt < 31; attempt += 1) {
        const response = await fetch(`${server.url}/api/places/autocomplete?input=knight+basins`);
        lastStatus = response.status;
        if (attempt < 30) assert.notEqual(response.status, 429, `attempt ${attempt + 1} should still be within quota`);
      }
      assert.equal(lastStatus, 429, "the 31st attempt within the window must be rate limited");
    } finally {
      await server.close();
    }
  });
});

describe("Final sign-off: POST /admin/session brute-force cap", () => {
  it("caps login attempts at 5/minute regardless of endpoint order (re-verified post-patch)", async () => {
    const server = await startApp();
    try {
      let lastStatus = 0;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await fetch(`${server.url}/api/admin/session`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: "wrong-password" }),
        });
        lastStatus = response.status;
      }
      assert.equal(lastStatus, 429);
    } finally {
      await server.close();
    }
  });
});

describe("Final sign-off: GET /admin/ai-cost-center", () => {
  it("rejects with 401 when there is no session", async () => {
    const server = await startApp();
    try {
      const response = await fetch(`${server.url}/api/admin/ai-cost-center`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("returns a real 200 with the full JSON shape for a correctly-permissioned session", async () => {
    // Unlike most /admin/* routes, ai-cost-center's handler is pure in-memory
    // aggregation (no database call), so this can assert a genuine 200 --
    // not just "not 401/403" -- without needing a real Postgres.
    const server = await startApp();
    try {
      const cookie = `knight_admin_session=${createAdminToken()}`;
      const response = await fetch(`${server.url}/api/admin/ai-cost-center`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { period?: string; services?: unknown[]; modelBreakdown?: unknown[] };
      assert.equal(body.period, "all");
      assert.equal(body.services?.length, 3);
      assert.ok(Array.isArray(body.modelBreakdown));
    } finally {
      await server.close();
    }
  });
});

// ---- Area 4: Secret Leakage & Error Hygiene ------------------------------

describe("Area 4: global error handler never leaks internals", () => {
  it("responds 500 with only a generic message when a real DB call fails, never the raw error", async () => {
    // Port 1 on loopback refuses connections immediately (nothing listens
    // there), giving a fast, real pg connection failure -- a genuine
    // unexpected server-side error, not a simulated one -- without touching
    // any real database.
    const server = await startApp("postgres://u:p@127.0.0.1:1/security_audit_unreachable");
    try {
      const cookie = `knight_admin_session=${createAdminToken()}`;
      const response = await fetch(`${server.url}/api/admin/leads`, { headers: { cookie } });
      assert.equal(response.status, 500);

      const rawBody = await response.text();
      const body = JSON.parse(rawBody) as Record<string, unknown>;

      assert.deepEqual(Object.keys(body).sort(), ["message"], "the error response must carry nothing but a message field");
      assert.equal(body["message"], "Internal server error");

      const leakPatterns = [/ECONNREFUSED/i, /node_modules/i, /at Object/i, /at async/i, /\.ts:\d/i, /\.js:\d/i, /password/i, /security_audit_unreachable/i];
      for (const pattern of leakPatterns) {
        assert.ok(!pattern.test(rawBody), `response body must not match ${pattern} (would indicate a leaked internal detail): ${rawBody}`);
      }
    } finally {
      await server.close();
    }
  });
});
