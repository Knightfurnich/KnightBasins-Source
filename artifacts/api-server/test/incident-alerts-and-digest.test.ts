import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { PgDialect } from "drizzle-orm/pg-core";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { createIncidentAlertService } from "../src/lib/incident-alerts.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

type CompiledQuery = { sql: string; params: unknown[] };
type TelegramRequest = { url: string; body: { chat_id: string; text: string } };

const adminRoute = new URL("../src/routes/admin-router.ts", import.meta.url);
const dialect = new PgDialect();
const originalEnv = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  DATABASE_URL: process.env["DATABASE_URL"],
  NODE_ENV: process.env["NODE_ENV"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  TELEGRAM_BOT_TOKEN: process.env["TELEGRAM_BOT_TOKEN"],
  TELEGRAM_SALES_CHAT_ID: process.env["TELEGRAM_SALES_CHAT_ID"],
};
const originalFetch = globalThis.fetch;

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = originalFetch;
}

function configureTestEnvironment() {
  process.env["ADMIN_PASSWORD"] = "digest-test-password";
  process.env["DATABASE_URL"] = "postgres://digest-test";
  process.env["NODE_ENV"] = "test";
  process.env["SESSION_SECRET"] = "digest-test-session-secret";
  process.env["TELEGRAM_BOT_TOKEN"] = "mock-bot-token";
  process.env["TELEGRAM_SALES_CHAT_ID"] = "mock-sales-chat";
  delete process.env["ADMIN_ROLE"];
}

before(configureTestEnvironment);
after(restoreEnvironment);

async function startAdmin(database: unknown) {
  const routeModule = await importTypeScriptModule<AdminModule>(adminRoute.pathname);
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", routeModule.createAdminRouter(database));
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: "Internal server error" });
  });

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Weekly digest test server did not expose a TCP address");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

const ownerCookie = () => `knight_admin_session=${createAdminToken()}`;

function createDigestDatabase() {
  const calls: CompiledQuery[] = [];
  const database = {
    execute: async (query: unknown) => {
      const compiled = dialect.sqlToQuery(query as never);
      calls.push(compiled);
      if (/GROUP BY 1, 2/i.test(compiled.sql)) {
        return {
          rows: [
            { key: "STUDIO_LAYOUT_INVALID", category: "ux", count: 3 },
            { key: "SLIP_UPLOAD_FAILED", category: "slip", count: 2 },
            { key: "INVALID_LEAD_PAYLOAD", category: "form", count: 1 },
          ],
        };
      }
      return { rows: [{ quoteRequests: 9, customerEvents: 20, successCount: 16, frictionCount: 4 }] };
    },
  };
  return { database, calls };
}

function installTelegramMock(requests: TelegramRequest[]) {
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? "{}")) as TelegramRequest["body"],
    });
    return new Response(JSON.stringify({ ok: true, result: { message_id: requests.length } }), { status: 200 });
  };
}

