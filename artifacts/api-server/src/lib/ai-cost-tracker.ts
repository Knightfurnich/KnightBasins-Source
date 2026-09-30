// Unified AI Cost Center: aggregates the company's 3 AI cost pillars into one
// THB figure for the admin dashboard --
//   1. sales_bot    -- น้องไนท์ (LINE OA / in-app chat customer assistant)
//   2. sketch_vision -- AI Blueprint Reader (POST /api/sketch/analyze)
//   3. hermes_ops   -- Hermes agent & automation (read from its own audit log)
//
// Usage events live in memory only (this process's lifetime) for sales_bot
// and sketch_vision -- there is no requirement here for durable storage, and
// FORBIDDEN explicitly keeps this task off the database. Hermes's own usage
// is instead read from a JSONL file it already writes on the VPS
// (/opt/data/cron/usage_audit.jsonl), which is the one thing here that
// persists across a restart, since Hermes controls that file's lifecycle,
// not this module.
import { readFileSync } from "node:fs";

export type AiUsageService = "sales_bot" | "sketch_vision" | "hermes_ops" | "vertex_gemini" | "google_tts";

export type AiUsageEvent = {
  service: AiUsageService;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  success: boolean;
  imageCount?: number;
};

type RecordedAiUsageEvent = AiUsageEvent & { timestamp: string };

export type AiCostPeriod = "today" | "7d" | "30d" | "all";
export const AI_COST_PERIODS: readonly AiCostPeriod[] = ["today", "7d", "30d", "all"];

export type AiCostServiceSummary = {
  id: AiUsageService;
  name: string;
  requests: number;
  tokens: number;
  costThb: number;
  status: "active" | "no-data";
};

export type AiCostModelBreakdown = { model: string; requests: number; costThb: number };

export type UnifiedAiCostResponse = {
  period: AiCostPeriod;
  updatedAt: string;
  totalCostThb: number;
  totalRequests: number;
  totalTokens: number;
  services: AiCostServiceSummary[];
  modelBreakdown: AiCostModelBreakdown[];
};

const aiUsageEvents: RecordedAiUsageEvent[] = [];

/** Appends one usage event to the in-memory log, stamped with the time it was recorded. */
export function recordAiUsage(event: AiUsageEvent): void {
  aiUsageEvents.push({ ...event, timestamp: new Date().toISOString() });
}

/** Test-only: clears the in-memory event log so each test starts from a clean state. */
export function clearAiUsageEvents(): void {
  aiUsageEvents.length = 0;
}

const USD_TO_THB = 35;

type ModelPricing = { inputThbPerThousandTokens: number; outputThbPerThousandTokens: number; imageThb?: number };

// Gemini 3.8 Flash and 2.5 Flash are the same price tier as of this writing
// (2.5 Flash's rate carried forward when the model was retired -- see
// sketch-vision.ts's own commit history), so both keys share one entry.
const GEMINI_FLASH_PRICING: ModelPricing = {
  inputThbPerThousandTokens: (0.075 / 1000) * USD_TO_THB, // 0.002625 บ./1k tokens
  outputThbPerThousandTokens: (0.3 / 1000) * USD_TO_THB, // 0.0105 บ./1k tokens
  imageThb: 0.0005 * USD_TO_THB, // 0.0175 บ./ภาพ
};

// Google Cloud Text-to-Speech (Chirp3-HD / Neural2) bills per character, not
// per token -- google-tts.ts's synthesizeSpeech() reports the character count
// via the event's promptTokens field (there is no separate "output" side to
// a TTS call), so outputThbPerThousandTokens stays 0 here.
const GOOGLE_TTS_PRICING: ModelPricing = {
  inputThbPerThousandTokens: (16 / 1_000_000) * 1000 * USD_TO_THB, // $16/1M characters ~= 0.56 บ./1,000 ตัวอักษร
  outputThbPerThousandTokens: 0,
};

