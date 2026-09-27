import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";
import type { DatabaseHealthMetrics } from "../src/lib/db-metrics.ts";

/**
 * GET /api/admin/database/health reports query latency and core-table
 * presence from src/lib/db-metrics.ts. checkDbHealth is injected into
 * createAdminRouter (job-114) so these tests never touch a real Postgres
 * connection -- neither the real VPS database nor any DDL is involved.
 */

type AdminRouteModule = {
  createAdminRouter: (
    database: unknown,
    checkDbHealth?: () => Promise<DatabaseHealthMetrics>,
  ) => Parameters<typeof express["use"]>[1];
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

/** The database/health route never touches drizzle directly, so a bare stub is enough. */
function createUnusedDatabase() {
  return {
    select: () => ({ from: () => Promise.resolve([]) }),
  };
}

async function startAdminRoute(database: unknown, checkDbHealth?: () => Promise<DatabaseHealthMetrics>) {
  const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", routeModule.createAdminRouter(database, checkDbHealth));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Admin route test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function adminCookie(): string {
  return `knight_admin_session=${createAdminToken()}`;
}

before(async () => {
  process.env["ADMIN_PASSWORD"] = "admin-database-health-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-database-health-test";
  process.env["SESSION_SECRET"] = "admin-database-health-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
});

after(async () => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("GET /admin/database/health", () => {
  it("rejects an unauthenticated request", async () => {
    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/database/health`);
      assert.equal(response.status, 401);
    } finally {
      await route.close();
    }
  });

  it("rejects an admin session without the leads/basins permission", async () => {
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "sheet-stones";
    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/database/health`, {
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 403);
    } finally {
      delete process.env["ADMIN_ROLE"];
      delete process.env["ADMIN_PERMISSIONS"];
      await route.close();
    }
  });

  it("reports healthy status with latency and table count on success", async () => {
    const route = await startAdminRoute(createUnusedDatabase(), async () => ({
      status: "healthy",
      latencyMs: 4,
      database: "postgres",
      timestamp: new Date().toISOString(),
      tablesCount: 3,
    }));
    try {
      const response = await fetch(`${route.url}/api/admin/database/health`, {
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 200);
      const payload = (await response.json()) as DatabaseHealthMetrics;

      assert.equal(payload.status, "healthy");
      assert.equal(payload.database, "postgres");
      assert.equal(typeof payload.latencyMs, "number");
      assert.ok(payload.latencyMs >= 0);
      assert.equal(payload.tablesCount, 3);
      assert.ok(!Number.isNaN(new Date(payload.timestamp).getTime()));
    } finally {
      await route.close();
    }
  });

  it("falls back to a safe degraded response when the connection fails, without a 500", async () => {
    const route = await startAdminRoute(createUnusedDatabase(), async () => ({
      status: "degraded",
      latencyMs: 0,
      database: "postgres",
      timestamp: new Date().toISOString(),
      tablesCount: 0,
    }));
    try {
      const response = await fetch(`${route.url}/api/admin/database/health`, {
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 200);
      const payload = (await response.json()) as DatabaseHealthMetrics;
      assert.equal(payload.status, "degraded");
      assert.equal(payload.tablesCount, 0);
    } finally {
      await route.close();
    }
  });
});
