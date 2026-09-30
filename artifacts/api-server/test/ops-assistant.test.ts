import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { after, afterEach, before, describe, it, mock } from "node:test";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { clearRateLimitStore } from "../src/lib/rate-limit.ts";
import {
  askOpsAssistant,
  buildOpsContextSummary,
  OPS_ASSISTANT_MODES,
  type OpsAssistantMode,
} from "../src/lib/ops-assistant.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  VERTEX_AI_PROJECT_ID: process.env["VERTEX_AI_PROJECT_ID"],
  VERTEX_AI_LOCATION: process.env["VERTEX_AI_LOCATION"],
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
  GOOGLE_APPLICATION_CREDENTIALS: process.env["GOOGLE_APPLICATION_CREDENTIALS"],
};

function restoreEnvironment() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

// A genuine RSA key pair so the real JWT-signing code in
// lib/google-service-account.ts runs unmocked -- only the outbound HTTP
// calls (Google's token endpoint and Vertex AI itself) are mocked below.
// This is not a real Google service account; it never leaves this process.
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
});
const FAKE_CREDENTIALS_JSON = JSON.stringify({
  client_email: "knight-basins-ops-assistant@test.iam.gserviceaccount.com",
  private_key: privateKey,
});

const realFetch = globalThis.fetch;
const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

/** Sensitive markers that must never appear in a context summary or an assistant reply. */
const SENSITIVE_TAX_ID = "1234567890123";
const SENSITIVE_SECRET = "sk-super-secret-token-should-never-leak";

function tableName(table: object): string {
  return table[Symbol.for("drizzle:Name") as keyof object] as string;
}

/** Rows returned deliberately carry extra sensitive-looking fields beyond what
 * ops-assistant.ts's own column allowlist selects, to prove the summary builders
 * only ever read the specific properties they ask for -- never the whole row. */
function leadRow(overrides: Record<string, unknown>) {
  return {
    id: 1,
    leadKey: "lead-1",
    name: "คุณทดสอบ",
    status: "new_lead",
    expectedInstallationDate: null,
    technicianTeamCode: null,
    taxId: SENSITIVE_TAX_ID,
    quoteAccessSecret: SENSITIVE_SECRET,
    ...overrides,
  };
}

function slipRow(overrides: Record<string, unknown>) {
  return {
    id: 1,
    status: "pending",
    verifiedAmountThb: null,
    claimedAmountThb: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    slipImageUrl: SENSITIVE_SECRET,
    ...overrides,
  };
}

let realDb: { select: unknown; insert: unknown; update: unknown; delete: unknown };
let writeAttempts = 0;

/** Installs a fake `select` on the real (singleton) db object that
 * ops-assistant.ts's dynamic `import("@workspace/db")` resolves to, and makes
 * insert/update/delete throw while counting how often they're called -- the
 * strongest possible proof that a code path never writes. */
function mockDatabase(leads: Array<Record<string, unknown>>, slips: Array<Record<string, unknown>>) {
  mock.method(realDb, "select", () => ({
    from: (table: object) => {
      const rows = tableName(table) === "customer_leads" ? leads : slips;
      const ordered = {
        limit: (n: number) => Promise.resolve(rows.slice(0, n)),
        then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
          Promise.resolve(rows).then(onFulfilled, onRejected),
      };
      return { orderBy: () => ordered };
    },
  }));
  for (const method of ["insert", "update", "delete"] as const) {
    mock.method(realDb, method, () => {
      writeAttempts += 1;
      throw new Error(`ops-assistant must never call database.${method}()`);
    });
  }
}

before(async () => {
  process.env["ADMIN_PASSWORD"] = "ops-assistant-test-password";
  process.env["DATABASE_URL"] = "postgres://ops-assistant-test";
  process.env["SESSION_SECRET"] = "ops-assistant-test-session-secret";
  const dbModule = await import("@workspace/db");
  realDb = dbModule.db as typeof realDb;
});

after(() => {
  mock.restoreAll();
  restoreEnvironment();
});

afterEach(() => {
  mock.restoreAll();
  clearRateLimitStore();
  writeAttempts = 0;
});

describe("OPS_ASSISTANT_MODES", () => {
  it("lists exactly the three supported modes", () => {
    assert.deepEqual(OPS_ASSISTANT_MODES, ["dashboard", "leads", "calendar"]);
  });
});

