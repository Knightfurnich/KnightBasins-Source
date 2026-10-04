// Everything the AI sketch reader (sketch-vision.ts) takes from the environment, in one place and free of I/O, so the
// provider choice, the model ids and the Vertex location can all change with a .env edit (plus the usual container
// recreate) and never with a code change.
//
// Why model ids are not constants in the reader: Google retires and renames models. The /sketch reader died in production
// because it was pinned to a model id the project no longer served and every analysis came back HTTP 404. A model id is
// configuration, so the only id this module ever supplies itself is OpenRouter's documented default.
//
//   SKETCH_VISION_PROVIDER=openrouter | gemini | auto      (default auto)
//   OPENROUTER_API_KEY, OPENROUTER_BASE_URL, OPENROUTER_VISION_MODEL
//   VERTEX_AI_MODEL, VERTEX_AI_FALLBACK_MODELS, VERTEX_VISION_LOCATION (falls back to VERTEX_AI_LOCATION)

export type SketchVisionProvider = "openrouter" | "gemini";
export type SketchVisionProviderChoice = SketchVisionProvider | "auto";

const SKETCH_VISION_PROVIDERS: readonly SketchVisionProvider[] = ["openrouter", "gemini"];
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
// OpenRouter's id for DeepSeek V4.1 Flash, the default the boss chose; OPENROUTER_VISION_MODEL overrides it.
const DEFAULT_OPENROUTER_VISION_MODEL = "deepseek/deepseek-v4.1-flash";
const DEFAULT_VERTEX_LOCATION = "asia-southeast1";
// Time limits (job-247). The proxy in front of the API cuts a request at 60 s and answers 504, and a reading that has
// not come back after 20 s is not going to be worth waiting for: one provider call gets at most 20 s, and the whole
// request (every provider and model it tries) must finish before 45 s. The defaults sit under those ceilings and the env
// overrides can only lower them, never raise them past a ceiling.
const MAX_ATTEMPT_TIMEOUT_MS = 20_000;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 20_000;
const MAX_TOTAL_BUDGET_MS = 44_000;
const DEFAULT_TOTAL_BUDGET_MS = 40_000;
// Room for the model to think and then write the whole reading as JSON (the sample sketch needed ~5.5k tokens end to end);
// an unbounded answer is also an unbounded wait.
const DEFAULT_OPENROUTER_MAX_TOKENS = 4_096;

type Env = Record<string, string | undefined>;

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/** The provider the operator asked for, or "auto". Anything unrecognised means "auto" (reported by the caller once). */
export function parseSketchVisionProviderChoice(raw: string | undefined): { choice: SketchVisionProviderChoice; recognised: boolean } {
  const value = clean(raw).toLowerCase();
  if (!value) return { choice: "auto", recognised: true };
  if (value === "auto") return { choice: "auto", recognised: true };
  if ((SKETCH_VISION_PROVIDERS as readonly string[]).includes(value)) return { choice: value as SketchVisionProvider, recognised: true };
  return { choice: "auto", recognised: false };
}

/**
 * The order providers are tried in. auto: OpenRouter first, then Gemini. A named provider goes first and the other one
 * is still tried after it. Only providers in `available` are returned, so an unconfigured one is skipped.
 */
export function orderSketchVisionProviders(choice: SketchVisionProviderChoice, available: readonly SketchVisionProvider[]): SketchVisionProvider[] {
  const preferred: SketchVisionProvider[] = choice === "gemini" ? ["gemini", "openrouter"] : ["openrouter", "gemini"];
  return preferred.filter((provider) => available.includes(provider));
}

export type OpenRouterVisionConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Upper bound for the answer's tokens (reasoning included). */
  maxTokens: number;
  /** Whether to ask for response_format json_object; some providers answer with an empty message when it is on. */
  jsonMode: boolean;
};

