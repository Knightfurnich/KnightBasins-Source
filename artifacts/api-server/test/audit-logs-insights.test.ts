import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { fileURLToPath } from "node:url";
import { PgDialect } from "drizzle-orm/pg-core";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

type CompiledQuery = { sql: string; params: unknown[] };

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));
const dialect = new PgDialect();
const originalEnv = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

before(() => {
  process.env["ADMIN_PASSWORD"] = "audit-insights-test-password";
  process.env["DATABASE_URL"] = "postgres://audit-insights-test";
  process.env["SESSION_SECRET"] = "audit-insights-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
});

after(restoreEnvironment);

async function startAdmin(database: unknown) {
  const routeModule = await importTypeScriptModule<AdminModule>(adminRoute);
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", routeModule.createAdminRouter(database));
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: "Internal server error" });
  });

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Audit insights test server did not expose a TCP address");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

const adminCookie = () => `knight_admin_session=${createAdminToken()}`;

function createAuditDatabase(options: {
  totals?: Record<string, number>;
  painPoints?: Array<{ key: string; category: string; count: number }>;
  prunedCount?: number;
} = {}) {
  const calls: CompiledQuery[] = [];
  const database = {
    execute: async (query: unknown) => {
      const compiled = dialect.sqlToQuery(query as never);
      calls.push(compiled);
      if (/DELETE FROM system_audit_logs/i.test(compiled.sql)) {
        return { rows: [{ prunedCount: options.prunedCount ?? 0 }] };
      }
      if (/GROUP BY 1, 2/i.test(compiled.sql)) {
        return { rows: options.painPoints ?? [] };
      }
      return {
        rows: [{
          total: options.totals?.["total"] ?? 0,
          success: options.totals?.["success"] ?? 0,
          warning: options.totals?.["warning"] ?? 0,
          error: options.totals?.["error"] ?? 0,
        }],
      };
    },
  };
  return { database, calls };
}

