import {
  fetchGoogleAccessToken,
  loadGoogleServiceAccountCredentials,
  type GoogleServiceAccountCredentials,
} from "./google-service-account.ts";
import {
  isVertexModelNotFound,
  resolveVertexPublisherLocation,
  vertexPublisherHost,
  vertexPublisherModels,
} from "./vertex-model.ts";

const REQUEST_TIMEOUT_MS = 30_000;
const VERTEX_AI_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_VERTEX_AI_LOCATION = "asia-southeast1";
const SLAB_IMAGE_ORIGIN = "https://api.srv1964473.hstgr.cloud";
const MAX_SLAB_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_CONCURRENT_SLAB_FETCHES = 6;

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
  credentials: GoogleServiceAccountCredentials;
};

type CandidateWithCleanText = StoneMatchCandidate & { code: string; name: string };

type SlabImagePart = {
  code: string;
  name: string;
  mimeType: string;
  base64: string;
};

function vertexConfig(): VertexConfig | null {
  const projectId = process.env["VERTEX_AI_PROJECT_ID"];
  if (!projectId) return null;

  const credentials = loadGoogleServiceAccountCredentials();
  if (!credentials) return null;

  return {
    projectId,
    location: resolveVertexPublisherLocation(DEFAULT_VERTEX_AI_LOCATION),
    credentials,
  };
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
  return `Compare the customer's room photo with the supplied official stone-slab reference photos. Rank only the listed stones by visual similarity, from closest to least close. Use the reference-photo label to identify each stone.

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

    const models = vertexPublisherModels();
    for (let candidate = 0; candidate < models.length; candidate += 1) {
      const model = models[candidate]!;
      const url = `https://${vertexPublisherHost(config.location)}/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${model}:generateContent`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          // Vertex rejects a content entry that carries no role with
          // HTTP 400 "Please use a valid role: user, model."
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
        error?: { status?: string; message?: string };
      } | null;
      if (!response.ok) {
        // A retired/renamed model is the one failure a different candidate can
        // fix; anything else (auth, quota, bad request) is reported as-is.
        const nextModel = models[candidate + 1];
        if (nextModel && isVertexModelNotFound(response.status, payload)) {
          console.warn(`[stone-matcher] model "${model}" is not served by this project (HTTP ${response.status}); retrying with "${nextModel}". Update VERTEX_AI_MODEL to a model the project serves.`);
          continue;
        }
        return { status: "failed", message: `Gemini Vision returned HTTP ${response.status}.` };
      }

      const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string" || !text.trim()) return { status: "ok", matches: [] };
      return { status: "ok", matches: parseMatches(text, allowedCandidates) };
    }
    return { status: "failed", message: "No Gemini model configured for this project is available." };
  };

  try {
    return await Promise.race([request(), timeoutPromise]);
  } catch (error) {
    controller.abort();
    const timedOut = error instanceof Error
      && (error.name === "AbortError" || error.name === "TimeoutError");
    return {
      status: "failed",
      message: timedOut
        ? "Gemini Vision request timed out. Please try again."
        : "Stone image matching could not be completed.",
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}