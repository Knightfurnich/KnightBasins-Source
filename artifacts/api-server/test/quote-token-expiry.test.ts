import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import { customerLeads } from "@workspace/db/schema";
import { importTypeScriptModule } from "./route-harness.ts";

type LeadRouteModule = typeof import("../src/routes/leads.ts");
type QuoteAccessModule = typeof import("../src/lib/quote-access.ts");

type FakeLeadRow = {
  quoteNumber: string;
  quoteAccessSecret: string;
  orderMode: "studio";
  studioData: unknown;
  createdAt: Date;
};

const EXPIRED_MESSAGE =
  "ลิงก์ใบเสนอราคานี้หมดอายุแล้ว (เกิน 45 วัน) กรุณาติดต่อทีมขายเพื่อประเมินราคาใหม่";
const ORIGINAL_ENV: Record<string, string | undefined> = {};
const TEST_ENV_KEYS = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "NOTIFY_CHANNEL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_SALES_CHAT_ID",
  "LINE_MESSAGING_ACCESS_TOKEN",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "LINE_SALES_DESTINATION_ID",
] as const;
let routeModule: LeadRouteModule;
let quoteAccess: QuoteAccessModule;

function baseLead(ageDays: number): FakeLeadRow {
  return {
    quoteNumber: `Oct 26 / US / ${ageDays}`,
    quoteAccessSecret: "a".repeat(64),
    orderMode: "studio",
    studioData: { total: 25000 },
    createdAt: new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000),
  };
}

function createFakeDatabase(lead: FakeLeadRow) {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => (table === customerLeads ? [lead] : []),
        }),
      }),
    }),
  };
}

async function startLeadsRoute(lead: FakeLeadRow) {
  const app = express();
  app.use(express.json());
  app.use("/api", routeModule.createLeadsRouter(createFakeDatabase(lead) as never));
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
    throw new Error("Quote token expiry test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function tokenFor(lead: FakeLeadRow) {
  return quoteAccess.createPublicQuoteToken(lead.quoteNumber, lead.quoteAccessSecret);
}

async function assertExpiredResponse(response: Response) {
  assert.equal(response.status, 410);
  assert.deepEqual(await response.json(), { error: "quote_expired", message: EXPIRED_MESSAGE });
}

before(async () => {
  for (const key of TEST_ENV_KEYS) ORIGINAL_ENV[key] = process.env[key];
  process.env["DATABASE_URL"] = "postgres://quote-token-expiry-test";
  process.env["SESSION_SECRET"] = "quote-token-expiry-test-secret";
  for (const key of TEST_ENV_KEYS.slice(2)) delete process.env[key];
  routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
  quoteAccess = await importTypeScriptModule<QuoteAccessModule>("src/lib/quote-access.ts");
});

after(() => {
  for (const key of TEST_ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("public quote token expiry", () => {
  it("accepts saved quote links that are 10 and 44 days old", async () => {
    for (const ageDays of [10, 44]) {
      const lead = baseLead(ageDays);
      const server = await startLeadsRoute(lead);
      try {
        const token = await tokenFor(lead);
        const response = await fetch(`${server.url}/api/quotes?token=${encodeURIComponent(token)}`);
        assert.equal(response.status, 200, `${ageDays}-day quote should still be available`);
        const body = await response.json() as Record<string, unknown>;
        assert.equal(body.quoteNumber, lead.quoteNumber);
        assert.equal("quoteAccessSecret" in body, false);
      } finally {
        await server.close();
      }
    }
  });

  it("returns the quote_expired 410 payload for a 46-day quote", async () => {
    const lead = baseLead(46);
    const server = await startLeadsRoute(lead);
    try {
      const token = await tokenFor(lead);
      await assertExpiredResponse(await fetch(`${server.url}/api/quotes?token=${encodeURIComponent(token)}`));
    } finally {
      await server.close();
    }
  });

  it("rejects expired PromptPay QR and sales-notification requests", async () => {
    const lead = baseLead(46);
    const server = await startLeadsRoute(lead);
    try {
      const token = await tokenFor(lead);
      await assertExpiredResponse(await fetch(`${server.url}/api/public/quotes/promptpay-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, paymentType: "deposit_50" }),
      }));
      await assertExpiredResponse(await fetch(`${server.url}/api/quotes/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }));
    } finally {
      await server.close();
    }
  });

  it("expires only after the full 45-day token lifetime", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = createdAt.getTime() + quoteAccess.PUBLIC_QUOTE_TOKEN_TTL_MS;
    assert.equal(quoteAccess.isPublicQuoteTokenExpired(createdAt, expiresAt), false);
    assert.equal(quoteAccess.isPublicQuoteTokenExpired(createdAt, expiresAt + 1), true);
  });
});