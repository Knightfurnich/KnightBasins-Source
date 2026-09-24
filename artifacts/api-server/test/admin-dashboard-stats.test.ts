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
  productSkus: string[];
  createdAt: string;
};

type DashboardSlipRow = {
  id: number;
  leadId: number | null;
  status: string;
  verifiedAmountThb: number | null;
  claimedAmountThb: number | null;
  senderName: string | null;
  createdAt: string;
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
  popularItems: Array<{ sku: string; count: number }>;
  recentActivities: Array<{
    id: string;
    type: "lead_created" | "payment_received";
    title: string;
    detail: string;
    timestamp: string;
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
  computePopularItems: (leads: DashboardLeadRow[]) => AdminDashboardStats["popularItems"];
  computeRecentActivities: (
    leads: DashboardLeadRow[],
    slips: DashboardSlipRow[],
  ) => AdminDashboardStats["recentActivities"];
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
    productSkus: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

let nextSlipId = 1;
function slip(overrides: Partial<DashboardSlipRow>): DashboardSlipRow {
  return {
    id: nextSlipId++,
    leadId: null,
    status: "pending",
    verifiedAmountThb: null,
    claimedAmountThb: null,
    senderName: null,
    createdAt: "2026-09-01T00:00:00.000Z",
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

describe("computePopularItems", () => {
  it("counts SKU frequency across leads' productSkus and returns them sorted by count descending", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [
      lead({ id: 1, productSkus: ["KF001", "KF002"] }),
      lead({ id: 2, productSkus: ["KF001"] }),
      lead({ id: 3, productSkus: ["KF002", "KF003"] }),
      lead({ id: 4, productSkus: ["KF001"] }),
    ];
    const result = routeModule.computePopularItems(leads);
    assert.deepEqual(result, [
      { sku: "KF001", count: 3 },
      { sku: "KF002", count: 2 },
      { sku: "KF003", count: 1 },
    ]);
  });

  it("skips null/blank SKU entries and truncates to the top 5", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = Array.from({ length: 7 }, (_, index) =>
      lead({ id: index + 1, productSkus: [`SKU-${index}`, "", "   "] }));
    // Give SKU-0 extra occurrences so it's unambiguously first.
    leads.push(lead({ id: 100, productSkus: ["SKU-0", "SKU-0"] }));
    const result = routeModule.computePopularItems(leads);
    assert.equal(result.length, 5, "never more than the top 5");
    assert.equal(result[0]?.sku, "SKU-0");
    assert.equal(result[0]?.count, 3);
    assert.ok(result.every((item) => item.sku.trim().length > 0), "blank/whitespace SKUs must never appear");
  });

  it("breaks ties in count alphabetically by SKU for a deterministic order", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [
      lead({ id: 1, productSkus: ["KF900"] }),
      lead({ id: 2, productSkus: ["KF100"] }),
      lead({ id: 3, productSkus: ["KF500"] }),
    ];
    const result = routeModule.computePopularItems(leads);
    assert.deepEqual(result.map((item) => item.sku), ["KF100", "KF500", "KF900"]);
  });
});

describe("computeRecentActivities", () => {
  it("maps a lead into a lead_created activity using quoteNumber, falling back to project then leadKey for detail", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const withQuote = routeModule.computeRecentActivities(
      [lead({ id: 1, name: "คุณสมชาย", quoteNumber: "Sep 26 / US / 1", project: "บ้านสุขุมวิท", createdAt: "2026-09-20T00:00:00.000Z" })],
      [],
    );
    assert.deepEqual(withQuote[0], {
      id: "lead-1",
      type: "lead_created",
      title: "Lead ใหม่: คุณสมชาย",
      detail: "Sep 26 / US / 1",
      timestamp: "2026-09-20T00:00:00.000Z",
    });

    const withProjectOnly = routeModule.computeRecentActivities(
      [lead({ id: 2, name: "คุณมานี", quoteNumber: null, project: "คอนโดรัชดา", createdAt: "2026-09-20T00:00:00.000Z" })],
      [],
    );
    assert.equal(withProjectOnly[0]?.detail, "คอนโดรัชดา");

    const withLeadKeyOnly = routeModule.computeRecentActivities(
      [lead({ id: 3, leadKey: "lead-key-3", quoteNumber: null, project: null, createdAt: "2026-09-20T00:00:00.000Z" })],
      [],
    );
    assert.equal(withLeadKeyOnly[0]?.detail, "lead-key-3");
  });

  it("maps a non-voided slip into a payment_received activity, using verifiedAmountThb when verified and claimedAmountThb otherwise", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const verified = routeModule.computeRecentActivities(
      [],
      [slip({ id: 1, status: "verified", verifiedAmountThb: 32100, claimedAmountThb: 99999, senderName: "คุณเอ", createdAt: "2026-09-20T00:00:00.000Z" })],
    );
    assert.deepEqual(verified[0], {
      id: "slip-1",
      type: "payment_received",
      title: `ได้รับเงินโอน ฿${(32100).toLocaleString()}`,
      detail: "คุณเอ",
      timestamp: "2026-09-20T00:00:00.000Z",
    });

    const teamReported = routeModule.computeRecentActivities(
      [],
      [slip({ id: 2, status: "team_reported_paid", claimedAmountThb: 8500, verifiedAmountThb: null, senderName: null, createdAt: "2026-09-20T00:00:00.000Z" })],
    );
    assert.equal(teamReported[0]?.title, `ได้รับเงินโอน ฿${(8500).toLocaleString()}`);
    assert.equal(teamReported[0]?.detail, "รายงานผ่าน LINE", "falls back when senderName is missing");
  });

  it("excludes voided slips entirely", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const result = routeModule.computeRecentActivities(
      [],
      [slip({ id: 1, status: "voided", verifiedAmountThb: 50000, createdAt: "2026-09-20T00:00:00.000Z" })],
    );
    assert.deepEqual(result, []);
  });

  it("merges leads and slips and sorts the combined result by timestamp descending", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [
      lead({ id: 1, name: "เก่าสุด", createdAt: "2026-09-10T00:00:00.000Z" }),
      lead({ id: 2, name: "ใหม่สุด", createdAt: "2026-09-24T00:00:00.000Z" }),
    ];
    const slips = [
      slip({ id: 1, status: "verified", verifiedAmountThb: 1000, createdAt: "2026-09-20T00:00:00.000Z" }),
    ];
    const result = routeModule.computeRecentActivities(leads, slips);
    assert.deepEqual(result.map((activity) => activity.id), ["lead-2", "slip-1", "lead-1"]);
  });

  it("takes the newest 5 from each source independently before merging, then the newest 5 overall", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    // 8 leads, all newer than the 1 slip -- only the newest 5 leads become candidates,
    // and since none are older than the slip, the slip never makes the final top 5.
    const leads = Array.from({ length: 8 }, (_, index) =>
      lead({ id: index + 1, createdAt: `2026-09-${20 + index}T00:00:00.000Z` }));
    const slips = [slip({ id: 1, status: "verified", verifiedAmountThb: 1000, createdAt: "2026-09-01T00:00:00.000Z" })];
    const result = routeModule.computeRecentActivities(leads, slips);
    assert.equal(result.length, 5);
    assert.ok(result.every((activity) => activity.type === "lead_created"), "the older slip is crowded out entirely");
    assert.deepEqual(result.map((activity) => activity.id), ["lead-8", "lead-7", "lead-6", "lead-5", "lead-4"]);
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
      lead({ id: 1, status: "ready_for_production", quoteNumber: "Sep 26 / US / 1", expectedInstallationDate: "2026-09-25", productSkus: ["KF001"], createdAt: "2026-09-24T01:00:00.000Z" }),
      lead({ id: 2, status: "closed", quoteNumber: "Sep 26 / OF / 2", productSkus: ["KF001"], createdAt: "2026-09-23T01:00:00.000Z" }),
      lead({ id: 3, status: "new_lead", createdAt: "2026-09-22T01:00:00.000Z" }),
    ];
    const slips = [
      slip({ id: 1, status: "verified", verifiedAmountThb: 20000, leadId: 1, senderName: "คุณเอ", createdAt: "2026-09-24T02:00:00.000Z" }),
      slip({ id: 2, status: "pending", leadId: null, createdAt: "2026-09-21T00:00:00.000Z" }),
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
      assert.deepEqual(payload.popularItems, [{ sku: "KF001", count: 2 }]);
      // 3 leads + 2 non-voided slips = 5 candidates total, all within the top 5 overall.
      assert.deepEqual(payload.recentActivities.map((activity) => activity.id), ["slip-1", "lead-1", "lead-2", "lead-3", "slip-2"]);
      assert.equal(payload.recentActivities[0]?.type, "payment_received", "newest overall: the verified slip at 02:00");
      assert.equal(typeof payload.asOf, "string");
    } finally {
      await server.close();
    }
  });
});
