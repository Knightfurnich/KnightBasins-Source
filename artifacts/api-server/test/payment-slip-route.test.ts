import assert from "node:assert/strict";
import { after, afterEach, before, describe, it, mock } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { importTypeScriptModule } from "./route-harness.ts";

type LeadRouteModule = typeof import("../src/routes/leads.ts");
type QuoteAccessModule = typeof import("../src/lib/quote-access.ts");

type StoredSlip = Record<string, unknown> & { id: number; leadId: number };

const QUOTE_NUMBER = "Sep 26 / US / 999999";

function createFakeDatabase(lead: Record<string, unknown>) {
  const slips: StoredSlip[] = [];
  const database = {
    select: () => {
      const builder = {
        from: () => builder,
        where: () => builder,
        limit: async () => [lead],
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
          const saved = { ...values, id: slips.length + 1 } as StoredSlip;
          slips.push(saved);
          return [saved];
        },
      };
      return builder;
    },
    slips,
  };
  return database;
}

async function startLeadsRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
  const app = express();
  app.use(express.json());
  app.use("/api", routeModule.createLeadsRouter(database as never));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: error instanceof Error ? error.message : "Internal server error" });
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Payment slip route test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

const originalEnv = {
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  SLIPOK_API_KEY: process.env["SLIPOK_API_KEY"],
  SLIPOK_BRANCH_ID: process.env["SLIPOK_BRANCH_ID"],
};
let uploadDirectory: string;

before(async () => {
  process.env["DATABASE_URL"] = "postgres://payment-slip-test";
  process.env["SESSION_SECRET"] = "payment-slip-test-secret";
  process.env["SLIPOK_API_KEY"] = "test-api-key";
  process.env["SLIPOK_BRANCH_ID"] = "test-branch";
  uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "payment-slip-uploads-"));
  process.env["UPLOAD_DIR"] = uploadDirectory;
});

after(async () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  delete process.env["UPLOAD_DIR"];
  await rm(uploadDirectory, { force: true, recursive: true });
});

afterEach(() => {
  mock.restoreAll();
});

const realFetch = globalThis.fetch;

function mockSlipOkFetch(slipOkResponse: () => Response) {
  mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("api.slipok.com")) return slipOkResponse();
    return realFetch(input as never, init);
  });
}

async function tokenFor(quoteNumber: string, accessSecret: string) {
  const quoteAccess = await importTypeScriptModule<QuoteAccessModule>("src/lib/quote-access.ts");
  return quoteAccess.createPublicQuoteToken(quoteNumber, accessSecret);
}

