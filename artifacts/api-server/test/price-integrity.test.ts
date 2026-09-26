import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import { importTypeScriptModule } from "./route-harness.ts";
import { validateNumericDimensions, verifyAndSanitizeQuoteTotal } from "../src/lib/price-integrity.ts";

type LeadRouteModule = typeof import("../src/routes/leads.ts");

// ---- verifyAndSanitizeQuoteTotal ------------------------------------------

describe("verifyAndSanitizeQuoteTotal", () => {
  it("returns a null, non-tampered result when studioData carries no total at all", () => {
    assert.deepEqual(verifyAndSanitizeQuoteTotal(undefined), { verifiedTotal: null, isTampered: false });
    assert.deepEqual(verifyAndSanitizeQuoteTotal(null), { verifiedTotal: null, isTampered: false });
    assert.deepEqual(verifyAndSanitizeQuoteTotal("not an object"), { verifiedTotal: null, isTampered: false });
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ kind: "quick-purchase" }), { verifiedTotal: null, isTampered: false });
  });

  it("accepts a normal positive total and rounds it, matching the pre-existing business behavior", () => {
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ total: 60990 }), { verifiedTotal: 60990, isTampered: false });
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ total: 12345.6 }), { verifiedTotal: 12346, isTampered: false });
  });

  it("accepts a total of exactly 0 (unusual, but not itself a tamper signal)", () => {
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ total: 0 }), { verifiedTotal: 0, isTampered: false });
  });

  it("flags a negative total as tampered", () => {
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ total: -1 }), { verifiedTotal: null, isTampered: true });
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ total: -60990 }), { verifiedTotal: null, isTampered: true });
  });

  it("flags NaN and +/-Infinity as tampered", () => {
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ total: NaN }), { verifiedTotal: null, isTampered: true });
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ total: Infinity }), { verifiedTotal: null, isTampered: true });
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ total: -Infinity }), { verifiedTotal: null, isTampered: true });
  });

  it("flags a string-injected price field as tampered, not silently coerced", () => {
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ total: "60990" }), { verifiedTotal: null, isTampered: true });
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ total: "1000; DROP TABLE customer_leads;" }), { verifiedTotal: null, isTampered: true });
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ total: true }), { verifiedTotal: null, isTampered: true });
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ total: [60990] }), { verifiedTotal: null, isTampered: true });
  });

  it("flags an out-of-this-world total as tampered even though it's a plain finite number", () => {
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ total: 999_999_999_999 }), { verifiedTotal: null, isTampered: true });
  });

  it("reads notification.total, quickQuote.total, and estimate.totalTHB, in that precedence order", () => {
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ quickQuote: { total: 4500 } }), { verifiedTotal: 4500, isTampered: false });
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ estimate: { totalTHB: 7200 } }), { verifiedTotal: 7200, isTampered: false });
    assert.deepEqual(
      verifyAndSanitizeQuoteTotal({ total: 100, notification: { total: 200 } }),
      { verifiedTotal: 200, isTampered: false },
      "notification.total must win over a plain top-level total, matching quoteTotalTHB's original precedence",
    );
  });

  it("flags tampering found in a nested variant just as readily as a top-level one", () => {
    assert.deepEqual(verifyAndSanitizeQuoteTotal({ notification: { total: -500 } }), { verifiedTotal: null, isTampered: true });
  });
});

// ---- validateNumericDimensions --------------------------------------------