// All th-TH Chirp3-HD voices an admin can select (SUPPORT_VOICE_OPTIONS in
// google-tts.ts) plus the generic labels this ticket calls out, so any of
// them price as google_tts instead of silently falling through to
// DEFAULT_PRICING's much cheaper per-token rate.
const GOOGLE_TTS_MODELS = [
  "th-TH-Chirp3-HD-Kore",
  "th-TH-Chirp3-HD-Zephyr",
  "th-TH-Chirp3-HD-Autonoe",
  "th-TH-Chirp3-HD-Leda",
  "th-TH-Chirp3-HD-Despina",
  "google-tts",
  "text-to-speech",
] as const;

const MODEL_PRICING: Record<string, ModelPricing> = {
  "gemini-3.8-flash": GEMINI_FLASH_PRICING,
  "gemini-2.5-flash": GEMINI_FLASH_PRICING,
  "google/gemini-2.5-flash": GEMINI_FLASH_PRICING, // vertex-gemini.ts's model id includes the "google/" vendor prefix
  "deepseek-v4.1-flash": {
    inputThbPerThousandTokens: (0.14 / 1000) * USD_TO_THB, // 0.0049 บ./1k tokens
    outputThbPerThousandTokens: (0.28 / 1000) * USD_TO_THB, // 0.0098 บ./1k tokens
  },
  ...Object.fromEntries(GOOGLE_TTS_MODELS.map((model) => [model, GOOGLE_TTS_PRICING])),
};

/**
 * Applied to any model name not in MODEL_PRICING above -- including
 * "hermes-agent" itself, which is a role label rather than a billable model,
 * and any model this table hasn't been taught yet (Hermes's audit log can
 * name a model this table doesn't know, since Hermes picks its own model per
 * job -- see feedback_hermes_model.md). Priced at the cheapest tier this
 * company actually uses, so an unrecognized model is never silently priced
 * at 0 THB (which would understate spend) or invented from nothing.
 */
const DEFAULT_PRICING: ModelPricing = GEMINI_FLASH_PRICING;

/** THB cost for one request: token counts default to 0 (e.g. sketch_vision events that
 * only know an image count, not a token count) and negative inputs are treated as 0. */
export function calculateModelCostThb(model: string, promptTokens = 0, completionTokens = 0, imageCount = 0): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const inputCost = (Math.max(0, promptTokens) / 1000) * pricing.inputThbPerThousandTokens;
  const outputCost = (Math.max(0, completionTokens) / 1000) * pricing.outputThbPerThousandTokens;
  const imageCost = (pricing.imageThb ?? 0) * Math.max(0, imageCount);
  return inputCost + outputCost + imageCost;
}

const HERMES_AUDIT_LOG_PATH = "/opt/data/cron/usage_audit.jsonl";

function parseHermesAuditLine(line: string): RecordedAiUsageEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const body = parsed as Record<string, unknown>;
  const numberOrUndefined = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
  const timestamp = typeof body["timestamp"] === "string" && Number.isFinite(Date.parse(body["timestamp"]))
    ? body["timestamp"]
    : new Date().toISOString();
  return {
    service: "hermes_ops",
    model: typeof body["model"] === "string" && body["model"].trim() ? body["model"] : "hermes-agent",
    promptTokens: numberOrUndefined(body["promptTokens"]),
    completionTokens: numberOrUndefined(body["completionTokens"]),
    totalTokens: numberOrUndefined(body["totalTokens"]),
    durationMs: numberOrUndefined(body["durationMs"]),
    success: body["success"] !== false,
    imageCount: numberOrUndefined(body["imageCount"]),
    timestamp,
  };
}

/**
 * Reads Hermes's own usage_audit.jsonl (one JSON object per line) if present.
 * Never throws: the file simply doesn't exist in dev/CI/this sandbox (it's a
 * VPS-only path Hermes's own cron jobs write to), and a malformed line is
 * skipped rather than aborting the whole read -- this endpoint's job is to
 * show whatever cost data genuinely exists, not to validate another system's
 * log format.
 */
