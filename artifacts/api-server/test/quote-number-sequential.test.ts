import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { importTypeScriptModule } from "./route-harness.ts";

type LeadsRouteModule = typeof import("../src/routes/leads.ts");
type AdminRouteModule = typeof import("../src/routes/admin-router.ts");
type SupportRouteModule = {
  applySupportPaymentSlipFailedAttemptLimits(
    request: never,
    response: never,
    quoteNumber: string,
    phone: string,
  ): boolean;
  validateSupportSlipQuote(
    lead: { createdAt: Date | string; orderMode: string; studioData: unknown },
    database: never,
    now: number,
  ): Promise<
    | { ok: true; total: number }
    | { ok: false; status: 400 | 410; error: string; message: string }
  >;
};

type CounterDatabase = {
  execute(query: SQL): Promise<{ rows: Array<{ last_value: number }> }>;
};

const originalDatabaseUrl = process.env["DATABASE_URL"];
const originalSessionSecret = process.env["SESSION_SECRET"];

before(() => {
  process.env["DATABASE_URL"] = "postgres://quote-number-sequential-test";
  process.env["SESSION_SECRET"] = "quote-number-sequential-test-session-secret";
});

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env["DATABASE_URL"];
  else process.env["DATABASE_URL"] = originalDatabaseUrl;
  if (originalSessionSecret === undefined) delete process.env["SESSION_SECRET"];
  else process.env["SESSION_SECRET"] = originalSessionSecret;
});

function createCounterDatabase(initialValues: Record<string, number> = {}) {
  const counters = new Map(Object.entries(initialValues));
  const statements: string[] = [];
  const dialect = new PgDialect();
  const database: CounterDatabase = {
    async execute(query) {
      const compiled = dialect.sqlToQuery(query);
      statements.push(compiled.sql);
      const period = String(compiled.params[0]);
      const lastValue = (counters.get(period) ?? 0) + 1;
      counters.set(period, lastValue);
      return { rows: [{ last_value: lastValue }] };
    },
  };

  return { database, counters, statements };
}

