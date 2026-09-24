import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
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
  studioData: unknown;
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

type DashboardPeriod = "all" | "7d" | "30d" | "3m" | "year";

type AdminDashboardStats = {
  period: DashboardPeriod;
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
  popularStones: Array<{ sku: string; count: number }>;
  popularBasins: Array<{ sku: string; count: number }>;
  recentActivities: Array<{
    id: string;
    type: "lead_created" | "payment_received";
    title: string;
    detail: string;
    timestamp: string;
  }>;
  monthlyComparison: Array<{ monthLabel: string; revenueThb: number; leadCount: number }>;
  projectedCashInflowThb: number;
  technicianCapacity: Array<{
    teamCode: string;
    teamName: string;
    activeJobsCount: number;
    status: "busy" | "moderate" | "available";
    jobs: Array<{ id: number; leadKey: string; name: string; project: string | null; date: string }>;
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
  computePopularStones: (leads: DashboardLeadRow[]) => AdminDashboardStats["popularStones"];
  computePopularBasins: (leads: DashboardLeadRow[]) => AdminDashboardStats["popularBasins"];
  computeRecentActivities: (
    leads: DashboardLeadRow[],
    slips: DashboardSlipRow[],
  ) => AdminDashboardStats["recentActivities"];
  computeMonthlyComparison: (
    leads: DashboardLeadRow[],
    slips: DashboardSlipRow[],
    now: Date,
  ) => AdminDashboardStats["monthlyComparison"];
  computeProjectedCashInflowThb: (
    leads: DashboardLeadRow[],
    slips: DashboardSlipRow[],
    now: Date,
    windowDays?: number,
  ) => number;
  computeTechnicianCapacity: (
    leads: DashboardLeadRow[],
    now: Date,
    windowDays?: number,
  ) => AdminDashboardStats["technicianCapacity"];
  buildDashboardBriefingText: (stats: AdminDashboardStats, now: Date) => string;
  computeAdminDashboardStats: (
    leads: DashboardLeadRow[],
    slips: DashboardSlipRow[],
    now?: Date,
    period?: DashboardPeriod,
  ) => AdminDashboardStats;
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  LINE_MESSAGING_ACCESS_TOKEN: process.env["LINE_MESSAGING_ACCESS_TOKEN"],
  LINE_CHANNEL_ACCESS_TOKEN: process.env["LINE_CHANNEL_ACCESS_TOKEN"],
  LINE_SALES_DESTINATION_ID: process.env["LINE_SALES_DESTINATION_ID"],
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));
const realFetch = globalThis.fetch;

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
    studioData: null,
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

describe("computePopularStones vs computePopularBasins", () => {
  it("splits SKUs by the KF prefix: basins start with KF, everything else is a stone", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [
      lead({ id: 1, productSkus: ["KF001", "BW010", "MU005"] }),
      lead({ id: 2, productSkus: ["KF001", "BW010"] }),
      lead({ id: 3, productSkus: ["KF002"] }),
    ];
    assert.deepEqual(routeModule.computePopularBasins(leads), [
      { sku: "KF001", count: 2 },
      { sku: "KF002", count: 1 },
    ]);
    assert.deepEqual(routeModule.computePopularStones(leads), [
      { sku: "BW010", count: 2 },
      { sku: "MU005", count: 1 },
    ]);
  });

  it("treats the KF prefix case-insensitively", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [lead({ id: 1, productSkus: ["kf777"] })];
    assert.deepEqual(routeModule.computePopularBasins(leads), [{ sku: "kf777", count: 1 }]);
    assert.deepEqual(routeModule.computePopularStones(leads), []);
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

describe("computeMonthlyComparison", () => {
  it("labels the trailing 3 calendar months oldest-to-newest with the Thai abbreviation and 2-digit Buddhist year", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z"); // Bangkok: September 2026
    const result = routeModule.computeMonthlyComparison([], [], now);
    assert.deepEqual(result.map((row) => row.monthLabel), ["ก.ค. 69", "ส.ค. 69", "ก.ย. 69"]);
  });

  it("rolls the Buddhist year over correctly when the trailing window crosses a calendar year boundary", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-01-15T03:00:00.000Z"); // Bangkok: January 2026
    const result = routeModule.computeMonthlyComparison([], [], now);
    assert.deepEqual(result.map((row) => row.monthLabel), ["พ.ย. 68", "ธ.ค. 68", "ม.ค. 69"]);
  });

  it("attributes slip revenue and lead count to the month each createdAt falls in (Asia/Bangkok), summing verified + team_reported_paid only", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z");
    const leads = [
      lead({ id: 1, createdAt: "2026-08-15T00:00:00.000Z" }),
      lead({ id: 2, createdAt: "2026-09-01T00:00:00.000Z" }),
      lead({ id: 3, createdAt: "2026-09-10T00:00:00.000Z" }),
    ];
    const slips = [
      slip({ id: 1, status: "verified", verifiedAmountThb: 100000, createdAt: "2026-08-20T00:00:00.000Z" }),
      slip({ id: 2, status: "team_reported_paid", claimedAmountThb: 50000, createdAt: "2026-08-25T00:00:00.000Z" }),
      slip({ id: 3, status: "voided", verifiedAmountThb: 999999, createdAt: "2026-08-25T00:00:00.000Z" }),
      slip({ id: 4, status: "pending", claimedAmountThb: 999999, createdAt: "2026-08-25T00:00:00.000Z" }),
    ];
    const result = routeModule.computeMonthlyComparison(leads, slips, now);
    const august = result.find((row) => row.monthLabel === "ส.ค. 69");
    const september = result.find((row) => row.monthLabel === "ก.ย. 69");
    assert.deepEqual(august, { monthLabel: "ส.ค. 69", revenueThb: 150000, leadCount: 1 });
    assert.deepEqual(september, { monthLabel: "ก.ย. 69", revenueThb: 0, leadCount: 2 });
  });
});

