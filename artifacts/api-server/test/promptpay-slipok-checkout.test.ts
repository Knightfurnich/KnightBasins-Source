import assert from "node:assert/strict";
import { after, afterEach, before, describe, it, mock } from "node:test";
import express from "express";
import { amountForPaymentType, generatePromptPayPayload } from "../src/lib/promptpay.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type LeadRouteModule = typeof import("../src/routes/leads.ts");
type QuoteAccessModule = typeof import("../src/lib/quote-access.ts");

type StoredLead = Record<string, unknown> & { id: number; status: string; notes: string | null };

function createFakeDatabase(lead: StoredLead) {
  const leads: StoredLead[] = [{ ...lead }];
  const slips: Array<Record<string, unknown> & { id: number }> = [];

  const database = {
    select: () => {
      const builder = {
        from: () => builder,
        where: () => builder,
        limit: async () => leads.map((row) => ({ ...row })),
      };
      return builder;
    },
    insert: () => {
      let values: Record<string, unknown>;
      const builder = {
        values(next: Record<string, unknown>) {
          values = next;
          return builder;
        },
        returning: async () => {
          const saved = { ...values, id: slips.length + 1 };
          slips.push(saved);
          return [saved];
        },
      };
      return builder;
    },
    update: () => {
      let setValues: Record<string, unknown>;
      const builder = {
        set(next: Record<string, unknown>) {
          setValues = next;
          return builder;
        },
        where: async () => {
          Object.assign(leads[0]!, setValues);
        },
      };
      return builder;
    },
    leads,
    slips,
  };
  return database;
}

async function startLeadsRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
  const app = express();
  const errors: unknown[] = [];
  app.use(express.json());
  app.use("/api", routeModule.createLeadsRouter(database as never));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    errors.push(error);
    res.status(500).json({ message: "Internal server error" });
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Lead route test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    errors,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function tokenFor(quoteNumber: string, accessSecret: string) {
  const quoteAccess = await importTypeScriptModule<QuoteAccessModule>("src/lib/quote-access.ts");
  return quoteAccess.createPublicQuoteToken(quoteNumber, accessSecret);
}

function slipForm(token: string) {
  const form = new FormData();
  form.append("file", new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" }), "slip.png");
  form.append("token", token);
  return form;
}

const realFetch = globalThis.fetch;

function mockSlipOkFetch(slipOkResponse: () => Response) {
  mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("api.slipok.com")) return slipOkResponse();
    if (url.includes("api.telegram.org")) return new Response(JSON.stringify({ ok: true }), { status: 200 });
    return realFetch(input as never, init);
  });
}

const QUOTE_NUMBER = "Oct 26 / US / 777777";

const originalEnv = {
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  SLIPOK_API_KEY: process.env["SLIPOK_API_KEY"],
  SLIPOK_BRANCH_ID: process.env["SLIPOK_BRANCH_ID"],
  TELEGRAM_BOT_TOKEN: process.env["TELEGRAM_BOT_TOKEN"],
  TELEGRAM_SALES_CHAT_ID: process.env["TELEGRAM_SALES_CHAT_ID"],
};

before(() => {
  process.env["DATABASE_URL"] = "postgres://promptpay-checkout-test";
  process.env["SESSION_SECRET"] = "promptpay-checkout-test-secret";
  process.env["SLIPOK_API_KEY"] = "test-api-key";
  process.env["SLIPOK_BRANCH_ID"] = "test-branch";
  delete process.env["TELEGRAM_BOT_TOKEN"];
  delete process.env["TELEGRAM_SALES_CHAT_ID"];
});

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

afterEach(() => {
  mock.restoreAll();
});

describe("generatePromptPayPayload", () => {
  it("builds a well-formed EMVCo payload embedding the exact amount, for a 13-digit tax ID", () => {
    const payload = generatePromptPayPayload({ target: "0135553014114", amountThb: 1500.5 });

    assert.match(payload, /^000201/); // Payload Format Indicator
    assert.match(payload, /010212/); // dynamic QR point-of-initiation
    assert.ok(payload.includes("0213" + "0135553014114")); // tag 02 (13-digit tax ID), length 13
    assert.ok(payload.includes("5407" + "1500.50")); // tag 54 (amount), 2 decimals
    assert.ok(payload.includes("5802TH"));
    assert.match(payload, /6304[0-9A-F]{4}$/); // trailing CRC
  });

  it("builds a valid payload for a 10-digit mobile number (country-code normalized)", () => {
    const payload = generatePromptPayPayload({ target: "0812345678", amountThb: 100 });
    assert.ok(payload.includes("0113" + "0066812345678")); // tag 01, length 13, "0066" + 9 digits
    assert.ok(payload.includes("5406100.00")); // tag 54, length 6, "100.00"
  });

  it("rejects a non-positive or non-finite amount", () => {
    assert.throws(() => generatePromptPayPayload({ target: "0135553014114", amountThb: 0 }));
    assert.throws(() => generatePromptPayPayload({ target: "0135553014114", amountThb: Number.NaN }));
  });

  it("rejects an unrecognized target format", () => {
    assert.throws(() => generatePromptPayPayload({ target: "not-a-valid-target", amountThb: 100 }));
  });
});