function readHermesAuditEvents(): RecordedAiUsageEvent[] {
  const auditPath = process.env["HERMES_AUDIT_LOG_PATH"] || HERMES_AUDIT_LOG_PATH;
  let raw: string;
  try {
    raw = readFileSync(auditPath, "utf8");
  } catch {
    return [];
  }
  const events: RecordedAiUsageEvent[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const event = parseHermesAuditLine(trimmed);
    if (event) events.push(event);
  }
  return events;
}

const SERVICE_ORDER: readonly AiUsageService[] = ["sales_bot", "sketch_vision", "hermes_ops", "vertex_gemini", "google_tts"];
const SERVICE_NAMES: Record<AiUsageService, string> = {
  sales_bot: "น้องไนท์ (LINE Bot ผู้ช่วยขาย)",
  sketch_vision: "AI Blueprint Reader (อ่านแบบร่าง)",
  hermes_ops: "เฮอร์มีส (งานบริหารระบบ & งานช่าง)",
  vertex_gemini: "ผู้ช่วย AI (Vertex AI Gemini)",
  google_tts: "เสียงผู้ช่วยขาย (Google Cloud TTS)",
};

function periodStartMs(period: AiCostPeriod, now: Date): number {
  if (period === "all") return Number.NEGATIVE_INFINITY;
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return now.getTime() - (period === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000;
}

function eventTokens(event: RecordedAiUsageEvent): number {
  return typeof event.totalTokens === "number" ? event.totalTokens : (event.promptTokens ?? 0) + (event.completionTokens ?? 0);
}

function eventCostThb(event: RecordedAiUsageEvent): number {
  return calculateModelCostThb(event.model, event.promptTokens, event.completionTokens, event.imageCount);
}

function roundThb(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Aggregates every recorded usage event (in-memory sales_bot/sketch_vision
 * events plus whatever Hermes's own audit log currently holds) into the
 * dashboard's response shape. `now` defaults to the real clock and exists as
 * a parameter purely so tests can pick a fixed instant instead of racing the
 * real one -- same pattern as computeAdminDashboardStats's own `now` param.
 * All 3 services are always present in the result (even with zero events),
 * so the frontend never has to special-case a missing pillar.
 */
export function getUnifiedAiCostSummary(period: AiCostPeriod, now: Date = new Date()): UnifiedAiCostResponse {
  const startMs = periodStartMs(period, now);
  const events = [...aiUsageEvents, ...readHermesAuditEvents()].filter((event) => Date.parse(event.timestamp) >= startMs);

  const services: AiCostServiceSummary[] = SERVICE_ORDER.map((id) => {
    const serviceEvents = events.filter((event) => event.service === id);
    return {
      id,
      name: SERVICE_NAMES[id],
      requests: serviceEvents.length,
      tokens: serviceEvents.reduce((sum, event) => sum + eventTokens(event), 0),
      costThb: roundThb(serviceEvents.reduce((sum, event) => sum + eventCostThb(event), 0)),
      status: serviceEvents.length > 0 ? "active" : "no-data",
    };
  });

  const modelTotals = new Map<string, { requests: number; costThb: number }>();
  for (const event of events) {
    const current = modelTotals.get(event.model) ?? { requests: 0, costThb: 0 };
    current.requests += 1;
    current.costThb += eventCostThb(event);
    modelTotals.set(event.model, current);
  }
  const modelBreakdown: AiCostModelBreakdown[] = [...modelTotals.entries()]
    .map(([model, totals]) => ({ model, requests: totals.requests, costThb: roundThb(totals.costThb) }))
    .sort((a, b) => b.costThb - a.costThb);

  return {
    period,
    updatedAt: now.toISOString(),
    totalCostThb: roundThb(services.reduce((sum, service) => sum + service.costThb, 0)),
    totalRequests: services.reduce((sum, service) => sum + service.requests, 0),
    totalTokens: services.reduce((sum, service) => sum + service.tokens, 0),
    services,
    modelBreakdown,
  };
}
