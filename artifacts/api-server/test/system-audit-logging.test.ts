/**
 * Operational audit trail (job-214): the logging service, the places it is wired into
 * (POST /leads, POST /leads/payment-slip's guards, admin price edits and lead deletes) and
 * GET /admin/audit-logs.
 *
 * Everything runs against in-memory fakes of the database. The two rules under test:
 *   - a log row never carries a secret, and
 *   - a failing log write never breaks the request it describes.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import { PgDialect } from "drizzle-orm/pg-core";
import { sheetStonePrices, systemAuditLogs } from "@workspace/db/schema";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import {
  AUDIT_LOG_MAX_LIMIT,
  auditAdminActor,
  auditErrorDetails,
  auditFieldChanges,
  buildAuditLogWhere,
  logAuditEvent,
  parseAuditLogQuery,
  sanitizeAuditDetails,
  scrubAuditText,
} from "../src/lib/audit-logger.ts";
import { importTypeScriptModule } from "./route-harness.ts";
import { quickPurchaseData, withPricingCatalog } from "./price-guard-fixtures.ts";

type AuditRow = Record<string, unknown> & { actorType: string; action: string; status: string; details: Record<string, any> | null };
type RouteModule<T> = T;
type LeadsModule = { createLeadsRouter: (database: unknown) => Parameters<typeof express["use"]>[1] };
type AdminModule = { createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1] };

const tableName = (table: object) => table[Symbol.for("drizzle:Name") as keyof object] as string;
const dialect = new PgDialect();
const rendered = (condition: unknown) => dialect.sqlToQuery(condition as never);

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};

before(() => {
  process.env["ADMIN_PASSWORD"] = "system-audit-test-password";
  delete process.env["ADMIN_ROLE"];
  process.env["DATABASE_URL"] = "postgres://system-audit-test";
  process.env["SESSION_SECRET"] = "system-audit-test-session-secret-32-chars";
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

/** A database that remembers what is written to system_audit_logs and can be told to fail those writes. */
function createAuditSink(options: { failAuditWrites?: boolean } = {}) {
  const rows: AuditRow[] = [];
  const insert = (table: object) => {
    if (tableName(table) !== "system_audit_logs") return undefined;
    return {
      values: async (row: AuditRow) => {
        if (options.failAuditWrites) throw new Error("audit table is down");
        rows.push(row);
      },
    };
  };
  return { rows, insert };
}

async function listen(app: express.Express) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function startLeads(database: unknown) {
  const routeModule = await importTypeScriptModule<RouteModule<LeadsModule>>("src/routes/leads.ts");
  const app = express();
  app.use(express.json());
  app.use("/api", routeModule.createLeadsRouter(withPricingCatalog(database as Parameters<typeof withPricingCatalog>[0])));
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: "Internal server error" });
  });
  return listen(app);
}

async function startAdmin(database: unknown) {
  const routeModule = await importTypeScriptModule<RouteModule<AdminModule>>(fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url)));
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", routeModule.createAdminRouter(database));
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: "Internal server error" });
  });
  return listen(app);
}

const adminCookie = () => `knight_admin_session=${createAdminToken()}`;

const leadPayload = (overrides: Record<string, unknown> = {}) => ({
  leadKey: "lead-audit-1",
  status: "quote_requested",
  source: "quote_builder",
  name: "คุณทดสอบ",
  phone: "0812345678",
  project: "คอนโดทดสอบ",
  taxName: "บริษัททดสอบ จำกัด",
  taxId: "0105559012345",
  productSkus: ["KF001"],
  orderMode: "quick-purchase",
  studioData: quickPurchaseData(60990),
  ...overrides,
});

/** Fake for POST /leads: select() finds no earlier lead, insert(customer_leads) returns the saved row, the audit table goes to the sink. */
function createLeadsDatabase(sink: ReturnType<typeof createAuditSink>) {
  return {
    select: () => {
      const builder = { from: () => builder, where: () => builder, limit: async () => [] };
      return builder;
    },
    insert: (table: object) => {
      const audit = sink.insert(table);
      if (audit) return audit;
      let values: Record<string, unknown> = {};
      const builder = {
        values(next: Record<string, unknown>) { values = next; return builder; },
        onConflictDoUpdate: () => builder,
        returning: async () => [{ ...values, id: 41, publicQuoteToken: undefined }],
      };
      return builder;
    },
  };
}

