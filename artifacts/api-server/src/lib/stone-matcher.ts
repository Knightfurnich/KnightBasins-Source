// "Match a stone colour from a photo" — Vertex AI / Gemini visual comparison against the official slab catalogue.
//
// The model id and the location are configuration, never constants in this file (job 248): Google retires and renames
// models, and this feature used to be pinned to a model id the project does not serve (HTTP 404 on every request).
// Everything the request needs therefore comes from the same env helpers the /sketch reader uses
// (sketch-vision-config.ts), so one .env edit changes both features and no code change ever carries a model id.
//
//   VERTEX_AI_MODEL            the primary model (a "google/" vendor prefix is stripped, the publisher path rejects it)
//   VERTEX_AI_FALLBACK_MODELS  comma separated, tried in order when the configured model is not served (404)
//   VERTEX_VISION_LOCATION     else VERTEX_AI_LOCATION, else asia-southeast1; "global" uses the unprefixed host
//
// Provider error text can name the project, region and model path: it is logged (capped) and never returned. The
// caller only ever sees the static Thai message below, and suggestStonesForPhoto never throws.

import {
  fetchGoogleAccessToken,
  loadGoogleServiceAccountCredentials,
  type GoogleServiceAccountCredentials,
} from "./google-service-account.ts";
import {
  isVertexModelNotFound,
  vertexHost,
  vertexModelCandidates,
  vertexVisionLocation,
} from "./sketch-vision-config.ts";

const REQUEST_TIMEOUT_MS = 30_000;
const VERTEX_AI_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const SLAB_IMAGE_ORIGIN = "https://api.srv1964473.hstgr.cloud";
const MAX_SLAB_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_CONCURRENT_SLAB_FETCHES = 6;
/** The only failure text a customer ever sees: static Thai, no provider detail, polite, invites a retry. */
const MATCH_FAILED_MESSAGE = "ขออภัย ไม่สามารถจับคู่สีหินจากภาพได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";

export type StoneMatchCandidate = {
  code: string;
  name: string;
  /** Pinned official photo used for the visual comparison (may be null). */
  slabImageUrl: string | null;
};

export type StoneMatch = {
  code: string;
  name: string;
  reason: string;
};

export type StoneMatchResult =
  | { status: "ok"; matches: StoneMatch[] }
  | { status: "not-configured" }
  | { status: "failed"; message: string };

type VertexConfig = {
  projectId: string;
  location: string;
  /** Models to try in order, straight from env; never a constant id. */
  models: string[];
  credentials: GoogleServiceAccountCredentials;
};

type CandidateWithCleanText = StoneMatchCandidate & { code: string; name: string };

type SlabImagePart = {
  code: string;
  name: string;
  mimeType: string;
  base64: string;
};

type GeminiPayload = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
  error?: { message?: string };
};

const warnedOnce = new Set<string>();
function warnOnce(key: string, message: string) {
  if (warnedOnce.has(key)) return;
  warnedOnce.add(key);
  console.warn(message);
}

/** Provider error text can be long and can name the project, region and model path: cap it, and log it only. */
function logSafe(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").slice(0, 300);
}

/**
 * Credentials + project + models from env. Returns null (feature off, politely) when the project id or the service
 * account is missing, or when VERTEX_AI_MODEL is unset: there is deliberately no built-in model id, so a missing or
 * retired model can never be re-pinned by this file.
 */
function vertexConfig(): VertexConfig | null {
  const projectId = process.env["VERTEX_AI_PROJECT_ID"];
  if (!projectId) return null;

  const credentials = loadGoogleServiceAccountCredentials();
  if (!credentials) return null;

  const models = vertexModelCandidates();
  if (models.length === 0) {
    warnOnce(
      "vertex-model",
      "[stone-matcher] Google credentials are set but VERTEX_AI_MODEL is empty, so the stone matcher stays disabled. Set VERTEX_AI_MODEL to a model the project serves.",
    );
    return null;
  }

  return { projectId, location: vertexVisionLocation(), models, credentials };
}

