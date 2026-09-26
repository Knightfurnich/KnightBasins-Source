import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { build } from "esbuild";
import type { Express } from "express";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";

type AppModule = { default: Express };

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

  it("SECURITY FINDING: rotating X-Forwarded-For lets an attacker bypass the same limiter entirely", async () => {
    // Demonstrates Finding 1 in SECURITY_AUDIT_REPORT.md: app.ts sets
    // `trust proxy: 1`, so createRateLimiter's default IP key (req.ip) is
    // taken from the caller-supplied X-Forwarded-For header. Sending a
    // distinct value on every request buckets each one separately, so the
    // 5-attempts/60s cap on admin login never trips even after far more than
    // 5 attempts. This test documents the CURRENT (vulnerable) behavior so a
    // future fix (pinning trust proxy to a verified hop count, or an infra
    // guard that strips client-supplied X-Forwarded-For) has a regression
    // test to flip red-to-green against.
    const server = await startApp();
    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const response = await fetch(`${server.url}/api/admin/session`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": `198.51.100.${attempt + 1}`,
          },
          body: JSON.stringify({ password: "wrong-password" }),
        });
        assert.equal(response.status, 401, `spoofed attempt ${attempt + 1} should never be rate limited (bypass confirmed)`);
      }
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
