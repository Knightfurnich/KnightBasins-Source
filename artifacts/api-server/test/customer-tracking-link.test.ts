import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { customerLeads, sitePhotos } from "@workspace/db/schema";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};
type LeadRouteModule = typeof import("../src/routes/leads.ts");
type QuoteAccessModule = typeof import("../src/lib/quote-access.ts");

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};

before(() => {
  process.env["ADMIN_PASSWORD"] = "tracking-link-test-password";
  process.env["DATABASE_URL"] = "postgres://tracking-link-test";
  process.env["SESSION_SECRET"] = "tracking-link-test-session-secret";
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function startServer(
  use: (app: express.Express) => void,
): Promise<{ url: string; close: () => Promise<void> }> {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  use(app);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

type FakeAdminLeadRow = {
  id: number;
  quoteNumber: string | null;
  quoteAccessSecret: string | null;
  createdAt: Date;
};

/** Mirrors createFakeLeadDatabase in admin-leads-route.test.ts: a single mutable
 * record that select()/update() operate on, ignoring where-predicates since each
 * test only ever seeds the one lead relevant to it. */
function createFakeTrackingLinkDatabase(initial: FakeAdminLeadRow | null) {
  let record = initial ? { ...initial } : null;
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (record ? [record] : []),
        }),
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
            if (!record) return [];
            record = { ...record, ...changes } as FakeAdminLeadRow;
            return [record];
          },
        }),
      };
      return builder;
    },
  };
}

async function startAdminRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<AdminRouteModule>("src/routes/admin-router.ts");
  return startServer((app) => app.use("/api", routeModule.createAdminRouter(database)));
}

