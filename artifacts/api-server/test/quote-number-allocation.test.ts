// Quote-number allocation uses the monthly database counter and must ignore
// client-supplied values while preserving numbers already assigned to a lead.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { fixtureBasinSku, quickPurchaseData, withPricingCatalog } from "./price-guard-fixtures.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type LeadsModule = typeof import("../src/routes/leads.ts");

// `@workspace/db` refuses to load without a connection string; the route tests
// use a fake database, including an atomic-counter result from execute().
const originalEnv = { DATABASE_URL: process.env["DATABASE_URL"], SESSION_SECRET: process.env["SESSION_SECRET"] };

before(() => {
  process.env["DATABASE_URL"] = "postgres://quote-number-allocation-test";
  process.env["SESSION_SECRET"] = "quote-number-allocation-test-secret";
});

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const QUOTE_NUMBER_SHAPE = /^QT-\d{6}-(?:US|OF)-\d{4,}$/;

// ================================================================================================================
// Server-issued quote numbers are authoritative -- client-supplied values are ignored
// ================================================================================================================
//
// A submitted quote number must never control the number stored on a new lead,
// the customer-facing quote link, or the audit target. Sketch uploads do not
// receive quote numbers from client metadata either.

type Row = Record<string, unknown>;

const FORGED = "HACKED / 999999";
const EXISTING_NUMBER = "Oct 26 / US / 123456";
const EXISTING_SECRET = "a".repeat(64);

function tableNameOf(table: unknown): string {
  return String((table as Record<symbol, unknown>)[Symbol.for("drizzle:Name")]);
}

/**
 * Route-level fake database: select() can return a saved lead and execute()
 * simulates the atomic monthly counter. Pricing-table reads come from the shared
 * fixture helper; saved holds inserts and updates holds conflict-clause values.
 */
function createRouteDatabase(options: { existing?: Row | null; failLookup?: boolean } = {}) {
  let quoteCounter = 0;
  const saved: Row[] = [];
  const updates: Row[] = [];
  const audits: Row[] = [];
  const base = {
    execute: async () => ({ rows: [{ last_value: ++quoteCounter }] }),
    select: (fields?: Record<string, unknown>) => {
      const builder = {
        from: () => builder,
        where: () => builder,
        limit: async () => {
          if (options.failLookup) throw new Error("database unavailable");
          return fields && "quoteAccessSecret" in fields && options.existing ? [{ ...options.existing }] : [];
        },
      };
      return builder;
    },
    insert: (table: unknown) => {
      const isAudit = tableNameOf(table) === "system_audit_logs";
      let values: Row = {};
      const builder = {
        values(next: Row) {
          values = next;
          if (isAudit) {
            audits.push(next);
            return Promise.resolve();
          }
          return builder;
        },
        onConflictDoUpdate(conflict: { set: Row }) {
          updates.push(conflict.set);
          return builder;
        },
        returning: async () => {
          saved.push(values);
          return [{ id: saved.length, ...values }];
        },
      };
      return builder;
    },
  };
  return { database: withPricingCatalog(base), saved, updates, audits };
}

async function waitForAudit(audits: Row[]) {
  for (let attempt = 0; attempt < 50 && audits.length === 0; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
}

async function startRoute(database: unknown) {
  // a fresh copy of the route each time: its rate limiter lives in the module
  const routeModule = await importTypeScriptModule<LeadsModule>("src/routes/leads.ts");
  const app = express();
  app.use(express.json());
  app.use("/api", routeModule.createLeadsRouter(database as never));
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: "Internal server error" });
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server has no TCP address");
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))) };
}

function leadBody(overrides: Row = {}) {
  return {
    leadKey: "lead-quote-number-0001",
    status: "quote_requested",
    source: "quote_builder",
    name: "คุณทดสอบ",
    phone: "0812345678",
    productSkus: [fixtureBasinSku(25000)],
    orderMode: "quick-purchase",
    studioData: quickPurchaseData(60990),
    ...overrides,
  };
}

