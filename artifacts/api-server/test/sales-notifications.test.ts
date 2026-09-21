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
    assert.match(requestBody, /⏰ .+ น\./);
    assert.match(requestBody, /KF002 Soft ×3 ชุด/);
    assert.doesNotMatch(requestBody, /600 × 800|หลุม 350/);
    assert.match(requestBody, /ยอดก่อน VAT: 57,000 บาท/);
    assert.match(requestBody, /VAT 7%: 3,990 บาท/);
    assert.match(requestBody, /ยอดรวมสุทธิ: 60,990 บาท/);
    assert.match(requestBody, /quote\/view\?quote=x/);
    const payload = JSON.parse(requestBody) as { reply_markup?: { inline_keyboard?: Array<Array<{ text: string; url: string }>> } };
    assert.deepEqual(payload.reply_markup?.inline_keyboard?.[0]?.[0], {
      text: "เปิดใบเสนอราคา",
      url: "https://example.com/quote/view?quote=x",
    });
  });

  it("includes tax and site details in both Telegram and LINE summaries", async () => {
    const detailedLead = {
      ...lead,
      lineContact: "@knight-customer",
      site: "ห้องน้ำชั้น 18",
      taxName: "บริษัททดสอบ จำกัด",
      taxId: "0105559012345",
      taxBranch: "สำนักงานใหญ่",
      taxAddress: "99 ถนนสุขุมวิท กรุงเทพฯ 10110",
      preferredContact: "line",
      customerRole: "homeowner",
      propertyType: "condo",
      condoFloor: "18",
      expectedInstallationDate: "2026-10-15",
    };

    for (const channel of ["telegram", "line"] as const) {
      process.env["NOTIFY_CHANNEL"] = channel;
      process.env["TELEGRAM_BOT_TOKEN"] = "test-token";
      process.env["TELEGRAM_SALES_CHAT_ID"] = "test-chat";
      process.env["LINE_CHANNEL_ACCESS_TOKEN"] = "line-token";
      process.env["LINE_SALES_DESTINATION_ID"] = "line-destination";
      let requestBody = "";
      globalThis.fetch = async (_input, init) => {
        requestBody = String(init?.body ?? "");
        return new Response(channel === "telegram" ? JSON.stringify({ ok: true }) : "{}", { status: 200 });
      };

      const result = await (await module()).notifyQuote(detailedLead, "https://example.com", "/quote/view?quote=x");
      assert.equal(result.notificationStatus, "notified");
      const text = channel === "telegram"
        ? (JSON.parse(requestBody) as { text: string }).text
        : (JSON.parse(requestBody) as { messages: Array<{ text: string }> }).messages[0]?.text ?? "";

      assert.match(text, /บริษัททดสอบ จำกัด/);
      assert.match(text, /Tax ID 0105559012345/);
      assert.match(text, /สำนักงานใหญ่/);
      assert.match(text, /99 ถนนสุขุมวิท กรุงเทพฯ 10110/);
      assert.match(text, /LINE/);
      assert.match(text, /@knight-customer/);
      assert.match(text, /ห้องน้ำชั้น 18/);
      assert.match(text, /ลูกค้าบ้านพักอาศัย/);
      assert.match(text, /คอนโด · ชั้น 18/);
      assert.match(text, /15 ต\.ค\. 2569/);
    }
  });

  it("keeps Studio service lines in the Telegram summary", async () => {
    process.env["NOTIFY_CHANNEL"] = "telegram";
    process.env["TELEGRAM_BOT_TOKEN"] = "test-token";
    process.env["TELEGRAM_SALES_CHAT_ID"] = "test-chat";
    let requestBody = "";
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const studioLead = {
      ...lead,
      studioData: {
        notification: {
          items: [
            { kind: "service" as const, code: "WORKPIECES", description: "3 ชิ้นงาน · 6 แผ่น", quantity: 3, unit: "ชิ้นงาน" },
            { kind: "service" as const, code: "UPSTAND", description: "บัวยาว 4.59 ม.", quantity: 4.59, unit: "ม." },
            { kind: "service" as const, code: "OPEN_EDGE", description: "ขอบเปิดยาว 1.24 ม.", quantity: 1.24, unit: "ม." },
            { kind: "service" as const, code: "INSTALL", description: "ค่าติดตั้ง / ค่าแรงต่อชุด", quantity: 1, unit: "ชุด" },
            { kind: "service" as const, code: "SMALL-JOB", description: "ค่าดำเนินการงานพื้นที่เล็ก", quantity: 1, unit: "งาน" },
          ],
          subtotal: 57616,
          vatAmount: 0,
          total: 57616,
          vat: false,
        },
      },
    };
    await (await module()).notifyQuote(studioLead, "https://example.com", "/quote/view?quote=x");
    assert.match(requestBody, /3 ชิ้นงาน/);
    assert.match(requestBody, /บัวยาว 4\.59 ม\./);
    assert.match(requestBody, /ขอบเปิดยาว 1\.24 ม\./);
    assert.match(requestBody, /ค่าติดตั้ง/);
    assert.match(requestBody, /ค่าดำเนินการงานพื้นที่เล็ก/);
  });

  it("adds the 9,500 stone-rate warning below the stone line", async () => {
    process.env["NOTIFY_CHANNEL"] = "telegram";
    process.env["TELEGRAM_BOT_TOKEN"] = "test-token";
    process.env["TELEGRAM_SALES_CHAT_ID"] = "test-chat";
    let requestBody = "";
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const rateLead = {
      ...lead,
      studioData: {
        notification: {
          items: [
            { kind: "stone" as const, code: "BR816O", description: "Black River", quantity: 1.2, unit: "ตร.ม.", unitPriceTHB: 9500 },
          ],
          subtotal: 12345,
          vatAmount: 0,
          total: 12345,
          vat: false,
        },
      },
    };
    await (await module()).notifyQuote(rateLead, "https://example.com", "/quote/view?quote=x");
    const warning = "*(ยอดรวมสุทธินี้ยังไม่รวมราคาหินลายหินอ่อน — ทีมขายจะประเมินราคาเพิ่ม)*";
    assert.match(requestBody, new RegExp(warning.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(requestBody.indexOf("- หิน BR816O") < requestBody.indexOf(warning));
  });

  it("sends the same 9,500 stone-rate warning through LINE", async () => {
    process.env["NOTIFY_CHANNEL"] = "line";
    process.env["LINE_CHANNEL_ACCESS_TOKEN"] = "line-token";
    process.env["LINE_SALES_DESTINATION_ID"] = "line-destination";
    let requestBody = "";
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response("{}", { status: 200 });
    };
    const rateLead = {
      ...lead,
      studioData: {
        notification: {
          items: [{ kind: "stone" as const, code: "BR816O", description: "Black River", quantity: 1, unit: "ตร.ม.", unitPriceTHB: 9500 }],
          subtotal: 10000,
          vatAmount: 0,
          total: 10000,
          vat: false,
        },
      },
    };
    const result = await (await module()).notifyQuote(rateLead, "https://example.com", "/quote/view?quote=x");
    assert.equal(result.notificationStatus, "notified");
    const payload = JSON.parse(requestBody) as { to: string; messages: Array<{ text: string }> };
    assert.equal(payload.to, "line-destination");
    assert.match(payload.messages[0]?.text ?? "", /ยอดรวมสุทธินี้ยังไม่รวมราคาหินลายหินอ่อน/);
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
    const result = await (await module()).notifySketch({ ...lead, quoteNumber: null }, "https://example.com");
    assert.equal(result.notificationStatus, "notified");
    assert.match(requestBody, /https:\/\/example.com\/api\/uploads\/sketch.png/);
    assert.match(requestBody, /KF002 Soft ×3 ชุด/);
    assert.match(requestBody, /ยอดรวมสุทธิ: 60,990 บาท/);
    assert.match(requestBody, /แนบรูปมาแล้วในข้อความนี้/);
    const payload = JSON.parse(requestBody) as { reply_markup?: { inline_keyboard?: Array<Array<{ text: string; url: string }>> } };
    assert.deepEqual(payload.reply_markup?.inline_keyboard?.[0]?.[0], {
      text: "เปิดดูรูปเต็ม",
      url: "https://example.com/api/uploads/sketch.png",
    });
    assert.doesNotMatch(requestBody, /"ลิงก์":/);
  });

  it("does not infer a public quote link from a quote number", async () => {
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
    assert.doesNotMatch(requestBody, /quote\/view/);
    assert.match(requestBody, /แนบรูปมาแล้วในข้อความนี้/);
    const payload = JSON.parse(requestBody) as { reply_markup?: { inline_keyboard?: Array<Array<{ text: string; url: string }>> } };
    assert.deepEqual(payload.reply_markup?.inline_keyboard?.[0]?.[0], {
      text: "เปิดดูรูปเต็ม",
      url: "https://example.com/api/uploads/sketch.png",
    });
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

  it("rounds displayed baht values while keeping fractional source amounts valid", async () => {
    process.env["NOTIFY_CHANNEL"] = "telegram";
    process.env["TELEGRAM_BOT_TOKEN"] = "test-token";
    process.env["TELEGRAM_SALES_CHAT_ID"] = "test-chat";
    let requestBody = "";
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const fractionalLead = {
      ...lead,
      studioData: {
        ...lead.studioData,
        subtotal: 70523.7,
        vatAmount: 4936.659,
        total: 75460.359,
        vat: true,
      },
    };
    const result = await (await module()).notifyQuote(fractionalLead, "https://example.com", "/quote/view?quote=x");
    assert.equal(result.notificationStatus, "notified");
    assert.match(requestBody, /ยอดก่อน VAT: 70,524 บาท/);
    assert.match(requestBody, /VAT 7%: 4,937 บาท/);
    assert.match(requestBody, /ยอดรวมสุทธิ: 75,460 บาท/);
    assert.doesNotMatch(requestBody, /70,523\.7|4,936\.659|75,460\.359/);
  });

  it("tells the sales team to check a no-QR slip by eye instead of treating it as rejected", async () => {
    process.env["NOTIFY_CHANNEL"] = "telegram";
    process.env["TELEGRAM_BOT_TOKEN"] = "test-token";
    process.env["TELEGRAM_SALES_CHAT_ID"] = "test-chat";
    let requestBody = "";
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    await (await module()).notifyPaymentSlip(lead, "https://example.com", "/api/uploads/slip.png", {
      status: "needs_review",
      claimedAmountThb: 60990,
      verifiedAmountThb: null,
      senderName: null,
      errorCode: "1007",
      message: "รูปภาพไม่มี QR Code",
    });
    assert.match(requestBody, /ต้องตรวจสอบด้วยตา/);
    assert.match(requestBody, /ไม่มี QR Code/);
    assert.match(requestBody, /code 1007/);
    assert.doesNotMatch(requestBody, /ยังไม่ผ่านการตรวจสอบอัตโนมัติ/);
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