function normalizeImageMimeType(value: string | null | undefined): string | null {
  const mimeType = value?.split(";")[0]?.trim().toLowerCase();
  if (mimeType === "image/jpg") return "image/jpeg";
  return mimeType && ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)
    ? mimeType
    : null;
}

function cleanCandidates(candidates: readonly StoneMatchCandidate[]): CandidateWithCleanText[] {
  const uniqueByCode = new Map<string, CandidateWithCleanText>();
  for (const candidate of candidates) {
    const code = candidate.code.trim();
    const name = candidate.name.replace(/[\r\n]+/g, " ").trim();
    if (!code || /[\r\n]/.test(code) || !name || uniqueByCode.has(code)) continue;
    uniqueByCode.set(code, {
      code,
      name,
      slabImageUrl: candidate.slabImageUrl?.trim() || null,
    });
  }
  return [...uniqueByCode.values()];
}

function makePrompt(candidates: readonly CandidateWithCleanText[]): string {
  const allowedList = candidates.map(({ code, name }) => `- ${code} · ${name}`).join("\n");
  return `Compare the customer's room photo with the supplied official stone-slab reference photos. Rank only the listed stones by visual similarity, from closest to least close. Use the reference-photo label to identify each stone. If none of the listed stones is close to the photo, return an empty match list instead of a forced match.

Allowed stones (these are the only codes you may return):
${allowedList}

Do not invent or alter a stone code or name. Do not calculate or return prices. Give a brief visual reason for each choice. Return valid JSON only, in exactly this shape: {"matches":[{"code":"...","reason":"..."}]}. Return no more than 3 matches.`;
}

function slabUrl(candidate: CandidateWithCleanText): URL | null {
  if (!candidate.slabImageUrl) return null;
  const url = new URL(candidate.slabImageUrl);
  if (
    url.protocol !== "https:"
    || url.origin !== SLAB_IMAGE_ORIGIN
    || !url.pathname.startsWith("/kb/images/slab/")
    || url.username
    || url.password
  ) {
    throw new Error("Stone slab reference URL is not allowed.");
  }
  return url;
}

async function fetchSlabImage(
  candidate: CandidateWithCleanText,
  url: URL,
  signal: AbortSignal,
): Promise<SlabImagePart> {
  const response = await fetch(url, { signal, redirect: "error" });
  if (!response.ok) throw new Error("Stone slab reference image could not be loaded.");

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SLAB_IMAGE_BYTES) {
    throw new Error("Stone slab reference image is too large.");
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_SLAB_IMAGE_BYTES) {
    throw new Error("Stone slab reference image is empty or too large.");
  }

  const extension = url.pathname.toLowerCase().split(".").pop();
  const inferredMimeType = extension === "jpg" || extension === "jpeg"
    ? "image/jpeg"
    : extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : extension === "gif"
          ? "image/gif"
          : null;
  const mimeType = normalizeImageMimeType(response.headers.get("content-type")) ?? inferredMimeType;
  if (!mimeType) throw new Error("Stone slab reference image has an unsupported format.");

  return { code: candidate.code, name: candidate.name, mimeType, base64: bytes.toString("base64") };
}

async function fetchSlabImages(
  candidates: readonly CandidateWithCleanText[],
  signal: AbortSignal,
): Promise<SlabImagePart[]> {
  const urls = new Map<string, { candidate: CandidateWithCleanText; url: URL }>();
  for (const candidate of candidates) {
    const url = slabUrl(candidate);
    if (url && !urls.has(url.toString())) urls.set(url.toString(), { candidate, url });
  }

  const entries = [...urls.values()];
  const results = new Map<string, SlabImagePart>();
  let nextIndex = 0;
  const workerCount = Math.min(MAX_CONCURRENT_SLAB_FETCHES, entries.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < entries.length) {
      const entry = entries[nextIndex++];
      if (!entry) return;
      results.set(
        entry.url.toString(),
        await fetchSlabImage(entry.candidate, entry.url, signal),
      );
    }
  }));

  return candidates.flatMap((candidate) => {
    const url = candidate.slabImageUrl ? new URL(candidate.slabImageUrl).toString() : null;
    const image = url ? results.get(url) : undefined;
    return image ? [image] : [];
  });
}