describe("computeProjectedCashInflowThb", () => {
  it("sums quote total minus already-paid amounts for leads installing within the next 14 days", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z"); // Bangkok today: 2026-09-24, window end: 2026-10-08
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-10-01", studioData: { total: 50000 } }),
    ];
    const slips = [
      slip({ id: 1, leadId: 1, status: "verified", verifiedAmountThb: 20000 }),
    ];
    assert.equal(routeModule.computeProjectedCashInflowThb(leads, slips, now), 30000);
  });

  it("clamps to 0 instead of going negative when a lead has been overpaid", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z");
    const leads = [lead({ id: 1, expectedInstallationDate: "2026-10-01", studioData: { total: 10000 } })];
    const slips = [slip({ id: 1, leadId: 1, status: "verified", verifiedAmountThb: 15000 })];
    assert.equal(routeModule.computeProjectedCashInflowThb(leads, slips, now), 0);
  });

  it("excludes leads with no expectedInstallationDate, an installation outside the 14-day window, or no resolvable quote total", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z");
    const leads = [
      lead({ id: 1, expectedInstallationDate: null, studioData: { total: 50000 } }),
      lead({ id: 2, expectedInstallationDate: "2026-11-01", studioData: { total: 50000 } }), // outside 14 days
      lead({ id: 3, expectedInstallationDate: "2026-10-01", studioData: null }), // no quote total
    ];
    assert.equal(routeModule.computeProjectedCashInflowThb(leads, [], now), 0);
  });

  it("sums across multiple qualifying leads", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z");
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-09-30", studioData: { total: 30000 } }),
      lead({ id: 2, expectedInstallationDate: "2026-10-05", studioData: { estimate: { totalTHB: 20000 } } }),
    ];
    assert.equal(routeModule.computeProjectedCashInflowThb(leads, [], now), 50000);
  });
});