describe("slip incident alert and weekly digest", () => {
  it("alerts on the third slip error and suppresses repeats during the 30-minute cooldown", async () => {
    const requests: TelegramRequest[] = [];
    installTelegramMock(requests);
    let failureCount = 0;
    const calls: CompiledQuery[] = [];
    const database = {
      execute: async (query: unknown) => {
        const compiled = dialect.sqlToQuery(query as never);
        calls.push(compiled);
        return { rows: [{ count: failureCount }] };
      },
    };
    const service = createIncidentAlertService();
    const firstAt = new Date("2026-10-03T03:00:00.000Z");

    failureCount = 1;
    assert.deepEqual(await service(database, firstAt), { status: "below_threshold", recentFailures: 1 });
    failureCount = 2;
    assert.deepEqual(await service(database, firstAt), { status: "below_threshold", recentFailures: 2 });
    failureCount = 3;
    assert.deepEqual(await service(database, firstAt), { status: "sent", recentFailures: 3 });
    failureCount = 4;
    assert.deepEqual(
      await service(database, new Date(firstAt.getTime() + 60_000)),
      { status: "cooldown", recentFailures: 4 },
    );

    assert.equal(requests.length, 1);
    assert.match(requests[0]!.url, /api\.telegram\.org\/botmock-bot-token\/sendMessage$/);
    assert.equal(requests[0]!.body.chat_id, "mock-sales-chat");
    assert.equal(requests[0]!.body.text, "🚨 [แจ้งเตือนด่วน Knight Basins] พบปัญหาสลิปการเงินล้มเหลว 3 ครั้งในรอบ 1 ชม. ล่าสุด! กรุณาตรวจสอบที่ /admin/logs");
    assert.match(calls[0]!.sql, /action = 'slip\.upload'/i);
    assert.match(calls[0]!.sql, /status = 'error'/i);
    assert.ok(calls[0]!.params.some((value) => value instanceof Date));
  });

  it("requires an owner and rejects invalid dryRun values", async () => {
    const { database } = createDigestDatabase();
    const server = await startAdmin(database);
    try {
      assert.equal((await originalFetch(`${server.url}/api/admin/audit-logs/send-weekly-digest?dryRun=1`, { method: "POST" })).status, 401);
      process.env["ADMIN_ROLE"] = "staff";
      const headers = { cookie: ownerCookie() };
      assert.equal((await originalFetch(`${server.url}/api/admin/audit-logs/send-weekly-digest?dryRun=1`, { method: "POST", headers })).status, 403);
      delete process.env["ADMIN_ROLE"];
      assert.equal((await originalFetch(`${server.url}/api/admin/audit-logs/send-weekly-digest?dryRun=yes`, { method: "POST", headers })).status, 400);
    } finally {
      await server.close();
      delete process.env["ADMIN_ROLE"];
    }
  });

  it("previews seven-day quote, success, friction and top-issue data without sending Telegram", async () => {
    const requests: TelegramRequest[] = [];
    installTelegramMock(requests);
    const { database, calls } = createDigestDatabase();
    const server = await startAdmin(database);
    try {
      const response = await originalFetch(`${server.url}/api/admin/audit-logs/send-weekly-digest?dryRun=1`, {
        method: "POST",
        headers: { cookie: ownerCookie() },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const result = await response.json() as {
        dryRun: boolean;
        stats: Record<string, number>;
        text: string;
        generatedAt: string;
      };

      assert.equal(result.dryRun, true);
      assert.deepEqual(result.stats, {
        quoteRequests: 9,
        customerEvents: 20,
        successCount: 16,
        successPercent: 80,
        frictionCount: 4,
        frictionPercent: 20,
      });
      assert.match(result.text, /Knight UX Digest/);
      assert.match(result.text, /สร้างใบเสนอราคา: 9 ราย/);
      assert.match(result.text, /รายการสำเร็จ: 16 ราย \(80\.0%\)/);
      assert.match(result.text, /จุดติดขัดที่พบ: 4 ราย \(20\.0%\)/);
      assert.match(result.text, /1\. ลูกค้าติดขัดระหว่างเลือกอ่างหรือจัดวางผังเคาน์เตอร์ — 3 ครั้ง/);
      assert.match(result.text, /ข้อเสนอแนะเพื่อพัฒนา:/);
      assert.match(result.text, /https:\/\/knightbasins\.com\/admin\/logs/);
      assert.ok(Number.isFinite(Date.parse(result.generatedAt)));
      assert.equal(requests.length, 0);

      const summaryQuery = calls.find((call) => /"quoteRequests"/.test(call.sql));
      const painPointsQuery = calls.find((call) => /GROUP BY 1, 2/i.test(call.sql));
      assert.ok(summaryQuery);
      assert.ok(painPointsQuery);
      assert.match(summaryQuery.sql, /quote_requested/);
      assert.match(summaryQuery.sql, /lead\.upsert/);
      assert.ok(summaryQuery.params.filter((value) => value instanceof Date).length >= 2);
      assert.match(painPointsQuery.sql, /status IN \('warning', 'error'\)/i);
    } finally {
      await server.close();
    }
  });

  it("sends the confirmed weekly digest through the mocked Telegram API", async () => {
    const requests: TelegramRequest[] = [];
    installTelegramMock(requests);
    const { database } = createDigestDatabase();
    const server = await startAdmin(database);
    try {
      const response = await originalFetch(`${server.url}/api/admin/audit-logs/send-weekly-digest`, {
        method: "POST",
        headers: { cookie: ownerCookie() },
      });
      assert.equal(response.status, 200);
      const result = await response.json() as { sent: boolean; text: string };
      assert.equal(result.sent, true);
      assert.equal(requests.length, 1);
      assert.equal(requests[0]!.body.chat_id, "mock-sales-chat");
      assert.equal(requests[0]!.body.text, result.text);

      const duplicate = await originalFetch(`${server.url}/api/admin/audit-logs/send-weekly-digest`, {
        method: "POST",
        headers: { cookie: ownerCookie() },
      });
      assert.equal(duplicate.status, 429);
      assert.equal(requests.length, 1);
    } finally {
      await server.close();
    }
  });
});