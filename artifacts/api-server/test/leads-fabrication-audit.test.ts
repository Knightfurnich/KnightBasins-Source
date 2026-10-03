import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import { importTypeScriptModule } from "./route-harness.ts";
import { quickPurchaseData, withPricingCatalog } from "./price-guard-fixtures.ts";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";

type LeadRouteModule = typeof import("../src/routes/leads.ts");
type AdminRouteModule = { createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1] };

// ---- shared fakes -----------------------------------------------------------

type StoredLead = Record<string, unknown> & { leadKey: string; quoteNumber: string | null };

function createFakeLeadsDatabase() {
  const records: StoredLead[] = [];
  return {
    select: () => {
      const builder = {
        from: () => builder,
        where: () => builder,
        limit: async () => records.map((record) => ({ quoteNumber: record.quoteNumber })),
      };
      return builder;
    },
    insert: () => {
      let values: StoredLead;
      const builder = {
        values(next: StoredLead) {
          values = next;
          return builder;
        },
        onConflictDoUpdate() {
          return builder;
        },
        returning: async () => {
          const existingIndex = records.findIndex((record) => record.leadKey === values.leadKey);
          const saved = { ...values, id: existingIndex + 1 };
          if (existingIndex >= 0) records[existingIndex] = saved;
          else records.push(saved);
          return [saved];
        },
      };
      return builder;
    },
    records,
  };
}

async function startLeadsRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
  const app = express();
  app.use(express.json());
  app.use("/api", routeModule.createLeadsRouter(withPricingCatalog(database as never) as never));
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
    throw new Error("Leads fabrication-audit test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    leadKey: "lead-fabrication-audit-regression",
    status: "quote_requested",
    source: "quote_builder",
    name: "คุณทดสอบ",
    orderMode: "quick-purchase",
    productSkus: ["KF001"],
    studioData: quickPurchaseData(60990, { kind: "studio" }),
    ...overrides,
  };
}

/** A basin layout with every side clearing 200mm (well over the 100mm floor). */
const SAFE_BASIN = { counterWidthMm: 2000, counterDepthMm: 800, widthMm: 600, depthMm: 400, xMm: 300, yMm: 200 };
/** Same counter/basin size, but yMm=50 -> front clearance is only 50mm. */
const UNSAFE_BASIN = { ...SAFE_BASIN, yMm: 50 };

const originalEnv = {
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};

before(() => {
  process.env["DATABASE_URL"] = "postgres://leads-fabrication-audit-test";
  process.env["SESSION_SECRET"] = "leads-fabrication-audit-test-secret";
});

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// ---- POST /api/leads ---------------------------------------------------------

describe("POST /api/leads fabrication geometry audit", () => {
  it("a normal layout (200mm clearance) saves safely with no warnings", async () => {
    const database = createFakeLeadsDatabase();
    const server = await startLeadsRoute(database);
    try {
      const response = await fetch(`${server.url}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload({ studioData: quickPurchaseData(60990, { kind: "studio", shape: "I", basin: SAFE_BASIN }) })),
      });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { studioData: Record<string, unknown> };
      assert.equal(body.studioData["fabricationWarnings"], undefined);
      assert.equal((database.records[0]?.["studioData"] as Record<string, unknown>)["fabricationWarnings"], undefined);
    } finally {
      await server.close();
    }
  });

  it("a basin cutout with only 50mm clearance is saved (200, not rejected) but flagged with a warning", async () => {
    const database = createFakeLeadsDatabase();
    const server = await startLeadsRoute(database);
    try {
      const response = await fetch(`${server.url}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload({ studioData: quickPurchaseData(60990, { kind: "studio", shape: "I", basin: UNSAFE_BASIN }) })),
      });
      assert.equal(response.status, 200, "a fabrication warning must not block the lead from saving");
      const body = (await response.json()) as { studioData: Record<string, unknown> };
      const warnings = body.studioData["fabricationWarnings"] as string[];
      assert.ok(Array.isArray(warnings) && warnings.length > 0);
      assert.ok(warnings.some((warning) => warning.includes("100")), "warning must mention the 100mm safety floor");

      const savedWarnings = (database.records[0]?.["studioData"] as Record<string, unknown>)["fabricationWarnings"];
      assert.deepEqual(savedWarnings, warnings, "the warning must actually be persisted, not just returned");
    } finally {
      await server.close();
    }
  });

  it("a basin cutout placed over an L-shape joint line is flagged with a joint-clash warning", async () => {
    const database = createFakeLeadsDatabase();
    const server = await startLeadsRoute(database);
    try {
      // Same safe 200mm-clearance basin as above, but a joint point falls inside its cutout footprint.
      const response = await fetch(`${server.url}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          basePayload({
            studioData: quickPurchaseData(60990, { kind: "studio", shape: "L", basin: SAFE_BASIN, joints: [{ x: 500, y: 300 }] }),
          }),
        ),
      });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { studioData: Record<string, unknown> };
      const warnings = body.studioData["fabricationWarnings"] as string[];
      assert.ok(Array.isArray(warnings) && warnings.length > 0);
      assert.ok(warnings.some((warning) => warning.toLowerCase().includes("joint")), "warning must call out the joint clash");
    } finally {
      await server.close();
    }
  });

  it("a joint far away from the cutout produces no joint-clash warning", async () => {
    const database = createFakeLeadsDatabase();
    const server = await startLeadsRoute(database);
    try {
      const response = await fetch(`${server.url}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          basePayload({
            studioData: quickPurchaseData(60990, { kind: "studio", shape: "L", basin: SAFE_BASIN, joints: [{ x: 10, y: 10 }] }),
          }),
        ),
      });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { studioData: Record<string, unknown> };
      assert.equal(body.studioData["fabricationWarnings"], undefined);
    } finally {
      await server.close();
    }
  });
});