function slipForm(token: string, kind?: string, paymentType?: string) {
  const form = new FormData();
  form.append("file", new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" }), "slip.png");
  form.append("token", token);
  if (kind) form.append("kind", kind);
  if (paymentType) form.append("paymentType", paymentType);
  return form;
}

describe("payment slip upload", () => {
  it("returns 404 when the quote token does not match a lead", async () => {
    const database = createFakeDatabase({
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: "a".repeat(64),
      orderMode: "quick-purchase",
      studioData: { total: 20000 },
    });
    const server = await startLeadsRoute(database);
    try {
      const response = await fetch(`${server.url}/api/leads/payment-slip`, {
        method: "POST",
        body: slipForm("not-a-real-token"),
      });
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });

  it("records a verified slip when SlipOK confirms the amount", async () => {
    const accessSecret = "b".repeat(64);
    const database = createFakeDatabase({
      id: 42,
      name: "คุณทดสอบ",
      phone: "0812345678",
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: accessSecret,
      orderMode: "quick-purchase",
      studioData: { total: 20000 },
    });
    mockSlipOkFetch(() => new Response(JSON.stringify({
      success: true,
      data: { transRef: "REF123", transDate: "20260921", transTime: "10:00:00", amount: 20000, sender: { name: "นาย ทดสอบ" } },
    }), { status: 200 }));
    const server = await startLeadsRoute(database);
    try {
      const token = await tokenFor(QUOTE_NUMBER, accessSecret);
      const response = await fetch(`${server.url}/api/leads/payment-slip`, { method: "POST", body: slipForm(token) });
      const body = await response.json() as Record<string, unknown>;
      assert.equal(response.status, 201);
      assert.equal(body.status, "verified");
      assert.equal(body.verifiedAmountThb, 20000);
      assert.equal(body.senderName, "นาย ทดสอบ");
      assert.equal(body.transRef, "REF123");
      assert.equal(database.slips[0]?.claimedAmountThb, 20000);
    } finally {
      await server.close();
    }
  });

  it("expects the deposit share when the client sends paymentType", async () => {
    const accessSecret = "d".repeat(64);
    const database = createFakeDatabase({
      id: 44,
      name: "คุณทดสอบ",
      phone: "0812345678",
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: accessSecret,
      orderMode: "quick-purchase",
      studioData: { total: 20000 },
    });
    mockSlipOkFetch(() => new Response(JSON.stringify({
      success: true,
      data: { transRef: "REF-DEP", transDate: "20261002", transTime: "09:00:00", amount: 10000, sender: { name: "นาย ทดสอบ" } },
    }), { status: 200 }));
    const server = await startLeadsRoute(database);
    try {
      const token = await tokenFor(QUOTE_NUMBER, accessSecret);
      const response = await fetch(`${server.url}/api/leads/payment-slip`, {
        method: "POST",
        body: slipForm(token, "deposit", "deposit_50"),
      });
      assert.equal(response.status, 201);
      // Half of the 20,000 quote total -- not the full amount.
      assert.equal(database.slips[0]?.claimedAmountThb, 10000);
    } finally {
      await server.close();
    }
  });

  it("records a rejected slip with the SlipOK error code on amount mismatch", async () => {
    const accessSecret = "c".repeat(64);
    const database = createFakeDatabase({
      id: 43,
      name: "คุณทดสอบ",
      phone: "0812345678",
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: accessSecret,
      orderMode: "quick-purchase",
      studioData: { total: 20000 },
    });
    mockSlipOkFetch(() => new Response(JSON.stringify({ success: false, code: 1013, message: "amount mismatch" }), { status: 200 }));
    const server = await startLeadsRoute(database);
    try {
      const token = await tokenFor(QUOTE_NUMBER, accessSecret);
      const response = await fetch(`${server.url}/api/leads/payment-slip`, { method: "POST", body: slipForm(token) });
      const body = await response.json() as Record<string, unknown>;
      assert.equal(response.status, 201);
      assert.equal(body.status, "rejected");
      assert.equal(body.slipokErrorCode, "1013");
      assert.equal(body.verifiedAmountThb, undefined);
    } finally {
      await server.close();
    }
  });

  it("routes a slip with no QR code to manual review instead of auto-rejecting it", async () => {
    const accessSecret = "d".repeat(64);
    const database = createFakeDatabase({
      id: 44,
      name: "บริษัท ทดสอบ จำกัด",
      phone: "0812345678",
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: accessSecret,
      orderMode: "quick-purchase",
      studioData: { total: 20000 },
    });
    mockSlipOkFetch(() => new Response(JSON.stringify({ success: false, code: 1007, message: "รูปภาพไม่มี QR Code" }), { status: 200 }));
    const server = await startLeadsRoute(database);
    try {
      const token = await tokenFor(QUOTE_NUMBER, accessSecret);
      const response = await fetch(`${server.url}/api/leads/payment-slip`, { method: "POST", body: slipForm(token) });
      const body = await response.json() as Record<string, unknown>;
      assert.equal(response.status, 201);
      assert.equal(body.status, "needs_review");
      assert.equal(body.slipokErrorCode, "1007");
    } finally {
      await server.close();
    }
  });

  it("still rejects (not review) other unreadable-image codes like a corrupt upload", async () => {
    const accessSecret = "e".repeat(64);
    const database = createFakeDatabase({
      id: 45,
      name: "คุณทดสอบ",
      phone: "0812345678",
      quoteNumber: QUOTE_NUMBER,
      quoteAccessSecret: accessSecret,
      orderMode: "quick-purchase",
      studioData: { total: 20000 },
    });
    mockSlipOkFetch(() => new Response(JSON.stringify({ success: false, code: 1014, message: "wrong account" }), { status: 200 }));
    const server = await startLeadsRoute(database);
    try {
      const token = await tokenFor(QUOTE_NUMBER, accessSecret);
      const response = await fetch(`${server.url}/api/leads/payment-slip`, { method: "POST", body: slipForm(token) });
      const body = await response.json() as Record<string, unknown>;
      assert.equal(response.status, 201);
      assert.equal(body.status, "rejected");
      assert.equal(body.slipokErrorCode, "1014");
    } finally {
      await server.close();
    }
  });
});
