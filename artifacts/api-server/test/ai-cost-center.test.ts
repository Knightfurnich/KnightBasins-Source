import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";
import {
  calculateModelCostThb,
  clearAiUsageEvents,
  getUnifiedAiCostSummary,
  parseHermesAuditLine,
  recordAiUsage,
} from "../src/lib/ai-cost-tracker.ts";

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

type AiCostServicePayload = { id: string; name: string; requests: number; tokens: number; costThb: number; status: string };
type AiCostModelBreakdownPayload = { model: string; requests: number; costThb: number };
type UnifiedAiCostResponsePayload = {
  period: string;
  updatedAt: string;
  totalCostThb: number;
  totalRequests: number;
  totalTokens: number;
  services: AiCostServicePayload[];
  modelBreakdown: AiCostModelBreakdownPayload[];
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

async function startAdminRoute(database: unknown = {}) {
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

before(() => {
  process.env["ADMIN_PASSWORD"] = "ai-cost-center-test-password";
  process.env["DATABASE_URL"] = "postgres://ai-cost-center-test";
  process.env["SESSION_SECRET"] = "ai-cost-center-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

afterEach(() => {
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
  clearAiUsageEvents();
});

describe("calculateModelCostThb", () => {
  it("prices gemini-2.5-flash/gemini-3.8-flash at 0.002625 บ./1k input, 0.0105 บ./1k output, 0.0175 บ./image", () => {
    assert.equal(Math.round(calculateModelCostThb("gemini-2.5-flash", 1000, 0, 0) * 1e6) / 1e6, 0.002625);
    assert.equal(Math.round(calculateModelCostThb("gemini-2.5-flash", 0, 1000, 0) * 1e6) / 1e6, 0.0105);
    assert.equal(Math.round(calculateModelCostThb("gemini-2.5-flash", 0, 0, 1) * 1e6) / 1e6, 0.0175);
    assert.equal(calculateModelCostThb("gemini-3.8-flash", 1000, 0, 0), calculateModelCostThb("gemini-2.5-flash", 1000, 0, 0));
  });

  it("prices deepseek-v4.1-flash at $0.14/M input and $0.28/M output, converted at 35 THB/USD", () => {
    assert.equal(Math.round(calculateModelCostThb("deepseek-v4.1-flash", 1_000_000, 0, 0) * 100) / 100, 4.9);
    assert.equal(Math.round(calculateModelCostThb("deepseek-v4.1-flash", 0, 1_000_000, 0) * 100) / 100, 9.8);
  });

  it("prices deepseek/deepseek-v4.1-flash (the id OpenRouter uses for sketch reading) at the peak rate, $0.30/M in and $1.20/M out", () => {
    assert.equal(Math.round(calculateModelCostThb("deepseek/deepseek-v4.1-flash", 1_000_000, 0, 0) * 100) / 100, 10.5);
    assert.equal(Math.round(calculateModelCostThb("deepseek/deepseek-v4.1-flash", 0, 1_000_000, 0) * 100) / 100, 42);
    // the real reading from the job-240 live test: 1,847 tokens in, 5,509 out
    assert.equal(Math.round(calculateModelCostThb("deepseek/deepseek-v4.1-flash", 1847, 5509, 0) * 1e4) / 1e4, 0.2508);
    // a priced model, not the Gemini default it would silently fall back to
    assert.notEqual(calculateModelCostThb("deepseek/deepseek-v4.1-flash", 1000, 1000, 0), calculateModelCostThb("some/unknown-model", 1000, 1000, 0));
    // and an image adds nothing on top of tokens for this model
    assert.equal(calculateModelCostThb("deepseek/deepseek-v4.1-flash", 1000, 1000, 3), calculateModelCostThb("deepseek/deepseek-v4.1-flash", 1000, 1000, 0));
  });

  it("prices google/gemini-2.5-flash (vertex-gemini.ts's model id) the same as gemini-2.5-flash", () => {
    assert.equal(
      calculateModelCostThb("google/gemini-2.5-flash", 1000, 1000, 0),
      calculateModelCostThb("gemini-2.5-flash", 1000, 1000, 0),
    );
  });

  it("falls back to a default rate for an unrecognized model instead of pricing it at 0", () => {
    const unknownCost = calculateModelCostThb("hermes-agent", 1000, 1000, 0);
    const knownCost = calculateModelCostThb("gemini-2.5-flash", 1000, 1000, 0);
    assert.equal(unknownCost, knownCost);
    assert.ok(unknownCost > 0);
  });

  it("treats a missing or negative token/image count as 0 rather than throwing", () => {
    assert.doesNotThrow(() => calculateModelCostThb("gemini-2.5-flash"));
    assert.equal(calculateModelCostThb("gemini-2.5-flash"), 0);
    assert.equal(calculateModelCostThb("gemini-2.5-flash", -100, -100, -1), 0);
  });
});

describe("recordAiUsage / getUnifiedAiCostSummary aggregation", () => {
  beforeEach(() => {
    process.env["HERMES_AUDIT_LOG_PATH"] = "/tmp/non-existent-hermes-audit.jsonl";
  });
  it("aggregates requests, tokens, and cost separately per service", () => {
    recordAiUsage({ service: "sales_bot", model: "deepseek-v4.1-flash", promptTokens: 500, completionTokens: 200, success: true });
    recordAiUsage({ service: "sketch_vision", model: "gemini-3.8-flash", imageCount: 2, success: true });
    recordAiUsage({ service: "sketch_vision", model: "gemini-3.8-flash", imageCount: 1, success: true });

    const summary = getUnifiedAiCostSummary("all");
    const salesBot = summary.services.find((service) => service.id === "sales_bot")!;
    const sketchVision = summary.services.find((service) => service.id === "sketch_vision")!;
    const hermes = summary.services.find((service) => service.id === "hermes_ops")!;

    assert.equal(salesBot.requests, 1);
    assert.equal(salesBot.tokens, 700);
    assert.equal(salesBot.status, "active");

    assert.equal(sketchVision.requests, 2);
    assert.equal(sketchVision.costThb, Math.round(0.0175 * 3 * 100) / 100, "2 + 1 images at 0.0175 บ. each");
    assert.equal(sketchVision.status, "active");

    assert.equal(hermes.requests, 0, "no in-memory hermes events and no audit file in this sandbox");
    assert.equal(hermes.status, "no-data");

    assert.equal(summary.totalRequests, 3);
  });

  it("aggregates vertex_gemini requests, tokens, and cost as its own pillar", () => {
    recordAiUsage({ service: "vertex_gemini", model: "google/gemini-2.5-flash", promptTokens: 100, completionTokens: 50, totalTokens: 150, success: true });
    recordAiUsage({ service: "vertex_gemini", model: "google/gemini-2.5-flash", promptTokens: 200, completionTokens: 100, totalTokens: 300, success: false });

    const summary = getUnifiedAiCostSummary("all");
    const vertexGemini = summary.services.find((service) => service.id === "vertex_gemini")!;
    assert.equal(vertexGemini.requests, 2);
    assert.equal(vertexGemini.tokens, 450);
    assert.equal(
      vertexGemini.costThb,
      Math.round(
        (calculateModelCostThb("google/gemini-2.5-flash", 100, 50, 0) + calculateModelCostThb("google/gemini-2.5-flash", 200, 100, 0)) * 100,
      ) / 100,
    );
    assert.equal(vertexGemini.status, "active");
  });

  it("always returns all 5 services in the fixed order, even with zero events", () => {
    const summary = getUnifiedAiCostSummary("all");
    assert.deepEqual(summary.services.map((service) => service.id), ["sales_bot", "sketch_vision", "hermes_ops", "vertex_gemini", "google_tts"]);
    assert.ok(summary.services.every((service) => service.requests === 0 && service.status === "no-data"));
    assert.equal(summary.totalCostThb, 0);
  });

  it("groups modelBreakdown across services by model name, sorted by cost descending", () => {
    recordAiUsage({ service: "sales_bot", model: "deepseek-v4.1-flash", promptTokens: 1_000_000, success: true });
    recordAiUsage({ service: "sketch_vision", model: "gemini-3.8-flash", imageCount: 1, success: true });
    const summary = getUnifiedAiCostSummary("all");
    assert.equal(summary.modelBreakdown[0]?.model, "deepseek-v4.1-flash", "the far more expensive deepseek request must sort first");
    assert.ok(summary.modelBreakdown.some((entry) => entry.model === "gemini-3.8-flash"));
  });

  it("filters events by period: 'today' excludes an event recorded on a prior day", () => {
    process.env["HERMES_AUDIT_LOG_PATH"] = "/tmp/non-existent-hermes-audit.jsonl";
    recordAiUsage({ service: "sales_bot", model: "deepseek-v4.1-flash", promptTokens: 100, success: true });
    const now = new Date();
    const allSummary = getUnifiedAiCostSummary("all", now);
    assert.equal(allSummary.totalRequests, 1);
    // Exercises the "today" period's midnight cutoff via an injected "now" one calendar
    // day later, so the event recorded a moment ago now falls outside "today"'s window.
    const summaryNextDay = getUnifiedAiCostSummary("today", new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0));
    assert.equal(summaryNextDay.totalRequests, 0);
  });
});

describe("GET /admin/ai-cost-center", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/ai-cost-center`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("returns 200 with the full JSON structure for an authenticated admin", async () => {
    // Note: the admin route runs in its own esbuild-bundled module instance (via
    // importTypeScriptModule), separate from this test file's own direct import of
    // ai-cost-tracker.ts above -- so a recordAiUsage() call here would not reach it.
    // In the real running server there is only one process-wide module instance, so
    // leads.ts's recordAiUsage() calls do reach this same route in production; this
    // test only needs to prove the response shape is correct, which the
    // "recordAiUsage / getUnifiedAiCostSummary aggregation" tests above already cover
    // for the actual aggregation behavior.
    const server = await startAdminRoute();
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/ai-cost-center`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const body = (await response.json()) as UnifiedAiCostResponsePayload;

      assert.equal(body.period, "all");
      assert.ok(!Number.isNaN(new Date(body.updatedAt).getTime()));
      assert.equal(typeof body.totalCostThb, "number");
      assert.equal(typeof body.totalRequests, "number");
      assert.equal(typeof body.totalTokens, "number");
      assert.equal(body.services.length, 5);
      assert.deepEqual(body.services.map((service) => service.id), ["sales_bot", "sketch_vision", "hermes_ops", "vertex_gemini", "google_tts"]);
      assert.equal(body.services.find((service) => service.id === "sales_bot")?.name, "น้องไนท์ (LINE Bot ผู้ช่วยขาย)");
      assert.equal(body.services.find((service) => service.id === "sketch_vision")?.name, "AI Blueprint Reader (อ่านแบบร่าง)");
      assert.equal(body.services.find((service) => service.id === "hermes_ops")?.name, "เฮอร์มีส (งานบริหารระบบ & งานช่าง)");
      assert.equal(body.services.find((service) => service.id === "vertex_gemini")?.name, "ผู้ช่วย AI (Vertex AI Gemini)");
      assert.ok(body.services.every((service) => typeof service.requests === "number" && typeof service.tokens === "number" && typeof service.costThb === "number" && (service.status === "active" || service.status === "no-data")));
      assert.ok(Array.isArray(body.modelBreakdown));
    } finally {
      await server.close();
    }
  });

  it("accepts ?period= and defaults to 'all' for an unrecognized value", async () => {
    const server = await startAdminRoute();
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const day = await fetch(`${server.url}/api/admin/ai-cost-center?period=today`, { headers: { cookie } });
      const dayBody = (await day.json()) as UnifiedAiCostResponsePayload;
      assert.equal(dayBody.period, "today");

      const bogus = await fetch(`${server.url}/api/admin/ai-cost-center?period=nonsense`, { headers: { cookie } });
      const bogusBody = (await bogus.json()) as UnifiedAiCostResponsePayload;
      assert.equal(bogusBody.period, "all");
    } finally {
      await server.close();
    }
  });

  it("rejects with 403 for a session lacking the 'leads' permission", async () => {
    const server = await startAdminRoute();
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "installed-stones";
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/ai-cost-center`, { headers: { cookie } });
      assert.equal(response.status, 403);
    } finally {
      await server.close();
    }
  });
});

// job-251: the Hermes row of the AI cost page showed 0 because the parser read camelCase fields while Hermes's own engine
// writes snake_case (ts, prompt_tokens, completion_tokens, total_tokens, duration_ms, error).

describe("Hermes usage_audit.jsonl parser (job-251)", () => {
  let directory: string;
  const savedAuditPath = process.env["HERMES_AUDIT_LOG_PATH"];

  before(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "hermes-audit-"));
  });
  after(async () => {
    if (savedAuditPath === undefined) delete process.env["HERMES_AUDIT_LOG_PATH"];
    else process.env["HERMES_AUDIT_LOG_PATH"] = savedAuditPath;
    await rm(directory, { force: true, recursive: true });
  });

  /** Writes the lines to a file and points the tracker at it. */
  async function auditFile(lines: string[], eol = "\n") {
    const file = path.join(directory, `usage-${Math.random().toString(36).slice(2)}.jsonl`);
    await writeFile(file, lines.join(eol) + eol);
    process.env["HERMES_AUDIT_LOG_PATH"] = file;
    return file;
  }
  const hermesRow = (summary: ReturnType<typeof getUnifiedAiCostSummary>) => summary.services.find((service) => service.id === "hermes_ops")!;

  // The line the engine really wrote (quoted in the work order from /opt/data/cron/usage_audit.jsonl).
  const ENGINE_LINE = '{"ts": "2026-10-04T10:42:01.309Z", "job_id": "8b4deceecb1a", "prompt_tokens": 42557, "completion_tokens": 1392, "total_tokens": 43949, "model": "deepseek/deepseek-v4.1-flash", "duration_ms": 7854, "error": null}';
  const NOW = new Date("2026-10-05T00:00:00.000Z");

  it("(a) a snake_case line from the engine gives its prompt, completion and total tokens, and a real cost (not 0)", async () => {
    await auditFile([ENGINE_LINE]);
    const summary = getUnifiedAiCostSummary("all", NOW);
    const hermes = hermesRow(summary);
    assert.equal(hermes.requests, 1);
    assert.equal(hermes.tokens, 43949);
    assert.equal(hermes.status, "active");
    // the input and the output side are priced separately, so each must land in its own field
    const expected = calculateModelCostThb("deepseek/deepseek-v4.1-flash", 42557, 1392, 0);
    assert.ok(expected > 0.5 && expected < 0.51, `0.5053 THB for this line, got ${expected}`);
    assert.equal(hermes.costThb, Math.round(expected * 100) / 100);
    assert.deepEqual(summary.modelBreakdown.map((entry) => [entry.model, entry.requests]), [["deepseek/deepseek-v4.1-flash", 1]]);
  });

  it("(a) the parsed fields are exactly the engine's numbers", () => {
    const event = parseHermesAuditLine(ENGINE_LINE)!;
    assert.deepEqual(
      [event.promptTokens, event.completionTokens, event.totalTokens, event.durationMs, event.model, event.success, event.service],
      [42557, 1392, 43949, 7854, "deepseek/deepseek-v4.1-flash", true, "hermes_ops"],
    );
  });

  it("(b) the camelCase lines the parser always accepted still work", async () => {
    await auditFile([JSON.stringify({ timestamp: "2026-10-04T08:00:00.000Z", model: "gemini-2.5-flash", promptTokens: 1000, completionTokens: 500, totalTokens: 1500, durationMs: 1200, success: false })]);
    const hermes = hermesRow(getUnifiedAiCostSummary("all", NOW));
    assert.equal(hermes.requests, 1);
    assert.equal(hermes.tokens, 1500);
    assert.ok(hermes.costThb > 0);
    const event = parseHermesAuditLine(JSON.stringify({ timestamp: "2026-10-04T08:00:00.000Z", promptTokens: 1000, completionTokens: 500, totalTokens: 1500, durationMs: 1200, success: false }))!;
    assert.deepEqual([event.promptTokens, event.completionTokens, event.totalTokens, event.durationMs, event.success, event.timestamp], [1000, 500, 1500, 1200, false, "2026-10-04T08:00:00.000Z"]);
  });

  it("(b) a line with only prompt and completion tokens still totals them", async () => {
    await auditFile([JSON.stringify({ ts: "2026-10-04T08:00:00.000Z", prompt_tokens: 700, completion_tokens: 300 })]);
    assert.equal(hermesRow(getUnifiedAiCostSummary("all", NOW)).tokens, 1000);
  });

  it("(c) `ts` is the event's time: an old call stays out of the recent periods, a fresh one is in", async () => {
    const old = JSON.stringify({ ts: "2026-01-15T03:00:00.000Z", prompt_tokens: 100, completion_tokens: 10, total_tokens: 110, model: "m", error: null });
    const fresh = JSON.stringify({ ts: "2026-10-04T10:42:01.309Z", prompt_tokens: 200, completion_tokens: 20, total_tokens: 220, model: "m", error: null });
    await auditFile([old, fresh]);
    const now = new Date("2026-10-05T00:00:00.000Z");
    assert.equal(hermesRow(getUnifiedAiCostSummary("30d", now)).tokens, 220, "only the October call is inside 30 days");
    assert.equal(hermesRow(getUnifiedAiCostSummary("7d", now)).tokens, 220);
    assert.equal(hermesRow(getUnifiedAiCostSummary("all", now)).tokens, 330, "all time has both");
    assert.equal(parseHermesAuditLine(old)!.timestamp, "2026-01-15T03:00:00.000Z");
  });

  it("(c) an unreadable or missing time falls back to now, as before", () => {
    const before = Date.now();
    for (const line of [{ ts: "not a date", prompt_tokens: 1 }, { prompt_tokens: 1 }, { ts: 12345, prompt_tokens: 1 }]) {
      const stamped = Date.parse(parseHermesAuditLine(JSON.stringify(line))!.timestamp);
      assert.ok(stamped >= before - 5 && stamped <= Date.now() + 5, JSON.stringify(line));
    }
  });

  it("(d) a call that ended in an error is unsuccessful but its tokens are still counted", async () => {
    const failed = JSON.stringify({ ts: "2026-10-04T09:00:00.000Z", prompt_tokens: 5000, completion_tokens: 0, total_tokens: 5000, model: "deepseek/deepseek-v4.1-flash", duration_ms: 31000, error: "Request timed out" });
    assert.equal(parseHermesAuditLine(failed)!.success, false);
    assert.equal(parseHermesAuditLine(JSON.stringify({ ts: "2026-10-04T09:00:00.000Z", error: { message: "boom" } }))!.success, false);
    await auditFile([failed, ENGINE_LINE]);
    const hermes = hermesRow(getUnifiedAiCostSummary("all", NOW));
    assert.equal(hermes.requests, 2, "the failed call is a request too");
    assert.equal(hermes.tokens, 5000 + 43949, "and it is billed");
  });

  it("(d) error null, missing or empty means success; an explicit success:false still wins", () => {
    assert.equal(parseHermesAuditLine('{"ts":"2026-10-04T09:00:00.000Z","error":null}')!.success, true);
    assert.equal(parseHermesAuditLine('{"ts":"2026-10-04T09:00:00.000Z"}')!.success, true);
    assert.equal(parseHermesAuditLine('{"ts":"2026-10-04T09:00:00.000Z","error":""}')!.success, true);
    assert.equal(parseHermesAuditLine('{"ts":"2026-10-04T09:00:00.000Z","error":null,"success":false}')!.success, false);
  });

  it("when both spellings are present the engine's usable value wins, otherwise the camelCase one is used", () => {
    const both = parseHermesAuditLine(JSON.stringify({ prompt_tokens: 10, promptTokens: 99, completion_tokens: "x", completionTokens: 7, ts: "2026-10-04T01:00:00.000Z", timestamp: "2026-10-04T02:00:00.000Z" }))!;
    assert.deepEqual([both.promptTokens, both.completionTokens, both.timestamp], [10, 7, "2026-10-04T01:00:00.000Z"]);
    const badTs = parseHermesAuditLine(JSON.stringify({ ts: "garbage", timestamp: "2026-10-04T02:00:00.000Z" }))!;
    assert.equal(badTs.timestamp, "2026-10-04T02:00:00.000Z");
  });

  it("token fields that are not numbers are ignored rather than trusted", () => {
    const event = parseHermesAuditLine(JSON.stringify({ prompt_tokens: "42557", completion_tokens: null, total_tokens: NaN, duration_ms: {} }))!;
    assert.deepEqual([event.promptTokens, event.completionTokens, event.totalTokens, event.durationMs], [undefined, undefined, undefined, undefined]);
  });

  it("a line without a model is attributed to hermes-agent", () => {
    assert.equal(parseHermesAuditLine('{"prompt_tokens":1}')!.model, "hermes-agent");
    assert.equal(parseHermesAuditLine('{"prompt_tokens":1,"model":"  "}')!.model, "hermes-agent");
  });

  it("(e) a missing file gives an empty Hermes row and does not throw", () => {
    process.env["HERMES_AUDIT_LOG_PATH"] = path.join(directory, "does-not-exist.jsonl");
    let summary!: ReturnType<typeof getUnifiedAiCostSummary>;
    assert.doesNotThrow(() => { summary = getUnifiedAiCostSummary("all", NOW); });
    assert.equal(hermesRow(summary).requests, 0);
    assert.equal(hermesRow(summary).status, "no-data");
  });

  it("(e) an empty file, and a directory where the file should be, also give an empty row without throwing", async () => {
    await auditFile([]);
    assert.equal(hermesRow(getUnifiedAiCostSummary("all", NOW)).requests, 0);
    process.env["HERMES_AUDIT_LOG_PATH"] = directory;
    assert.doesNotThrow(() => getUnifiedAiCostSummary("all", NOW));
    assert.equal(hermesRow(getUnifiedAiCostSummary("all", NOW)).requests, 0);
  });

  it("(e) damaged lines are skipped and the good lines around them still count (also with CRLF line endings)", async () => {
    const lines = ["not json at all", ENGINE_LINE, "{", "[1,2,3]", "42", "null", '"a string"', "", "   ", '{"ts": "2026-10-04T11:00:00.000Z", "prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150, "model": "m", "error": null}'];
    for (const eol of ["\n", "\r\n"]) {
      await auditFile(lines, eol);
      let hermes!: ReturnType<typeof hermesRow>;
      assert.doesNotThrow(() => { hermes = hermesRow(getUnifiedAiCostSummary("all", NOW)); });
      assert.equal(hermes.requests, 2, JSON.stringify(eol));
      assert.equal(hermes.tokens, 43949 + 150, JSON.stringify(eol));
    }
  });

  it("parseHermesAuditLine never throws, whatever the line holds", () => {
    for (const line of ["", " ", "{", "}", "[", "null", "true", "0", '"x"', "[]", "{}", '{"error": {"a": {"b": {"c": 1}}}}', '{"ts": {}}', "\u0000", "💥"]) {
      assert.doesNotThrow(() => parseHermesAuditLine(line), JSON.stringify(line));
    }
    assert.equal(parseHermesAuditLine("[]"), null, "an array is not a usage record");
  });
});

// job-254: one Hermes line is one reporting round, not one model call. The engine writes the number of model calls in the
// round as `api_calls`, and the Hermes row's request count is the sum of it. Tokens and cost must not move.
describe("Hermes request count from api_calls (job-254)", () => {
  let directory: string;
  const savedAuditPath = process.env["HERMES_AUDIT_LOG_PATH"];
  const NOW = new Date("2026-10-05T00:00:00.000Z");

  before(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "hermes-api-calls-"));
  });
  beforeEach(() => clearAiUsageEvents());
  after(async () => {
    clearAiUsageEvents();
    if (savedAuditPath === undefined) delete process.env["HERMES_AUDIT_LOG_PATH"];
    else process.env["HERMES_AUDIT_LOG_PATH"] = savedAuditPath;
    await rm(directory, { force: true, recursive: true });
  });

  async function auditFile(lines: string[]) {
    const file = path.join(directory, `usage-${Math.random().toString(36).slice(2)}.jsonl`);
    await writeFile(file, lines.join("\n") + "\n");
    process.env["HERMES_AUDIT_LOG_PATH"] = file;
  }
  const row = (summary: ReturnType<typeof getUnifiedAiCostSummary>, id: string) => summary.services.find((service) => service.id === id)!;
  /** A line in the engine's format; `extra` is spliced in as raw JSON so broken values can be written as they would appear. */
  const line = (extra: string, promptTokens = 1000, completionTokens = 100) =>
    `{"ts": "2026-10-04T11:34:00Z", "model": "deepseek/deepseek-v4.1-flash", "source": "hermes_interactive", "session": "s1"${extra}, "prompt_tokens": ${promptTokens}, "completion_tokens": ${completionTokens}, "total_tokens": ${promptTokens + completionTokens}, "duration_ms": null, "error": null}`;

  it("a line with api_calls=4 counts as 4 requests", async () => {
    await auditFile([line(', "api_calls": 4')]);
    const summary = getUnifiedAiCostSummary("all", NOW);
    assert.equal(row(summary, "hermes_ops").requests, 4);
    assert.equal(summary.totalRequests, 4);
    assert.deepEqual(summary.modelBreakdown.map((entry) => [entry.model, entry.requests]), [["deepseek/deepseek-v4.1-flash", 4]]);
  });

  it("a line without api_calls (the engine's cron lines) still counts as 1", async () => {
    await auditFile([line("")]);
    assert.equal(row(getUnifiedAiCostSummary("all", NOW), "hermes_ops").requests, 1);
    assert.equal(parseHermesAuditLine(line(""))!.apiCalls, 1);
  });

  it("a broken api_calls (0, -3, \"x\", 2.5, null, a huge number) counts as 1", async () => {
    const broken = ["0", "-3", '"x"', '"4"', "2.5", "null", "true", "{}", "[4]", "1e300"];
    for (const value of broken) {
      assert.equal(parseHermesAuditLine(line(`, "api_calls": ${value}`))!.apiCalls, 1, value);
    }
    await auditFile(broken.map((value) => line(`, "api_calls": ${value}`)));
    assert.equal(row(getUnifiedAiCostSummary("all", NOW), "hermes_ops").requests, broken.length);
  });

  it("requests are the sum of api_calls over the lines, mixing lines with and without the field", async () => {
    await auditFile([line(', "api_calls": 4'), line(""), line(', "api_calls": 0'), line(', "api_calls": 12'), line(', "apiCalls": 3')]);
    assert.equal(row(getUnifiedAiCostSummary("all", NOW), "hermes_ops").requests, 4 + 1 + 1 + 12 + 3);
  });

  it("tokens and cost are exactly what the same lines give without api_calls", async () => {
    const lines = [line(', "api_calls": 4', 29137, 148), line(', "api_calls": 7', 5000, 900), line("", 300, 20)];
    await auditFile(lines.map((text) => text.replace(/, "api_calls": \d+/, "")));
    const before = row(getUnifiedAiCostSummary("all", NOW), "hermes_ops");
    await auditFile(lines);
    const after = row(getUnifiedAiCostSummary("all", NOW), "hermes_ops");
    assert.equal(before.requests, 3);
    assert.equal(after.requests, 4 + 7 + 1);
    assert.equal(after.tokens, before.tokens);
    assert.equal(after.costThb, before.costThb);
    assert.equal(after.tokens, 29285 + 5900 + 320);
  });

  it("other services keep counting one request per event, even if an event carries apiCalls", async () => {
    await auditFile([]);
    recordAiUsage({ service: "sales_bot", model: "gemini-2.5-flash", promptTokens: 10, completionTokens: 5, success: true, apiCalls: 9 });
    recordAiUsage({ service: "sketch_vision", model: "deepseek/deepseek-v4.1-flash", success: true, imageCount: 1 });
    recordAiUsage({ service: "vertex_gemini", model: "google/gemini-2.5-flash", success: true, apiCalls: 5 });
    recordAiUsage({ service: "google_tts", model: "th-TH-Chirp3-HD-Kore", promptTokens: 40, success: true });
    const summary = getUnifiedAiCostSummary("all", NOW);
    for (const id of ["sales_bot", "sketch_vision", "vertex_gemini", "google_tts"]) {
      assert.equal(row(summary, id).requests, 1, id);
    }
    assert.equal(row(summary, "hermes_ops").requests, 0);
    assert.equal(row(summary, "hermes_ops").status, "no-data");
    assert.equal(summary.totalRequests, 4);
  });

  it("the model breakdown counts Hermes requests the same way, alongside one-per-event app services", async () => {
    await auditFile([line(', "api_calls": 4'), line(', "api_calls": 2')]);
    recordAiUsage({ service: "sketch_vision", model: "deepseek/deepseek-v4.1-flash", success: true, imageCount: 1 });
    const summary = getUnifiedAiCostSummary("all", NOW);
    assert.deepEqual(summary.modelBreakdown.map((entry) => [entry.model, entry.requests]), [["deepseek/deepseek-v4.1-flash", 7]]);
    assert.equal(summary.totalRequests, 7);
  });
});