describe("computeTechnicianCapacity", () => {
  it("matches a team by its code as a whole word, and never matches a code substring inside a SKU", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z");
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-09-25", notes: "ทีม TP ไปติดตั้ง" }),
      lead({ id: 2, expectedInstallationDate: "2026-09-25", notes: "สั่ง SKU KF001 ไว้แล้ว" }), // must NOT match team KF
    ];
    const result = routeModule.computeTechnicianCapacity(leads, now);
    const tp = result.find((team) => team.teamCode === "TP")!;
    const kf = result.find((team) => team.teamCode === "KF")!;
    assert.equal(tp.activeJobsCount, 1);
    assert.equal(tp.jobs[0]?.id, 1);
    assert.equal(kf.activeJobsCount, 0, "\"KF001\" in notes must not be mistaken for team KF");
  });

  it("matches a team by its Thai name and by the 'ทีม<shortname>' pattern from the work order's own examples", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z");
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-09-25", project: "ช่างชัยยา ติดตั้งวันนี้" }),
      lead({ id: 2, expectedInstallationDate: "2026-09-25", notes: "ทีมเปา รับผิดชอบ" }),
      lead({ id: 3, expectedInstallationDate: "2026-09-25", notes: "ประสานกับแอนนี่แล้ว" }),
      lead({ id: 4, expectedInstallationDate: "2026-09-25", notes: "ทีมพร้อม รอคิวติดตั้ง" }),
      lead({ id: 5, expectedInstallationDate: "2026-09-25", notes: "ทีมโรงงาน ส่งลูกค้า" }),
      lead({ id: 6, expectedInstallationDate: "2026-09-25", notes: "ทีมออฟฟิศ เก็บงาน" }),
      lead({ id: 7, expectedInstallationDate: "2026-09-25", notes: "ทีมเจมส์ วัดงาน" }),
    ];
    const result = routeModule.computeTechnicianCapacity(leads, now);
    assert.equal(result.find((t) => t.teamCode === "CL")!.activeJobsCount, 1, "ช่างชัยยา -> CL");
    assert.equal(result.find((t) => t.teamCode === "PA")!.activeJobsCount, 1, "ทีมเปา -> PA");
    assert.equal(result.find((t) => t.teamCode === "TP")!.activeJobsCount, 1, "แอนนี่ (alias) -> TP");
    assert.equal(result.find((t) => t.teamCode === "PM")!.activeJobsCount, 1, "ทีมพร้อม -> PM");
    assert.equal(result.find((t) => t.teamCode === "KF")!.activeJobsCount, 2, "ทีมโรงงาน + ทีมออฟฟิศ -> KF");
    assert.equal(result.find((t) => t.teamCode === "CM")!.activeJobsCount, 1, "ทีมเจมส์ -> CM");
  });

  it("does not credit KF from a bare 'โรงงาน' mention that is not a team assignment", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z");
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-09-25", notes: "บ่ายไปรับแผ่นสีน้ำเงินโรงงานพี่อ้วนให้พี่หมู" }),
    ];
    const result = routeModule.computeTechnicianCapacity(leads, now);
    assert.equal(result.find((t) => t.teamCode === "KF")!.activeJobsCount, 0, "bare 'โรงงาน' must not imply team KF");
  });

  it("assigns status by job count: 0 available, 1-2 moderate, 3+ busy", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z");
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-09-25", notes: "TP" }),
      lead({ id: 2, expectedInstallationDate: "2026-09-26", notes: "TP" }),
      lead({ id: 3, expectedInstallationDate: "2026-09-25", notes: "PP" }),
    ];
    const result = routeModule.computeTechnicianCapacity(leads, now);
    assert.equal(result.find((t) => t.teamCode === "TP")!.status, "moderate", "2 jobs");
    assert.equal(result.find((t) => t.teamCode === "PP")!.status, "moderate", "1 job");
    assert.equal(result.find((t) => t.teamCode === "ST")!.status, "available", "0 jobs");

    const busyLeads = [
      lead({ id: 4, expectedInstallationDate: "2026-09-25", notes: "TP" }),
      lead({ id: 5, expectedInstallationDate: "2026-09-25", notes: "TP" }),
      lead({ id: 6, expectedInstallationDate: "2026-09-25", notes: "TP" }),
    ];
    const busyResult = routeModule.computeTechnicianCapacity(busyLeads, now);
    assert.equal(busyResult.find((t) => t.teamCode === "TP")!.status, "busy", "3 jobs");
  });

  it("only counts installations within the next 7 days, and always returns all 10 teams", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z");
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-10-05", notes: "TP" }), // outside 7 days
      lead({ id: 2, expectedInstallationDate: "2026-09-25", notes: "ไม่มีทีมระบุ" }), // no team match
    ];
    const result = routeModule.computeTechnicianCapacity(leads, now);
    assert.equal(result.length, 10);
    assert.deepEqual(result.map((t) => t.teamCode).sort(), ["AM", "CL", "CM", "KF", "PA", "PM", "PP", "ST", "TJ", "TP"]);
    assert.ok(result.every((team) => team.activeJobsCount === 0), "neither lead should be assigned to any team");
  });
});

