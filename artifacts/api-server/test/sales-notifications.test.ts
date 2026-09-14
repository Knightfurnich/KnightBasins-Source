import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { importTypeScriptModule } from "./route-harness.ts";

type NotificationModule = typeof import("../src/lib/sales-notifications.ts");

const originalEnv = {
  channel: process.env["NOTIFY_CHANNEL"],
  token: process.env["TELEGRAM_BOT_TOKEN"],
  chatId: process.env["TELEGRAM_SALES_CHAT_ID"],
  lineToken: process.env["LINE_CHANNEL_ACCESS_TOKEN"],
  lineDestination: process.env["LINE_SALES_DESTINATION_ID"],
};
const originalFetch = globalThis.fetch;

afterEach(() => {
  process.env["NOTIFY_CHANNEL"] = originalEnv.channel;
  process.env["TELEGRAM_BOT_TOKEN"] = originalEnv.token;
  process.env["TELEGRAM_SALES_CHAT_ID"] = originalEnv.chatId;
  process.env["LINE_CHANNEL_ACCESS_TOKEN"] = originalEnv.lineToken;
  process.env["LINE_SALES_DESTINATION_ID"] = originalEnv.lineDestination;
  globalThis.fetch = originalFetch;
});

async function module() {
  return importTypeScriptModule<NotificationModule>("src/lib/sales-notifications.ts");
}

const lead = {
  name: "คุณทดสอบ",
  phone: "0812345678",
  project: "โครงการทดสอบ",
  productSkus: ["KF001"],
  quoteNumber: "Sep 26 / US / 123456",
  orderMode: "quick-purchase",
  studioData: {
    kind: "quick-purchase",
    total: 71450,
    items: [{ code: "KF001", description: "อ่างล้างหน้า", quantity: 3, unit: "ชุด" }],
  },
  sketchUrl: "/api/uploads/sketch.png",
};

describe("sales notifications", () => {
  it("reports a saved-but-not-notified result without Telegram credentials", async () => {
    process.env["NOTIFY_CHANNEL"] = "telegram";
    delete process.env["TELEGRAM_BOT_TOKEN"];
    delete process.env["TELEGRAM_SALES_CHAT_ID"];
    const result = await (await module()).notifyQuote(lead, "https://example.com", "/quote/view?quote=x");
    assert.equal(result.notificationStatus, "saved_not_notified");
    assert.match(result.message, /บันทึกแล้ว/);
  });

  it("sends a quote summary through Telegram", async () => {
    process.env["NOTIFY_CHANNEL"] = "telegram";
    process.env["TELEGRAM_BOT_TOKEN"] = "test-token";
    process.env["TELEGRAM_SALES_CHAT_ID"] = "test-chat";
    let requestBody = "";
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const result = await (await module()).notifyQuote(lead, "https://example.com", "/quote/view?quote=x");
    assert.equal(result.notificationStatus, "notified");
    assert.match(requestBody, /Sep 26/);
    assert.match(requestBody, /71,450/);
    assert.match(requestBody, /quote\/view\?quote=x/);
  });

  it("uses sendPhoto for sketch notifications", async () => {
    process.env["NOTIFY_CHANNEL"] = "telegram";
    process.env["TELEGRAM_BOT_TOKEN"] = "test-token";
    process.env["TELEGRAM_SALES_CHAT_ID"] = "test-chat";
    let requestBody = "";
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const result = await (await module()).notifySketch(lead, "https://example.com");
    assert.equal(result.notificationStatus, "notified");
    assert.match(requestBody, /https:\/\/example.com\/api\/uploads\/sketch.png/);
  });

  it("returns a retryable saved-not-notified result when Telegram rejects a message", async () => {
    process.env["NOTIFY_CHANNEL"] = "telegram";
    process.env["TELEGRAM_BOT_TOKEN"] = "test-token";
    process.env["TELEGRAM_SALES_CHAT_ID"] = "test-chat";
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, description: "chat not found" }), { status: 400 });
    const result = await (await module()).notifyQuote(lead, "https://example.com", "/quote/view?quote=x");
    assert.equal(result.notificationStatus, "saved_not_notified");
    assert.match(result.message, /ลองใหม่/);
  });
});