describe("sanitizeAuditDetails", () => {
  it("blanks password, token, session secret and tax identity keys, at any depth", () => {
    const result = sanitizeAuditDetails({
      password: "hunter2",
      sessionSecret: "s3cret",
      token: "abc.def",
      quoteAccessSecret: "xyz",
      taxId: "0105559012345",
      taxName: "บริษัททดสอบ จำกัด",
      nested: { apiKey: "key-1", Authorization: "Bearer zzz", keep: "visible" },
      list: [{ cookie: "knight_admin_session=1", ok: 1 }],
    }) as Record<string, any>;
    assert.equal(result.password, "[REDACTED]");
    assert.equal(result.sessionSecret, "[REDACTED]");
    assert.equal(result.token, "[REDACTED]");
    assert.equal(result.quoteAccessSecret, "[REDACTED]");
    assert.equal(result.taxId, "[REDACTED]");
    assert.equal(result.taxName, "[REDACTED]");
    assert.equal(result.nested.apiKey, "[REDACTED]");
    assert.equal(result.nested.Authorization, "[REDACTED]");
    assert.equal(result.nested.keep, "visible");
    assert.equal(result.list[0].cookie, "[REDACTED]");
    assert.equal(result.list[0].ok, 1);
    assert.doesNotMatch(JSON.stringify(result), /hunter2|s3cret|abc\.def|0105559012345|key-1|knight_admin_session=1/);
  });

  it("scrubs secrets that appear inside free text such as error messages and URLs", () => {
    assert.equal(scrubAuditText("GET /quote/view?token=abc123&x=1"), "GET /quote/view?token=[REDACTED]&x=1");
    assert.equal(scrubAuditText("connect failed postgres://knight:pa55word@db:5432/kb"), "connect failed postgres://[REDACTED]@db:5432/kb");
    assert.match(scrubAuditText("Authorization: Bearer abc.DEF-123"), /Bearer \[REDACTED\]/);
    assert.doesNotMatch(scrubAuditText("password=hunter2 failed"), /hunter2/);
    const { errorMessage } = auditErrorDetails(new Error("bad url postgresql://u:p@h/db?token=zzz"));
    assert.doesNotMatch(errorMessage, /:p@|zzz/);
  });

  it("keeps the details small: long strings, long lists, deep nesting and huge objects are bounded", () => {
    const result = sanitizeAuditDetails({
      long: "x".repeat(5_000),
      list: Array.from({ length: 100 }, (_unused, index) => index),
      deep: { a: { b: { c: { d: { e: { f: 1 } } } } } },
    }) as Record<string, any>;
    assert.equal(result.long.length, 500);
    assert.equal(result.list.length, 25);
    assert.equal(result.deep.a.b.c.d, "[nested data omitted]");

    const huge = sanitizeAuditDetails(Object.fromEntries(Array.from({ length: 40 }, (_unused, index) => [`k${index}`, "y".repeat(400)]))) as Record<string, any>;
    assert.equal(huge.truncated, true);
    assert.ok(JSON.stringify(huge).length < 3_000);
  });

  it("returns null for empty details and JSON-safe values for odd input", () => {
    assert.equal(sanitizeAuditDetails(undefined), null);
    assert.equal(sanitizeAuditDetails(null), null);
    const odd = sanitizeAuditDetails({ when: new Date("2026-10-03T00:00:00.000Z"), nan: Number.NaN, flag: true }) as Record<string, unknown>;
    assert.deepEqual(odd, { when: "2026-10-03T00:00:00.000Z", nan: null, flag: true });
  });
});