function parseMatches(
  text: string,
  allowedCandidates: ReadonlyMap<string, CandidateWithCleanText>,
): StoneMatch[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { matches?: unknown }).matches)) {
    return [];
  }

  const matches: StoneMatch[] = [];
  const seenCodes = new Set<string>();
  for (const entry of (parsed as { matches: unknown[] }).matches) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const code = typeof item["code"] === "string" ? item["code"].trim() : "";
    const candidate = allowedCandidates.get(code);
    if (!candidate || seenCodes.has(code)) continue;

    seenCodes.add(code);
    matches.push({
      code: candidate.code,
      name: candidate.name,
      reason: typeof item["reason"] === "string" ? item["reason"].trim() : "",
    });
    if (matches.length === 3) break;
  }
  return matches;
}

export async function suggestStonesForPhoto(
  imageBuffer: Buffer,
  mimeType: string,
  inputCandidates: readonly StoneMatchCandidate[],
): Promise<StoneMatchResult> {
  const config = vertexConfig();
  if (!config) return { status: "not-configured" };

  if (imageBuffer.length === 0) {
    return { status: "failed", message: "The room photo is empty." };
  }
  const normalizedMimeType = normalizeImageMimeType(mimeType);
  if (!normalizedMimeType) {
    return { status: "failed", message: "The room photo format is not supported." };
  }

  const candidates = cleanCandidates(inputCandidates);
  if (candidates.length === 0) return { status: "ok", matches: [] };

  const allowedCandidates = new Map(candidates.map((candidate) => [candidate.code, candidate]));
  const prompt = makePrompt(candidates);
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      const error = new Error("Stone matcher request timed out.");
      error.name = "TimeoutError";
      reject(error);
    }, REQUEST_TIMEOUT_MS);
  });

  const request = async (): Promise<StoneMatchResult> => {
    const slabImages = await fetchSlabImages(candidates, controller.signal);
    const accessToken = await fetchGoogleAccessToken(config.credentials, VERTEX_AI_SCOPE);
    const parts: Array<Record<string, unknown>> = [
      { text: prompt },
      { text: "Customer room photo:" },
      { inline_data: { mime_type: normalizedMimeType, data: imageBuffer.toString("base64") } },
    ];
    for (const image of slabImages) {
      parts.push({ text: `Official slab reference for ${image.code} · ${image.name}:` });
      parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
    }

    for (let index = 0; index < config.models.length; index += 1) {
      const model = config.models[index]!;
      const url = `https://${vertexHost(config.location)}/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${model}:generateContent`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          // Vertex rejects a content entry with no role (HTTP 400 "Please use a valid role: user, model."):
          // every request is a user turn.
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as GeminiPayload | null;
      if (!response.ok) {
        const providerText = payload?.error?.message;
        const next = config.models[index + 1];
        if (next && isVertexModelNotFound(response.status, providerText)) {
          console.warn(`[stone-matcher] model "${model}" is not served by this project (HTTP ${response.status}); retrying with "${next}". Update VERTEX_AI_MODEL to a model the project serves.`);
          continue;
        }
        console.warn(`[stone-matcher] Gemini ${model} answered HTTP ${response.status}: ${logSafe(providerText)}`);
        return { status: "failed", message: MATCH_FAILED_MESSAGE };
      }

      const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string" || !text.trim()) return { status: "ok", matches: [] };
      return { status: "ok", matches: parseMatches(text, allowedCandidates) };
    }
    // Every configured model came back "not served": configuration, not a customer error.
    return { status: "failed", message: MATCH_FAILED_MESSAGE };
  };

  try {
    return await Promise.race([request(), timeoutPromise]);
  } catch (error) {
    controller.abort();
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.warn(`[stone-matcher] stone matching failed: ${logSafe(detail)}`);
    return { status: "failed", message: MATCH_FAILED_MESSAGE };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
