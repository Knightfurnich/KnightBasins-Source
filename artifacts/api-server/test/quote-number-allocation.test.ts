// Quote-number allocation (job-232 follow-up).
//
// The serial used to be `String(now.getTime()).slice(-6)` -- the epoch
// millisecond count modulo 1,000,000, which repeats every 16 minutes and 40
// seconds. Two quotations requested in the same position of that cycle shared a
// number, and both `GET /quotes` and `POST /public/quotes/promptpay-qr` resolve
// a lead *by* quote number, so the later customer could be served the earlier
// customer's quotation. These tests pin the two properties that fix it: the
// serial is no longer a function of the clock, and allocation retries (then
// refuses) rather than returning a number the database already holds.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { fixtureBasinSku, quickPurchaseData, withPricingCatalog } from "./price-guard-fixtures.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type LeadsModule = typeof import("../src/routes/leads.ts");

// `@workspace/db` refuses to load without a connection string; the harness keeps
// it external, so the route module only needs *a* value here. Nothing in these
// tests reaches a real database -- `createUniqueQuoteNumber` is given a fake.
const originalEnv = { DATABASE_URL: process.env["DATABASE_URL"], SESSION_SECRET: process.env["SESSION_SECRET"] };

let leads: LeadsModule;

before(async () => {
  process.env["DATABASE_URL"] = "postgres://quote-number-allocation-test";
  process.env["SESSION_SECRET"] = "quote-number-allocation-test-secret";
  leads = await importTypeScriptModule<LeadsModule>("src/routes/leads.ts");
});

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

/**
 * Stand-in for the single `db.select(...).from(...).where(...).limit(...)` chain
 * the helper uses. It reports the next entry of `results` per call (the last
 * entry repeats), and counts lookups so a test can prove a retry happened. It
 * deliberately exposes only `.select()`, mirroring `financial-safety.ts`'s
 * database convention.
 */
function fakeDatabase(results: boolean[]) {
  let calls = 0;
  return {
    lookups: () => calls,
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            const taken = results[Math.min(calls, results.length - 1)] ?? false;
            calls += 1;
            return taken ? [{ id: 1 }] : [];
          },
        }),
      }),
    }),
  };
}

const QUOTE_NUMBER_SHAPE = /^[A-Za-z]{3} \d{2} \/ US \/ \d{6}$/;