describe("GET /api/admin/leads/:id/tracking-link", () => {
  it("creates a quoteAccessSecret automatically and returns an available link", async () => {
    const server = await startAdminRoute(
      createFakeTrackingLinkDatabase({
        id: 501,
        quoteNumber: "Sep 30 / US / 501",
        quoteAccessSecret: null,
        createdAt: new Date("2026-09-20T03:00:00.000Z"),
      }),
    );
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/501/tracking-link`, {
        headers: { cookie },
      });
      assert.equal(response.status, 200);
      const body = await response.json() as {
        available: boolean;
        path: string;
        token: string;
        quoteNumber: string;
        createdAt: string;
      };
      assert.equal(body.available, true);
      assert.equal(body.quoteNumber, "Sep 30 / US / 501");
      assert.ok(body.token, "expected a token to be returned");
      assert.equal(body.path, `/track?token=${encodeURIComponent(body.token)}`);

      const quoteAccess = await importTypeScriptModule<QuoteAccessModule>("src/lib/quote-access.ts");
      const decoded = quoteAccess.verifyPublicQuoteToken(body.token);
      assert.ok(decoded, "the returned token must verify");
      assert.equal(decoded?.quoteNumber, "Sep 30 / US / 501");
      assert.match(decoded?.accessSecret ?? "", /^[a-f0-9]{64}$/);
    } finally {
      await server.close();
    }
  });

  it("returns available:false with a reason (never 500) when the lead has no quoteNumber", async () => {
    const server = await startAdminRoute(
      createFakeTrackingLinkDatabase({
        id: 502,
        quoteNumber: null,
        quoteAccessSecret: null,
        createdAt: new Date("2026-09-20T03:00:00.000Z"),
      }),
    );
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/502/tracking-link`, {
        headers: { cookie },
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { available: boolean; reason?: string };
      assert.equal(body.available, false);
      assert.ok(body.reason && body.reason.length > 0, "expected a human-readable reason");
    } finally {
      await server.close();
    }
  });

  it("returns 404 when the lead does not exist", async () => {
    const server = await startAdminRoute(createFakeTrackingLinkDatabase(null));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/999999/tracking-link`, {
        headers: { cookie },
      });
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });
});

type FakePublicLeadRow = {
  id: number;
  quoteNumber: string;
  quoteAccessSecret: string;
  name: string | null;
  project: string | null;
  phone: string | null;
  status: string;
  studioData: unknown;
  trackingViewCount: number | null;
  trackingViewedAt: Date | null;
};

function createFakePublicTrackDatabase(
  lead: FakePublicLeadRow | null,
  options: { updateThrows?: boolean } = {},
) {
  const updateCalls: Array<Record<string, unknown>> = [];
  return {
    updateCalls,
    select: (_columns?: unknown) => ({
      from: (table: unknown) => {
        if (table === sitePhotos) {
          return { where: () => ({ orderBy: async () => [] }) };
        }
        return { where: () => ({ limit: async () => (lead ? [lead] : []) }) };
      },
    }),
    update: (_table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        updateCalls.push(values);
        return {
          where: async () => {
            if (options.updateThrows) throw new Error("simulated tracking update failure");
            if (lead) Object.assign(lead, values);
            return undefined;
          },
        };
      },
    }),
  };
}

async function startLeadsRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
  return startServer((app) => app.use("/api", routeModule.createLeadsRouter(database as never)));
}

async function tokenFor(quoteNumber: string, accessSecret: string) {
  const quoteAccess = await importTypeScriptModule<QuoteAccessModule>("src/lib/quote-access.ts");
  return quoteAccess.createPublicQuoteToken(quoteNumber, accessSecret);
}

function basePublicLead(overrides: Partial<FakePublicLeadRow> = {}): FakePublicLeadRow {
  return {
    id: 77,
    quoteNumber: "Sep 30 / US / 777",
    quoteAccessSecret: "a".repeat(64),
    name: "คุณทดสอบ",
    project: "คอนโดทดสอบ",
    phone: "0812345678",
    status: "in_production",
    studioData: null,
    trackingViewCount: 0,
    trackingViewedAt: null,
    ...overrides,
  };
}

describe("GET /api/public/track tracking view log", () => {
  it("increments tracking_view_count and sets tracking_viewed_at, without touching status", async () => {
    const lead = basePublicLead();
    const database = createFakePublicTrackDatabase(lead);
    const server = await startLeadsRoute(database);
    try {
      const token = await tokenFor(lead.quoteNumber, lead.quoteAccessSecret);
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(token)}`);
      assert.equal(response.status, 200);

      assert.equal(database.updateCalls.length, 1);
      const [values] = database.updateCalls;
      assert.deepEqual(Object.keys(values).sort(), ["trackingViewCount", "trackingViewedAt"]);
      assert.equal(values["trackingViewCount"], 1);
      assert.ok(values["trackingViewedAt"] instanceof Date);

      assert.equal(lead.trackingViewCount, 1);
      assert.ok(lead.trackingViewedAt instanceof Date);
      assert.equal(lead.status, "in_production", "status must never change from a tracking view");
    } finally {
      await server.close();
    }
  });

  it("still returns 200 with normal data when the view-count update fails", async () => {
    const lead = basePublicLead();
    const database = createFakePublicTrackDatabase(lead, { updateThrows: true });
    const server = await startLeadsRoute(database);
    try {
      const token = await tokenFor(lead.quoteNumber, lead.quoteAccessSecret);
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(token)}`);
      assert.equal(response.status, 200);
      const body = await response.json() as { jobCode: string };
      assert.equal(body.jobCode, lead.quoteNumber);
    } finally {
      await server.close();
    }
  });

  it("returns 404 when no lead matches the token (no tracking update attempted)", async () => {
    const database = createFakePublicTrackDatabase(null);
    const server = await startLeadsRoute(database);
    try {
      const token = await tokenFor("Sep 30 / US / 999", "b".repeat(64));
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(token)}`);
      assert.equal(response.status, 404);
      assert.equal(database.updateCalls.length, 0);
    } finally {
      await server.close();
    }
  });
});
