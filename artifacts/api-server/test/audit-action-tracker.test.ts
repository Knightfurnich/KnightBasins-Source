import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { PgDialect } from "drizzle-orm/pg-core";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

type CompiledQuery = { sql: string; params: unknown[] };
type TrackerRow = {
  id: number;
  errorCode: string;
  title: string;
  category: string;
  status: string;
  assignee: string | null;
  notes: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

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
  process.env["ADMIN_PASSWORD"] = "audit-action-tracker-test-password";
  process.env["DATABASE_URL"] = "postgres://audit-action-tracker-test";
  process.env["SESSION_SECRET"] = "audit-action-tracker-test-session-secret";
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
    throw new Error("Audit action tracker test server did not expose a TCP address");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

const adminCookie = () => `knight_admin_session=${createAdminToken()}`;

const tracker: TrackerRow = {
  id: 17,
  errorCode: "INVALID_LEAD_PAYLOAD",
  title: "Improve required field guidance",
  category: "form",
  status: "pending",
  assignee: "Owner",
  notes: "Show a concrete example.",
  resolvedAt: null,
  createdAt: new Date("2026-09-20T00:00:00.000Z"),
  updatedAt: new Date("2026-09-20T00:00:00.000Z"),
};

function createAuditDatabase(options: {
  totals?: Record<string, number>;
  painPoints?: Array<{ key: string; category: string; count: number }>;
  trackers?: TrackerRow[];
  createdTracker?: TrackerRow;
  updatedTracker?: TrackerRow | null;
  preview?: Record<string, unknown>;
  exportItems?: Array<Record<string, unknown>>;
  prunedCount?: number;
} = {}) {
  const calls: CompiledQuery[] = [];
  const database = {
    execute: async (query: unknown) => {
      const compiled = dialect.sqlToQuery(query as never);
      calls.push(compiled);
      if (/INSERT INTO audit_issue_trackers/i.test(compiled.sql)) {
        return { rows: [options.createdTracker ?? tracker] };
      }
      if (/UPDATE audit_issue_trackers/i.test(compiled.sql)) {
        return { rows: options.updatedTracker === null ? [] : [options.updatedTracker ?? { ...tracker, status: "resolved" }] };
      }
      if (/FROM audit_issue_trackers/i.test(compiled.sql)) {
        return { rows: options.trackers ?? [tracker] };
      }
      if (/DELETE FROM system_audit_logs/i.test(compiled.sql)) {
        return { rows: [{ prunedCount: options.prunedCount ?? 0 }] };
      }
      if (/FROM system_audit_logs/i.test(compiled.sql) && /"successCount"/i.test(compiled.sql)) {
        return {
          rows: [options.preview ?? {
            successCount: 3,
            successOldestAt: new Date("2026-01-01T00:00:00.000Z"),
            successNewestAt: new Date("2026-02-01T00:00:00.000Z"),
            warningCount: 2,
            errorCount: 1,
            warningErrorOldestAt: new Date("2025-11-01T00:00:00.000Z"),
            warningErrorNewestAt: new Date("2025-12-01T00:00:00.000Z"),
          }],
        };
      }
      if (/FROM system_audit_logs/i.test(compiled.sql) && /"actorType"/i.test(compiled.sql)) {
        return { rows: options.exportItems ?? [{ id: 5, actorType: "customer", action: "lead.upsert", status: "success" }] };
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
          previousTotal: options.totals?.["previousTotal"] ?? 0,
        }],
      };
    },
  };
  return { database, calls };
}

function assertPrunePolicy(query: CompiledQuery) {
  assert.match(query.sql, /actor_type IS DISTINCT FROM 'admin'/i);
  assert.match(query.sql, /action NOT LIKE 'admin\.%'/i);
  assert.match(query.sql, /action IS DISTINCT FROM 'slip\.upload'/i);
  assert.match(query.sql, /status = 'success'.*INTERVAL '30 days'/is);
  assert.match(query.sql, /status IN \('warning', 'error'\).*INTERVAL '90 days'/is);
}