describe("logAuditEvent", () => {
  it("writes one row with the sanitized details and clipped fields", async () => {
    const sink = createAuditSink();
    await logAuditEvent(sink, {
      actorType: "customer",
      actorName: "  คุณทดสอบ  ",
      action: "lead.upsert",
      targetId: "ตุลาคม / US / 123456",
      errorCode: null,
      details: { customerPhone: "0812345678", password: "hunter2" },
      ipAddress: "203.0.113.7",
      userAgent: "u".repeat(400),
    });
    assert.equal(sink.rows.length, 1);
    const row = sink.rows[0]!;
    assert.equal(row.actorType, "customer");
    assert.equal(row.actorName, "คุณทดสอบ");
    assert.equal(row.status, "success");
    assert.equal((row.userAgent as string).length, 255);
    assert.equal(row.details?.customerPhone, "0812345678");
    assert.equal(row.details?.password, "[REDACTED]");
  });

  it("never throws or rejects when the audit write fails or the database cannot insert", async () => {
    const failing = createAuditSink({ failAuditWrites: true });
    await assert.doesNotReject(() => logAuditEvent(failing, { actorType: "system", action: "x" }));
    await assert.doesNotReject(() => logAuditEvent({} as never, { actorType: "system", action: "x" }));
    await assert.doesNotReject(() => logAuditEvent({ insert: () => { throw new Error("sync failure"); } }, { actorType: "system", action: "x" }));
  });

  it("describes who acted on an admin route", () => {
    assert.deepEqual(auditAdminActor({ adminMember: { displayName: "ช่างเอ" } } as never), { actorType: "admin", actorName: "ช่างเอ" });
    assert.deepEqual(auditAdminActor({ adminApiKey: { name: "n8n" } } as never), { actorType: "admin", actorName: "API key: n8n" });
    assert.equal(auditAdminActor({ adminAccess: { role: "owner" } } as never).actorName, "เจ้าของระบบ (รหัสผ่าน)");
  });

  it("reports only the fields that changed, as { from, to }", () => {
    const changes = auditFieldChanges(
      { code: "BW010", basePriceTHB: 7500, price10PlusTHB: 7300, name: "Glaring White" },
      { basePriceTHB: 8000, price10PlusTHB: 7300, name: "Glaring White", galleryImageUrls: ["a"], updatedAt: new Date() },
    );
    assert.deepEqual(changes, { basePriceTHB: { from: 7500, to: 8000 } });
  });
});

describe("audit log query filters", () => {
  it("validates and bounds limit, offset, status and actor type", () => {
    assert.deepEqual(parseAuditLogQuery({}), { ok: true, value: { limit: 50, offset: 0 } });
    const capped = parseAuditLogQuery({ limit: "100000", offset: "20", status: "error", actorType: "customer", targetId: "Q-1", q: "0812" });
    assert.deepEqual(capped, { ok: true, value: { targetId: "Q-1", actorType: "customer", status: "error", q: "0812", limit: AUDIT_LOG_MAX_LIMIT, offset: 20 } });
    for (const bad of [{ status: "fatal" }, { actorType: "robot" }, { limit: "0" }, { limit: "abc" }, { offset: "-1" }, { offset: "1.5" }]) {
      assert.equal(parseAuditLogQuery(bad).ok, false, JSON.stringify(bad));
    }
  });

  it("builds a WHERE clause on the right columns, with every value as a bound parameter", () => {
    assert.equal(buildAuditLogWhere({}), undefined);
    const query = rendered(buildAuditLogWhere({ targetId: "Q-1", actorType: "admin", status: "warning", q: "50%_x" }));
    assert.match(query.sql, /"target_id" = \$/);
    assert.match(query.sql, /"actor_type" = \$/);
    assert.match(query.sql, /"status" = \$/);
    assert.match(query.sql, /ilike/i);
    assert.match(query.sql, /customerPhone|->>/);
    assert.ok(query.params.includes("Q-1") && query.params.includes("admin") && query.params.includes("warning"));
    assert.ok(query.params.includes("%50\\%\\_x%"), "LIKE wildcards in the search text are escaped");
    assert.doesNotMatch(query.sql, /Q-1|warning/, "values are never concatenated into the SQL text");
  });

  it("also searches the digits of a phone number typed with separators", () => {
    const query = rendered(buildAuditLogWhere({ q: "081-234-5678" }));
    assert.ok(query.params.includes("%0812345678%"));
  });
});