describe("amountForPaymentType", () => {
  it("computes deposit_50, deposit_30 and full correctly, rounded to the nearest baht", () => {
    assert.equal(amountForPaymentType(20000, "deposit_50"), 10000);
    assert.equal(amountForPaymentType(20000, "deposit_30"), 6000);
    assert.equal(amountForPaymentType(20000, "full"), 20000);
    assert.equal(amountForPaymentType(333, "deposit_30"), 100); // 99.9 rounds to 100
  });
});

describe("POST /api/public/quotes/promptpay-qr", () => {
  it("returns a QR payload and the deposit amount for a valid token", async () => {
    const accessSecret = "d".repeat(64);
    const database = createFakeDatabase({
      id: 1,
      name: "คุณทดสอบ",
      phone: "0812345678",
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: accessSecret,
      orderMode: "quick-purchase",
      studioData: { total: 20000 },
      status: "quoted",
      notes: null,
    });
    const server = await startLeadsRoute(database);
    try {
      const token = await tokenFor(QUOTE_NUMBER, accessSecret);
      const response = await fetch(`${server.url}/api/public/quotes/promptpay-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, paymentType: "deposit_50" }),
      });
      const body = await response.json() as Record<string, unknown>;

      assert.equal(response.status, 200);
      assert.equal(body["amountThb"], 10000);
      assert.equal(body["paymentType"], "deposit_50");
      assert.equal(typeof body["qrPayload"], "string");
      assert.match(body["qrPayload"] as string, /10000\.00/);
      const companyAccount = body["companyAccount"] as Record<string, unknown>;
      assert.equal(companyAccount["taxId"], "0135553014114");
      assert.equal(companyAccount["bankAccountName"], "บริษัท ไนท์ เฟอร์นิช จำกัด");
    } finally {
      await server.close();
    }
  });

  it("defaults to the full amount when paymentType is omitted", async () => {
    const accessSecret = "e".repeat(64);
    const database = createFakeDatabase({
      id: 2,
      name: "คุณทดสอบ",
      phone: "0812345678",
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: accessSecret,
      orderMode: "quick-purchase",
      studioData: { total: 15000 },
      status: "quoted",
      notes: null,
    });
    const server = await startLeadsRoute(database);
    try {
      const token = await tokenFor(QUOTE_NUMBER, accessSecret);
      const response = await fetch(`${server.url}/api/public/quotes/promptpay-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await response.json() as Record<string, unknown>;

      assert.equal(response.status, 200);
      assert.equal(body["amountThb"], 15000);
      assert.equal(body["paymentType"], "full");
    } finally {
      await server.close();
    }
  });

  it("returns 404 for an invalid or mismatched token", async () => {
    const database = createFakeDatabase({
      id: 3,
      name: null,
      phone: null,
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: "f".repeat(64),
      orderMode: "quick-purchase",
      studioData: { total: 15000 },
      status: "quoted",
      notes: null,
    });
    const server = await startLeadsRoute(database);
    try {
      const response = await fetch(`${server.url}/api/public/quotes/promptpay-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "not-a-real-token" }),
      });
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });
});

describe("SlipOK auto-confirm (job-163 Auto-Close)", () => {
  it("moves a 'quoted' lead to 'confirmed' and records a note when SlipOK verifies the slip", async () => {
    const accessSecret = "a1".repeat(32);
    const database = createFakeDatabase({
      id: 101,
      name: "คุณทดสอบ",
      phone: "0812345678",
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: accessSecret,
      orderMode: "quick-purchase",
      studioData: { total: 20000 },
      status: "quoted",
      notes: "โน้ตเดิม",
    });
    mockSlipOkFetch(() => new Response(JSON.stringify({
      success: true,
      data: { transRef: "REF999", transDate: "20261002", transTime: "10:00:00", amount: 10000, sender: { name: "นาย ทดสอบ" } },
    }), { status: 200 }));
    const server = await startLeadsRoute(database);
    try {
      const token = await tokenFor(QUOTE_NUMBER, accessSecret);
      const response = await fetch(`${server.url}/api/leads/payment-slip`, { method: "POST", body: slipForm(token) });
      assert.equal(response.status, 201);

      assert.equal(database.leads[0]?.["status"], "confirmed");
      const notes = database.leads[0]?.["notes"] as string;
      assert.match(notes, /โน้ตเดิม/);
      assert.match(notes, /\[ระบบอัตโนมัติ\]: ชำระเงินมัดจำเรียบร้อยแล้วผ่าน SlipOK \(ยอด 10000 บาท\)/);
    } finally {
      await server.close();
    }
  });

  it("does NOT confirm the lead when SlipOK rejects the slip (result.ok === false)", async () => {
    const accessSecret = "a2".repeat(32);
    const database = createFakeDatabase({
      id: 102,
      name: "คุณทดสอบ",
      phone: "0812345678",
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: accessSecret,
      orderMode: "quick-purchase",
      studioData: { total: 20000 },
      status: "quoted",
      notes: null,
    });
    mockSlipOkFetch(() => new Response(JSON.stringify({ success: false, code: 1013, message: "amount mismatch" }), { status: 200 }));
    const server = await startLeadsRoute(database);
    try {
      const token = await tokenFor(QUOTE_NUMBER, accessSecret);
      const response = await fetch(`${server.url}/api/leads/payment-slip`, { method: "POST", body: slipForm(token) });
      assert.equal(response.status, 201);

      assert.equal(database.leads[0]?.["status"], "quoted");
      assert.equal(database.leads[0]?.["notes"], null);
    } finally {
      await server.close();
    }
  });

  it("leaves a lead that is not 'new'/'quoted' untouched even when SlipOK verifies the slip", async () => {
    const accessSecret = "a3".repeat(32);
    const database = createFakeDatabase({
      id: 103,
      name: "คุณทดสอบ",
      phone: "0812345678",
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: accessSecret,
      orderMode: "quick-purchase",
      studioData: { total: 20000 },
      status: "closed",
      notes: null,
    });
    mockSlipOkFetch(() => new Response(JSON.stringify({
      success: true,
      data: { transRef: "REF000", transDate: "20261002", transTime: "10:00:00", amount: 20000, sender: { name: "นาย ทดสอบ" } },
    }), { status: 200 }));
    const server = await startLeadsRoute(database);
    try {
      const token = await tokenFor(QUOTE_NUMBER, accessSecret);
      const response = await fetch(`${server.url}/api/leads/payment-slip`, { method: "POST", body: slipForm(token) });
      assert.equal(response.status, 201);
      assert.equal(database.leads[0]?.["status"], "closed");
    } finally {
      await server.close();
    }
  });

  it("sends the exact required Telegram tag when auto-confirming", async () => {
    process.env["TELEGRAM_BOT_TOKEN"] = "test-token";
    process.env["TELEGRAM_SALES_CHAT_ID"] = "-1004361494281";
    const accessSecret = "a4".repeat(32);
    const database = createFakeDatabase({
      id: 104,
      name: "คุณทดสอบ",
      phone: "0812345678",
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: accessSecret,
      orderMode: "quick-purchase",
      studioData: { total: 20000 },
      status: "new",
      notes: null,
    });
    const telegramCalls: Record<string, unknown>[] = [];
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("api.slipok.com")) {
        return new Response(JSON.stringify({
          success: true,
          data: { transRef: "REF111", transDate: "20261002", transTime: "10:00:00", amount: 10000, sender: { name: "นาย ทดสอบ" } },
        }), { status: 200 });
      }
      if (url.includes("api.telegram.org")) {
        telegramCalls.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return realFetch(input as never, init);
    });
    const server = await startLeadsRoute(database);
    try {
      const token = await tokenFor(QUOTE_NUMBER, accessSecret);
      const response = await fetch(`${server.url}/api/leads/payment-slip`, { method: "POST", body: slipForm(token) });
      assert.equal(response.status, 201);

      const autoConfirmCall = telegramCalls.find((call) => String(call["text"]).includes("เริ่มเปิดคิวผลิตอัตโนมัติ"));
      assert.ok(autoConfirmCall, "expected an auto-confirm Telegram alert to be sent");
      assert.match(String(autoConfirmCall!["text"]), /✅ \[ชำระเงินมัดจำสำเร็จ - เริ่มเปิดคิวผลิตอัตโนมัติ\]/);
      assert.equal(autoConfirmCall!["chat_id"], "-1004361494281");
    } finally {
      await server.close();
      delete process.env["TELEGRAM_BOT_TOKEN"];
      delete process.env["TELEGRAM_SALES_CHAT_ID"];
    }
  });
});
