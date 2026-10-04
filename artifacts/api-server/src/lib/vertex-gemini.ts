// Calls Gemini via Vertex AI's OpenAI-compatible Chat Completions endpoint
// (https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/endpoints/openapi/chat/completions;
// for location "global" the host has no region prefix: https://aiplatform.googleapis.com/...),
// authenticated with the same Google service account used elsewhere in this
// app (lib/google-service-account.ts) instead of an API key -- the org's GCP
// project disallows API keys. Mirrors lib/hermes-support.ts's shape
// (config loader + ok/message result) since both are "ask an LLM" bridges.

import { loadGoogleServiceAccountCredentials, fetchGoogleAccessToken } from "./google-service-account.ts";
import { recordAiUsage } from "./ai-cost-tracker.ts";

const VERTEX_AI_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const REQUEST_TIMEOUT_MS = 45_000;
const DEFAULT_LOCATION = "asia-southeast1";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

/** The Vertex AI host for a location. "global" has no regional prefix ("global-aiplatform..." does not exist and answers 404). */
export function vertexAiHost(location: string): string {
  return location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
}

export function vertexChatCompletionsUrl(projectId: string, location: string): string {
  return `https://${vertexAiHost(location)}/v1/projects/${projectId}/locations/${location}/endpoints/openapi/chat/completions`;
}

export type GeminiResult =
  | { ok: true; reply: string }
  | { ok: false; message: string };

function vertexConfig() {
  const projectId = process.env["VERTEX_AI_PROJECT_ID"];
  if (!projectId) return null;
  return {
    projectId,
    location: process.env["VERTEX_AI_LOCATION"] || DEFAULT_LOCATION,
    model: process.env["VERTEX_AI_MODEL"] || DEFAULT_MODEL,
    // Comma-separated model ids to try, in order, when the configured model answers 404 (a model id that is misspelt or not
    // served in this location). Empty unless the operator sets it: no model name is hard-coded here.
    fallbackModels: (process.env["VERTEX_AI_FALLBACK_MODELS"] ?? "").split(",").map((model) => model.trim()).filter(Boolean),
  };
}

export function vertexGeminiConfigured() {
  return vertexConfig() !== null && loadGoogleServiceAccountCredentials() !== null;
}

export async function askGemini(options: {
  message: string;
  contextSummary?: string;
}): Promise<GeminiResult> {
  const config = vertexConfig();
  if (!config) return { ok: false, message: "ยังไม่ได้ตั้งค่า VERTEX_AI_PROJECT_ID" };

  const credentials = loadGoogleServiceAccountCredentials();
  if (!credentials) return { ok: false, message: "ยังไม่ได้ตั้งค่า Google Service Account (GOOGLE_SERVICE_ACCOUNT_JSON)" };

  const messages = [
    ...(options.contextSummary
      ? [{ role: "system" as const, content: options.contextSummary }]
      : []),
    { role: "user" as const, content: options.message },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // The configured model first, then each fallback (once). Only a 404 moves on to the next one.
  const models = [config.model, ...config.fallbackModels.filter((model) => model !== config.model)]
    .filter((model, index, all) => all.indexOf(model) === index);
  let lastModel = config.model;
  let startedAt = Date.now();
  try {
    const accessToken = await fetchGoogleAccessToken(credentials, VERTEX_AI_SCOPE);
    const url = vertexChatCompletionsUrl(config.projectId, config.location);
    let lastFailure = "Vertex AI request failed";
    for (let attempt = 0; attempt < models.length; attempt += 1) {
      const model = models[attempt] as string;
      lastModel = model;
      startedAt = Date.now();
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ model, messages }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      } | null;

      const reply = payload?.choices?.[0]?.message?.content;
      const success = response.ok && typeof reply === "string" && reply.trim().length > 0;
      recordAiUsage({
        service: "vertex_gemini",
        model,
        promptTokens: payload?.usage?.prompt_tokens,
        completionTokens: payload?.usage?.completion_tokens,
        totalTokens: payload?.usage?.total_tokens,
        durationMs: Date.now() - startedAt,
        success,
      });
      if (success) return { ok: true, reply: reply.trim() };
      lastFailure = payload?.error?.message ?? `Vertex AI returned ${response.status}`;
      const nextModel = models[attempt + 1];
      if (response.status === 404 && nextModel !== undefined) {
        console.warn("Vertex AI model not found (404); trying the next fallback model", {
          model,
          nextModel,
          location: config.location,
          host: vertexAiHost(config.location),
        });
        continue;
      }
      return { ok: false, message: lastFailure };
    }
    return { ok: false, message: lastFailure };
  } catch (error) {
    const message = error instanceof Error
      ? (error.name === "AbortError" ? "Vertex AI request timed out" : error.message)
      : "Vertex AI request failed";
    recordAiUsage({
      service: "vertex_gemini",
      model: lastModel,
      durationMs: Date.now() - startedAt,
      success: false,
    });
    return { ok: false, message };
  } finally {
    clearTimeout(timeout);
  }
}
