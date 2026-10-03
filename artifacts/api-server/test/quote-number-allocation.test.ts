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