describe("POST /leads is audited without being put at risk by it", () => {
  it("logs a quotation request as a success row, with the phone but without the tax identity", async () => {
    const sink = createAuditSink();
    const server = await startLeads(createLeadsDatabase(sink));
    try {
      const response = await fetch(`${server.url}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(leadPayload()) });
      assert.equal(response.status, 200);
      assert.equal(sink.rows.length, 1);
      const row = sink.rows[0]!;
      assert.equal(row.actorType, "customer");
      assert.equal(row.action, "lead.upsert");
      assert.equal(row.status, "success");
      assert.equal(row.actorName, "คุณทดสอบ");
      assert.equal(row.details?.customerPhone, "0812345678");
      assert.equal(row.details?.leadKey, "lead-audit-1");
      assert.doesNotMatch(JSON.stringify(row), /0105559012345|บริษัททดสอบ จำกัด/);
    } finally {
      await server.close();
    }
  });

  it("does not log every autosave: a plain 'selecting' update writes no row", async () => {
    const sink = createAuditSink();
    const server = await startLeads(createLeadsDatabase(sink));
    try {
      const response = await fetch(`${server.url}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(leadPayload({ status: "selecting" })) });
      assert.equal(response.status, 200);
      assert.equal(sink.rows.length, 0);
    } finally {
      await server.close();
    }
  });

  it("logs a rejected payload with the invalid field names only, never the values", async () => {
    const sink = createAuditSink();
    const server = await startLeads(createLeadsDatabase(sink));
    try {
      const response = await fetch(`${server.url}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadKey: "lead-bad", phone: "0899999999", status: "not-a-status" }) });
      assert.equal(response.status, 400);
      assert.equal(sink.rows.length, 1);
      const row = sink.rows[0]!;
      assert.equal(row.status, "error");
      assert.equal(row.errorCode, "INVALID_LEAD_PAYLOAD");
      assert.equal(row.targetId, "lead-bad");
      assert.ok(Array.isArray(row.details?.invalidFields) && row.details.invalidFields.length > 0);
      assert.doesNotMatch(JSON.stringify(row), /0899999999/);
    } finally {
      await server.close();
    }
  });

  it("logs a tampered quote total as an error row and still rejects it", async () => {
    const sink = createAuditSink();
    const server = await startLeads(createLeadsDatabase(sink));
    try {
      const response = await fetch(`${server.url}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(leadPayload({ studioData: { total: -5 } })) });
      assert.equal(response.status, 400);
      assert.equal(sink.rows[0]?.errorCode, "TAMPERED_QUOTE_TOTAL");
      assert.equal(sink.rows[0]?.status, "error");
    } finally {
      await server.close();
    }
  });

  it("logs a database failure as an error row with the raw message, and the customer still gets the normal 500", async () => {
    const sink = createAuditSink();
    const database = {
      select: () => { throw new Error("connection to postgres://knight:pa55word@db/kb lost"); },
      insert: (table: object) => sink.insert(table),
    };
    const server = await startLeads(database);
    try {
      const response = await fetch(`${server.url}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(leadPayload()) });
      assert.equal(response.status, 500);
      const row = sink.rows[0]!;
      assert.equal(row.errorCode, "LEAD_SAVE_FAILED");
      assert.match(String(row.details?.errorMessage), /connection to postgres:\/\/\[REDACTED\]@db\/kb lost/);
      assert.doesNotMatch(JSON.stringify(row), /pa55word/);
    } finally {
      await server.close();
    }
  });

  it("a failing audit table never changes the customer's response", async () => {
    const sink = createAuditSink({ failAuditWrites: true });
    const server = await startLeads(createLeadsDatabase(sink));
    try {
      const response = await fetch(`${server.url}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(leadPayload()) });
      assert.equal(response.status, 200);
      const body = await response.json() as { leadKey: string };
      assert.equal(body.leadKey, "lead-audit-1");
    } finally {
      await server.close();
    }
  });
});

describe("POST /leads/payment-slip is audited", () => {
  it("logs a slip upload with an unknown token as a warning, without writing the token anywhere", async () => {
    const sink = createAuditSink();
    const server = await startLeads(createLeadsDatabase(sink));
    try {
      const form = new FormData();
      form.append("token", "not-a-real-token-value");
      form.append("image", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])], { type: "image/jpeg" }), "slip.jpg");
      const response = await fetch(`${server.url}/api/leads/payment-slip`, { method: "POST", body: form });
      assert.equal(response.status, 404);
      assert.equal(sink.rows.length, 1);
      assert.equal(sink.rows[0]?.action, "slip.upload");
      assert.equal(sink.rows[0]?.status, "warning");
      assert.equal(sink.rows[0]?.errorCode, "QUOTE_NOT_FOUND");
      assert.doesNotMatch(JSON.stringify(sink.rows[0]), /not-a-real-token-value/);
    } finally {
      await server.close();
    }
  });
});