describe("buildOpsContextSummary", () => {
  it("dashboard mode: counts leads by status and reports the latest payment, without leaking taxId/secret fields", async () => {
    mockDatabase(
      [
        leadRow({ id: 1, status: "ready_for_production" }),
        leadRow({ id: 2, status: "ready_for_production" }),
        leadRow({ id: 3, status: "closed" }),
        leadRow({ id: 4, status: "new_lead" }),
      ],
      [
        slipRow({ id: 1, status: "verified", verifiedAmountThb: 15000, createdAt: "2026-09-10T00:00:00.000Z" }),
        slipRow({ id: 2, status: "team_reported_paid", claimedAmountThb: 5000, createdAt: "2026-09-20T00:00:00.000Z" }),
        slipRow({ id: 3, status: "voided", verifiedAmountThb: 99999, createdAt: "2026-09-25T00:00:00.000Z" }),
      ],
    );
    const summary = await buildOpsContextSummary("dashboard");
    assert.match(summary, /จำนวน Lead ทั้งหมด: 4 งาน/);
    assert.match(summary, /พร้อมผลิต: 2 งาน/);
    assert.match(summary, /ปิดการขาย: 1 งาน/);
    assert.match(summary, /5,000 บาท \(2026-09-20\)/, "latest paid slip by createdAt, ignoring the newer voided one");
    assert.ok(!summary.includes(SENSITIVE_TAX_ID), "must never include taxId");
    assert.ok(!summary.includes(SENSITIVE_SECRET), "must never include secrets");
    assert.ok(summary.length <= 2000);
  });

  it("leads mode: lists only the 10 most recent leads, without leaking taxId/secret fields", async () => {
    const leads = Array.from({ length: 15 }, (_, index) =>
      leadRow({ id: index + 1, leadKey: `lead-${index + 1}`, name: `ลูกค้า ${index + 1}`, status: "new_lead" }));
    mockDatabase(leads, []);
    const summary = await buildOpsContextSummary("leads");
    const lines = summary.split("\n");
    assert.equal(lines.length, 10, "never more than 10 leads");
    assert.ok(!summary.includes(SENSITIVE_TAX_ID));
    assert.ok(!summary.includes(SENSITIVE_SECRET));
  });

  it("leads mode: reports a friendly message when there are no leads", async () => {
    mockDatabase([], []);
    const summary = await buildOpsContextSummary("leads");
    assert.match(summary, /ไม่พบข้อมูลงานล่าสุด/);
  });

  it("calendar mode: counts installations this month grouped by technician team, without leaking taxId/secret fields", async () => {
    const now = new Date("2026-09-15T03:00:00.000Z"); // Bangkok: September 2026
    mockDatabase(
      [
        leadRow({ id: 1, technicianTeamCode: "TP", expectedInstallationDate: "2026-09-10" }),
        leadRow({ id: 2, technicianTeamCode: "TP", expectedInstallationDate: "2026-09-25" }),
        leadRow({ id: 3, technicianTeamCode: "PA", expectedInstallationDate: "2026-09-05" }),
        leadRow({ id: 4, technicianTeamCode: "PA", expectedInstallationDate: "2026-08-31" }), // last month -- excluded
        leadRow({ id: 5, technicianTeamCode: null, expectedInstallationDate: "2026-09-12" }),
      ],
      [],
    );
    const summary = await buildOpsContextSummary("calendar", now);
    assert.match(summary, /ทีม TP: 2 งาน/);
    assert.match(summary, /ทีม PA: 1 งาน/);
    assert.match(summary, /ไม่ระบุทีม: 1 งาน/);
    assert.ok(!summary.includes(SENSITIVE_TAX_ID));
    assert.ok(!summary.includes(SENSITIVE_SECRET));
  });

  it("calendar mode: reports a friendly message when nothing is scheduled this month", async () => {
    const now = new Date("2026-09-15T03:00:00.000Z");
    mockDatabase([leadRow({ id: 1, technicianTeamCode: "TP", expectedInstallationDate: "2026-08-01" })], []);
    const summary = await buildOpsContextSummary("calendar", now);
    assert.match(summary, /เดือนนี้ยังไม่มีงานติดตั้งที่กำหนดวันไว้/);
  });

  it("never calls insert/update/delete on the database (read-only)", async () => {
    mockDatabase([leadRow({ id: 1 })], [slipRow({ id: 1, status: "verified", verifiedAmountThb: 1000 })]);
    await buildOpsContextSummary("dashboard");
    await buildOpsContextSummary("leads");
    await buildOpsContextSummary("calendar", new Date());
    assert.equal(writeAttempts, 0);
  });
});

