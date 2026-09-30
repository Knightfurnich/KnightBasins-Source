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
  siteMapsUrl: string | null;
  siteLat: number | null;
  siteLng: number | null;
};

type TechnicianCalendarStatus = "available" | "moderate" | "busy";

type TechnicianCalendarJob = {
  id: number;
  leadKey: string;
  name: string;
  project: string | null;
  address: string | null;
  quoteNumber: string | null;
  siteMapsUrl?: string | null;
  siteLat?: number | null;
  siteLng?: number | null;
};

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
      jobs: TechnicianCalendarJob[];
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
    siteMapsUrl: null,
    siteLat: null,
    siteLng: null,
    ...overrides,
  };
}

const tableName = (table: object) => table[Symbol.for("drizzle:Name") as keyof object] as string;

/** Same route-level fake as admin-technician-calendar.test.ts: select().from().where().orderBy() -> the given rows, unfiltered. technician_teams has no rows here -> loadTechnicianTeams() falls back to the 10-team seed. */
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
  process.env["ADMIN_PASSWORD"] = "admin-technician-calendar-maps-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-technician-calendar-maps-test";
  process.env["SESSION_SECRET"] = "admin-technician-calendar-maps-test-session-secret";
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("computeTechnicianCalendar: siteMapsUrl / siteLat / siteLng", () => {
  it("carries siteMapsUrl, siteLat, siteLng through to the team's job card when the lead has map coordinates", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [
      lead({
        id: 42,
        expectedInstallationDate: "2026-09-15",
        technicianTeamCode: "TP",
        siteMapsUrl: "https://maps.google.com/?q=13.7563,100.5018",
        siteLat: 13.7563,
        siteLng: 100.5018,
      }),
    ];
    const result = routeModule.computeTechnicianCalendar(leads, "2026-09");
    const job = result.days.find((d) => d.date === "2026-09-15")!.teams.find((t) => t.teamCode === "TP")!.jobs[0]!;
    assert.equal(job.siteMapsUrl, "https://maps.google.com/?q=13.7563,100.5018");
    assert.equal(job.siteLat, 13.7563);
    assert.equal(job.siteLng, 100.5018);
  });

  it("reports null siteMapsUrl, siteLat, siteLng when the lead has no map coordinates set", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const leads = [
      lead({ id: 1, expectedInstallationDate: "2026-09-15", technicianTeamCode: "TP" }),
    ];
    const result = routeModule.computeTechnicianCalendar(leads, "2026-09");
    const job = result.days.find((d) => d.date === "2026-09-15")!.teams.find((t) => t.teamCode === "TP")!.jobs[0]!;
    assert.equal(job.siteMapsUrl, null);
    assert.equal(job.siteLat, null);
    assert.equal(job.siteLng, null);
  });
});

describe("GET /admin/technician-calendar: siteMapsUrl", () => {
  it("returns siteMapsUrl (and siteLat/siteLng) for a job whose lead has map coordinates", async () => {
    const leads = [
      lead({
        id: 7,
        expectedInstallationDate: "2026-09-20",
        technicianTeamCode: "PP",
        siteMapsUrl: "https://maps.google.com/?q=13.75,100.50",
        siteLat: 13.75,
        siteLng: 100.50,
      }),
    ];
    const server = await startAdminRoute(createFakeCalendarDatabase(leads));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/technician-calendar?month=2026-09`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as TechnicianCalendarResponse;
      const day = payload.days.find((d) => d.date === "2026-09-20")!;
      const job = day.teams.find((t) => t.teamCode === "PP")!.jobs[0]!;
      assert.equal(job.siteMapsUrl, "https://maps.google.com/?q=13.75,100.50");
      assert.equal(job.siteLat, 13.75);
      assert.equal(job.siteLng, 100.50);
    } finally {
      await server.close();
    }
  });
});