describe("admin edits are audited", () => {
  const stoneRow = { id: 7, code: "BW010", name: "Glaring White", basePriceTHB: 7500, price10PlusTHB: 7300, price50PlusTHB: 7100, tone: "#f5f5f5", aliases: [], active: true, sortOrder: 0 };
  /** PUT replaces the whole row, so the body carries every field and only the price differs. */
  const stoneBody = (basePriceTHB: number) => JSON.stringify({ ...stoneRow, id: undefined, basePriceTHB });

  function createStoneDatabase(sink: ReturnType<typeof createAuditSink>, options: { readBeforeFails?: boolean } = {}) {
    let current: Record<string, unknown> = { ...stoneRow };
    return {
      select: () => {
        const builder = {
          from: () => builder,
          where: () => builder,
          limit: async () => {
            if (options.readBeforeFails) throw new Error("read failed");
            return [{ ...current }];
          },
        };
        return builder;
      },
      insert: (table: object) => sink.insert(table),
      update: (_table: object) => {
        let changes: Record<string, unknown> = {};
        const builder = {
          set(values: Record<string, unknown>) { changes = values; return builder; },
          where: () => ({
            returning: async () => {
              current = { ...current, ...Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)) };
              return [current];
            },
          }),
        };
        return builder;
      },
    };
  }

  it("PUT /admin/sheet-stones/:id logs who changed which price, with before and after", async () => {
    const sink = createAuditSink();
    const server = await startAdmin(createStoneDatabase(sink));
    try {
      const response = await fetch(`${server.url}/api/admin/sheet-stones/7`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: adminCookie() },
        body: stoneBody(8000),
      });
      assert.equal(response.status, 200);
      assert.equal(sink.rows.length, 1);
      const row = sink.rows[0]!;
      assert.equal(row.actorType, "admin");
      assert.equal(row.actorName, "เจ้าของระบบ (รหัสผ่าน)");
      assert.equal(row.action, "admin.stone.update");
      assert.equal(row.targetId, "BW010");
      assert.equal(row.status, "success");
      assert.deepEqual(row.details?.changes, { basePriceTHB: { from: 7500, to: 8000 } });
      assert.equal(row.details?.kind, "sheet");
    } finally {
      await server.close();
    }
  });

  it("the stone edit still succeeds when the before-image cannot be read or the audit table is down", async () => {
    for (const options of [{ readBeforeFails: true }, { failAuditWrites: true }]) {
      const sink = createAuditSink({ failAuditWrites: Boolean((options as { failAuditWrites?: boolean }).failAuditWrites) });
      const server = await startAdmin(createStoneDatabase(sink, { readBeforeFails: Boolean((options as { readBeforeFails?: boolean }).readBeforeFails) }));
      try {
        const response = await fetch(`${server.url}/api/admin/sheet-stones/7`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", cookie: adminCookie() },
          body: stoneBody(8100),
        });
        assert.equal(response.status, 200, JSON.stringify(options));
      } finally {
        await server.close();
      }
    }
  });

  it("DELETE /admin/leads/:id logs the deleted quotation, and a financial lock as a warning", async () => {
    const sink = createAuditSink();
    const slips: Array<{ status: string }> = [];
    const lead = { id: 10, quoteNumber: "ตุลาคม / US / 654321", name: "คุณลบ", phone: "0811112222", status: "new_lead" };
    const database = {
      select: () => ({ from: () => ({ where: async () => slips }) }),
      insert: (table: object) => sink.insert(table),
      delete: () => ({ where: () => ({ returning: async () => [lead] }) }),
    };
    const server = await startAdmin(database);
    try {
      const deleted = await fetch(`${server.url}/api/admin/leads/10`, { method: "DELETE", headers: { cookie: adminCookie() } });
      assert.equal(deleted.status, 200);
      assert.equal(sink.rows[0]?.action, "admin.lead.delete");
      assert.equal(sink.rows[0]?.targetId, "ตุลาคม / US / 654321");
      assert.equal(sink.rows[0]?.details?.customerPhone, "0811112222");

      slips.push({ status: "verified", claimedAmountThb: 5000 } as never);
      const locked = await fetch(`${server.url}/api/admin/leads/10`, { method: "DELETE", headers: { cookie: adminCookie() } });
      assert.equal(locked.status, 409);
      assert.equal(sink.rows[1]?.status, "warning");
      assert.equal(sink.rows[1]?.errorCode, "FINANCIAL_LOCK");
    } finally {
      await server.close();
    }
  });
});