describe("createQuoteNumber serial is not a clock cycle", () => {
  it("produces more than one distinct serial across a full epoch-millisecond cycle", () => {
    // Every quote number produced 16m40s apart used to be byte-identical.
    const base = 1_700_000_000_000;
    const serials = new Set<string>();
    for (let offset = 0; offset < 1_000_000; offset += 100_000) {
      serials.add(leads.createQuoteNumber(new Date(base + offset)));
    }
    assert.ok(
      serials.size > 1,
      `expected distinct serials across one cycle, got ${serials.size}`,
    );
  });

  it("keeps the documented MMM YY / US / NNNNNN shape", () => {
    assert.match(leads.createQuoteNumber(new Date("2026-10-03T00:00:00.000Z")), QUOTE_NUMBER_SHAPE);
  });

  it("always pads the serial to exactly six digits", () => {
    for (let i = 0; i < 200; i += 1) {
      const serial = leads.createQuoteNumber().split(" / ")[2]!;
      assert.equal(serial.length, 6, `serial "${serial}" is not six digits`);
    }
  });

  it("carries the month and year of the date it is given", () => {
    assert.match(leads.createQuoteNumber(new Date("2026-09-15T00:00:00.000Z")), /^Sep 26 \/ US \//);
    assert.match(leads.createQuoteNumber(new Date("2026-10-15T00:00:00.000Z")), /^Oct 26 \/ US \//);
  });
});

describe("createUniqueQuoteNumber refuses to hand back a number already in use", () => {
  it("returns a valid number when the database holds none of its candidates", async () => {
    const database = fakeDatabase([false]);
    assert.match(await leads.createUniqueQuoteNumber(database), QUOTE_NUMBER_SHAPE);
    assert.equal(database.lookups(), 1, "a free candidate should need exactly one lookup");
  });

  it("retries past a candidate that is already taken", async () => {
    const database = fakeDatabase([true, true, false]);
    assert.match(await leads.createUniqueQuoteNumber(database), QUOTE_NUMBER_SHAPE);
    assert.equal(database.lookups(), 3, "the third lookup should have found a free serial");
  });

  it("throws instead of looping forever when every candidate collides", async () => {
    const database = fakeDatabase([true]);
    await assert.rejects(
      () => leads.createUniqueQuoteNumber(database),
      /Could not allocate a unique quote number/,
    );
    assert.equal(
      database.lookups(),
      leads.QUOTE_NUMBER_ATTEMPTS,
      "it should stop after exactly QUOTE_NUMBER_ATTEMPTS lookups",
    );
  });

  it("needs only a database that exposes .select()", async () => {
    // This is what lets admin-router.ts pass its narrower `AdminDatabase` type.
    const database = fakeDatabase([false]);
    assert.equal(typeof database.select, "function");
    await leads.createUniqueQuoteNumber(database);
  });

  it("documents a retry budget greater than one", () => {
    assert.ok(Number.isInteger(leads.QUOTE_NUMBER_ATTEMPTS) && leads.QUOTE_NUMBER_ATTEMPTS > 1);
  });
});

// ================================================================================================================
// job-233: the quote number is the server's alone -- whatever the client sends as `quoteNumber` is ignored
// ================================================================================================================
//
// Before this, `quoteNumber: "HACKED / 999999"` in the body of POST /api/leads was stored as sent: it skipped
// createUniqueQuoteNumber, got a quote link, could duplicate another customer's number (that customer's link then
// answers 404, because the lookup by number finds the wrong row and the access secret does not match), and was written
// to the audit trail as the target of the event. POST /api/leads/sketch spread the body into the insert the same way.

type Row = Record<string, unknown>;

const FORGED = "HACKED / 999999";
const EXISTING_NUMBER = "Oct 26 / US / 123456";
const EXISTING_SECRET = "a".repeat(64);

function tableNameOf(table: unknown): string {
  return String((table as Record<symbol, unknown>)[Symbol.for("drizzle:Name")]);
}

/**
 * Fake database. `existing` is what the route's "is there already a lead with this key" lookup finds; the uniqueness
 * lookup of createUniqueQuoteNumber (it selects only `id`) finds a clash for its first `takenFirst` calls and nothing after; the pricing tables come from
 * withPricingCatalog. `saved` holds the values of each insert, `updates` the `set` of each conflict clause.
 */
function createRouteDatabase(options: { existing?: Row | null; failLookup?: boolean; takenFirst?: number } = {}) {
  let uniquenessLookups = 0;
  const saved: Row[] = [];
  const updates: Row[] = [];
  const audits: Row[] = [];
  const base = {
    select: (fields?: Record<string, unknown>) => {
      const builder = {
        from: () => builder,
        where: () => builder,
        limit: async () => {
          if (options.failLookup) throw new Error("database unavailable");
          if (fields && "quoteAccessSecret" in fields) return options.existing ? [{ ...options.existing }] : [];
          uniquenessLookups += 1;
          return uniquenessLookups <= (options.takenFirst ?? 0) ? [{ id: 99 }] : [];
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
  return { database: withPricingCatalog(base), saved, updates, audits, lookups: () => uniquenessLookups };
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

  it("checks the number it issues against the database, and issues another when it is taken", async () => {
    const { database, saved, lookups } = createRouteDatabase({ takenFirst: 2 });
    const server = await startRoute(database);
    try {
      const { status, body } = await post(server.url, leadBody());
      assert.equal(status, 200);
      assert.equal(lookups(), 3, "two candidates were taken, the third was free");
      assert.equal(saved[0]!["quoteNumber"], body["quoteNumber"]);
    } finally {
      await server.close();
    }
  });

  it("saves nothing, and gives no quote link, when every candidate number is taken", async () => {
    const { database, saved, audits, lookups } = createRouteDatabase({ takenFirst: Number.POSITIVE_INFINITY });
    const server = await startRoute(database);
    try {
      const { status, body } = await post(server.url, leadBody());
      assert.equal(status, 500);
      assert.equal(lookups(), 5, "it gave up after its five attempts");
      assert.equal(saved.length, 0);
      assert.equal("publicQuoteToken" in body, false);
      await waitForAudit(audits);
      assert.equal(audits[0]!["errorCode"], "LEAD_SAVE_FAILED");
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
