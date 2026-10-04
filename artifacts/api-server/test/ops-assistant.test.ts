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
  formatOpsDate,
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
function mockDatabase(
  leads: Array<Record<string, unknown>>,
  slips: Array<Record<string, unknown>>,
  teams: Array<Record<string, unknown>> = [],
) {
  mock.method(realDb, "select", () => ({
    from: (table: object) => {
      const name = tableName(table);
      const rows = name === "customer_leads" ? leads : name === "technician_teams" ? teams : slips;
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

async function captureAssistantContext(
  mode: OpsAssistantMode,
  leads: Array<Record<string, unknown>> = [],
  slips: Array<Record<string, unknown>> = [],
  teams: Array<Record<string, unknown>> = [],
): Promise<string> {
  process.env["VERTEX_AI_PROJECT_ID"] = "test-project";
  process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
  mockDatabase(leads, slips, teams);
  let context = "";
  mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
    }
    if (url.includes("aiplatform.googleapis.com")) {
      const messages = JSON.parse(String(init?.body)).messages as Array<{ role: string; content: string }>;
      context = messages[0]?.content ?? "";
      return new Response(JSON.stringify({ choices: [{ message: { content: "รับทราบครับ" } }] }), { status: 200 });
    }
    return realFetch(input as never, init);
  });
  const result = await askOpsAssistant("สรุปข้อมูลให้หน่อย", mode);
  assert.equal(result.ok, true);
  return context;
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
    assert.match(summary, /จำนวนงานทั้งหมด: 4 งาน/);
    assert.match(summary, /พร้อมผลิต: 2 งาน/);
    assert.match(summary, /ปิดการขาย: 1 งาน/);
    assert.match(summary, /แยกตามสถานะงาน: พร้อมผลิต 2 งาน · ปิดการขาย 1 งาน · งานใหม่ 1 งาน/);
    assert.match(summary, /5,000 บาท \(20 ก.ย. 2569\)/, "latest paid slip by createdAt, ignoring the newer voided one");
    assert.doesNotMatch(summary, /\b(?:Lead|status|record|field|new_lead|ready_for_production)\b/);
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
      [
        { code: "TP", name: "ทีมช่างปทุมวัน" },
        { code: "PA", name: "ทีมช่างพระรามสอง" },
      ],
    );
    const summary = await buildOpsContextSummary("calendar", now);
    assert.match(summary, /งานของช่าง ทีมช่างปทุมวัน: 2 งาน/);
    assert.match(summary, /งานของช่าง ทีมช่างพระรามสอง: 1 งาน/);
    assert.match(summary, /งานของช่าง ไม่ระบุชื่อ: 1 งาน/);
    assert.match(summary, /กันยายน 2569/);
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

describe("askOpsAssistant Thai response rules", () => {
  it("(ก) locks a friendly, professional tone and direct answers that end with ครับ", async () => {
    const context = await captureAssistantContext("dashboard");
    const prompt = context.split("\n\nข้อมูลอ้างอิง:\n")[0] ?? "";
    assert.match(prompt, /พูดคุยเป็นกันเอง/);
    assert.match(prompt, /สุภาพแบบมืออาชีพ/);
    assert.match(prompt, /ไม่ห้วน/);
    assert.match(prompt, /ห้ามใช้คำเทคนิค/);
    assert.match(prompt, /ห้ามเปิดเผยรหัสงานหรือรหัสภายใน/);
    assert.match(prompt, /ตอบตรงคำถามก่อน/);
    assert.match(prompt, /1–2 ประโยค/);
    assert.match(prompt, /ลงท้ายทุกคำตอบด้วยคำว่า “ครับ”/);
  });

  it("(ค) keeps answers grounded in provided facts and offers a verifiable next step when data is missing", async () => {
    const context = await captureAssistantContext("leads");
    const prompt = context.split("\n\nข้อมูลอ้างอิง:\n")[0] ?? "";
    assert.match(context, /ไม่พบข้อมูลงานล่าสุด/);
    assert.match(prompt, /ใช้เฉพาะข้อมูลอ้างอิงที่ให้มา/);
    assert.match(prompt, /ห้ามเดาตัวเลข/);
    assert.match(prompt, /แต่งรายละเอียด/);
    assert.match(prompt, /หากข้อมูลไม่มีหรือไม่พอ/);
    assert.match(prompt, /เสนอทางเลือกที่ตรวจสอบได้แทน/);
    assert.match(prompt, /ห้ามแนะนำการแก้ไขข้อมูลในระบบ/);
  });

  it("(ข) gives the model readable Thai labels and never exposes internal identifiers", async () => {
    const context = await captureAssistantContext(
      "leads",
      [leadRow({
        id: 1,
        leadKey: "lead_dispatch_2048",
        name: "คุณสมชาย",
        status: "new_lead",
        technicianTeamCode: "TP",
        expectedInstallationDate: "2026-10-04",
      })],
      [],
      [{ code: "TP", name: "ทีมช่างสมชาย" }],
    );
    const summary = context.split("\n\nข้อมูลอ้างอิง:\n")[1] ?? "";
    assert.match(summary, /งานที่ 1 · งานของช่าง ทีมช่างสมชาย · ลูกค้า: คุณสมชาย · สถานะงาน: งานใหม่ · วันติดตั้ง: 4 ต\.ค\. 2569/);
    assert.doesNotMatch(summary, /lead_dispatch_2048|\b(?:Lead|status|record|field)\b|new_lead|\bTP\b/);
    assert.match(context, /ห้ามเปิดเผยรหัสงาน/);
  });

  it("formats dates in Thai Buddhist-calendar form", async () => {
    const context = await captureAssistantContext(
      "leads",
      [leadRow({ id: 1, technicianTeamCode: "TP", expectedInstallationDate: "2026-10-04" })],
      [],
      [{ code: "TP", name: "ทีมช่างสมชาย" }],
    );
    assert.match(context, /วันติดตั้ง: 4 ต\.ค\. 2569/);
    assert.match(context, /วันที่ให้ใช้รูปแบบภาษาไทย เช่น “4 ต\.ค\. 2569”/);
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

  it("(ง) preserves the API success fields while the assistant answers read-only", async () => {
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

// job-257: the database driver hands timestamps back as Date objects. The tests above feed ISO strings, which is why
// `latestPayment.createdAt.slice is not a function` reached production (dashboard -> HTTP 500). These feed real Date objects.
describe("dates from the database arrive as Date objects", () => {
  it("dashboard mode: formats a payment whose createdAt is a real Date in Thai", async () => {
    mockDatabase(
      [leadRow({ id: 1, status: "closed" })],
      [slipRow({ id: 1, status: "verified", verifiedAmountThb: 12500, createdAt: new Date("2026-10-03T08:30:00.000Z") })],
    );
    const summary = await buildOpsContextSummary("dashboard");
    assert.match(summary, /12,500 บาท \(3 ต\.ค\. 2569\)/);
  });

  it("dashboard mode: picks the latest payment by time across Date objects, ISO strings and a missing date", async () => {
    mockDatabase(
      [],
      [
        slipRow({ id: 1, status: "verified", verifiedAmountThb: 1000, createdAt: new Date("2026-09-01T00:00:00.000Z") }),
        slipRow({ id: 2, status: "verified", verifiedAmountThb: 2000, createdAt: "2026-09-15T00:00:00.000Z" }),
        slipRow({ id: 3, status: "team_reported_paid", claimedAmountThb: 3000, createdAt: new Date("2026-09-30T23:00:00.000Z") }),
        slipRow({ id: 4, status: "verified", verifiedAmountThb: 4000, createdAt: null }),
      ],
    );
    assert.match(await buildOpsContextSummary("dashboard"), /3,000 บาท \(30 ก\.ย\. 2569\)/);
  });

  it("dashboard mode: a payment with no usable date is still reported, without a date and without throwing", async () => {
    mockDatabase([], [slipRow({ id: 1, status: "verified", verifiedAmountThb: 700, createdAt: null })]);
    assert.match(await buildOpsContextSummary("dashboard"), /700 บาท \(ไม่ระบุวันที่\)/);
    mock.restoreAll();
    mockDatabase([], [slipRow({ id: 1, status: "verified", verifiedAmountThb: 700, createdAt: new Date("not a date") })]);
    assert.match(await buildOpsContextSummary("dashboard"), /700 บาท \(ไม่ระบุวันที่\)/);
  });

  it("leads mode: formats a Date installation value in Thai", async () => {
    mockDatabase([leadRow({ id: 1, expectedInstallationDate: new Date("2026-10-20T00:00:00.000Z") })], []);
    assert.match(await buildOpsContextSummary("leads"), /วันติดตั้ง: 20 ต\.ค\. 2569/);
  });

  it("calendar mode: counts Date installation values in the right month without exposing team codes", async () => {
    mockDatabase(
      [
        leadRow({ id: 1, technicianTeamCode: "TP", expectedInstallationDate: new Date("2026-09-10T00:00:00.000Z") }),
        leadRow({ id: 2, technicianTeamCode: "TP", expectedInstallationDate: new Date("2026-08-31T00:00:00.000Z") }),
      ],
      [],
      [{ code: "TP", name: "ทีมช่างปทุมวัน" }],
    );
    const summary = await buildOpsContextSummary("calendar", new Date("2026-09-15T03:00:00.000Z"));
    assert.match(summary, /งานของช่าง ทีมช่างปทุมวัน: 1 งาน/);
    assert.doesNotMatch(summary, /\bTP\b/);
  });

  it("formatOpsDate accepts Date, ISO string, date-only string, null and rubbish, and never throws", () => {
    assert.equal(formatOpsDate(new Date("2026-10-03T08:30:00.000Z")), "2026-10-03");
    assert.equal(formatOpsDate("2026-10-03T08:30:00.000Z"), "2026-10-03");
    assert.equal(formatOpsDate("2026-10-03"), "2026-10-03");
    assert.equal(formatOpsDate(Date.UTC(2026, 9, 3)), "2026-10-03");
    for (const bad of [null, undefined, "", "   ", "not a date", new Date("x"), {}, [], true, Number.NaN]) {
      assert.equal(formatOpsDate(bad), null);
    }
  });

  it("askOpsAssistant answers (ok) with Date rows, and still answers when the summary query itself fails", async () => {
    process.env["VERTEX_AI_PROJECT_ID"] = "test-project";
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    let context = "";
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      if (url.includes("aiplatform.googleapis.com")) {
        context = JSON.parse(String(init?.body)).messages[0].content;
        return new Response(JSON.stringify({ choices: [{ message: { content: "ตอบแล้วครับ" } }] }), { status: 200 });
      }
      return realFetch(input as never, init);
    });
    mockDatabase([leadRow({ id: 1 })], [slipRow({ id: 1, status: "verified", verifiedAmountThb: 900, createdAt: new Date("2026-10-01T00:00:00.000Z") })]);
    assert.deepEqual(await askOpsAssistant("สรุปภาพรวมให้หน่อย", "dashboard"), { ok: true, reply: "ตอบแล้วครับ" });
    assert.match(context, /900 บาท \(1 ต\.ค\. 2569\)/);

    mock.method(realDb, "select", () => { throw new Error("db is down"); });
    const warn = mock.method(console, "warn", () => {});
    assert.deepEqual(await askOpsAssistant("สรุปภาพรวมให้หน่อย", "dashboard"), { ok: true, reply: "ตอบแล้วครับ" });
    assert.match(context, /ไม่พบข้อมูล/);
    assert.equal(warn.mock.callCount(), 1);
  });
});
