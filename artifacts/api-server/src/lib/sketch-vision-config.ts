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
// One attempt, not the whole request: the same sketch took 8.5 s on one Gemini model, 22 s on DeepSeek and 36 s on another
// Gemini model, so the old 30 s ceiling would have cut off an answer that was about to arrive.
const DEFAULT_ATTEMPT_TIMEOUT_MS = 45_000;

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

export type OpenRouterVisionConfig = { apiKey: string; baseUrl: string; model: string };

/** null when there is no OPENROUTER_API_KEY. The base URL has any trailing slash removed. */
export function openRouterVisionConfig(env: Env = process.env): OpenRouterVisionConfig | null {
  const apiKey = clean(env["OPENROUTER_API_KEY"]);
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (clean(env["OPENROUTER_BASE_URL"]) || DEFAULT_OPENROUTER_BASE_URL).replace(/\/+$/, ""),
    model: clean(env["OPENROUTER_VISION_MODEL"]) || DEFAULT_OPENROUTER_VISION_MODEL,
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

/** Per-attempt timeout: SKETCH_VISION_TIMEOUT_MS when it is a positive number, otherwise 45 seconds. */
export function sketchVisionAttemptTimeoutMs(env: Env = process.env): number {
  const configured = Number(clean(env["SKETCH_VISION_TIMEOUT_MS"]));
  return Number.isFinite(configured) && configured > 0 ? Math.round(configured) : DEFAULT_ATTEMPT_TIMEOUT_MS;
}
