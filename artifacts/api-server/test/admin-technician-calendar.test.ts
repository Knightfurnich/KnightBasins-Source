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
  studioData: unknown;
  technicianTeamCode: string | null;
};

type TechnicianCalendarStatus = "available" | "moderate" | "busy";

type TechnicianCalendarResponse = {
  month: string;
  days: Array<{
    date: string;
    dayStatus: TechnicianCalendarStatus;
    totalJobs: number;
    teams: Array<{
      teamCode: string;
      teamName: string;
      status: TechnicianCalendarStatus;
      jobCount: number;
      jobs: Array<{ id: number; leadKey: string; name: string; project: string | null; address: string | null; quoteNumber: string | null }>;
    }>;
  }>;
  technicianTeams: Array<{ teamCode: string; teamName: string }>;
};

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
  computeTechnicianCalendar: (leads: DashboardLeadRow[], month: string) => TechnicianCalendarResponse;
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));
const ALL_TEAM_CODES = ["TP", "PP", "ST", "CM", "KF", "PA", "PM", "TJ", "AM", "CL"];

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
    technicianTeamCode: null,
    ...overrides,
  };
}

type FakeLeadRecord = {
  id: number;
  technicianTeamCode: string | null;
  expectedInstallationDate?: string | null;
  status?: string;
  updatedAt?: unknown;
};

const tableName = (table: object) => table[Symbol.for("drizzle:Name") as keyof object] as string;

/** Route-level fake for GET /admin/technician-calendar: select().from().where().orderBy() -> the given rows, unfiltered (date-range filtering is covered by computeTechnicianCalendar's own unit tests). technician_teams has no rows here -> loadTechnicianTeams() falls back to the 10-team seed. */
function createFakeCalendarDatabase(leads: DashboardLeadRow[]) {
  return {
    select: () => ({
      from: (table: object) => {
        const rows = tableName(table) === "technician_teams" ? [] : leads;
        return { where: () => ({ orderBy: async () => rows }) };
      },
    }),
  };
}

