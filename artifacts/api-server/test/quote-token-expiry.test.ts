import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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
  // job-219: the slip route stores the file and asks SlipOK, so the tests give it a scratch folder and fake keys
  "UPLOAD_DIR",
  "SLIPOK_API_KEY",
  "SLIPOK_BRANCH_ID",
] as const;
let uploadDirectory = "";
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
  uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "quote-expiry-slip-uploads-"));
  process.env["UPLOAD_DIR"] = uploadDirectory;
  process.env["SLIPOK_API_KEY"] = "test-api-key";
  process.env["SLIPOK_BRANCH_ID"] = "test-branch";
  routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
  quoteAccess = await importTypeScriptModule<QuoteAccessModule>("src/lib/quote-access.ts");
});

after(async () => {
  for (const key of TEST_ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (uploadDirectory) await rm(uploadDirectory, { force: true, recursive: true });
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

// ---------------------------------------------------------------------------------------------------------
// job-219: the 45-day link lifetime also covers the payment-slip upload and the public job tracking page.
// ---------------------------------------------------------------------------------------------------------

type SlipLead = FakeLeadRow & { id: number; name: string; phone: string; status: string; notes: string | null };
const tableName = (table: object) => table[Symbol.for("drizzle:Name") as keyof object] as string;

function slipLead(ageDays: number): SlipLead {
  return { ...baseLead(ageDays), id: 7, name: "คุณทดสอบ", phone: "0812345678", status: "quoted", notes: null };
}

/** Remembers what the routes write: payment slips, audit rows, and tracking-view updates. */
function createRecordingDatabase(lead: SlipLead) {
  const slips: Array<Record<string, unknown>> = [];
  const auditRows: Array<Record<string, any>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const database = {
    select: () => {
      let table: unknown;
      const builder: Record<string, unknown> = {
        from: (next: unknown) => { table = next; return builder; },
        where: () => builder,
        orderBy: async () => [],
        limit: async () => (table === customerLeads ? [lead] : []),
        then: undefined,
      };
      return builder;
    },
    insert: (table: object) => {
      if (tableName(table) === "system_audit_logs") {
        return { values: async (row: Record<string, any>) => { auditRows.push(row); } };
      }
      let values: Record<string, unknown>;
      const builder = {
        values(next: Record<string, unknown>) { values = next; return builder; },
        returning: async () => {
          const saved = { ...values, id: slips.length + 1 };
          slips.push(saved);
          return [saved];
        },
      };
      return builder;
    },
    update: () => ({
      set: (values: Record<string, unknown>) => ({ where: async () => { updates.push(values); } }),
    }),
  };
  return { database, slips, auditRows, updates };
}

async function startLeadsRouteWith(database: unknown) {
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
    throw new Error("Quote token expiry test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function slipForm(token: string, extra: Record<string, string> = {}) {
  const form = new FormData();
  form.append("file", new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" }), "slip.png");
  form.append("token", token);
  for (const [key, value] of Object.entries(extra)) form.append(key, value);
  return form;
}

describe("payment slip upload honours the 45-day link lifetime (job-219)", () => {
  const realFetch = globalThis.fetch;
  let slipOkCalls = 0;
  let calledSlipOk: string[] = [];

  beforeEach(() => {
    slipOkCalls = 0;
    calledSlipOk = [];
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes("api.slipok.com")) {
        slipOkCalls += 1;
        calledSlipOk.push(String(input));
        return new Response(JSON.stringify({
          success: true,
          data: { transRef: "REF-OK", transDate: "20261003", transTime: "10:00:00", amount: 25000, sender: { name: "นาย ทดสอบ" } },
        }), { status: 200 });
      }
      return realFetch(input as never, init);
    });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  const savedFiles = async () => (await readdir(uploadDirectory)).length;

  it("a 10-day-old quote goes through the normal flow: file kept, SlipOK asked, slip recorded, audited as a success", async () => {
    const lead = slipLead(10);
    const recording = createRecordingDatabase(lead);
    const filesBefore = await savedFiles();
    const server = await startLeadsRouteWith(recording.database);
    try {
      const response = await fetch(`${server.url}/api/leads/payment-slip`, { method: "POST", body: slipForm(await tokenFor(lead)) });
      assert.equal(response.status, 201);
      const body = await response.json() as Record<string, unknown>;
      assert.equal(body.status, "verified");
      assert.equal(slipOkCalls, 1);
      assert.equal(recording.slips.length, 1);
      assert.equal(await savedFiles(), filesBefore + 1);
      assert.equal(recording.auditRows.at(-1)?.status, "success");
    } finally {
      await server.close();
    }
  });

  it("a 44-day-old quote (last day inside the lifetime) is still accepted", async () => {
    const lead = slipLead(44);
    const recording = createRecordingDatabase(lead);
    const server = await startLeadsRouteWith(recording.database);
    try {
      const response = await fetch(`${server.url}/api/leads/payment-slip`, { method: "POST", body: slipForm(await tokenFor(lead)) });
      assert.equal(response.status, 201);
      assert.equal(recording.slips.length, 1);
    } finally {
      await server.close();
    }
  });

  it("a 46-day-old quote is refused with HTTP 410 quote_expired - nothing stored, SlipOK never asked, audited as a warning", async () => {
    const lead = slipLead(46);
    const recording = createRecordingDatabase(lead);
    const filesBefore = await savedFiles();
    const server = await startLeadsRouteWith(recording.database);
    try {
      const token = await tokenFor(lead);
      await assertExpiredResponse(await fetch(`${server.url}/api/leads/payment-slip`, { method: "POST", body: slipForm(token) }));
      assert.equal(slipOkCalls, 0, "an expired link must not reach SlipOK");
      assert.deepEqual(calledSlipOk, []);
      assert.equal(recording.slips.length, 0, "no payment slip row");
      assert.equal(await savedFiles(), filesBefore, "no slip file left on disk");
      assert.deepEqual(recording.updates, [], "the lead is not touched (no auto-confirm)");
      assert.equal(recording.auditRows.length, 1);
      const row = recording.auditRows[0]!;
      assert.equal(row.action, "slip.upload");
      assert.equal(row.status, "warning");
      assert.equal(row.errorCode, "QUOTE_EXPIRED");
      assert.equal(row.targetId, lead.quoteNumber);
      assert.equal(row.actorType, "customer");
      assert.deepEqual(row.details, { reason: "payment slip rejected because quote link expired (>45 days)" });
      assert.doesNotMatch(JSON.stringify(row), new RegExp(token.slice(0, 24)), "the token is never written to the log");
    } finally {
      await server.close();
    }
  });

  it("the other upload options cannot get an expired quote past the check (final slip, 50% deposit)", async () => {
    const lead = slipLead(46);
    const recording = createRecordingDatabase(lead);
    const server = await startLeadsRouteWith(recording.database);
    try {
      const token = await tokenFor(lead);
      await assertExpiredResponse(await fetch(`${server.url}/api/leads/payment-slip`, {
        method: "POST",
        body: slipForm(token, { kind: "final", paymentType: "deposit_50" }),
      }));
      assert.equal(slipOkCalls, 0);
      assert.equal(recording.slips.length, 0);
    } finally {
      await server.close();
    }
  });

  it("a wrong access secret on an expired quote still looks like 'not found' (the 410 does not confirm that the quote exists)", async () => {
    const lead = slipLead(46);
    const recording = createRecordingDatabase(lead);
    const server = await startLeadsRouteWith(recording.database);
    try {
      const forged = await quoteAccess.createPublicQuoteToken(lead.quoteNumber, "f".repeat(64));
      const response = await fetch(`${server.url}/api/leads/payment-slip`, { method: "POST", body: slipForm(forged) });
      assert.equal(response.status, 404);
      assert.equal(slipOkCalls, 0);
      assert.equal(recording.auditRows.at(-1)?.errorCode, "QUOTE_NOT_FOUND");
    } finally {
      await server.close();
    }
  });
});

describe("public job tracking honours the 45-day link lifetime (job-219)", () => {
  it("a 46-day-old link is refused with HTTP 410 quote_expired and does not count as a view", async () => {
    const lead = slipLead(46);
    const recording = createRecordingDatabase(lead);
    const server = await startLeadsRouteWith(recording.database);
    try {
      const token = await tokenFor(lead);
      await assertExpiredResponse(await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(token)}`));
      assert.deepEqual(recording.updates, [], "tracking_view_count must not be bumped by an expired link");
    } finally {
      await server.close();
    }
  });

  it("a 10-day-old link still shows the job and counts the view (control: the 410 is not blanket)", async () => {
    const lead = slipLead(10);
    const recording = createRecordingDatabase(lead);
    const server = await startLeadsRouteWith(recording.database);
    try {
      const token = await tokenFor(lead);
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(token)}`);
      assert.equal(response.status, 200);
      const body = await response.json() as Record<string, unknown>;
      assert.equal(body.jobCode, lead.quoteNumber);
      assert.equal(recording.updates.length, 1);
      assert.equal("quoteAccessSecret" in body, false);
    } finally {
      await server.close();
    }
  });

  it("the last day inside the lifetime (44 days) is still served", async () => {
    const lead = slipLead(44);
    const server = await startLeadsRouteWith(createRecordingDatabase(lead).database);
    try {
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(await tokenFor(lead))}`);
      assert.equal(response.status, 200);
    } finally {
      await server.close();
    }
  });

  it("a wrong access secret on an expired job is 'not found', not 410", async () => {
    const lead = slipLead(46);
    const server = await startLeadsRouteWith(createRecordingDatabase(lead).database);
    try {
      const forged = await quoteAccess.createPublicQuoteToken(lead.quoteNumber, "f".repeat(64));
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(forged)}`);
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });
});
