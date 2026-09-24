import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type DashboardLeadRow = {
  id: number;
  leadKey: string;
  status: string;
  quoteNumber: string | null;
  name: string | null;
  project: string | null;
  address: string | null;
  expectedInstallationDate: string | null;
  notes: string | null;
};

type DashboardSlipRow = {
  leadId: number | null;
  status: string;
  verifiedAmountThb: number | null;
  claimedAmountThb: number | null;
};

type AdminDashboardStats = {
  kpis: { totalRevenueThb: number; totalLeads: number; readyForProduction: number; closed: number };
  actionItems: { unassignedSlipsCount: number; awaitingContactCount: number };
  pipelineRatio: { usCount: number; ofCount: number; otherCount: number };
  upcomingInstallations: Array<{
    id: number;
    leadKey: string;
    name: string;
    quoteNumber: string | null;
    project: string | null;
    address: string | null;
    expectedInstallationDate: string;
    notes: string | null;
  }>;
  asOf: string;
};

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
  computeTotalRevenueThb: (slips: DashboardSlipRow[]) => number;
  computeUpcomingInstallations: (
    leads: DashboardLeadRow[],
    now: Date,
    windowDays?: number,
  ) => AdminDashboardStats["upcomingInstallations"];
  computeAdminDashboardStats: (
    leads: DashboardLeadRow[],
    slips: DashboardSlipRow[],
    now?: Date,
  ) => AdminDashboardStats;
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

function lead(overrides: Partial<DashboardLeadRow> & { id: number }): DashboardLeadRow {
  return {
    leadKey: `lead-${overrides.id}`,
    status: "new_lead",
    quoteNumber: null,
    name: "คุณทดสอบ",
    project: null,
    address: null,
    expectedInstallationDate: null,
    notes: null,
    ...overrides,
  };
}

function slip(overrides: Partial<DashboardSlipRow>): DashboardSlipRow {
  return {
    leadId: null,
    status: "pending",
    verifiedAmountThb: null,
    claimedAmountThb: null,
    ...overrides,
  };
}

function createFakeDashboardDatabase(leads: DashboardLeadRow[], slips: DashboardSlipRow[]) {
  const tableName = (table: object) => table[Symbol.for("drizzle:Name") as keyof object] as string;
  return {
    select: () => ({
      from: (table: object) => {
        const rows = tableName(table) === "customer_leads" ? leads : slips;
        return { orderBy: async () => rows };
      },
    }),
  };
}

async function startAdminRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", routeModule.createAdminRouter(database));
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
    routeModule,
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

before(() => {
  process.env["ADMIN_PASSWORD"] = "admin-dashboard-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-dashboard-test";
  process.env["SESSION_SECRET"] = "admin-dashboard-test-session-secret";
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("computeTotalRevenueThb", () => {
  it("sums verified slips from verifiedAmountThb and team_reported_paid slips from claimedAmountThb, skipping voided", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const total = routeModule.computeTotalRevenueThb([
      slip({ status: "verified", verifiedAmountThb: 15000, claimedAmountThb: 99999 }),
      slip({ status: "team_reported_paid", claimedAmountThb: 8500, verifiedAmountThb: null }),
      slip({ status: "voided", verifiedAmountThb: 50000, claimedAmountThb: 50000 }),
      slip({ status: "pending", claimedAmountThb: 1000 }),
      slip({ status: "rejected", verifiedAmountThb: 1000 }),
    ]);
    assert.equal(total, 15000 + 8500);
  });
});

describe("computeUpcomingInstallations", () => {
  it("keeps only leads whose expectedInstallationDate falls within the next 7 days (Asia/Bangkok) and sorts by nearest first", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    // "now" is 2026-09-24T10:00:00+07:00 -> Bangkok today is 2026-09-24, window end is 2026-10-01
    const now = new Date("2026-09-24T03:00:00.000Z");
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-09-30" }),
      lead({ id: 2, expectedInstallationDate: "2026-09-24" }),
      lead({ id: 3, expectedInstallationDate: "2026-10-02" }),
      lead({ id: 4, expectedInstallationDate: "2026-09-10" }),
      lead({ id: 5, expectedInstallationDate: null }),
      lead({ id: 6, expectedInstallationDate: "2026-09-27" }),
    ];
    const result = routeModule.computeUpcomingInstallations(leads, now);
    assert.deepEqual(result.map((row) => row.id), [2, 6, 1]);
  });

  it("includes the exact 7-day boundary and excludes the day after it", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z");
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-10-01" }),
      lead({ id: 2, expectedInstallationDate: "2026-10-02" }),
    ];
    const result = routeModule.computeUpcomingInstallations(leads, now);
    assert.deepEqual(result.map((row) => row.id), [1]);
  });
});