describe("validateNumericDimensions", () => {
  it("accepts normal positive dimensions", () => {
    assert.equal(validateNumericDimensions(1980, 600), true);
    assert.equal(validateNumericDimensions(1, 1), true);
  });

  it("rejects zero or negative dimensions", () => {
    assert.equal(validateNumericDimensions(0, 600), false);
    assert.equal(validateNumericDimensions(1980, 0), false);
    assert.equal(validateNumericDimensions(-1980, 600), false);
    assert.equal(validateNumericDimensions(1980, -600), false);
  });

  it("rejects NaN and Infinity", () => {
    assert.equal(validateNumericDimensions(NaN, 600), false);
    assert.equal(validateNumericDimensions(1980, Infinity), false);
  });

  it("rejects a dimension past the 50-meter safety ceiling", () => {
    assert.equal(validateNumericDimensions(50_001, 600), false);
    assert.equal(validateNumericDimensions(50_000, 600), true);
  });

  it("rejects a non-number smuggled in past the type signature", () => {
    assert.equal(validateNumericDimensions("1980" as unknown as number, 600), false);
  });
});

// ---- POST /api/leads end-to-end -------------------------------------------

type StoredLead = Record<string, unknown> & { leadKey: string; quoteNumber: string | null };

function createFakeDatabase() {
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
    throw new Error("Price-integrity test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    leadKey: "lead-price-integrity-regression",
    status: "quote_requested",
    source: "quote_builder",
    name: "คุณทดสอบ",
    orderMode: "quick-purchase",
    productSkus: ["KF001"],
    studioData: { kind: "quick-purchase", total: 60990 },
    ...overrides,
  };
}

const originalEnv = {
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};

before(() => {
  process.env["DATABASE_URL"] = "postgres://price-integrity-test";
  process.env["SESSION_SECRET"] = "price-integrity-test-secret";
});

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("POST /api/leads price-integrity guard", () => {
  it("accepts a normal payload with a legitimate total (200, unchanged response shape)", async () => {
    const server = await startLeadsRoute(createFakeDatabase());
    try {
      const response = await fetch(`${server.url}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload()),
      });
      assert.equal(response.status, 200);
      const body = (await response.json()) as Record<string, unknown>;
      assert.equal((body["studioData"] as { total: number }).total, 60990);
    } finally {
      await server.close();
    }
  });

  it("rejects a negative total with 400 instead of saving it", async () => {
    const database = createFakeDatabase();
    const server = await startLeadsRoute(database);
    try {
      const response = await fetch(`${server.url}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload({ studioData: { kind: "quick-purchase", total: -60990 } })),
      });
      assert.equal(response.status, 400);
      assert.equal(database.records.length, 0, "a tampered payload must never reach the database");
    } finally {
      await server.close();
    }
  });

  it("rejects a string-injected price field with 400", async () => {
    const database = createFakeDatabase();
    const server = await startLeadsRoute(database);
    try {
      const response = await fetch(`${server.url}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload({ studioData: { kind: "quick-purchase", total: "60990; DROP TABLE customer_leads;" } })),
      });
      assert.equal(response.status, 400);
      assert.equal(database.records.length, 0);
    } finally {
      await server.close();
    }
  });

  it("rejects an out-of-this-world total with 400", async () => {
    const database = createFakeDatabase();
    const server = await startLeadsRoute(database);
    try {
      const response = await fetch(`${server.url}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload({ studioData: { kind: "quick-purchase", total: 999_999_999_999 } })),
      });
      assert.equal(response.status, 400);
      assert.equal(database.records.length, 0);
    } finally {
      await server.close();
    }
  });

  it("rejects tampered dimensions (negative widthMm) with 400", async () => {
    const database = createFakeDatabase();
    const server = await startLeadsRoute(database);
    try {
      const response = await fetch(`${server.url}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload({ studioData: { kind: "studio", total: 60990, widthMm: -1980, depthMm: 600 } })),
      });
      assert.equal(response.status, 400);
      assert.equal(database.records.length, 0);
    } finally {
      await server.close();
    }
  });

  it("still accepts a normal payload that legitimately carries widthMm/depthMm", async () => {
    const server = await startLeadsRoute(createFakeDatabase());
    try {
      const response = await fetch(`${server.url}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload({ studioData: { kind: "studio", total: 60990, widthMm: 1980, depthMm: 600 } })),
      });
      assert.equal(response.status, 200);
    } finally {
      await server.close();
    }
  });
});