describe("GET /admin/audit-logs", () => {
  function createLogReader(items: unknown[], total = items.length) {
    const calls: { where: unknown; limit?: number; offset?: number; counted: boolean }[] = [];
    const database = {
      select: (columns?: unknown) => {
        const call = { where: undefined as unknown, counted: Boolean(columns), limit: undefined as number | undefined, offset: undefined as number | undefined };
        calls.push(call);
        const builder: Record<string, any> = {
          from: () => builder,
          where(condition: unknown) { call.where = condition; return builder; },
          orderBy: () => builder,
          limit(value: number) { call.limit = value; return builder; },
          offset(value: number) { call.offset = value; return builder; },
          then(resolve: (value: unknown) => unknown) { return resolve(columns ? [{ total }] : items); },
        };
        return builder;
      },
    };
    return { database, calls };
  }

  it("requires an admin session and the owner role", async () => {
    const { database } = createLogReader([]);
    const server = await startAdmin(database);
    try {
      assert.equal((await fetch(`${server.url}/api/admin/audit-logs`)).status, 401);
      process.env["ADMIN_ROLE"] = "staff";
      try {
        const staff = await fetch(`${server.url}/api/admin/audit-logs`, { headers: { cookie: adminCookie() } });
        assert.equal(staff.status, 403);
      } finally {
        delete process.env["ADMIN_ROLE"];
      }
    } finally {
      await server.close();
    }
  });

  it("returns the page, the total, and applies the filters, limit and offset", async () => {
    const items = [{ id: 2, action: "lead.upsert", status: "error" }, { id: 1, action: "slip.upload", status: "success" }];
    const { database, calls } = createLogReader(items, 37);
    const server = await startAdmin(database);
    try {
      const response = await fetch(`${server.url}/api/admin/audit-logs?targetId=Q-9&actorType=customer&status=error&limit=20&offset=40&q=0812`, { headers: { cookie: adminCookie() } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), { items, total: 37, limit: 20, offset: 40 });
      const page = calls.find((call) => !call.counted)!;
      assert.equal(page.limit, 20);
      assert.equal(page.offset, 40);
      const sql = rendered(page.where);
      assert.match(sql.sql, /"target_id" = \$/);
      assert.match(sql.sql, /"actor_type" = \$/);
      assert.match(sql.sql, /"status" = \$/);
      assert.ok(sql.params.includes("Q-9") && sql.params.includes("customer") && sql.params.includes("error"));
    } finally {
      await server.close();
    }
  });

  it("caps the page size and rejects unknown filter values with 400", async () => {
    const { database, calls } = createLogReader([]);
    const server = await startAdmin(database);
    try {
      const capped = await fetch(`${server.url}/api/admin/audit-logs?limit=99999`, { headers: { cookie: adminCookie() } });
      assert.equal(capped.status, 200);
      assert.equal(calls.find((call) => !call.counted)?.limit, AUDIT_LOG_MAX_LIMIT);
      for (const query of ["status=fatal", "actorType=robot", "limit=0", "offset=-5"]) {
        const bad = await fetch(`${server.url}/api/admin/audit-logs?${query}`, { headers: { cookie: adminCookie() } });
        assert.equal(bad.status, 400, query);
      }
    } finally {
      await server.close();
    }
  });
});

describe("schema", () => {
  it("system_audit_logs has the columns the logger writes and the indexes the admin page filters on", () => {
    const columns = Object.keys(systemAuditLogs);
    for (const name of ["id", "actorType", "actorName", "action", "targetId", "status", "errorCode", "details", "ipAddress", "userAgent", "createdAt"]) {
      assert.ok(columns.includes(name), `missing column ${name}`);
    }
    assert.equal(tableName(systemAuditLogs), "system_audit_logs");
    assert.equal(tableName(sheetStonePrices), "sheet_stone_prices");
  });
});