describe("computeAdminDashboardStats", () => {
  it("computes the US/OF/other pipeline ratio from quoteNumber, mutually exclusively", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [
      lead({ id: 1, quoteNumber: "Sep 26 / US / 296579" }),
      lead({ id: 2, quoteNumber: "sep 26 / of / 296580" }),
      lead({ id: 3, quoteNumber: "Sep 26 / US / 296581" }),
      lead({ id: 4, quoteNumber: null }),
      lead({ id: 5, quoteNumber: "Sep 26 / XX / 296582" }),
    ];
    const stats = routeModule.computeAdminDashboardStats(leads, [], new Date("2026-09-24T03:00:00.000Z"));
    assert.deepEqual(stats.pipelineRatio, { usCount: 2, ofCount: 1, otherCount: 2 });
  });

  it("assembles kpis, actionItems, and asOf from leads and slips", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z");
    const leads = [
      lead({ id: 1, status: "new_lead" }),
      lead({ id: 2, status: "selecting" }),
      lead({ id: 3, status: "quote_requested" }),
      lead({ id: 4, status: "ready_for_production" }),
      lead({ id: 5, status: "ready_for_production" }),
      lead({ id: 6, status: "closed" }),
      lead({ id: 7, status: "deposit_paid" }),
    ];
    const slips = [
      slip({ status: "verified", verifiedAmountThb: 10000, leadId: 1 }),
      slip({ status: "team_reported_paid", claimedAmountThb: 5000, leadId: 2 }),
      slip({ status: "pending", leadId: null }),
      slip({ status: "needs_review", leadId: null }),
      slip({ status: "voided", leadId: null }),
    ];
    const stats = routeModule.computeAdminDashboardStats(leads, slips, now);
    assert.deepEqual(stats.kpis, { totalRevenueThb: 15000, totalLeads: 7, readyForProduction: 2, closed: 1 });
    assert.deepEqual(stats.actionItems, { unassignedSlipsCount: 2, awaitingContactCount: 3 });
    assert.equal(stats.asOf, now.toISOString());
  });
});

describe("GET /admin/dashboard-stats", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeDashboardDatabase([], []));
    try {
      const response = await fetch(`${server.url}/api/admin/dashboard-stats`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("returns the full dashboard payload for an authenticated admin", async () => {
    const leads = [
      lead({ id: 1, status: "ready_for_production", quoteNumber: "Sep 26 / US / 1", expectedInstallationDate: "2026-09-25" }),
      lead({ id: 2, status: "closed", quoteNumber: "Sep 26 / OF / 2" }),
      lead({ id: 3, status: "new_lead" }),
    ];
    const slips = [
      slip({ status: "verified", verifiedAmountThb: 20000, leadId: 1 }),
      slip({ status: "pending", leadId: null }),
    ];
    const server = await startAdminRoute(createFakeDashboardDatabase(leads, slips));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/dashboard-stats`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as AdminDashboardStats;
      assert.equal(payload.kpis.totalRevenueThb, 20000);
      assert.equal(payload.kpis.totalLeads, 3);
      assert.equal(payload.kpis.readyForProduction, 1);
      assert.equal(payload.kpis.closed, 1);
      assert.equal(payload.actionItems.unassignedSlipsCount, 1);
      assert.equal(payload.actionItems.awaitingContactCount, 1);
      assert.deepEqual(payload.pipelineRatio, { usCount: 1, ofCount: 1, otherCount: 1 });
      assert.equal(payload.upcomingInstallations.length, 1);
      assert.equal(payload.upcomingInstallations[0]?.leadKey, "lead-1");
      assert.equal(typeof payload.asOf, "string");
    } finally {
      await server.close();
    }
  });
});
