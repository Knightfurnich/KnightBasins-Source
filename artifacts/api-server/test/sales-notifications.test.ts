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
    subtotal: 57000,
    vatAmount: 3990,
    total: 60990,
    vat: true,
    items: [{ code: "KF002", description: "Soft · อ่างวางเคาน์เตอร์ · 600 × 800 × 200 mm · หลุม 350 × 500 × 130 mm", quantity: 3, unit: "ชุด", notificationKind: "basin" }],
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
    assert.match(requestBody, /KF002 Soft ×3 ชุด/);
    assert.doesNotMatch(requestBody, /600 × 800|หลุม 350/);
    assert.match(requestBody, /ยอดก่อน VAT: 57,000 บาท/);
    assert.match(requestBody, /VAT 7%: 3,990 บาท/);
    assert.match(requestBody, /ยอดรวมสุทธิ: 60,990 บาท/);
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
    assert.match(requestBody, /KF002 Soft ×3 ชุด/);
    assert.match(requestBody, /ยอดรวมสุทธิ: 60,990 บาท/);
  });

  it("omits the VAT line when the quote does not charge VAT", async () => {
    process.env["NOTIFY_CHANNEL"] = "telegram";
    process.env["TELEGRAM_BOT_TOKEN"] = "test-token";
    process.env["TELEGRAM_SALES_CHAT_ID"] = "test-chat";
    let requestBody = "";
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const noVatLead = {
      ...lead,
      studioData: {
        ...lead.studioData,
        vat: false,
        vatAmount: 0,
        total: 57000,
      },
    };
    const result = await (await module()).notifyQuote(noVatLead, "https://example.com", "/quote/view?quote=x");
    assert.equal(result.notificationStatus, "notified");
    assert.match(requestBody, /ยอดรวม \(ยังไม่รวม VAT\): 57,000 บาท/);
    assert.doesNotMatch(requestBody, /VAT 7%/);
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