describe("audit action tracker, safe prune preview and export", () => {
  it("requires Owner access for every tracker and safe-prune endpoint", async () => {
    const { database } = createAuditDatabase();
    const server = await startAdmin(database);
    try {
      const paths: Array<[string, RequestInit?]> = [
        ["/api/admin/audit-issues"],
        ["/api/admin/audit-issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ errorCode: "X", title: "Issue", category: "form" }) }],
        ["/api/admin/audit-issues/17", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "resolved" }) }],
        ["/api/admin/audit-logs/prune-preview"],
        ["/api/admin/audit-logs/export"],
        ["/api/admin/audit-logs/prune", { method: "POST" }],
      ];
      for (const [path, init] of paths) assert.equal((await fetch(`${server.url}${path}`, init)).status, 401, path);

      process.env["ADMIN_ROLE"] = "staff";
      try {
        const headers = { cookie: adminCookie() };
        for (const [path, init] of paths) {
          assert.equal((await fetch(`${server.url}${path}`, { ...init, headers: { ...init?.headers, ...headers } })).status, 403, path);
        }
      } finally {
        delete process.env["ADMIN_ROLE"];
      }
    } finally {
      await server.close();
    }
  });

  it("supports 7-, 30- and 90-day insights with previous-period counts and trend direction", async () => {
    const { database, calls } = createAuditDatabase({
      totals: { total: 60, success: 45, warning: 10, error: 5, previousTotal: 40 },
      painPoints: [{ key: "INVALID_LEAD_PAYLOAD", category: "form", count: 4 }],
    });
    const server = await startAdmin(database);
    try {
      for (const [range, days] of [["7d", 7], ["30d", 30], ["90d", 90]] as const) {
        const response = await fetch(`${server.url}/api/admin/audit-logs/insights?range=${range}`, { headers: { cookie: adminCookie() } });
        assert.equal(response.status, 200);
        const result = await response.json() as {
          range: string;
          periodDays: number;
          totals: Record<string, number>;
          trend: { current: number; previous: number; direction: string; changePercent: number | null };
        };
        assert.equal(result.range, range);
        assert.equal(result.periodDays, days);
        assert.deepEqual(result.totals, { total: 60, success: 45, warning: 10, error: 5 });
        assert.deepEqual(result.trend, { current: 60, previous: 40, direction: "up", changePercent: 50 });
      }

      const currentQueries = calls.filter((call) => /"previousTotal"/i.test(call.sql));
      assert.equal(currentQueries.length, 3);
      for (const [index, days] of [7, 30, 90].entries()) {
        const start = currentQueries[index]!.params[0] as Date;
        assert.ok(start instanceof Date);
        assert.ok(Math.abs(Date.now() - start.getTime() - days * 24 * 60 * 60 * 1000) < 5_000);
        assert.match(currentQueries[index]!.sql, /created_at >= \$\d+ AND created_at < \$\d+/i);
      }
    } finally {
      await server.close();
    }
  });

  it("rejects unsupported insights ranges and handles a zero-previous-period trend without infinity", async () => {
    const { database } = createAuditDatabase({ totals: { total: 6, previousTotal: 0 } });
    const server = await startAdmin(database);
    try {
      const headers = { cookie: adminCookie() };
      assert.equal((await fetch(`${server.url}/api/admin/audit-logs/insights?range=365d`, { headers })).status, 400);
      const response = await fetch(`${server.url}/api/admin/audit-logs/insights?range=7d`, { headers });
      const result = await response.json() as { trend: { current: number; previous: number; direction: string; changePercent: number | null } };
      assert.deepEqual(result.trend, { current: 6, previous: 0, direction: "up", changePercent: null });
    } finally {
      await server.close();
    }
  });

  it("lists, creates and updates issues while validating category, status and input lengths", async () => {
    const createdTracker = { ...tracker, id: 21, category: "payment", errorCode: "slip.upload" };
    const updatedTracker = { ...tracker, status: "resolved", notes: "Fixed validation copy.", resolvedAt: new Date("2026-10-01T00:00:00.000Z") };
    const { database, calls } = createAuditDatabase({ createdTracker, updatedTracker });
    const server = await startAdmin(database);
    try {
      const headers = { cookie: adminCookie(), "Content-Type": "application/json" };
      const listResponse = await fetch(`${server.url}/api/admin/audit-issues`, { headers: { cookie: headers.cookie } });
      assert.equal(listResponse.status, 200);
      const listed = await listResponse.json() as { items: Array<Record<string, unknown>> };
      assert.equal(listed.items.length, 1);
      assert.equal(listed.items[0]?.["createdAt"], "2026-09-20T00:00:00.000Z");
      assert.equal(listed.items[0]?.["updatedAt"], "2026-09-20T00:00:00.000Z");
      assert.equal(listed.items[0]?.["errorCode"], tracker.errorCode);

      const createResponse = await fetch(`${server.url}/api/admin/audit-issues`, {
        method: "POST",
        headers,
        body: JSON.stringify({ errorCode: "slip.upload", title: "Improve payment help", category: "payment", assignee: "Nok", notes: "Clarify retry steps." }),
      });
      assert.equal(createResponse.status, 201);
      assert.equal((await createResponse.json() as { item: TrackerRow }).item.category, "payment");

      const patchResponse = await fetch(`${server.url}/api/admin/audit-issues/17`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "resolved", notes: "Fixed validation copy." }),
      });
      assert.equal(patchResponse.status, 200);
      assert.equal((await patchResponse.json() as { item: TrackerRow }).item.status, "resolved");

      assert.equal((await fetch(`${server.url}/api/admin/audit-issues`, {
        method: "POST",
        headers,
        body: JSON.stringify({ errorCode: "X", title: "Bad category", category: "other" }),
      })).status, 400);
      assert.equal((await fetch(`${server.url}/api/admin/audit-issues/17`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "closed" }),
      })).status, 400);
      assert.equal((await fetch(`${server.url}/api/admin/audit-issues/17`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ notes: "x".repeat(5001) }),
      })).status, 400);

      const insert = calls.find((call) => /INSERT INTO audit_issue_trackers/i.test(call.sql));
      const update = calls.find((call) => /UPDATE audit_issue_trackers/i.test(call.sql));
      assert.ok(insert);
      assert.ok(update);
      assert.deepEqual(insert.params.slice(0, 3), ["slip.upload", "Improve payment help", "payment"]);
      assert.match(update.sql, /resolved_at = CASE/i);
      assert.ok(update.params.includes("resolved"));
      assert.ok(update.params.includes("Fixed validation copy."));
    } finally {
      await server.close();
    }
  });

  it("previews the exact conservative retention policy without deleting rows", async () => {
    const { database, calls } = createAuditDatabase();
    const server = await startAdmin(database);
    try {
      const response = await fetch(`${server.url}/api/admin/audit-logs/prune-preview`, { headers: { cookie: adminCookie() } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const result = await response.json() as {
        totalCount: number;
        rules: Array<{ key: string; count: number; oldestAt: string | null; newestAt: string | null; warningCount?: number; errorCount?: number }>;
      };
      assert.equal(result.totalCount, 6);
      assert.equal(result.rules[0]?.count, 3);
      assert.equal(result.rules[1]?.count, 3);
      assert.equal(result.rules[1]?.warningCount, 2);
      assert.equal(result.rules[1]?.errorCount, 1);
      assert.equal(result.rules[0]?.oldestAt, "2026-01-01T00:00:00.000Z");
      const previewQuery = calls.find((call) => /"successCount"/i.test(call.sql));
      assert.ok(previewQuery);
      assertPrunePolicy(previewQuery);
      assert.doesNotMatch(previewQuery.sql, /DELETE FROM/i);
    } finally {
      await server.close();
    }
  });

  it("exports matching eligible audit rows as a downloadable JSON attachment", async () => {
    const { database, calls } = createAuditDatabase({
      exportItems: [
        { id: 7, actorType: "customer", action: "lead.upsert", status: "success", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: 8, actorType: "customer", action: "checkout.submit", status: "error", createdAt: "2025-10-01T00:00:00.000Z" },
      ],
    });
    const server = await startAdmin(database);
    try {
      const response = await fetch(`${server.url}/api/admin/audit-logs/export`, { headers: { cookie: adminCookie() } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /application\/json/);
      assert.match(response.headers.get("content-disposition") ?? "", /^attachment; filename="audit-log-backup-/);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const result = await response.json() as { totalCount: number; items: Array<{ id: number }>; policy: { preservedAdminActions: boolean; preservedSlipUploads: boolean } };
      assert.equal(result.totalCount, 2);
      assert.deepEqual(result.items.map((item) => item.id), [7, 8]);
      assert.deepEqual(result.policy, {
        successOlderThanDays: 30,
        warningOrErrorOlderThanDays: 90,
        preservedAdminActions: true,
        preservedSlipUploads: true,
      });
      const exportQuery = calls.find((call) => /"actorType"/i.test(call.sql));
      assert.ok(exportQuery);
      assertPrunePolicy(exportQuery);
      assert.match(exportQuery.sql, /ORDER BY created_at ASC, id ASC/i);
    } finally {
      await server.close();
    }
  });

  it("uses the same exclusions and age thresholds when pruning", async () => {
    const { database, calls } = createAuditDatabase({ prunedCount: 12 });
    const server = await startAdmin(database);
    try {
      const response = await fetch(`${server.url}/api/admin/audit-logs/prune`, {
        method: "POST",
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 200);
      const result = await response.json() as { prunedCount: number };
      assert.equal(result.prunedCount, 12);
      const pruneQuery = calls.find((call) => /DELETE FROM system_audit_logs/i.test(call.sql));
      assert.ok(pruneQuery);
      assertPrunePolicy(pruneQuery);
      assert.match(pruneQuery.sql, /RETURNING id/i);
    } finally {
      await server.close();
    }
  });
});