/** Route-level fake for PATCH /admin/leads/:id/technician. technician_teams has no rows here -> loadTechnicianTeams(true) falls back to the 10-team seed, so the 10 real codes still validate. */
function createFakeLeadDatabase(record: FakeLeadRecord | null) {
  let current = record;
  return {
    select: () => ({
      from: () => ({
        where: () => ({ orderBy: async () => [] }),
      }),
    }),
    update: () => {
      let changes: Record<string, unknown> = {};
      const builder = {
        set(values: Record<string, unknown>) {
          changes = values;
          return builder;
        },
        where: () => ({
          returning: async () => {
            if (!current) return [];
            current = { ...current, ...changes } as FakeLeadRecord;
            return [current];
          },
        }),
      };
      return builder;
    },
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
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

before(() => {
  process.env["ADMIN_PASSWORD"] = "admin-technician-calendar-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-technician-calendar-test";
  process.env["SESSION_SECRET"] = "admin-technician-calendar-test-session-secret";
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("computeTechnicianCalendar", () => {
  it("returns one entry per calendar day, all 10 teams every day, even with zero leads", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const result = routeModule.computeTechnicianCalendar([], "2026-09");
    assert.equal(result.month, "2026-09");
    assert.equal(result.days.length, 30, "September has 30 days");
    assert.equal(result.days[0]?.date, "2026-09-01");
    assert.equal(result.days[29]?.date, "2026-09-30");
    assert.deepEqual(result.technicianTeams.map((t) => t.teamCode).sort(), [...ALL_TEAM_CODES].sort());
    assert.ok(result.days.every((day) => day.teams.length === 10), "every day must list all 10 teams");
  });

  it("handles February in a leap year (29 days) and a non-leap year (28 days)", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    assert.equal(routeModule.computeTechnicianCalendar([], "2028-02").days.length, 29, "2028 is a leap year");
    assert.equal(routeModule.computeTechnicianCalendar([], "2026-02").days.length, 28, "2026 is not a leap year");
  });

  it("prefers the explicit technicianTeamCode column over the notes/project regex guess", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-09-15", technicianTeamCode: "PP", notes: "ทีมเปา รับผิดชอบ" }),
    ];
    const result = routeModule.computeTechnicianCalendar(leads, "2026-09");
    const day = result.days.find((d) => d.date === "2026-09-15")!;
    assert.equal(day.teams.find((t) => t.teamCode === "PP")!.jobCount, 1, "explicit column (PP) wins over notes-guessed PA");
    assert.equal(day.teams.find((t) => t.teamCode === "PA")!.jobCount, 0);
  });

  it("falls back to the notes/project regex match when technicianTeamCode is null (pre-migration leads)", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-09-15", technicianTeamCode: null, notes: "ทีม TP ไปติดตั้ง" }),
    ];
    const result = routeModule.computeTechnicianCalendar(leads, "2026-09");
    const day = result.days.find((d) => d.date === "2026-09-15")!;
    assert.equal(day.teams.find((t) => t.teamCode === "TP")!.jobCount, 1);
  });

  it("counts an unmatched lead toward totalJobs for the day without crediting any team", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [lead({ id: 1, expectedInstallationDate: "2026-09-15", technicianTeamCode: null, notes: "ยังไม่ได้มอบหมาย" })];
    const result = routeModule.computeTechnicianCalendar(leads, "2026-09");
    const day = result.days.find((d) => d.date === "2026-09-15")!;
    assert.equal(day.totalJobs, 1);
    assert.ok(day.teams.every((team) => team.jobCount === 0), "no team should be credited");
  });

  it("assigns team status by job count that day: 0 available, 1-2 moderate, 3+ busy", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-09-15", technicianTeamCode: "TP" }),
      lead({ id: 2, expectedInstallationDate: "2026-09-15", technicianTeamCode: "TP" }),
      lead({ id: 3, expectedInstallationDate: "2026-09-15", technicianTeamCode: "PP" }),
    ];
    const result = routeModule.computeTechnicianCalendar(leads, "2026-09");
    const day = result.days.find((d) => d.date === "2026-09-15")!;
    assert.equal(day.teams.find((t) => t.teamCode === "TP")!.status, "moderate", "2 jobs");
    assert.equal(day.teams.find((t) => t.teamCode === "PP")!.status, "moderate", "1 job");
    assert.equal(day.teams.find((t) => t.teamCode === "ST")!.status, "available", "0 jobs");

    const withThird = routeModule.computeTechnicianCalendar([
      ...leads,
      lead({ id: 4, expectedInstallationDate: "2026-09-15", technicianTeamCode: "TP" }),
    ], "2026-09").days.find((d) => d.date === "2026-09-15")!;
    assert.equal(withThird.teams.find((t) => t.teamCode === "TP")!.status, "busy", "3 jobs");
  });

  it("day status: available at 0 jobs, busy at >=4 total jobs even if no single team is full", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const empty = routeModule.computeTechnicianCalendar([], "2026-09").days.find((d) => d.date === "2026-09-15")!;
    assert.equal(empty.dayStatus, "available");

    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-09-15", technicianTeamCode: "TP" }),
      lead({ id: 2, expectedInstallationDate: "2026-09-15", technicianTeamCode: "PP" }),
      lead({ id: 3, expectedInstallationDate: "2026-09-15", technicianTeamCode: "ST" }),
      lead({ id: 4, expectedInstallationDate: "2026-09-15", technicianTeamCode: "CM" }),
    ];
    const day = routeModule.computeTechnicianCalendar(leads, "2026-09").days.find((d) => d.date === "2026-09-15")!;
    assert.equal(day.totalJobs, 4);
    assert.ok(day.teams.every((t) => t.status !== "busy"), "no single team has 3+ jobs");
    assert.equal(day.dayStatus, "busy", "4 total jobs is busy regardless of per-team spread");
  });

  it("day status: busy when any single team is full (>=3), even if the day total is under 4", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-09-15", technicianTeamCode: "TP" }),
      lead({ id: 2, expectedInstallationDate: "2026-09-15", technicianTeamCode: "TP" }),
      lead({ id: 3, expectedInstallationDate: "2026-09-15", technicianTeamCode: "TP" }),
    ];
    const day = routeModule.computeTechnicianCalendar(leads, "2026-09").days.find((d) => d.date === "2026-09-15")!;
    assert.equal(day.totalJobs, 3, "total is under 4");
    assert.equal(day.dayStatus, "busy", "but team TP alone is full");
  });

  it("day status: moderate for 1-3 total jobs spread across teams with none full", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-09-15", technicianTeamCode: "TP" }),
      lead({ id: 2, expectedInstallationDate: "2026-09-15", technicianTeamCode: "PP" }),
    ];
    const day = routeModule.computeTechnicianCalendar(leads, "2026-09").days.find((d) => d.date === "2026-09-15")!;
    assert.equal(day.dayStatus, "moderate");
  });

  it("keeps each day's jobs isolated to that exact date", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-09-14", technicianTeamCode: "TP" }),
      lead({ id: 2, expectedInstallationDate: "2026-09-15", technicianTeamCode: "TP" }),
    ];
    const result = routeModule.computeTechnicianCalendar(leads, "2026-09");
    assert.equal(result.days.find((d) => d.date === "2026-09-14")!.teams.find((t) => t.teamCode === "TP")!.jobCount, 1);
    assert.equal(result.days.find((d) => d.date === "2026-09-15")!.teams.find((t) => t.teamCode === "TP")!.jobCount, 1);
  });

  it("ignores leads with no expectedInstallationDate", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [lead({ id: 1, expectedInstallationDate: null, technicianTeamCode: "TP" })];
    const result = routeModule.computeTechnicianCalendar(leads, "2026-09");
    assert.ok(result.days.every((day) => day.totalJobs === 0));
  });

  it("carries job detail fields (leadKey, name, project, address, quoteNumber) through to the team's jobs array", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [
      lead({
        id: 42,
        leadKey: "lead-key-42",
        expectedInstallationDate: "2026-09-15",
        technicianTeamCode: "TP",
        name: "คุณสมชาย",
        project: "บ้านสุขุมวิท",
        address: "123 ถ.สุขุมวิท",
        quoteNumber: "Sep 26 / US / 42",
      }),
    ];
    const result = routeModule.computeTechnicianCalendar(leads, "2026-09");
    const job = result.days.find((d) => d.date === "2026-09-15")!.teams.find((t) => t.teamCode === "TP")!.jobs[0];
    assert.deepEqual(job, {
      id: 42,
      leadKey: "lead-key-42",
      name: "คุณสมชาย",
      project: "บ้านสุขุมวิท",
      address: "123 ถ.สุขุมวิท",
      quoteNumber: "Sep 26 / US / 42",
    });
  });
});