describe("owner-only audit log insights and pruning", () => {
  it("requires an owner session for both new endpoints", async () => {
    const { database } = createAuditDatabase();
    const server = await startAdmin(database);
    try {
      assert.equal((await fetch(`${server.url}/api/admin/audit-logs/insights`)).status, 401);
      assert.equal((await fetch(`${server.url}/api/admin/audit-logs/prune`, { method: "POST" })).status, 401);

      process.env["ADMIN_ROLE"] = "staff";
      try {
        const headers = { cookie: adminCookie() };
        assert.equal((await fetch(`${server.url}/api/admin/audit-logs/insights`, { headers })).status, 403);
        assert.equal((await fetch(`${server.url}/api/admin/audit-logs/prune`, { method: "POST", headers })).status, 403);
      } finally {
        delete process.env["ADMIN_ROLE"];
      }
    } finally {
      await server.close();
    }
  });

  it("returns 30-day totals and customer issue counts grouped by error code or action", async () => {
    const { database, calls } = createAuditDatabase({
      totals: { total: 38, success: 31, warning: 5, error: 2 },
      painPoints: [
        { key: "STUDIO_LAYOUT_INVALID", category: "ux", count: 9 },
        { key: "INVALID_LEAD_PAYLOAD", category: "form", count: 7 },
        { key: "slip.upload", category: "slip", count: 6 },
        { key: "QUOTE_NOT_FOUND", category: "form", count: 4 },
        { key: "TAMPERED_QUOTE_TOTAL", category: "form", count: 3 },
        { key: "LOW_VOLUME_ACTION", category: "form", count: 1 },
      ],
    });
    const server = await startAdmin(database);
    try {
      const response = await fetch(`${server.url}/api/admin/audit-logs/insights`, { headers: { cookie: adminCookie() } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const result = await response.json() as {
        periodDays: number;
        totals: Record<string, number>;
        customerIssues: number;
        categories: Array<{ category: string; label: string; count: number }>;
        painPoints: Array<{ key: string; count: number; category: string; categoryLabel: string; description: string; recommendation: string }>;
        generatedAt: string;
      };

      assert.equal(result.periodDays, 30);
      assert.deepEqual(result.totals, { total: 38, success: 31, warning: 5, error: 2 });
      assert.equal(result.customerIssues, 30);
      assert.deepEqual(result.categories, [
        { category: "ux", label: "UX/ผังเคาน์เตอร์", count: 9 },
        { category: "slip", label: "สลิปการเงิน", count: 6 },
        { category: "form", label: "ข้อมูลฟอร์ม", count: 15 },
      ]);
      assert.equal(result.painPoints.length, 5);
      assert.equal(result.painPoints[0]?.key, "STUDIO_LAYOUT_INVALID");
      assert.equal(result.painPoints[0]?.count, 9);
      assert.equal(result.painPoints[0]?.categoryLabel, "UX/ผังเคาน์เตอร์");
      assert.match(result.painPoints[0]?.description ?? "", /ลูกค้าติดขัด/);
      assert.match(result.painPoints[0]?.recommendation ?? "", /ตรวจขั้นตอน/);
      assert.equal(result.painPoints.find((point) => point.key === "INVALID_LEAD_PAYLOAD")?.categoryLabel, "ข้อมูลฟอร์ม");
      assert.ok(Number.isFinite(Date.parse(result.generatedAt)));

      const totalsQuery = calls.find((call) => /COUNT\(\*\) FILTER/i.test(call.sql));
      const issuesQuery = calls.find((call) => /GROUP BY 1, 2/i.test(call.sql));
      assert.ok(totalsQuery);
      assert.ok(issuesQuery);
      assert.match(totalsQuery.sql, /created_at >= \$1/i);
      assert.ok(totalsQuery.params[0] instanceof Date);
      assert.ok(Math.abs(Date.now() - (totalsQuery.params[0] as Date).getTime() - 30 * 24 * 60 * 60 * 1000) < 5_000);
      assert.match(issuesQuery.sql, /COALESCE\(NULLIF\(error_code, ''\), action\)/i);
      assert.match(issuesQuery.sql, /actor_type = 'customer'/i);
      assert.match(issuesQuery.sql, /status IN \('warning', 'error'\)/i);
      assert.match(issuesQuery.sql, /created_at >= \$1/i);
    } finally {
      await server.close();
    }
  });

  it("returns empty, zero-valued categories for a quiet 30-day period", async () => {
    const { database } = createAuditDatabase();
    const server = await startAdmin(database);
    try {
      const response = await fetch(`${server.url}/api/admin/audit-logs/insights`, { headers: { cookie: adminCookie() } });
      assert.equal(response.status, 200);
      const result = await response.json() as { totals: Record<string, number>; customerIssues: number; categories: Array<{ count: number }>; painPoints: unknown[] };
      assert.deepEqual(result.totals, { total: 0, success: 0, warning: 0, error: 0 });
      assert.equal(result.customerIssues, 0);
      assert.deepEqual(result.categories.map((category) => category.count), [0, 0, 0]);
      assert.deepEqual(result.painPoints, []);
    } finally {
      await server.close();
    }
  });

  it("prunes only eligible old rows and always keeps slip uploads and admin actions", async () => {
    const { database, calls } = createAuditDatabase({ prunedCount: 12 });
    const server = await startAdmin(database);
    try {
      const response = await fetch(`${server.url}/api/admin/audit-logs/prune`, {
        method: "POST",
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const result = await response.json() as { prunedCount: number; prunedAt: string };
      assert.equal(result.prunedCount, 12);
      assert.ok(Number.isFinite(Date.parse(result.prunedAt)));

      const pruneQuery = calls.find((call) => /DELETE FROM system_audit_logs/i.test(call.sql));
      assert.ok(pruneQuery);
      assert.match(pruneQuery.sql, /actor_type IS DISTINCT FROM 'admin'/i);
      assert.match(pruneQuery.sql, /action NOT LIKE 'admin\.%'/i);
      assert.match(pruneQuery.sql, /action IS DISTINCT FROM 'slip\.upload'/i);
      assert.match(pruneQuery.sql, /status = 'success'.*INTERVAL '30 days'/is);
      assert.match(pruneQuery.sql, /status IN \('warning', 'error'\).*INTERVAL '90 days'/is);
      assert.match(pruneQuery.sql, /RETURNING id/i);
    } finally {
      await server.close();
    }
  });
});