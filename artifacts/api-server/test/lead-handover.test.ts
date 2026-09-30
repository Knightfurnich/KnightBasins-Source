import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { sitePhotos } from "@workspace/db/schema";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

type LeadRouteModule = typeof import("../src/routes/leads.ts");
type QuoteAccessModule = typeof import("../src/lib/quote-access.ts");

type FakeLeadRecord = {
  id: number;
  handoverDate?: string | null;
  warrantyNo?: string | null;
  warrantyPeriodMonths?: number;
  handoverNotes?: string | null;
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

/** Route-level fake for PATCH /admin/leads/:id/handover: select() is unused by
 * this endpoint, update().set().where().returning() applies the given
 * changes onto the seeded record (or returns [] if no record was seeded, to
 * exercise the 404 path). */
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

type FakeTrackLeadRow = {
  id: number;
  quoteNumber: string;
  quoteAccessSecret: string;
  name: string | null;
  project: string | null;
  phone: string | null;
  status: string;
  updatedAt: Date;
  studioData: unknown;
  handoverDate: string | null;
  warrantyNo: string | null;
  warrantyPeriodMonths: number;
};

const QUOTE_NUMBER = "Sep 30 / US / 555222";

/** Same dispatch-on-table-identity shortcut as public-job-tracking.test.ts's
 * createFakeDatabase -- leads.ts and this test share the real, unmocked
 * `@workspace/db/schema` module, so table objects compare equal by reference. */
function createFakeTrackDatabase(lead: FakeTrackLeadRow | null) {
  return {
    select: (_columns?: unknown) => ({
      from: (table: unknown) => {
        if (table === sitePhotos) {
          return { where: () => ({ orderBy: async () => [] }) };
        }
        return {
          where: () => ({
            limit: async () => (lead ? [lead] : []),
          }),
        };
      },
    }),
    update: () => ({
      set: () => ({ where: async () => undefined }),
    }),
  };
}

async function startLeadsRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
  const app = express();
  app.use(express.json());
  app.use("/api", routeModule.createLeadsRouter(database as never));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: error instanceof Error ? error.message : "Internal server error" });
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Lead handover / tracking test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function tokenFor(quoteNumber: string, accessSecret: string) {
  const quoteAccess = await importTypeScriptModule<QuoteAccessModule>("src/lib/quote-access.ts");
  return quoteAccess.createPublicQuoteToken(quoteNumber, accessSecret);
}

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};

before(() => {
  process.env["ADMIN_PASSWORD"] = "lead-handover-test-password";
  process.env["DATABASE_URL"] = "postgres://lead-handover-test";
  process.env["SESSION_SECRET"] = "lead-handover-test-session-secret";
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("PATCH /admin/leads/:id/handover", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1 }));
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/handover`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handoverDate: "2026-09-30" }),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("records handover date, warranty number, warranty period, and notes", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, warrantyPeriodMonths: 12 }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/handover`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          handoverDate: "2026-09-30",
          warrantyNo: "KB-WAR-26/1012",
          warrantyPeriodMonths: 24,
          handoverNotes: "ส่งมอบงานเรียบร้อย ลูกค้าตรวจรับแล้ว",
        }),
      });
      assert.equal(response.status, 200);
      const body = await response.json() as Record<string, unknown>;
      assert.equal(body.handoverDate, "2026-09-30");
      assert.equal(body.warrantyNo, "KB-WAR-26/1012");
      assert.equal(body.warrantyPeriodMonths, 24);
      assert.equal(body.handoverNotes, "ส่งมอบงานเรียบร้อย ลูกค้าตรวจรับแล้ว");
    } finally {
      await server.close();
    }
  });

  it("applies the default warranty period (12 months) when not provided", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, warrantyPeriodMonths: 12 }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/handover`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ handoverDate: "2026-09-30" }),
      });
      assert.equal(response.status, 200);
      const body = await response.json() as Record<string, unknown>;
      assert.equal(body.warrantyPeriodMonths, 12);
    } finally {
      await server.close();
    }
  });

  it("rejects a malformed handoverDate", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1 }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      for (const handoverDate of ["30-09-2026", "2026/09/30", "not-a-date", "2026-13-01"]) {
        const response = await fetch(`${server.url}/api/admin/leads/1/handover`, {
          method: "PATCH",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({ handoverDate }),
        });
        assert.equal(response.status, 400, `"${handoverDate}" should be rejected`);
      }
    } finally {
      await server.close();
    }
  });

  it("rejects a non-positive-integer warrantyPeriodMonths", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1 }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      for (const warrantyPeriodMonths of [0, -1, 1.5, "12"]) {
        const response = await fetch(`${server.url}/api/admin/leads/1/handover`, {
          method: "PATCH",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({ warrantyPeriodMonths }),
        });
        assert.equal(response.status, 400, `${JSON.stringify(warrantyPeriodMonths)} should be rejected`);
      }
    } finally {
      await server.close();
    }
  });

  it("returns 404 when the lead does not exist", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase(null));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/999/handover`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ handoverDate: "2026-09-30" }),
      });
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });
});

describe("GET /api/public/track (handover & warranty fields)", () => {
  it("returns handoverDate, warrantyNo, and warrantyPeriodMonths for a valid token", async () => {
    const lead: FakeTrackLeadRow = {
      id: 42,
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: "a".repeat(64),
      name: "คุณทดสอบ",
      project: "คอนโดทดสอบ",
      phone: "0812345678",
      status: "closed",
      updatedAt: new Date("2026-09-25T03:00:00.000Z"),
      studioData: null,
      handoverDate: "2026-09-28",
      warrantyNo: "KB-WAR-26/1012",
      warrantyPeriodMonths: 24,
    };
    const server = await startLeadsRoute(createFakeTrackDatabase(lead));
    try {
      const token = await tokenFor(lead.quoteNumber, lead.quoteAccessSecret);
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(token)}`);
      assert.equal(response.status, 200);
      const body = await response.json() as Record<string, unknown>;
      assert.equal(body.handoverDate, "2026-09-28");
      assert.equal(body.warrantyNo, "KB-WAR-26/1012");
      assert.equal(body.warrantyPeriodMonths, 24);
    } finally {
      await server.close();
    }
  });

  it("returns null handover fields when a lead has not been handed over yet", async () => {
    const lead: FakeTrackLeadRow = {
      id: 42,
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: "a".repeat(64),
      name: "คุณทดสอบ",
      project: "คอนโดทดสอบ",
      phone: "0812345678",
      status: "in_production",
      updatedAt: new Date("2026-09-25T03:00:00.000Z"),
      studioData: null,
      handoverDate: null,
      warrantyNo: null,
      warrantyPeriodMonths: 12,
    };
    const server = await startLeadsRoute(createFakeTrackDatabase(lead));
    try {
      const token = await tokenFor(lead.quoteNumber, lead.quoteAccessSecret);
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(token)}`);
      assert.equal(response.status, 200);
      const body = await response.json() as Record<string, unknown>;
      assert.equal(body.handoverDate, null);
      assert.equal(body.warrantyNo, null);
      assert.equal(body.warrantyPeriodMonths, 12);
    } finally {
      await server.close();
    }
  });
});