describe("askOpsAssistant", () => {
  it("returns ok:false with the fixed Thai message, and never touches the database, when Vertex AI is not configured", async () => {
    delete process.env["VERTEX_AI_PROJECT_ID"];
    delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
    delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
    let selectCalled = false;
    mock.method(realDb, "select", () => {
      selectCalled = true;
      throw new Error("must not query the database when AI is not configured");
    });
    let fetchCalled = false;
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      fetchCalled = true;
      return realFetch(input as never, init);
    });

    const result = await askOpsAssistant("มีงานพร้อมผลิตกี่งาน", "dashboard");
    assert.deepEqual(result, { ok: false, message: "ผู้ช่วย AI ยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง" });
    assert.equal(selectCalled, false);
    assert.equal(fetchCalled, false);
  });

  it("asks Gemini with the locked system prompt plus the read-only context summary, and returns its reply", async () => {
    process.env["VERTEX_AI_PROJECT_ID"] = "test-project";
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    mockDatabase([leadRow({ id: 1, status: "ready_for_production" })], []);

    let capturedMessages: Array<{ role: string; content: string }> = [];
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      }
      if (url.includes("aiplatform.googleapis.com")) {
        capturedMessages = JSON.parse(String(init?.body)).messages;
        return new Response(JSON.stringify({ choices: [{ message: { content: "มีงานพร้อมผลิต 1 งานครับ" } }] }), { status: 200 });
      }
      return realFetch(input as never, init);
    });

    const result = await askOpsAssistant("มีงานพร้อมผลิตกี่งาน", "dashboard");
    assert.deepEqual(result, { ok: true, reply: "มีงานพร้อมผลิต 1 งานครับ" });
    assert.equal(capturedMessages[0]?.role, "system");
    assert.match(capturedMessages[0]?.content ?? "", /ห้ามเดาตัวเลข/);
    assert.match(capturedMessages[0]?.content ?? "", /พร้อมผลิต: 1 งาน/);
    assert.equal(capturedMessages[1]?.role, "user");
    assert.equal(capturedMessages[1]?.content, "มีงานพร้อมผลิตกี่งาน");
    assert.equal(writeAttempts, 0);
  });
});

async function startAdminRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", routeModule.createAdminRouter(database));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Admin route test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

/** The route never uses the DI'd AdminDatabase (ops-assistant.ts resolves its own),
 * so any call into it is a bug -- this stub makes that loud instead of silent. */
const UNUSED_ADMIN_DATABASE = {
  select: () => {
    throw new Error("POST /admin/assistant/ask must not use the injected AdminDatabase");
  },
};

describe("POST /admin/assistant/ask", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(UNUSED_ADMIN_DATABASE);
    try {
      const response = await fetch(`${server.url}/api/admin/assistant/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "สวัสดี" }),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("returns 400 when the question is empty", async () => {
    const server = await startAdminRoute(UNUSED_ADMIN_DATABASE);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/assistant/ask`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ question: "   " }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("returns 400 when the question exceeds 500 characters", async () => {
    const server = await startAdminRoute(UNUSED_ADMIN_DATABASE);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/assistant/ask`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ question: "ก".repeat(501) }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("returns 200 { ok: false } instead of 500 when the AI assistant is not configured", async () => {
    delete process.env["VERTEX_AI_PROJECT_ID"];
    delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
    delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
    const server = await startAdminRoute(UNUSED_ADMIN_DATABASE);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/assistant/ask`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ question: "มีงานพร้อมผลิตกี่งาน" }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json() as { ok: boolean; message?: string };
      assert.equal(payload.ok, false);
      assert.equal(payload.message, "ผู้ช่วย AI ยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง");
    } finally {
      await server.close();
    }
  });

  it("answers successfully and never writes to the database (row counts stay unchanged)", async () => {
    process.env["VERTEX_AI_PROJECT_ID"] = "test-project";
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    const leads = [leadRow({ id: 1, status: "ready_for_production" }), leadRow({ id: 2, status: "closed" })];
    const leadCountBefore = leads.length;
    mockDatabase(leads, []);
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      }
      if (url.includes("aiplatform.googleapis.com")) {
        return new Response(JSON.stringify({ choices: [{ message: { content: "สรุปแล้วครับ" } }] }), { status: 200 });
      }
      return realFetch(input as never, init);
    });

    const server = await startAdminRoute(UNUSED_ADMIN_DATABASE);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/assistant/ask`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ question: "สรุปแดชบอร์ดให้หน่อย", mode: "dashboard" }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json() as { ok: boolean; reply?: string; mode?: string };
      assert.deepEqual(payload, { ok: true, reply: "สรุปแล้วครับ", mode: "dashboard" });
      assert.equal(leads.length, leadCountBefore, "the fixture's row count never changes");
      assert.equal(writeAttempts, 0, "insert/update/delete must never be called");
    } finally {
      await server.close();
    }
  });

  it("defaults to dashboard mode and falls back to it for an unrecognized mode value", async () => {
    process.env["VERTEX_AI_PROJECT_ID"] = "test-project";
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    mockDatabase([], []);
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      }
      if (url.includes("aiplatform.googleapis.com")) {
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
      }
      return realFetch(input as never, init);
    });

    const server = await startAdminRoute(UNUSED_ADMIN_DATABASE);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/assistant/ask`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ question: "test", mode: "not-a-real-mode" }),
      });
      const payload = await response.json() as { mode?: string };
      assert.equal(payload.mode, "dashboard");
    } finally {
      await server.close();
    }
  });

  it("validates every declared mode is accepted (dashboard, leads, calendar)", () => {
    for (const mode of OPS_ASSISTANT_MODES as OpsAssistantMode[]) {
      assert.ok(["dashboard", "leads", "calendar"].includes(mode));
    }
  });
});