describe("buildDashboardBriefingText", () => {
  it("includes cumulative revenue, total job count, and today's install queue grouped by team", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z");
    const leads = [lead({ id: 1, expectedInstallationDate: "2026-09-24", name: "คุณสมชาย", project: "บ้านสุขุมวิท", notes: "TP" })];
    const stats = routeModule.computeAdminDashboardStats(leads, [slip({ id: 1, status: "verified", verifiedAmountThb: 12345, leadId: 1 })], now);
    const text = routeModule.buildDashboardBriefingText(stats, now);
    assert.match(text, /12,345/);
    assert.match(text, /จำนวนงานทั้งหมด: 1 งาน/);
    assert.match(text, /ช่างยี่/);
    assert.match(text, /คุณสมชาย/);
  });

  it("shows a fallback line when no team has an installation scheduled today", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const now = new Date("2026-09-24T03:00:00.000Z");
    const stats = routeModule.computeAdminDashboardStats([], [], now);
    const text = routeModule.buildDashboardBriefingText(stats, now);
    assert.match(text, /ไม่มีคิวติดตั้งวันนี้/);
  });
});

describe("computeAdminDashboardStats period filter", () => {
  const now = new Date("2026-09-24T03:00:00.000Z"); // Bangkok: 2026-09-24
  const leadOutsideEverything = lead({ id: 1, createdAt: "2025-06-01T00:00:00.000Z" }); // 2025 - outside year/3m/7d
  const leadEarlyThisYear = lead({ id: 2, createdAt: "2026-01-05T00:00:00.000Z" }); // within year only
  const leadWithinThreeMonths = lead({ id: 3, createdAt: "2026-08-15T00:00:00.000Z" }); // within year + 3m, outside 7d
  const leadWithinSevenDays = lead({ id: 4, createdAt: "2026-09-20T00:00:00.000Z" }); // within all windows
  const leads = [leadOutsideEverything, leadEarlyThisYear, leadWithinThreeMonths, leadWithinSevenDays];

  it("period 'all' (the default) includes every lead", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const stats = routeModule.computeAdminDashboardStats(leads, [], now);
    assert.equal(stats.period, "all");
    assert.equal(stats.kpis.totalLeads, 4);
  });

  it("period 'year' includes only leads created this calendar year (Jan 1 - Dec 31, Asia/Bangkok)", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const stats = routeModule.computeAdminDashboardStats(leads, [], now, "year");
    assert.equal(stats.period, "year");
    assert.equal(stats.kpis.totalLeads, 3);
  });

  it("period '3m' includes only leads from the 1st of the month 2 months back through the end of this month", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const stats = routeModule.computeAdminDashboardStats(leads, [], now, "3m");
    assert.equal(stats.period, "3m");
    assert.equal(stats.kpis.totalLeads, 2);
  });

  it("period '7d' includes only leads created in the trailing 7 days", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const stats = routeModule.computeAdminDashboardStats(leads, [], now, "7d");
    assert.equal(stats.period, "7d");
    assert.equal(stats.kpis.totalLeads, 1);
  });

  it("does not filter upcomingInstallations, technicianCapacity, monthlyComparison, or projectedCashInflowThb by period", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leadsWithInstallation = [
      ...leads,
      lead({ id: 5, createdAt: "2025-01-01T00:00:00.000Z", expectedInstallationDate: "2026-09-25", notes: "TP" }),
    ];
    const allPeriod = routeModule.computeAdminDashboardStats(leadsWithInstallation, [], now, "all");
    const sevenDayPeriod = routeModule.computeAdminDashboardStats(leadsWithInstallation, [], now, "7d");
    assert.deepEqual(allPeriod.upcomingInstallations, sevenDayPeriod.upcomingInstallations);
    assert.deepEqual(allPeriod.technicianCapacity, sevenDayPeriod.technicianCapacity);
    assert.deepEqual(allPeriod.monthlyComparison, sevenDayPeriod.monthlyComparison);
    assert.equal(allPeriod.projectedCashInflowThb, sevenDayPeriod.projectedCashInflowThb);
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
      assert.equal(payload.period, "all");
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
      assert.deepEqual(payload.popularBasins, [{ sku: "KF001", count: 2 }]);
      assert.deepEqual(payload.popularStones, []);
      assert.equal(payload.monthlyComparison.length, 3);
      assert.equal(typeof payload.projectedCashInflowThb, "number");
      assert.equal(payload.technicianCapacity.length, 10);
      // 3 leads + 2 non-voided slips = 5 candidates total, all within the top 5 overall.
      assert.deepEqual(payload.recentActivities.map((activity) => activity.id), ["slip-1", "lead-1", "lead-2", "lead-3", "slip-2"]);
      assert.equal(payload.recentActivities[0]?.type, "payment_received", "newest overall: the verified slip at 02:00");
      assert.equal(typeof payload.asOf, "string");
    } finally {
      await server.close();
    }
  });

  it("filters the snapshot fields when a valid ?period= is given, and falls back to 'all' for an unrecognized value", async () => {
    const leads = [
      lead({ id: 1, createdAt: "2025-01-01T00:00:00.000Z" }),
      lead({ id: 2, createdAt: "2026-09-20T00:00:00.000Z" }),
    ];
    const server = await startAdminRoute(createFakeDashboardDatabase(leads, []));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const filtered = await fetch(`${server.url}/api/admin/dashboard-stats?period=7d`, { headers: { cookie } });
      const filteredPayload = await filtered.json() as AdminDashboardStats;
      assert.equal(filteredPayload.period, "7d");

      const garbage = await fetch(`${server.url}/api/admin/dashboard-stats?period=not-a-real-period`, { headers: { cookie } });
      const garbagePayload = await garbage.json() as AdminDashboardStats;
      assert.equal(garbagePayload.period, "all");
      assert.equal(garbagePayload.kpis.totalLeads, 2);
    } finally {
      await server.close();
    }
  });
});

