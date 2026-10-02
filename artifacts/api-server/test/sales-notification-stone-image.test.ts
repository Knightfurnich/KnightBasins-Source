import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { importTypeScriptModule } from "./route-harness.ts";

type NotificationModule = typeof import("../src/lib/sales-notifications.ts");

const ENV_KEYS = ["NOTIFY_CHANNEL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_SALES_CHAT_ID", "LINE_CHANNEL_ACCESS_TOKEN", "LINE_MESSAGING_ACCESS_TOKEN", "LINE_SALES_DESTINATION_ID"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  globalThis.fetch = originalFetch;
});

const ORIGIN = "https://knightbasins.example.com";
const QUOTE_PATH = "/quote/view?token=abc";
const UPLOAD = `${ORIGIN}/api/uploads/catalog-abc.jpg?v=abc`;

type Item = Record<string, unknown>;

function leadWith(items: Item[]) {
  return {
    name: "คุณทดสอบ",
    phone: "0812345678",
    project: "โครงการทดสอบ",
    productSkus: ["KF001"],
    quoteNumber: "Oct 26 / US / 123456",
    orderMode: "studio",
    studioData: { notification: { items, subtotal: 10000, vatAmount: 700, total: 10700, vat: true } },
  };
}

const stone = (extra: Item = {}): Item => ({ kind: "stone", code: "BW010", description: "Bright White", quantity: 2, unit: "ตร.ม.", unitPriceTHB: 7500, totalTHB: 15000, ...extra });
const basin = (extra: Item = {}): Item => ({ kind: "basin", code: "KF001", description: "Soft", quantity: 1, unit: "ชุด", unitPriceTHB: 8000, totalTHB: 8000, ...extra });
const service = (extra: Item = {}): Item => ({ kind: "service", code: "INSTALL", description: "ค่าติดตั้ง", quantity: 1, unit: "จุด", unitPriceTHB: 2000, totalTHB: 2000, ...extra });

async function sentLineText(items: Item[]) {
  process.env["NOTIFY_CHANNEL"] = "line";
  process.env["LINE_CHANNEL_ACCESS_TOKEN"] = "test-line-token";
  process.env["LINE_SALES_DESTINATION_ID"] = "test-destination";
  let text = "";
  globalThis.fetch = async (_input, init) => {
    text = (JSON.parse(String(init?.body ?? "{}")) as { messages: { text: string }[] }).messages[0]!.text;
    return new Response("{}", { status: 200 });
  };
  const { notifyQuote } = await importTypeScriptModule<NotificationModule>("src/lib/sales-notifications.ts");
  const result = await notifyQuote(leadWith(items), ORIGIN, QUOTE_PATH);
  assert.equal(result.notificationStatus, "notified");
  return text;
}

const photoLines = (text: string) => text.split("\n").filter((line) => line.startsWith("รูปหิน "));