// ---- PATCH /admin/leads/:id ---------------------------------------------------

type FakeLeadRecord = {
  id: number;
  status: string;
  notes: string | null;
  studioData: Record<string, unknown> | null;
  quoteNumber?: string | null;
  quoteAccessSecret?: string | null;
};

function createFakeAdminLeadDatabase(initialRecord: FakeLeadRecord) {
  let record = initialRecord;
  return {
    // Two different lookups share this chain: the admin route reads the lead's
    // existing studioData/quote fields, while createUniqueQuoteNumber asks only
    // for `{ id }` to check whether a freshly generated quote number is free.
    // The latter must come back empty (a free number), or saving would retry
    // every candidate and fail.
    select: (fields?: Record<string, unknown>) => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            if (fields && Object.keys(fields).length === 1 && "id" in fields) return [];
            return [{
              studioData: record.studioData,
              quoteNumber: record.quoteNumber ?? null,
              quoteAccessSecret: record.quoteAccessSecret ?? null,
            }];
          },
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
            record = { ...record, ...changes } as FakeLeadRecord;
            return [record];
          },
        }),
      };
      return builder;
    },
  };
}

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

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
    throw new Error("Admin fabrication-audit test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

describe("PATCH /api/admin/leads/:id fabrication geometry audit", () => {
  it("saving a safe basin layout carries no fabricationWarnings", async () => {
    const database = createFakeAdminLeadDatabase({ id: 1, status: "new_lead", notes: null, studioData: {} });
    const server = await startAdminRoute(database);
    try {
      const cookie = `knight_admin_session=${createAdminToken()}`;
      const response = await fetch(`${server.url}/api/admin/leads/1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ status: "selecting", studioData: { shape: "I", basin: SAFE_BASIN } }),
      });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { studioData: Record<string, unknown> };
      assert.equal(body.studioData["fabricationWarnings"], undefined);
    } finally {
      await server.close();
    }
  });

  it("staff saving an unsafe basin layout gets fabricationWarnings back, without the save being blocked", async () => {
    const database = createFakeAdminLeadDatabase({ id: 2, status: "new_lead", notes: null, studioData: {} });
    const server = await startAdminRoute(database);
    try {
      const cookie = `knight_admin_session=${createAdminToken()}`;
      const response = await fetch(`${server.url}/api/admin/leads/2`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ status: "selecting", studioData: { shape: "I", basin: UNSAFE_BASIN } }),
      });
      assert.equal(response.status, 200, "an admin save must not be blocked by a fabrication warning");
      const body = (await response.json()) as { studioData: Record<string, unknown> };
      const warnings = body.studioData["fabricationWarnings"] as string[];
      assert.ok(Array.isArray(warnings) && warnings.length > 0);
      assert.ok(warnings.some((warning) => warning.includes("100")));
    } finally {
      await server.close();
    }
  });

  it("a basin placed over a joint line via a staff edit is flagged", async () => {
    const database = createFakeAdminLeadDatabase({ id: 3, status: "new_lead", notes: null, studioData: {} });
    const server = await startAdminRoute(database);
    try {
      const cookie = `knight_admin_session=${createAdminToken()}`;
      const response = await fetch(`${server.url}/api/admin/leads/3`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ status: "selecting", studioData: { shape: "U", basin: SAFE_BASIN, joints: [{ x: 500, y: 300 }] } }),
      });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { studioData: Record<string, unknown> };
      const warnings = body.studioData["fabricationWarnings"] as string[];
      assert.ok(Array.isArray(warnings) && warnings.length > 0);
      assert.ok(warnings.some((warning) => warning.toLowerCase().includes("joint")));
    } finally {
      await server.close();
    }
  });
});
