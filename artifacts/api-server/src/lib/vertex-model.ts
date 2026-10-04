// Resolves the model id(s) for Vertex AI's *native* publisher path
// (`.../publishers/google/models/<id>:generateContent`), for every feature
// that reads images with Gemini (sketch-vision.ts, stone-matcher.ts).
//
// Why this lives here instead of a `const MODEL = "..."` per file: Google
// retires and renames models, and a hard-coded id breaks the feature the day
// that happens. That is exactly how the /sketch AI reader died -- it was
// pinned to "gemini-3.8-flash", a model the project no longer serves, and
// every analysis came back HTTP 404 "Publisher model ... was not found"
// (with the raw Google error shown to the customer).
//
// Moving to a newer/stronger model is therefore a configuration change, not a
// code change:
//
//   VERTEX_AI_MODEL=<model id>              # primary, e.g. gemini-2.5-flash
//   VERTEX_AI_FALLBACK_MODELS=<id>,<id>     # optional, tried in order
//
// Both are read from the API server's environment (.env on the VPS), so
// switching models needs no code edit and no redeploy -- only the usual
// container recreate so the new value is picked up.
//
// VERTEX_AI_MODEL is shared with vertex-gemini.ts, which talks to the
// OpenAI-compatible endpoint and writes the same model with a "google/"
// vendor prefix ("google/gemini-2.5-flash"). The native publisher path
// rejects that prefixed id with 404, so the prefix is stripped here.

/** A model this project has actually been verified to serve in
 * asia-southeast1 (probed with the production service account). Used when
 * nothing is configured and as the last-resort fallback when the configured
 * model turns out to be retired. */
const DEFAULT_VERTEX_PUBLISHER_MODEL = "gemini-2.5-flash";

function normalizeModelId(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/^google\//, "").trim();
}

function parseFallbackList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => normalizeModelId(entry))
    .filter((entry) => entry.length > 0);
}

/**
 * Ordered candidate list: the configured model first, then any configured
 * fallbacks, then the built-in verified default. Duplicates removed, so a
 * caller can simply try them in order until one is served.
 */
export function vertexPublisherModels(): string[] {
  const primary = normalizeModelId(process.env["VERTEX_AI_MODEL"]);
  const candidates = [
    ...(primary ? [primary] : []),
    ...parseFallbackList(process.env["VERTEX_AI_FALLBACK_MODELS"]),
    DEFAULT_VERTEX_PUBLISHER_MODEL,
  ];
  return candidates.filter((model, index) => candidates.indexOf(model) === index);
}

/** The model a request will use first -- what an AI-cost record should be
 * labelled with. */
export function resolveVertexPublisherModel(): string {
  return vertexPublisherModels()[0]!;
}

/**
 * True when a failed response means "this project does not serve that model
 * id" -- the one failure a *different* candidate can fix. Google answers 404
 * with a message naming the publisher model; anything else (403, 400, quota)
 * is a real error for the current model and must not be retried blindly.
 */
export function isVertexModelNotFound(status: number, payload: { error?: { status?: string; message?: string } } | null): boolean {
  if (status !== 404) return false;
  const message = payload?.error?.message ?? "";
  return /publisher model|was not found|does not have access/i.test(message);
}

/**
 * Location for the native publisher path. A dedicated override exists so the
 * image features can move to the "global" endpoint -- the only place this
 * project is served the Gemini 3.x family -- without dragging
 * vertex-gemini.ts (the support bot, whose OpenAI-compatible URL is built
 * differently) along with it.
 */
export function resolveVertexPublisherLocation(fallback = "asia-southeast1"): string {
  const configured = (process.env["VERTEX_VISION_LOCATION"] || process.env["VERTEX_AI_LOCATION"] || "").trim();
  return configured || fallback;
}

/**
 * Host for the native generateContent endpoint. A regional location is
 * prefixed ("asia-southeast1-aiplatform.googleapis.com") but "global" is not:
 * "global-aiplatform.googleapis.com" does not exist, so dropping the prefix is
 * what makes a location=global migration work at all.
 */
export function vertexPublisherHost(location: string): string {
  return location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
}