describe("POST /admin/dashboard-briefing/line", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeDashboardDatabase([], []));
    try {
      const response = await fetch(`${server.url}/api/admin/dashboard-briefing/line`, { method: "POST" });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("pushes the briefing to the LINE Messaging API and returns success + deliveredAt when configured", async () => {
    process.env["LINE_MESSAGING_ACCESS_TOKEN"] = "test-line-token";
    process.env["LINE_SALES_DESTINATION_ID"] = "test-destination";
    let capturedUrl = "";
    let capturedAuth = "";
    let capturedBody: Record<string, unknown> = {};
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes("api.line.me")) return realFetch(input as never, init);
      capturedUrl = url;
      capturedAuth = (init?.headers as Record<string, string>)["Authorization"];
      capturedBody = JSON.parse(String(init?.body));
      return new Response("{}", { status: 200 });
    });
    const leads = [lead({ id: 1, status: "ready_for_production" })];
    const server = await startAdminRoute(createFakeDashboardDatabase(leads, []));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/dashboard-briefing/line`, { method: "POST", headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as { success: boolean; deliveredAt: string };
      assert.equal(payload.success, true);
      assert.equal(typeof payload.deliveredAt, "string");
      assert.equal(capturedUrl, "https://api.line.me/v2/bot/message/push");
      assert.equal(capturedAuth, "Bearer test-line-token");
      assert.equal(capturedBody["to"], "test-destination");
      const messages = capturedBody["messages"] as Array<{ type: string; text: string }>;
      assert.equal(messages[0]?.type, "text");
      assert.match(messages[0]?.text ?? "", /Knight Basins Dashboard Briefing/);
    } finally {
      await server.close();
      mock.restoreAll();
    }
  });

  it("returns 502 without calling fetch when LINE is not configured", async () => {
    delete process.env["LINE_MESSAGING_ACCESS_TOKEN"];
    delete process.env["LINE_CHANNEL_ACCESS_TOKEN"];
    delete process.env["LINE_SALES_DESTINATION_ID"];
    let called = false;
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes("api.line.me")) called = true;
      return realFetch(input as never, init);
    });
    const server = await startAdminRoute(createFakeDashboardDatabase([], []));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/dashboard-briefing/line`, { method: "POST", headers: { cookie } });
      assert.equal(response.status, 502);
      assert.equal(called, false);
    } finally {
      await server.close();
      mock.restoreAll();
    }
  });

  it("returns 502 when the LINE push request itself fails", async () => {
    process.env["LINE_MESSAGING_ACCESS_TOKEN"] = "test-line-token";
    process.env["LINE_SALES_DESTINATION_ID"] = "test-destination";
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      if (!String(input).includes("api.line.me")) return realFetch(input as never, init);
      return new Response("{}", { status: 500 });
    });
    const server = await startAdminRoute(createFakeDashboardDatabase([], []));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/dashboard-briefing/line`, { method: "POST", headers: { cookie } });
      assert.equal(response.status, 502);
    } finally {
      await server.close();
      mock.restoreAll();
    }
  });
});
