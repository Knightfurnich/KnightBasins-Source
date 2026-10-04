import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";
import {
  calculateModelCostThb,
  clearAiUsageEvents,
  getUnifiedAiCostSummary,
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