describe("sequential quote numbers", () => {
  it("formats the period using the Asia/Bangkok calendar month", async () => {
    const routeModule = await importTypeScriptModule<LeadsRouteModule>("src/routes/leads.ts");
    assert.equal(routeModule.formatQuotePeriod(new Date("2026-09-30T16:59:59.999Z")), "202609");
    assert.equal(routeModule.formatQuotePeriod(new Date("2026-09-30T17:00:00.000Z")), "202610");
  });

  it("allocates 0001 then 0002 with the required format and one atomic SQL statement per number", async () => {
    const routeModule = await importTypeScriptModule<LeadsRouteModule>("src/routes/leads.ts");
    const { database, statements } = createCounterDatabase();
    const now = new Date("2026-10-03T00:00:00+07:00");

    const us = await routeModule.createNextQuoteNumber(database, "US", now);
    const of = await routeModule.createNextQuoteNumber(database, "OF", now);

    assert.equal(us, "QT-202610-US-0001");
    assert.equal(of, "QT-202610-OF-0002");
    assert.match(us, /^QT-\d{6}-(US|OF)-\d{4,}$/);
    assert.match(of, /^QT-\d{6}-(US|OF)-\d{4,}$/);
    assert.equal(statements.length, 2);
    for (const statement of statements) {
      assert.match(statement, /INSERT INTO quote_number_counters/i);
      assert.match(statement, /ON CONFLICT \(period\)/i);
      assert.match(statement, /RETURNING last_value/i);
    }
  });

  it("resets the sequence when the Bangkok month changes", async () => {
    const routeModule = await importTypeScriptModule<LeadsRouteModule>("src/routes/leads.ts");
    const { database } = createCounterDatabase();
    const october = new Date("2026-10-31T16:59:59.999Z");
    const november = new Date("2026-10-31T17:00:00.000Z");

    assert.equal(await routeModule.createNextQuoteNumber(database, "US", october), "QT-202610-US-0001");
    assert.equal(await routeModule.createNextQuoteNumber(database, "US", november), "QT-202611-US-0001");
  });

  it("defaults the format to US and expands beyond four digits without truncation", async () => {
    const routeModule = await importTypeScriptModule<LeadsRouteModule>("src/routes/leads.ts");
    const { database } = createCounterDatabase({ "202610": 9999 });

    assert.equal(
      await routeModule.createNextQuoteNumber(database, undefined, new Date("2026-10-03T00:00:00+07:00")),
      "QT-202610-US-10000",
    );
  });

  it("uses a shared helper to read US/OF from the stored studio state and defaults to US", async () => {
    const routeModule = await importTypeScriptModule<LeadsRouteModule>("src/routes/leads.ts");
    assert.equal(routeModule.quoteFormatFromStudioData({ state: { quoteFormat: "OF" } }), "OF");
    assert.equal(routeModule.quoteFormatFromStudioData({ quoteFormat: "OF" }), "OF");
    assert.equal(routeModule.quoteFormatFromStudioData({ state: { quoteFormat: "invalid" } }), "US");
    assert.equal(routeModule.quoteFormatFromStudioData(null), "US");
  });

  it("classifies the new US and OF formats in the admin pipeline", async () => {
    const routeModule = await importTypeScriptModule<AdminRouteModule>("src/routes/admin-router.ts");
    assert.equal(routeModule.pipelineOrderType("QT-202610-US-0001"), "us");
    assert.equal(routeModule.pipelineOrderType("QT-202610-OF-0002"), "of");
  });

  it("keeps quote allocation atomic and does not use COUNT(*) or MAX-based numbering", async () => {
    const source = await readFile(new URL("../src/routes/leads.ts", import.meta.url), "utf8");
    const generator = source.match(/export async function createNextQuoteNumber[\s\S]*?\n}/)?.[0];

    assert.ok(generator, "expected createNextQuoteNumber to exist");
    assert.match(generator, /INSERT INTO quote_number_counters/);
    assert.match(generator, /ON CONFLICT \(period\)/);
    assert.match(generator, /RETURNING last_value/);
    assert.equal((generator.match(/database\.execute\(/g) ?? []).length, 1);
    assert.doesNotMatch(generator, /COUNT\s*\(\s*\*\s*\)|SELECT\s+MAX\s*\(/i);
  });

  it("keeps the support upload lookup rate-limited per IP", async () => {
    const source = await readFile(new URL("../src/routes/support.ts", import.meta.url), "utf8");
    const limit = source.match(/const supportPaymentSlipRateLimit = createRateLimiter\(\{([^}]+)\}\);/);

    assert.ok(limit, "expected a dedicated payment-slip rate limiter");
    const max = Number(limit[1]?.match(/\bmax:\s*(\d+)/)?.[1]);
    const minutes = Number(limit[1]?.match(/windowMs:\s*(\d+)\s*\*\s*60\s*\*\s*1000/)?.[1]);
    assert.ok(max > 0 && max <= 10, `expected no more than 10 attempts, got ${max}`);
    assert.ok(minutes > 0 && minutes <= 15, `expected a window no longer than 15 minutes, got ${minutes}`);
    assert.ok(max / minutes <= 10 / 15, "expected a limit at least as strict as 10 attempts per 15 minutes");
    assert.doesNotMatch(limit[1] ?? "", /\bkey\s*:/, "the default rate-limit key must remain IP-based");
    assert.match(source, /router\.post\("\/support\/payment-slip",\s*supportPaymentSlipRateLimit/);
  });

  it("locks repeated failed support lookups by quote number or phone", async () => {
    const support = await importTypeScriptModule<SupportRouteModule>("src/routes/support.ts");
    const createResponse = () => {
      let statusCode = 200;
      const response = {} as {
        setHeader: (...args: unknown[]) => unknown;
        status: (code: number) => { json: (...args: unknown[]) => unknown };
        json: (...args: unknown[]) => unknown;
      };
      response.setHeader = () => response;
      response.status = (code: number) => {
        statusCode = code;
        return { json: () => response };
      };
      response.json = () => response;
      return { response: response as never, statusCode: () => statusCode };
    };
    const request = { ip: "203.0.113.234" } as never;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = createResponse();
      assert.equal(
        support.applySupportPaymentSlipFailedAttemptLimits(
          request,
          response.response,
          "QT-234R-REPEATED-QUOTE",
          `08123456${String(attempt).padStart(2, "0")}`,
        ),
        false,
      );
    }
    const quoteLockedResponse = createResponse();
    assert.equal(
      support.applySupportPaymentSlipFailedAttemptLimits(
        request,
        quoteLockedResponse.response,
        "QT-234R-REPEATED-QUOTE",
        "0812345699",
      ),
      true,
    );
    assert.equal(quoteLockedResponse.statusCode(), 429);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = createResponse();
      assert.equal(
        support.applySupportPaymentSlipFailedAttemptLimits(
          request,
          response.response,
          `QT-234R-PHONE-${attempt}`,
          "0897654321",
        ),
        false,
      );
    }
    const phoneLockedResponse = createResponse();
    assert.equal(
      support.applySupportPaymentSlipFailedAttemptLimits(
        request,
        phoneLockedResponse.response,
        "QT-234R-NEW-QUOTE",
        "0897654321",
      ),
      true,
    );
    assert.equal(phoneLockedResponse.statusCode(), 429);

    const source = await readFile(new URL("../src/routes/support.ts", import.meta.url), "utf8");
    assert.match(source, /supportPaymentSlipFailedQuoteRateLimit[\s\S]*?windowMs:\s*60\s*\*\s*60\s*\*\s*1000/);
    assert.match(source, /supportPaymentSlipFailedPhoneRateLimit[\s\S]*?windowMs:\s*60\s*\*\s*60\s*\*\s*1000/);
    assert.match(source, /applySupportPaymentSlipFailedAttemptLimits\(req, res, quoteNumber, phone\)/);
  });

  it("returns 410 for an expired quote and rejects quote data without a verified price", async () => {
    const support = await importTypeScriptModule<SupportRouteModule>("src/routes/support.ts");
    const now = Date.parse("2026-10-03T12:00:00.000Z");
    const expired = await support.validateSupportSlipQuote(
      {
        createdAt: new Date(now - 46 * 24 * 60 * 60 * 1000),
        orderMode: "studio",
        studioData: { total: 19000 },
      },
      {} as never,
      now,
    );
    assert.equal(expired.ok, false);
    if (!expired.ok) {
      assert.equal(expired.status, 410);
      assert.equal(expired.error, "quote_expired");
    }

    const validServerPrice = await support.validateSupportSlipQuote(
      {
        createdAt: new Date(now - 24 * 60 * 60 * 1000),
        orderMode: "studio",
        studioData: { total: 19000, serverPricing: { verifiedTotalTHB: 19000 } },
      },
      {} as never,
      now,
    );
    assert.deepEqual(validServerPrice, { ok: true, total: 19000 });

    const missingPrice = await support.validateSupportSlipQuote(
      { createdAt: new Date(now), orderMode: "studio", studioData: {} },
      {} as never,
      now,
    );
    assert.equal(missingPrice.ok, false);
    if (!missingPrice.ok) {
      assert.equal(missingPrice.status, 400);
      assert.equal(missingPrice.error, "PRICE_VERIFICATION_FAILED");
    }

    const source = await readFile(new URL("../src/routes/support.ts", import.meta.url), "utf8");
    assert.match(source, /isPublicQuoteTokenExpired/);
    assert.match(source, /checkQuoteBeforePayment/);
    assert.match(source, /res\.status\(quoteValidation\.status\)/);
  });

  it("keeps the migration additive and limited to the counter table", async () => {
    const migration = await readFile(
      new URL("../../../deploy/hostinger/migrations/022_quote_number_counters.sql", import.meta.url),
      "utf8",
    );
    assert.equal(
      migration.trim(),
      `CREATE TABLE IF NOT EXISTS quote_number_counters (
  period text PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);`,
    );
  });
});