describe("GET /admin/technician-calendar", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeCalendarDatabase([]));
    try {
      const response = await fetch(`${server.url}/api/admin/technician-calendar?month=2026-09`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("rejects a missing month parameter", async () => {
    const server = await startAdminRoute(createFakeCalendarDatabase([]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/technician-calendar`, { headers: { cookie } });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects a malformed month parameter", async () => {
    const server = await startAdminRoute(createFakeCalendarDatabase([]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      for (const month of ["2026-9", "26-09", "2026/09", "not-a-month", "2026-00", "2026-13"]) {
        const response = await fetch(`${server.url}/api/admin/technician-calendar?month=${encodeURIComponent(month)}`, { headers: { cookie } });
        assert.equal(response.status, 400, `"${month}" should be rejected`);
      }
    } finally {
      await server.close();
    }
  });

  it("returns the full month grid for a valid month", async () => {
    const leads = [lead({ id: 1, expectedInstallationDate: "2026-09-15", technicianTeamCode: "TP" })];
    const server = await startAdminRoute(createFakeCalendarDatabase(leads));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/technician-calendar?month=2026-09`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as TechnicianCalendarResponse;
      assert.equal(payload.month, "2026-09");
      assert.equal(payload.days.length, 30);
      const day = payload.days.find((d) => d.date === "2026-09-15")!;
      assert.equal(day.teams.find((t) => t.teamCode === "TP")!.jobCount, 1);
    } finally {
      await server.close();
    }
  });
});

describe("PATCH /admin/leads/:id/technician", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, technicianTeamCode: null }));
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/technician`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ technicianTeamCode: "TP" }),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("accepts every one of the 10 real team codes", async () => {
    const cookie = `knight_admin_session=${createAdminToken()}`;
    for (const teamCode of ALL_TEAM_CODES) {
      const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, technicianTeamCode: null }));
      try {
        const response = await fetch(`${server.url}/api/admin/leads/1/technician`, {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ technicianTeamCode: teamCode }),
        });
        assert.equal(response.status, 200, `team code "${teamCode}" should be accepted`);
        const payload = await response.json() as FakeLeadRecord;
        assert.equal(payload.technicianTeamCode, teamCode);
      } finally {
        await server.close();
      }
    }
  });

  it("accepts null to clear an assignment back to unassigned", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, technicianTeamCode: "TP" }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/technician`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ technicianTeamCode: null }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json() as FakeLeadRecord;
      assert.equal(payload.technicianTeamCode, null);
    } finally {
      await server.close();
    }
  });

  it("rejects a team code outside the real 10-team domain", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, technicianTeamCode: null }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/technician`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ technicianTeamCode: "ZZ" }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects a body with neither technicianTeamCode nor expectedInstallationDate", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, technicianTeamCode: null }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/technician`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("updates only expectedInstallationDate, leaving technicianTeamCode untouched (backward compatible: technicianTeamCode-only calls still work alone)", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, technicianTeamCode: "TP", expectedInstallationDate: "2026-09-01" }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/technician`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ expectedInstallationDate: "2026-10-15" }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json() as FakeLeadRecord;
      assert.equal(payload.expectedInstallationDate, "2026-10-15");
      assert.equal(payload.technicianTeamCode, "TP", "team code must be untouched when only the date is sent");
    } finally {
      await server.close();
    }
  });

  it("updates technicianTeamCode and expectedInstallationDate together in one call", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, technicianTeamCode: null, expectedInstallationDate: null }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/technician`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ technicianTeamCode: "PP", expectedInstallationDate: "2026-11-03" }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json() as FakeLeadRecord;
      assert.equal(payload.technicianTeamCode, "PP");
      assert.equal(payload.expectedInstallationDate, "2026-11-03");
    } finally {
      await server.close();
    }
  });

  it("clears expectedInstallationDate to null", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, technicianTeamCode: "TP", expectedInstallationDate: "2026-09-01" }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/technician`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ expectedInstallationDate: null }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json() as FakeLeadRecord;
      assert.equal(payload.expectedInstallationDate, null);
      assert.equal(payload.technicianTeamCode, "TP", "team code must be untouched when only the date is cleared");
    } finally {
      await server.close();
    }
  });

  it("rejects a malformed expectedInstallationDate", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, technicianTeamCode: null }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      for (const badDate of ["2026-9-1", "2026/09/01", "26-09-01", "not-a-date", ""]) {
        const response = await fetch(`${server.url}/api/admin/leads/1/technician`, {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ expectedInstallationDate: badDate }),
        });
        assert.equal(response.status, 400, `"${badDate}" should be rejected`);
      }
    } finally {
      await server.close();
    }
  });

  it("rejects a non-numeric lead id", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, technicianTeamCode: null }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/not-a-number/technician`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ technicianTeamCode: "TP" }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("returns 404 when the lead does not exist", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase(null));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/999/technician`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ technicianTeamCode: "TP" }),
      });
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });
});

/**
 * Not called out by name in the work order's EVIDENCE list (which only
 * enumerates PATCH /admin/leads/:id/technician cases), but GET /admin/leads
 * is in this same work order's SCOPE, so it gets baseline coverage here too
 * rather than shipping the new filter untested.
 */
describe("GET /admin/leads?technicianTeamCode", () => {
  type FakeListLead = { id: number; quoteNumber: string | null; quoteAccessSecret: string | null; technicianTeamCode: string | null };

  function createFakeLeadsListDatabase(leads: FakeListLead[]) {
    let capturedWhere: unknown = "not-called";
    return {
      capturedWhere: () => capturedWhere,
      select: () => ({
        from: () => ({
          where: (condition: unknown) => {
            capturedWhere = condition;
            return { orderBy: async () => leads };
          },
        }),
      }),
    };
  }

  const SAMPLE_LEADS: FakeListLead[] = [
    { id: 1, quoteNumber: null, quoteAccessSecret: null, technicianTeamCode: "TP" },
    { id: 2, quoteNumber: null, quoteAccessSecret: null, technicianTeamCode: null },
  ];

  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeLeadsListDatabase(SAMPLE_LEADS));
    try {
      const response = await fetch(`${server.url}/api/admin/leads`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("queries with no filter condition when technicianTeamCode is omitted (backward compatible)", async () => {
    const db = createFakeLeadsListDatabase(SAMPLE_LEADS);
    const server = await startAdminRoute(db);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as FakeListLead[];
      assert.equal(payload.length, 2);
      assert.equal(db.capturedWhere(), undefined, "no WHERE condition should be built when the filter is absent");
    } finally {
      await server.close();
    }
  });

  it("builds a filter condition for a real team code", async () => {
    const db = createFakeLeadsListDatabase(SAMPLE_LEADS);
    const server = await startAdminRoute(db);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads?technicianTeamCode=TP`, { headers: { cookie } });
      assert.equal(response.status, 200);
      assert.notEqual(db.capturedWhere(), undefined, "a WHERE condition should be built for a team filter");
    } finally {
      await server.close();
    }
  });

  it("builds a filter condition for technicianTeamCode=unassigned", async () => {
    const db = createFakeLeadsListDatabase(SAMPLE_LEADS);
    const server = await startAdminRoute(db);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads?technicianTeamCode=unassigned`, { headers: { cookie } });
      assert.equal(response.status, 200);
      assert.notEqual(db.capturedWhere(), undefined, "a WHERE condition should be built for the unassigned filter");
    } finally {
      await server.close();
    }
  });

  it("rejects a technicianTeamCode outside the 10 real codes and \"unassigned\"", async () => {
    const db = createFakeLeadsListDatabase(SAMPLE_LEADS);
    const server = await startAdminRoute(db);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads?technicianTeamCode=ZZ`, { headers: { cookie } });
      assert.equal(response.status, 400);
      assert.equal(db.capturedWhere(), "not-called", "an invalid filter must be rejected before the database is ever queried");
    } finally {
      await server.close();
    }
  });
});