async function post(url: string, body: Row) {
  const response = await fetch(`${url}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, body: (await response.json()) as Row };
}

/** The quote number the public token carries (the first, base64url part of the token). */
function tokenQuoteNumber(token: unknown): string {
  return (JSON.parse(Buffer.from(String(token).split(".")[0]!, "base64url").toString("utf8")) as { quoteNumber: string }).quoteNumber;
}

describe("job-233: POST /api/leads ignores a quote number from the client", () => {
  it("issues the server's own number for a quotation, however the client names one", async () => {
    for (const quoteNumber of [FORGED, EXISTING_NUMBER, "   ", "x".repeat(64), ""]) {
      const { database, saved, updates } = createRouteDatabase();
      const server = await startRoute(database);
      try {
        const { status, body } = await post(server.url, leadBody({ quoteNumber }));
        assert.equal(status, 200, JSON.stringify(quoteNumber));
        assert.match(String(body["quoteNumber"]), QUOTE_NUMBER_SHAPE, JSON.stringify(quoteNumber));
        assert.notEqual(body["quoteNumber"], quoteNumber);
        assert.equal(saved[0]!["quoteNumber"], body["quoteNumber"], "the row stores the number the customer is told");
        assert.equal(updates[0]!["quoteNumber"], body["quoteNumber"], "and so does the conflict update");
        assert.equal(tokenQuoteNumber(body["publicQuoteToken"]), body["quoteNumber"], "the quote link carries that number too");
      } finally {
        await server.close();
      }
    }
  });

  it("gives an honest customer who names no number a valid one, as before", async () => {
    const { database, saved } = createRouteDatabase();
    const server = await startRoute(database);
    try {
      const { status, body } = await post(server.url, leadBody());
      assert.equal(status, 200);
      assert.match(String(body["quoteNumber"]), QUOTE_NUMBER_SHAPE);
      assert.equal(typeof body["publicQuoteToken"], "string");
      assert.match(String(saved[0]!["quoteAccessSecret"]), /^[a-f0-9]{64}$/);
    } finally {
      await server.close();
    }
  });

  it("allocates consecutive sequential numbers for successive new quotations", async () => {
    const { database, saved } = createRouteDatabase();
    const server = await startRoute(database);
    try {
      const first = await post(server.url, leadBody({ leadKey: "lead-sequential-quote-0001" }));
      const second = await post(server.url, leadBody({ leadKey: "lead-sequential-quote-0002" }));
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      const firstNumber = String(first.body["quoteNumber"]);
      const secondNumber = String(second.body["quoteNumber"]);
      assert.match(firstNumber, QUOTE_NUMBER_SHAPE);
      assert.match(secondNumber, QUOTE_NUMBER_SHAPE);
      assert.equal(firstNumber.replace(/-\d+$/, ""), secondNumber.replace(/-\d+$/, ""));
      assert.equal(Number(secondNumber.match(/-(\d+)$/)?.[1]), Number(firstNumber.match(/-(\d+)$/)?.[1]) + 1);
      assert.equal(saved.length, 2);
      assert.equal(saved[0]!["quoteNumber"], firstNumber);
      assert.equal(saved[1]!["quoteNumber"], secondNumber);
    } finally {
      await server.close();
    }
  });

  it("keeps the number a lead already has, and its access secret, whatever the client sends", async () => {
    const existing = { quoteNumber: EXISTING_NUMBER, quoteAccessSecret: EXISTING_SECRET, orderMode: "quick-purchase" };
    const { database, saved, updates } = createRouteDatabase({ existing });
    const server = await startRoute(database);
    try {
      const { status, body } = await post(server.url, leadBody({ quoteNumber: FORGED }));
      assert.equal(status, 200);
      assert.equal(body["quoteNumber"], EXISTING_NUMBER);
      assert.equal(saved[0]!["quoteNumber"], EXISTING_NUMBER);
      assert.equal(updates[0]!["quoteNumber"], EXISTING_NUMBER);
      assert.equal(saved[0]!["quoteAccessSecret"], EXISTING_SECRET, "the link already given to the customer keeps working");
      assert.equal(tokenQuoteNumber(body["publicQuoteToken"]), EXISTING_NUMBER);
    } finally {
      await server.close();
    }
  });

  it("issues a number to a lead whose stored number is an empty string (two such rows exist in production)", async () => {
    const existing = { quoteNumber: "", quoteAccessSecret: null, orderMode: "quick-purchase" };
    const { database, saved } = createRouteDatabase({ existing });
    const server = await startRoute(database);
    try {
      const { status, body } = await post(server.url, leadBody());
      assert.equal(status, 200);
      assert.match(String(body["quoteNumber"]), QUOTE_NUMBER_SHAPE, "an empty stored number counts as none");
      assert.equal(saved[0]!["quoteNumber"], body["quoteNumber"]);
    } finally {
      await server.close();
    }
  });

  it("stores no number at all for a request that is not a quotation, even when the client names one", async () => {
    const { database, saved, updates } = createRouteDatabase();
    const server = await startRoute(database);
    try {
      for (const status of ["new_lead", "selecting", "closed"]) {
        const { status: code, body } = await post(server.url, leadBody({ leadKey: `lead-not-a-quote-${status}`, status, studioData: null, quoteNumber: FORGED }));
        assert.equal(code, 200, status);
        assert.equal(body["quoteNumber"] ?? null, null, status);
        assert.equal(body["publicQuoteToken"] ?? null, null, `${status}: no quote link`);
      }
      assert.ok(saved.every((values) => values["quoteNumber"] === null), "no row carries a number");
      assert.ok(updates.every((set) => set["quoteNumber"] !== FORGED), "and no update writes the forged one");
    } finally {
      await server.close();
    }
  });

  it("still refuses quote_requested without studioData, a named quote number does not stand in for it", async () => {
    const { database, saved } = createRouteDatabase();
    const server = await startRoute(database);
    try {
      const { status, body } = await post(server.url, leadBody({ studioData: null, quoteNumber: FORGED }));
      assert.equal(status, 400);
      assert.equal(body["error"], "STUDIO_DATA_REQUIRED");
      assert.equal(saved.length, 0);
    } finally {
      await server.close();
    }
  });
});

describe("job-233: the audit trail is not addressed to a quote number the client made up", () => {
  const cases: Array<[string, Row, string]> = [
    ["a total that does not match the server's price", { studioData: quickPurchaseData(60990, { total: 100, subtotal: 100 }) }, "PRICE_VERIFICATION_FAILED"],
    ["a negative total", { studioData: quickPurchaseData(60990, { total: -5 }) }, "TAMPERED_QUOTE_TOTAL"],
    ["impossible dimensions", { studioData: quickPurchaseData(60990, { widthMm: -1, depthMm: 600 }) }, "TAMPERED_DIMENSIONS"],
  ];

  for (const [label, overrides, errorCode] of cases) {
    it(`uses the lead key as the target when the request is refused for ${label}`, async () => {
      const { database, saved, audits } = createRouteDatabase();
      const server = await startRoute(database);
      try {
        const { status } = await post(server.url, leadBody({ ...overrides, quoteNumber: FORGED }));
        assert.equal(status, 400);
        assert.equal(saved.length, 0);
        await waitForAudit(audits);
        assert.equal(audits.length, 1);
        assert.equal(audits[0]!["errorCode"], errorCode);
        assert.equal(audits[0]!["targetId"], "lead-quote-number-0001");
        assert.ok(!JSON.stringify(audits[0]).includes(FORGED), "the forged number is nowhere in the audit row");
      } finally {
        await server.close();
      }
    });
  }

  it("uses the lead key as the target when saving fails", async () => {
    const { database, audits } = createRouteDatabase({ failLookup: true });
    const server = await startRoute(database);
    try {
      const { status } = await post(server.url, leadBody({ quoteNumber: FORGED }));
      assert.equal(status, 500);
      await waitForAudit(audits);
      assert.equal(audits[0]!["errorCode"], "LEAD_SAVE_FAILED");
      assert.equal(audits[0]!["targetId"], "lead-quote-number-0001");
    } finally {
      await server.close();
    }
  });
});

describe("job-233: POST /api/leads/sketch does not store a quote number from the client either", () => {
  it("saves the sketch lead with no quote number", async () => {
    const uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "lead-quote-number-sketch-"));
    const originalUploadDirectory = process.env["UPLOAD_DIR"];
    process.env["UPLOAD_DIR"] = uploadDirectory;
    const { database, saved } = createRouteDatabase();
    const server = await startRoute(database);
    try {
      const formData = new FormData();
      formData.append(
        "metadata",
        JSON.stringify({
          leadKey: "lead-sketch-quote-number",
          status: "new_lead",
          source: "sketch_upload",
          name: "คุณทดสอบ",
          phone: "0812345678",
          productSkus: [],
          orderMode: "sketch",
          quoteNumber: EXISTING_NUMBER,
        }),
      );
      formData.append("file", new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" }), "sketch.png");
      const response = await fetch(`${server.url}/api/leads/sketch`, { method: "POST", body: formData });
      assert.ok(response.status < 300, `sketch upload answered ${response.status}`);
      assert.equal(saved.length, 1);
      assert.equal(saved[0]!["quoteNumber"], null, "the number the client named is not stored");
      assert.equal(saved[0]!["orderMode"], "sketch");
    } finally {
      await server.close();
      await rm(uploadDirectory, { force: true, recursive: true });
      if (originalUploadDirectory === undefined) delete process.env["UPLOAD_DIR"];
      else process.env["UPLOAD_DIR"] = originalUploadDirectory;
    }
  });
});