describe("stone photo in the sales notification", () => {
  it("adds the stone's photo link as a plain text line under the items", async () => {
    const text = await sentLineText([stone({ imageUrl: UPLOAD })]);
    assert.deepEqual(photoLines(text), [`รูปหิน BW010: ${UPLOAD}`]);
    const lines = text.split("\n");
    assert.ok(lines.indexOf(`รูปหิน BW010: ${UPLOAD}`) > lines.findIndex((line) => line.startsWith("- หิน BW010")), "photo line comes after the stone line");
  });

  it("sends the same line through Telegram", async () => {
    process.env["NOTIFY_CHANNEL"] = "telegram";
    process.env["TELEGRAM_BOT_TOKEN"] = "test-token";
    process.env["TELEGRAM_SALES_CHAT_ID"] = "test-chat";
    let text = "";
    globalThis.fetch = async (_input, init) => {
      text = (JSON.parse(String(init?.body ?? "{}")) as { text: string }).text;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const { notifyQuote } = await importTypeScriptModule<NotificationModule>("src/lib/sales-notifications.ts");
    await notifyQuote(leadWith([stone({ imageUrl: UPLOAD })]), ORIGIN, QUOTE_PATH);
    assert.deepEqual(photoLines(text), [`รูปหิน BW010: ${UPLOAD}`]);
  });

  it("resolves a relative upload path against the site origin", async () => {
    const text = await sentLineText([stone({ imageUrl: "/api/uploads/catalog-abc.jpg?v=abc" })]);
    assert.deepEqual(photoLines(text), [`รูปหิน BW010: ${UPLOAD}`]);
  });

  it("accepts a catalog photo served from a sibling host of the same domain", async () => {
    const text = await sentLineText([stone({ imageUrl: "https://api.example.com/kb/images/slab/BW010.png" })]);
    assert.deepEqual(photoLines(text), ["รูปหิน BW010: https://api.example.com/kb/images/slab/BW010.png"]);
  });

  it("leaves the message exactly as before when no stone has a photo", async () => {
    const without = await sentLineText([stone(), basin(), service()]);
    assert.deepEqual(photoLines(without), []);
    assert.doesNotMatch(without, /รูปหิน/);
    const withBlank = await sentLineText([stone({ imageUrl: "" }), basin(), service()]);
    const withNull = await sentLineText([stone({ imageUrl: null }), basin(), service()]);
    // The timestamp line is the only part that can differ between two sends.
    const strip = (text: string) => text.split("\n").filter((line) => !line.startsWith("⏰")).join("\n");
    assert.equal(strip(withBlank), strip(without));
    assert.equal(strip(withNull), strip(without));
  });

  it("does not add photos for basin or service rows", async () => {
    const text = await sentLineText([stone(), basin({ imageUrl: UPLOAD }), service({ imageUrl: UPLOAD })]);
    assert.deepEqual(photoLines(text), []);
    assert.doesNotMatch(text, /catalog-abc\.jpg/);
  });

  it("lists at most three stone photos, one per stone code", async () => {
    const text = await sentLineText([
      stone({ code: "A1", imageUrl: `${ORIGIN}/a1.jpg` }),
      stone({ code: "A1", imageUrl: `${ORIGIN}/a1-again.jpg` }),
      stone({ code: "B2", imageUrl: `${ORIGIN}/b2.jpg` }),
      stone({ code: "C3", imageUrl: `${ORIGIN}/c3.jpg` }),
      stone({ code: "D4", imageUrl: `${ORIGIN}/d4.jpg` }),
    ]);
    assert.deepEqual(photoLines(text), [`รูปหิน A1: ${ORIGIN}/a1.jpg`, `รูปหิน B2: ${ORIGIN}/b2.jpg`, `รูปหิน C3: ${ORIGIN}/c3.jpg`]);
  });

  it("drops links that do not belong to this site, because the customer's browser supplies them", async () => {
    const unsafe = [
      "https://evil.example.org/phish.jpg",
      "https://knightbasins.example.com.evil.org/x.jpg",
      "http://169.254.169.254/latest/meta-data",
      "//evil.example.org/x.jpg",
      "javascript:alert(1)",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "file:///etc/passwd",
      "https://user:secret@knightbasins.example.com/x.jpg",
      `${ORIGIN}/${"a".repeat(600)}.jpg`,
    ];
    for (const imageUrl of unsafe) {
      const text = await sentLineText([stone({ imageUrl })]);
      assert.deepEqual(photoLines(text), [], `must not forward ${imageUrl.slice(0, 40)}`);
    }
  });

  it("never puts tokens or server paths in the photo line", async () => {
    const text = await sentLineText([stone({ imageUrl: UPLOAD })]);
    assert.doesNotMatch(text, /test-line-token|test-destination|\/opt\/|\/app\/|\.env/);
  });

  it("leaves the stone, price and total lines unchanged", async () => {
    const baseline = await sentLineText([stone()]);
    const withPhoto = await sentLineText([stone({ imageUrl: UPLOAD })]);
    const strip = (text: string) => text.split("\n").filter((line) => !line.startsWith("⏰") && !line.startsWith("รูปหิน ")).join("\n");
    assert.equal(strip(withPhoto), strip(baseline));
    assert.match(withPhoto, /- หิน BW010 Bright White 2 ตร\.ม\. × ฿7,500 = ฿15,000/);
    assert.match(withPhoto, /ยอดรวมสุทธิ: 10,700 บาท/);
  });
});