function positiveInteger(raw: string | undefined): number | null {
  const value = Number(clean(raw));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

/** null when there is no OPENROUTER_API_KEY. The base URL has any trailing slash removed. */
export function openRouterVisionConfig(env: Env = process.env): OpenRouterVisionConfig | null {
  const apiKey = clean(env["OPENROUTER_API_KEY"]);
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (clean(env["OPENROUTER_BASE_URL"]) || DEFAULT_OPENROUTER_BASE_URL).replace(/\/+$/, ""),
    model: clean(env["OPENROUTER_VISION_MODEL"]) || DEFAULT_OPENROUTER_VISION_MODEL,
    maxTokens: positiveInteger(env["OPENROUTER_VISION_MAX_TOKENS"]) ?? DEFAULT_OPENROUTER_MAX_TOKENS,
    jsonMode: !/^(off|false|0|no)$/i.test(clean(env["OPENROUTER_VISION_JSON_MODE"])),
  };
}

function normalizeVertexModelId(raw: string | undefined): string {
  // VERTEX_AI_MODEL is shared with vertex-gemini.ts, which writes it with a "google/" vendor prefix; the native
  // publisher path rejects that prefixed id with 404.
  return clean(raw).replace(/^google\//, "").trim();
}

/**
 * Models to try on the Vertex / Gemini path, in order: VERTEX_AI_MODEL, then VERTEX_AI_FALLBACK_MODELS (comma separated).
 * Empty when VERTEX_AI_MODEL is not set: there is deliberately no built-in id, so the Gemini path then counts as not configured.
 */
export function vertexModelCandidates(env: Env = process.env): string[] {
  const primary = normalizeVertexModelId(env["VERTEX_AI_MODEL"]);
  if (!primary) return [];
  const fallbacks = clean(env["VERTEX_AI_FALLBACK_MODELS"]).split(",").map((entry) => normalizeVertexModelId(entry)).filter(Boolean);
  const all = [primary, ...fallbacks];
  return all.filter((model, index) => all.indexOf(model) === index);
}

/** Location for the native generateContent path: VERTEX_VISION_LOCATION, else VERTEX_AI_LOCATION, else asia-southeast1. */
export function vertexVisionLocation(env: Env = process.env): string {
  return clean(env["VERTEX_VISION_LOCATION"]) || clean(env["VERTEX_AI_LOCATION"]) || DEFAULT_VERTEX_LOCATION;
}

/**
 * Host for the native generateContent endpoint. A region is a prefix ("asia-southeast1-aiplatform.googleapis.com"), but
 * "global" is not: "global-aiplatform.googleapis.com" does not exist.
 */
export function vertexHost(location: string): string {
  return location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
}

/**
 * True when a failed Vertex answer means "this project does not serve that model id", the one failure that a different
 * model can fix. Anything else (auth, quota, a bad request) belongs to the current model and is not retried with another.
 */
export function isVertexModelNotFound(status: number, message: string | undefined): boolean {
  return status === 404 && /publisher model|was not found|does not have access/i.test(message ?? "");
}

/** Per-provider-call timeout: SKETCH_VISION_TIMEOUT_MS when it is a positive number, never more than 20 s (default 20 s). */
export function sketchVisionAttemptTimeoutMs(env: Env = process.env): number {
  return Math.min(positiveInteger(env["SKETCH_VISION_TIMEOUT_MS"]) ?? DEFAULT_ATTEMPT_TIMEOUT_MS, MAX_ATTEMPT_TIMEOUT_MS);
}

/** Time for the whole request, all providers together: SKETCH_VISION_TOTAL_BUDGET_MS, never more than 44 s (default 40 s). */
export function sketchVisionTotalBudgetMs(env: Env = process.env): number {
  return Math.min(positiveInteger(env["SKETCH_VISION_TOTAL_BUDGET_MS"]) ?? DEFAULT_TOTAL_BUDGET_MS, MAX_TOTAL_BUDGET_MS);
}
