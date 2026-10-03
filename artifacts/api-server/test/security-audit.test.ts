import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { build } from "esbuild";
import type { Request, Express } from "express";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { clearRateLimitStore, clientKey } from "../src/lib/rate-limit.ts";
import { LINE_LOCAL_CALLBACK_URL } from "../src/lib/line-config.ts";

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

  it("FIXED (job-225): rotating the User-Agent no longer bypasses the limiter", async () => {
    // Before job-225 the bucket key included a hash of the User-Agent, so every one of these
    // requests got a brand new bucket and none was ever limited. (startApp bundles a fresh copy of the
    // app, with its own empty rate-limit store, so this starts from zero.)
    const server = await startApp();
    try {
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const response = await fetch(`${server.url}/api/admin/session`, {
          method: "POST",
          headers: { "content-type": "application/json", "user-agent": `rotating-agent-${attempt}` },
          body: JSON.stringify({ password: "wrong-password" }),
        });
        statuses.push(response.status);
      }
      assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429, 429, 429], `a new User-Agent per request must not reset the limit, got ${statuses.join(",")}`);
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
    assert.equal(clientKey(directPublicPeer), "8.8.8.8", "an untrusted public peer must resolve to its own socket address, not the header");
    assert.equal(clientKey(directLoopbackPeer), "127.0.0.1", "loopback is never the nginx container, so it must fall back to the socket address too");
  });

  it("reads the real client from X-Forwarded-For only when the socket peer is nginx's own private-network container", () => {
    // nginx.conf's $proxy_add_x_forwarded_for always appends nginx's own
    // observed peer as the LAST entry -- the real client is the one before it.
    const throughNginx = fakeRequest({
      socket: { remoteAddress: "172.20.0.5" },
      headers: { "x-forwarded-for": "203.0.113.9, 172.20.0.5" },
    });
    assert.equal(clientKey(throughNginx), "203.0.113.9", "must extract the entry nginx itself received, not nginx's own appended IP");
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

  it("job-225: the User-Agent is not part of the key -- the same IP with different User-Agents shares one bucket", () => {
    // The key used to carry a hash of the User-Agent, so a caller could get a fresh bucket on every
    // request by changing that one header. Nothing the caller controls may influence the key.
    const chrome = fakeRequest({ headers: { "user-agent": "Mozilla/5.0 Chrome" } });
    const curl = fakeRequest({ headers: { "user-agent": "curl/8.0" } });
    const none = fakeRequest({});
    assert.equal(clientKey(chrome), clientKey(curl), "different User-Agents on the same IP must land in the same bucket");
    assert.equal(clientKey(chrome), clientKey(none), "a missing User-Agent must not change the bucket either");
    const keys = new Set<string>();
    for (let i = 0; i < 50; i += 1) keys.add(clientKey(fakeRequest({ headers: { "user-agent": `rotating-agent-${i}` } })));
    assert.equal(keys.size, 1, `50 rotating User-Agents must collapse to one key, got ${keys.size}`);
  });

  it("job-225: different real clients behind nginx still get different buckets (the key is not collapsed to the proxy address)", () => {
    // Guards against "fixing" the User-Agent bypass by keying on the raw socket address: behind nginx
    // that is always the nginx container, so every visitor would share one bucket.
    const clientA = fakeRequest({ socket: { remoteAddress: "172.20.0.5" }, headers: { "x-forwarded-for": "203.0.113.9, 172.20.0.5" } });
    const clientB = fakeRequest({ socket: { remoteAddress: "172.20.0.5" }, headers: { "x-forwarded-for": "203.0.113.10, 172.20.0.5" } });
    assert.equal(clientKey(clientA), "203.0.113.9");
    assert.equal(clientKey(clientB), "203.0.113.10");
    assert.notEqual(clientKey(clientA), clientKey(clientB), "two different real clients must not share a bucket");
    assert.notEqual(clientKey(clientA), "172.20.0.5", "the key must never be the nginx container's own address");
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
      assert.equal(body.services?.length, 5);
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

// ---- job-225: LINE Login returnTo must stay on this site ------------------
//
// returnTo() used to accept anything that started with "/" but not "//", which lets "/\evil.example" through:
// a browser reads that as "//evil.example" and leaves the site after login. Exercised through the real app
// (login route -> signed state cookie -> callback redirect), the same way a browser meets it.

const OAUTH_STATE_COOKIE = "knight_line_oauth_state";
const BACKSLASH = String.fromCharCode(92);
const TAB = String.fromCharCode(9);
const NEWLINE = String.fromCharCode(10);

const LINE_ENV_KEYS = ["LINE_CHANNEL_ID", "LINE_CHANNEL_SECRET", "LINE_CALLBACK_URL"] as const;
const SAVED_LINE_ENV: Record<string, string | undefined> = {};

/** What the login route stores as returnTo in the signed state cookie for a given ?returnTo= query value. */
async function returnToStoredByLogin(serverUrl: string, rawQuery: string): Promise<string> {
  const response = await fetch(`${serverUrl}/api/auth/line/login${rawQuery}`, { redirect: "manual" });
  assert.equal(response.status, 302, "the login route should redirect to LINE");
  const setCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${OAUTH_STATE_COOKIE}=`));
  assert.ok(setCookie, "the login route must set the signed state cookie");
  const cookieValue = decodeURIComponent(setCookie.split(";")[0]!.slice(OAUTH_STATE_COOKIE.length + 1));
  const payload = cookieValue.split(".")[0]!;
  return (JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { returnTo: string }).returnTo;
}

function signedStateCookie(state: string, returnTo: string) {
  const payload = Buffer.from(JSON.stringify({ state, returnTo })).toString("base64url");
  const signature = createHmac("sha256", process.env["SESSION_SECRET"]!).update(payload).digest("hex");
  return `${OAUTH_STATE_COOKIE}=${encodeURIComponent(`${payload}.${signature}`)}`;
}

describe("job-225: LINE Login returnTo cannot leave the site", () => {
  before(() => {
    for (const key of LINE_ENV_KEYS) SAVED_LINE_ENV[key] = process.env[key];
    process.env["LINE_CHANNEL_ID"] = "1234567890";
    process.env["LINE_CHANNEL_SECRET"] = "line-channel-secret-for-tests";
    process.env["LINE_CALLBACK_URL"] = LINE_LOCAL_CALLBACK_URL;
  });
  after(() => {
    for (const key of LINE_ENV_KEYS) {
      if (SAVED_LINE_ENV[key] === undefined) delete process.env[key];
      else process.env[key] = SAVED_LINE_ENV[key];
    }
  });

  const dangerous: Array<[string, string]> = [
    ["backslash after the slash (the reported case)", `/${BACKSLASH}evil.example/path`],
    ["backslash, short host", `/${BACKSLASH}evil.com`],
    ["backslash later in the path", `/admin${BACKSLASH}evil.com`],
    ["protocol-relative", "//evil.com"],
    ["protocol-relative with a path", "//evil.com/login"],
    ["percent-encoded backslash (upper case)", "/%5Cevil.com"],
    ["percent-encoded backslash (lower case)", "/%5cevil.com"],
    ["tab between the slashes", `/${TAB}/evil.com`],
    ["newline between the slashes", `/${NEWLINE}/evil.com`],
    ["absolute URL", "https://evil.com/x"],
    ["javascript: URL", "javascript:alert(1)"],
    ["bare host", "evil.com"],
    ["empty string", ""],
  ];

  for (const [label, value] of dangerous) {
    it(`falls back to "/" for ${label}`, async () => {
      const server = await startApp();
      try {
        const stored = await returnToStoredByLogin(server.url, `?returnTo=${encodeURIComponent(value)}`);
        assert.equal(stored, "/", `${JSON.stringify(value)} must not be accepted as a return target`);
      } finally {
        await server.close();
      }
    });
  }

  it('falls back to "/" when returnTo is missing or is not a single string', async () => {
    const server = await startApp();
    try {
      assert.equal(await returnToStoredByLogin(server.url, ""), "/");
      assert.equal(await returnToStoredByLogin(server.url, "?returnTo[]=%2Fadmin"), "/", "an array value is not a path");
      assert.equal(await returnToStoredByLogin(server.url, "?returnTo[a]=%2Fadmin"), "/", "an object value is not a path");
    } finally {
      await server.close();
    }
  });

  const legitimate = [
    "/",
    "/admin",
    "/admin?invite=abc123",
    "/studio?draft=dft_abc-123",
    "/quote/view?token=eyJhYg.sig-_",
    "/portfolio#gallery",
    "/support?topic=quote&page=2",
    "/" + encodeURIComponent("สตูดิโอ") + "?x=1",
  ];

  it("keeps every normal internal path exactly as given", async () => {
    const server = await startApp();
    try {
      for (const value of legitimate) {
        const decoded = decodeURIComponent(value);
        const stored = await returnToStoredByLogin(server.url, `?returnTo=${encodeURIComponent(decoded)}`);
        assert.equal(stored, decoded, `the normal path ${decoded} must keep working`);
      }
    } finally {
      await server.close();
    }
  });

  it("the callback re-checks the target: a signed state cookie carrying a backslash path still redirects to /", async () => {
    // The state cookie is signed but lives for 10 minutes, so one issued before this fix could still hold an
    // unchecked value. Craft exactly that (we know the test SESSION_SECRET) and take the no-network branch
    // of the callback (LINE reported an error), which redirects straight to the stored target.
    const server = await startApp();
    try {
      const bad = await fetch(`${server.url}/api/auth/line/callback?state=s1&error=access_denied`, {
        redirect: "manual",
        headers: { cookie: signedStateCookie("s1", `/${BACKSLASH}evil.example/path`) },
      });
      assert.equal(bad.status, 302);
      assert.equal(bad.headers.get("location"), "/", "a backslash target in an older cookie must not be followed");

      const good = await fetch(`${server.url}/api/auth/line/callback?state=s2&error=access_denied`, {
        redirect: "manual",
        headers: { cookie: signedStateCookie("s2", "/admin?invite=abc123") },
      });
      assert.equal(good.status, 302);
      assert.equal(good.headers.get("location"), "/admin?invite=abc123", "a normal internal path keeps redirecting exactly as before");
    } finally {
      await server.close();
    }
  });
});
