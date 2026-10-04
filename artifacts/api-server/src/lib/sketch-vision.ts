// Reads a customer's hand-drawn counter sketch (photo of a napkin drawing,
// a rough plan, etc.) with a vision model -- OpenRouter (DeepSeek by default)
// or Gemini on Vertex AI, chosen by SKETCH_VISION_PROVIDER, see
// sketch-vision-config.ts -- and pulls out the shape
// and dimensions so the /sketch page can pre-fill its form. The sales team
// or customer always reviews and can correct every field afterwards, so a
// wrong guess here is an inconvenience, not a pricing risk -- but a guessed
// number presented as read is worse than an honest "couldn't read this," so
// every field that can't be confidently parsed comes back null rather than
// invented (CONTRIBUTING.md rule 1: never collapse an uncertain outcome into
// a fabricated success).
//
// Never logs the image bytes, the OCR'd text, or anything else pulled from
// the photo -- only this module's own config/HTTP-failure messages, which
// never include request content. A provider's own error text (it can name the
// GCP project, region and model path) goes to the log only, never into the
// `notes` a customer sees.

import { loadGoogleServiceAccountCredentials, fetchGoogleAccessToken, type GoogleServiceAccountCredentials } from "./google-service-account.ts";
import {
  isVertexModelNotFound,
  openRouterVisionConfig,
  orderSketchVisionProviders,
  parseSketchVisionProviderChoice,
  sketchVisionAttemptTimeoutMs,
  sketchVisionTotalBudgetMs,
  vertexHost,
  vertexModelCandidates,
  vertexVisionLocation,
  type OpenRouterVisionConfig,
  type SketchVisionProvider,
} from "./sketch-vision-config.ts";

const VERTEX_AI_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

export type SketchVisionShape = "I" | "L-left" | "L-right" | "U" | "unknown";
export type SketchVisionConfidence = "high" | "medium" | "low";

export type SketchWorkpiecePanel = {
  panelIndex: number;
  label: string;
  lengthMm: number | null;
  depthMm: number | null;
};

export type SketchWorkpieceEdgeSide = "top" | "front" | "left" | "right";
export type SketchWorkpieceEdgeStatus = "upstand" | "wall-flush" | "open-edge" | "closed-edge" | "joint" | "unknown";

export type SketchWorkpieceEdge = {
  side: SketchWorkpieceEdgeSide;
  status: SketchWorkpieceEdgeStatus;
  note?: string;
};

export type SketchWorkpieceCutoutType = "basin" | "hob" | "other";

export type SketchWorkpieceCutout = {
  type: SketchWorkpieceCutoutType;
  description: string;
  count: number;
};

export type SketchWorkpiece = {
  id: string;
  shape: SketchVisionShape;
  label: string;
  dimensionsSummary: string;
  panels: SketchWorkpiecePanel[];
  edges: SketchWorkpieceEdge[];
  cutouts: SketchWorkpieceCutout[];
  notes?: string;
};

export type SketchVisionItem = {
  index: number;
  shape: SketchVisionShape;
  runAMm: number | null;
  runBMm: number | null;
  runCMm: number | null;
  depthMm: number | null;
  basinCount: number | null;
  stoneHint: string | null;
  rawText: string | null;
  confidence: SketchVisionConfidence;
  notes: string | null;
  workpieceCount: number;
  workpieces: SketchWorkpiece[];
};

const SKETCH_VISION_PROMPT = `คุณคือช่างประเมินหน้างานหินสังเคราะห์มืออาชีพระดับสูง กำลังดูภาพแบบร่าง (สเก็ตช์มือหรือแปลน) ของเคาน์เตอร์ครัว/อ่างล้างหน้าที่ลูกค้าหรือสถาปนิกวาดหรือถ่ายมา

อ่านภาพอย่างละเอียดแล้วตอบกลับเป็น JSON ตาม schema นี้เท่านั้น ไม่ต้องมีข้อความอื่นนอกเหนือจาก JSON:
{
  "workpieces": [
    {
      "id": string,
      "shape": "I" | "L-left" | "L-right" | "U" | "unknown",
      "label": string (เช่น "ชิ้นล่าง (เคาน์เตอร์ครัว)", "ชิ้นบน (ตู้ลอย)"),
      "dimensionsSummary": string (สรุปมิติสั้นๆ อ่านง่าย เช่น "1.98 x 0.6 ม."),
      "panels": [ { "panelIndex": number, "label": string, "lengthMm": number หรือ null, "depthMm": number หรือ null } ],
      "edges": [ { "side": "top" | "front" | "left" | "right", "status": "upstand" | "wall-flush" | "open-edge" | "closed-edge" | "joint" | "unknown", "note": string (ถ้ามี) } ],
      "cutouts": [ { "type": "basin" | "hob" | "other", "description": string, "count": number } ],
      "notes": string (ถ้ามี)
    }
  ],
  "shape": "I" | "L-left" | "L-right" | "U" | "unknown",
  "runAMm": number หรือ null,
  "runBMm": number หรือ null,
  "runCMm": number หรือ null,
  "depthMm": number หรือ null,
  "basinCount": number หรือ null,
  "stoneHint": string หรือ null,
  "rawText": string หรือ null,
  "confidence": "high" | "medium" | "low",
  "notes": string หรือ null
}

กติกาสำคัญ:
- ระบุจำนวนชิ้นงานทั้งหมดที่เห็นในภาพให้ครบ: workpieces ต้องมีอย่างน้อย 1 รายการเสมอ ถ้าภาพมีมากกว่า 1 ชิ้น (เช่น เคาน์เตอร์ล่างทรง L + ตู้ลอยชิ้นตรงด้านบน) ให้แยกเป็นหลาย workpieces
- panels คือรายการแผ่นหินที่ต้องตัดของชิ้นงานนั้น (ทรง I = 1 แผ่น, L-left/L-right = 2 แผ่น, U = 3 แผ่น) ระบุ lengthMm และ depthMm ของแต่ละแผ่น
- edges คือสถานะขอบที่อ่านจากสัญลักษณ์ในภาพ: upstand (▲ ติดบัว กันน้ำชนผนังปูน), wall-flush (║ ชิดผนัง ไม่มีบัว), open-edge (⊗ ขอบเปิดโชว์ลอย ขัดเนียน), closed-edge (⊞ ขอบปิด/บังหน้าโชว์เนียน), joint (🔗 รอยต่อชนแผ่น — เป็นจุดที่ล็อกอัตโนมัติในระบบอยู่แล้ว ไม่ต้องอ่านจากภาพก็ได้) — ถ้าอ่านสัญลักษณ์ขอบด้านใดไม่ชัดเจน ให้ตอบสถานะเป็น "unknown" ห้ามเดา
- cutouts คือจุดเจาะอ่าง/ก๊อก/เตาที่วาดหรือระบุในภาพ พร้อมคำอธิบาย (description) และจำนวน (count)
- กฎเหล็กสำคัญที่สุด: ห้ามหักพื้นที่ช่องเจาะ (อ่าง/ก๊อก/เตา) ออกจากพื้นที่คำนวณราคาหินเด็ดขาด ราคาหินคิดเต็มพื้นที่กว้าง × ยาวเสมอไม่ว่าจะมีรูเจาะกี่จุด ห้ามใส่ตัวเลขพื้นที่หรือราคาหักลบใน cutouts เด็ดขาด
- ฟิลด์ระดับบน (shape, runAMm, runBMm, runCMm, depthMm, basinCount) ให้สรุปค่าจากชิ้นงานแรก (workpieces[0]) เสมอ เพื่อให้ระบบเดิมที่ยังอ่านฟิลด์เหล่านี้ใช้งานได้ต่อเนื่อง
- ทุกตัวเลขความยาว/ความลึกต้องเป็นหน่วยมิลลิเมตร (mm) เสมอ ไม่ว่าตัวเลขในภาพจะเขียนเป็นเมตร (ม.), เซนติเมตร (ซม.), หรือไม่มีหน่วยกำกับก็ตาม ให้แปลงเป็นมิลลิเมตรก่อนตอบ
- stoneHint คือรหัส/ชื่อสีหินถ้าอ่านเจอในภาพ ไม่งั้นเป็น null
- rawText คือข้อความ/ตัวเลขทั้งหมดที่อ่านได้จากภาพ (สำหรับให้ทีมขายตรวจทาน)
- ถ้าอ่านตัวเลข รูปทรง หรือสถานะขอบไม่ได้ชัดเจน ห้ามเดา ให้ตอบ null หรือ "unknown" สำหรับค่านั้น
- confidence สะท้อนความมั่นใจโดยรวมของการอ่านภาพนี้`;

/** What the model sent back, reduced to what the reader needs; both providers are mapped onto this. */
type ModelAnswer = { text: string; promptTokens: number | null; completionTokens: number | null; finishReason?: string };

/** Token usage of one provider call that got an HTTP 200, so the cost center can bill what was really spent. */
export type SketchVisionUsage = {
  provider: SketchVisionProvider;
  /** The model id the request asked for (the cost table is keyed by it). */
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number;
  /** True when the answer was usable JSON, false when the call was billed but its output was not. */
  success: boolean;
};

export type SketchVisionAnalysis = {
  item: SketchVisionItem;
  /** One entry per provider call that got an answer. Empty when no AI call produced one (nothing configured, or every call failed). */
  usages: SketchVisionUsage[];
};

type VertexAccess =
  | { mode: "vertex"; projectId: string; location: string; credentials: GoogleServiceAccountCredentials }
  | { mode: "api-key"; apiKey: string };

/**
 * Google Service Account (Vertex AI) is the primary Gemini path -- it needs both VERTEX_AI_PROJECT_ID and a loadable
 * service account. GOOGLE_API_KEY is kept as a graceful fallback for environments that haven't migrated yet, so this
 * module still works during a rollout without a hard cutover. The Gemini path also needs a model id (VERTEX_AI_MODEL).
 */
function vertexAccess(): VertexAccess | null {
  const projectId = process.env["VERTEX_AI_PROJECT_ID"];
  if (projectId) {
    const credentials = loadGoogleServiceAccountCredentials();
    if (credentials) return { mode: "vertex", projectId, location: vertexVisionLocation(), credentials };
  }
  const apiKey = process.env["GOOGLE_API_KEY"];
  if (apiKey) return { mode: "api-key", apiKey };
  return null;
}

const warnedOnce = new Set<string>();
function warnOnce(key: string, message: string) {
  if (warnedOnce.has(key)) return;
  warnedOnce.add(key);
  console.warn(`[sketch-vision] ${message}`);
}

type ProviderPlan =
  | { provider: "openrouter"; config: OpenRouterVisionConfig }
  | { provider: "gemini"; access: VertexAccess; models: string[] };

/** The configured providers, in the order they will be tried (SKETCH_VISION_PROVIDER decides who goes first). */
function sketchVisionPlan(): ProviderPlan[] {
  const { choice, recognised } = parseSketchVisionProviderChoice(process.env["SKETCH_VISION_PROVIDER"]);
  if (!recognised) warnOnce("provider-choice", `SKETCH_VISION_PROVIDER="${process.env["SKETCH_VISION_PROVIDER"]}" is not openrouter, gemini or auto; using auto.`);

  const openRouter = openRouterVisionConfig();
  const access = vertexAccess();
  const models = vertexModelCandidates();
  if (access && models.length === 0) warnOnce("vertex-model", "Google credentials are set but VERTEX_AI_MODEL is empty, so the Gemini path is disabled. Set VERTEX_AI_MODEL to a model the project serves.");

  const available: SketchVisionProvider[] = [];
  if (openRouter) available.push("openrouter");
  if (access && models.length > 0) available.push("gemini");
  return orderSketchVisionProviders(choice, available).map((provider): ProviderPlan =>
    provider === "openrouter" ? { provider, config: openRouter! } : { provider, access: access!, models },
  );
}

export function sketchVisionConfigured() {
  return sketchVisionPlan().length > 0;
}

/** A provider call that did not produce an answer. `kind` only picks the Thai message a customer sees. */
class ProviderFailure extends Error {
  // plain fields, not constructor parameter properties: node's strip-only TypeScript mode (the tests) rejects those
  readonly kind: "timeout" | "network" | "rejected" | "empty";
  readonly modelNotFound: boolean;
  /** Tokens the provider charged for an answer that came back empty (a thinking model is billed for its thinking). */
  readonly billed: { promptTokens: number | null; completionTokens: number | null } | null;
  constructor(
    kind: "timeout" | "network" | "rejected" | "empty",
    detail: string,
    modelNotFound = false,
    billed: { promptTokens: number | null; completionTokens: number | null } | null = null,
  ) {
    super(detail);
    this.kind = kind;
    this.modelNotFound = modelNotFound;
    this.billed = billed;
  }
}

/** Provider error text can be long and can name the project, region and model path: cap it, and log it only. */
function logSafe(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").slice(0, 300);
}

/** Some models wrap JSON in a ```json fence even when asked not to; the fence is removed, nothing else is touched. */
function stripCodeFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1]! : text;
}

function asTokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * The time one request may spend on providers (job-247). Every provider call asks it how long it may run: the per-call
 * limit, or what is left of the whole request if that is less. When too little is left to be worth a call it says so by
 * throwing, which ends the walk through the providers.
 */
class TimeBudget {
  private readonly deadline: number;
  private readonly attemptMs: number;
  constructor(totalMs: number, attemptMs: number) {
    this.deadline = Date.now() + totalMs;
    this.attemptMs = attemptMs;
  }
  nextAttemptMs(): number {
    const left = this.deadline - Date.now();
    if (left < Math.min(2_000, this.attemptMs / 2)) throw new ProviderFailure("timeout", "the time budget for this request is used up");
    return Math.min(this.attemptMs, left);
  }
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, budget: TimeBudget, label: string) {
  const timeoutMs = budget.nextAttemptMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    return { response, payload };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new ProviderFailure("timeout", `${label} timed out after ${Math.round(timeoutMs)} ms`);
    throw new ProviderFailure("network", `${label} request failed: ${logSafe(error instanceof Error ? error.message : String(error))}`);
  } finally {
    clearTimeout(timeout);
  }
}

/** Removes anything long from a provider's reply before it is logged: strings are clipped, lists and depth are capped. */
function clipForLog(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return value.length > 400 ? `${value.slice(0, 400)}...[${value.length} chars]` : value;
  if (Array.isArray(value)) return value.slice(0, 10).map((entry) => clipForLog(entry, depth + 1));
  if (value && typeof value === "object") {
    if (depth >= 6) return "[nested]";
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 40).map(([key, entry]) => [key, clipForLog(entry, depth + 1)]));
  }
  return value;
}

/** The text of a chat message's `content`: a string, or the text parts of a list of content parts. Anything else is "". */
function messageContentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (typeof part === "string" ? part : part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
    .join("");
}

/**
 * The JSON object in `text` that looks like a sketch reading (it parses and has `workpieces` or `shape`), or null: of
 * all such objects the one that ends last (so the outermost: a reading holds workpieces that themselves have a
 * `shape`). Every `{` is tried as a start, so a stray brace in the thinking before the answer cannot hide it. Used
 * only when a thinking model leaves `content` empty and puts its answer in the reasoning field.
 */
function sketchReadingFromReasoning(text: string): string | null {
  const starts: number[] = [];
  for (let index = text.indexOf("{"); index >= 0 && starts.length < 400; index = text.indexOf("{", index + 1)) starts.push(index);

  let best: { text: string; end: number } | null = null;
  for (const start of starts) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index]!;
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === "\"") inString = false;
        continue;
      }
      if (char === "\"") inString = true;
      else if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(start, index + 1);
          if (best && best.end > index) break; // an earlier-starting object that ends later already holds this one
          try {
            const parsed = JSON.parse(candidate) as Record<string, unknown>;
            if (parsed && typeof parsed === "object" && ("workpieces" in parsed || "shape" in parsed)) best = { text: candidate, end: index };
          } catch {
            // not JSON: no reading starts here
          }
          break;
        }
      }
    }
  }
  return best ? best.text : null;
}

type OpenRouterChoice = {
  finish_reason?: unknown;
  native_finish_reason?: unknown;
  message?: { content?: unknown; reasoning?: unknown; reasoning_content?: unknown };
};

/** OpenAI-compatible chat completion with the sketch as a data URL. */
async function askOpenRouter(config: OpenRouterVisionConfig, buffer: Buffer, mimeType: string, budget: TimeBudget): Promise<ModelAnswer> {
  const { response, payload } = await postJson(
    `${config.baseUrl}/chat/completions`,
    { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    {
      model: config.model,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: SKETCH_VISION_PROMPT },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}`, detail: "high" } },
        ],
      }],
      max_tokens: config.maxTokens,
      ...(config.jsonMode ? { response_format: { type: "json_object" } } : {}),
    },
    budget,
    `OpenRouter ${config.model}`,
  );
  const providerError = (payload?.["error"] as { message?: string } | undefined)?.message;
  if (!response.ok || providerError) {
    throw new ProviderFailure("rejected", `OpenRouter ${config.model} answered HTTP ${response.status}: ${logSafe(providerError)}`);
  }
  const usage = payload?.["usage"] as { prompt_tokens?: unknown; completion_tokens?: unknown } | undefined;
  const choice = (payload?.["choices"] as OpenRouterChoice[] | undefined)?.[0];
  const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : undefined;
  const base = { promptTokens: asTokenCount(usage?.prompt_tokens), completionTokens: asTokenCount(usage?.completion_tokens), finishReason };

  const content = messageContentText(choice?.message?.content);
  if (content.trim()) return { ...base, text: content };

  // `content` is empty: a thinking model may have left the answer in its reasoning field, or been cut off while thinking.
  const reasoning = [choice?.message?.reasoning, choice?.message?.reasoning_content].find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const fromReasoning = reasoning ? sketchReadingFromReasoning(reasoning) : null;
  if (fromReasoning) {
    console.warn(`[sketch-vision] OpenRouter ${config.model} left content empty (finish_reason=${finishReason ?? "none"}); using the reading found in its reasoning field`);
    return { ...base, text: fromReasoning };
  }
  // What the next person needs to see why: the whole reply, with long strings clipped (never the image or the key).
  console.warn(`[sketch-vision] OpenRouter ${config.model} sent no text; finish_reason=${finishReason ?? "none"} completion_tokens=${base.completionTokens ?? "?"}; reply=${JSON.stringify(clipForLog(payload)).slice(0, 4000)}`);
  throw new ProviderFailure(
    "empty",
    `OpenRouter ${config.model} sent no text (finish_reason=${finishReason ?? "none"}, completion_tokens=${base.completionTokens ?? "?"})`,
    false,
    { promptTokens: base.promptTokens, completionTokens: base.completionTokens },
  );
}

type GeminiPayload = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: unknown; candidatesTokenCount?: unknown; thoughtsTokenCount?: unknown };
  error?: { message?: string };
};

/** One generateContent call; the same body is valid on Vertex AI and on the AI Studio (API key) endpoint. */
async function askGeminiModel(access: VertexAccess, model: string, buffer: Buffer, mimeType: string, budget: TimeBudget): Promise<ModelAnswer> {
  let url: string;
  let headers: Record<string, string>;
  if (access.mode === "vertex") {
    let accessToken: string;
    try {
      accessToken = await fetchGoogleAccessToken(access.credentials, VERTEX_AI_SCOPE);
    } catch (error) {
      throw new ProviderFailure("network", `Google token exchange failed: ${logSafe(error instanceof Error ? error.message : String(error))}`);
    }
    url = `https://${vertexHost(access.location)}/v1/projects/${access.projectId}/locations/${access.location}/publishers/google/models/${model}:generateContent`;
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${access.apiKey}`;
    headers = { "Content-Type": "application/json" };
  }
  const { response, payload: raw } = await postJson(
    url,
    headers,
    {
      // Vertex rejects a content entry with no role (HTTP 400 "Please use a valid role: user, model."): every request is a user turn.
      contents: [{
        role: "user",
        parts: [
          { text: SKETCH_VISION_PROMPT },
          { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
        ],
      }],
      generationConfig: { responseMimeType: "application/json" },
    },
    budget,
    `Gemini ${model}`,
  );
  const payload = raw as GeminiPayload | null;
  if (!response.ok) {
    throw new ProviderFailure(
      "rejected",
      `Gemini ${model} answered HTTP ${response.status}: ${logSafe(payload?.error?.message)}`,
      isVertexModelNotFound(response.status, payload?.error?.message),
    );
  }
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  const usage = payload?.usageMetadata;
  const thoughts = asTokenCount(usage?.thoughtsTokenCount) ?? 0;
  const completion = asTokenCount(usage?.candidatesTokenCount);
  const promptTokens = asTokenCount(usage?.promptTokenCount);
  // reasoning tokens are billed as output
  const completionTokens = completion === null && thoughts === 0 ? null : (completion ?? 0) + thoughts;
  if (typeof text !== "string" || !text.trim()) {
    throw new ProviderFailure("empty", `Gemini ${model} sent no text`, false, { promptTokens, completionTokens });
  }
  return { text, promptTokens, completionTokens };
}

/** Tries each configured Gemini model in turn; only "this project does not serve that model" moves on to the next one. */
async function askGemini(plan: Extract<ProviderPlan, { provider: "gemini" }>, buffer: Buffer, mimeType: string, budget: TimeBudget): Promise<ModelAnswer & { model: string }> {
  for (let index = 0; index < plan.models.length; index += 1) {
    const model = plan.models[index]!;
    try {
      return { ...(await askGeminiModel(plan.access, model, buffer, mimeType, budget)), model };
    } catch (error) {
      const next = plan.models[index + 1];
      if (next && error instanceof ProviderFailure && error.modelNotFound) {
        console.warn(`[sketch-vision] model "${model}" is not served by this project; retrying with "${next}". Update VERTEX_AI_MODEL to a model the project serves.`);
        continue;
      }
      throw error;
    }
  }
  throw new ProviderFailure("empty", "no Gemini model configured");
}

function unknownItem(index: number, notes: string): SketchVisionItem {
  return {
    index,
    shape: "unknown",
    runAMm: null,
    runBMm: null,
    runCMm: null,
    depthMm: null,
    basinCount: null,
    stoneHint: null,
    rawText: null,
    confidence: "low",
    notes,
    workpieceCount: 0,
    workpieces: [],
  };
}

const SKETCH_SHAPES: readonly SketchVisionShape[] = ["I", "L-left", "L-right", "U", "unknown"];
const SKETCH_CONFIDENCES: readonly SketchVisionConfidence[] = ["high", "medium", "low"];
const SKETCH_WORKPIECE_EDGE_SIDES: readonly SketchWorkpieceEdgeSide[] = ["top", "front", "left", "right"];
const SKETCH_WORKPIECE_EDGE_STATUSES: readonly SketchWorkpieceEdgeStatus[] = ["upstand", "wall-flush", "open-edge", "closed-edge", "joint", "unknown"];
const SKETCH_WORKPIECE_CUTOUT_TYPES: readonly SketchWorkpieceCutoutType[] = ["basin", "hob", "other"];

/**
 * Normalizes one dimension value from the AI's JSON into millimeters.
 * Accepts a number or a string, optionally suffixed with "m"/"cm"/"mm"
 * (also the Thai unit words ม./ซม./มม.). A bare number (no unit) is
 * disambiguated by magnitude: a realistic counter run/depth is never written
 * as a whole number of meters (nobody writes "45" meaning 45 m), so a value
 * under 10 is read as meters (e.g. "1.98" -> 1980 mm) and 10 or over as
 * centimeters (e.g. "45" -> 450 mm) -- this matches how a sketch's bare
 * numbers are conventionally written by hand. Never guesses beyond this: an
 * unparseable value returns null rather than a fabricated number.
 */
export function parseDimensionToMm(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    if (value < 10) return Math.round(value * 1000);
    if (value < 100) return Math.round(value * 10);
    return Math.round(value);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|m|มม\.?|ซม\.?|ม\.?)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = (match[2] ?? "").toLowerCase().replace(/\.$/, "");
  if (unit === "mm" || unit === "มม") return Math.round(amount);
  if (unit === "cm" || unit === "ซม") return Math.round(amount * 10);
  if (unit === "m" || unit === "ม") return Math.round(amount * 1000);
  if (amount < 10) return Math.round(amount * 1000);
  if (amount < 100) return Math.round(amount * 10);
  return Math.round(amount);
}

function parseShape(value: unknown): SketchVisionShape {
  return typeof value === "string" && (SKETCH_SHAPES as readonly string[]).includes(value) ? (value as SketchVisionShape) : "unknown";
}

function parseConfidence(value: unknown): SketchVisionConfidence {
  return typeof value === "string" && (SKETCH_CONFIDENCES as readonly string[]).includes(value) ? (value as SketchVisionConfidence) : "low";
}

function parseNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function parseBasinCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function parseWorkpiecePanel(value: unknown, fallbackIndex: number): SketchWorkpiecePanel | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const panelIndex = typeof body["panelIndex"] === "number" && Number.isFinite(body["panelIndex"]) ? Math.round(body["panelIndex"]) : fallbackIndex;
  const label = parseNullableString(body["label"]) ?? `แผ่น ${panelIndex + 1}`;
  return { panelIndex, label, lengthMm: parseDimensionToMm(body["lengthMm"]), depthMm: parseDimensionToMm(body["depthMm"]) };
}

function parseWorkpiecePanels(value: unknown): SketchWorkpiecePanel[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => parseWorkpiecePanel(entry, index))
    .filter((panel): panel is SketchWorkpiecePanel => panel !== null);
}

/** An edge with no recognized `side` is dropped entirely -- there is no safe "unknown side" to attach a status to. */
function parseWorkpieceEdge(value: unknown): SketchWorkpieceEdge | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const side = typeof body["side"] === "string" && (SKETCH_WORKPIECE_EDGE_SIDES as readonly string[]).includes(body["side"])
    ? (body["side"] as SketchWorkpieceEdgeSide)
    : null;
  if (!side) return null;
  const status = typeof body["status"] === "string" && (SKETCH_WORKPIECE_EDGE_STATUSES as readonly string[]).includes(body["status"])
    ? (body["status"] as SketchWorkpieceEdgeStatus)
    : "unknown";
  const note = parseNullableString(body["note"]);
  return note ? { side, status, note } : { side, status };
}

function parseWorkpieceEdges(value: unknown): SketchWorkpieceEdge[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseWorkpieceEdge).filter((edge): edge is SketchWorkpieceEdge => edge !== null);
}

function parseWorkpieceCutout(value: unknown): SketchWorkpieceCutout | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const type = typeof body["type"] === "string" && (SKETCH_WORKPIECE_CUTOUT_TYPES as readonly string[]).includes(body["type"])
    ? (body["type"] as SketchWorkpieceCutoutType)
    : "other";
  const description = parseNullableString(body["description"]) ?? "";
  const count = typeof body["count"] === "number" && Number.isFinite(body["count"]) && body["count"] >= 0 ? Math.round(body["count"]) : 1;
  return { type, description, count };
}

function parseWorkpieceCutouts(value: unknown): SketchWorkpieceCutout[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseWorkpieceCutout).filter((cutout): cutout is SketchWorkpieceCutout => cutout !== null);
}

function parseWorkpiece(value: unknown, fallbackIndex: number): SketchWorkpiece | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const notes = parseNullableString(body["notes"]);
  return {
    id: parseNullableString(body["id"]) ?? `workpiece-${fallbackIndex}`,
    shape: parseShape(body["shape"]),
    label: parseNullableString(body["label"]) ?? `ชิ้นงาน ${fallbackIndex + 1}`,
    dimensionsSummary: parseNullableString(body["dimensionsSummary"]) ?? "",
    panels: parseWorkpiecePanels(body["panels"]),
    edges: parseWorkpieceEdges(body["edges"]),
    cutouts: parseWorkpieceCutouts(body["cutouts"]),
    ...(notes ? { notes } : {}),
  };
}

/** Never throws: an entry that isn't a plain object is dropped rather than aborting the whole array. */
function parseWorkpieces(value: unknown): SketchWorkpiece[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => parseWorkpiece(entry, index))
    .filter((workpiece): workpiece is SketchWorkpiece => workpiece !== null);
}

/**
 * Derives the legacy flat summary fields (shape/runAMm/runBMm/runCMm/depthMm/
 * basinCount) from the first workpiece, per job-76's backward-compatibility
 * requirement: once workpieces[] exists, it is the single source of truth for
 * these fields (never a separately AI-provided top-level value that could
 * silently drift from what the workpiece itself says) -- panelIndex 0/1/2 map
 * to runA/runB/runC, and basinCount sums every "basin" cutout's count.
 */
function summarizeFirstWorkpiece(workpiece: SketchWorkpiece) {
  const panelByIndex = (index: number) =>
    workpiece.panels.find((panel) => panel.panelIndex === index) ?? workpiece.panels[index];
  const basinCutouts = workpiece.cutouts.filter((cutout) => cutout.type === "basin");
  return {
    shape: workpiece.shape,
    runAMm: panelByIndex(0)?.lengthMm ?? null,
    runBMm: panelByIndex(1)?.lengthMm ?? null,
    runCMm: panelByIndex(2)?.lengthMm ?? null,
    depthMm: workpiece.panels[0]?.depthMm ?? null,
    basinCount: basinCutouts.length > 0 ? basinCutouts.reduce((sum, cutout) => sum + cutout.count, 0) : null,
  };
}

/**
 * Turns Gemini's raw JSON text response into a typed SketchVisionItem.
 * Never throws -- a malformed or unexpected-shape response degrades to the
 * same "unknown" fallback used when the AI call itself fails, so the caller
 * never needs a second error path for "AI answered, but not usefully."
 */
export function parseSketchVisionResponse(rawText: string, index: number): SketchVisionItem {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return unknownItem(index, "อ่านผลลัพธ์จาก AI ไม่ได้ (รูปแบบไม่ใช่ JSON)");
  }
  if (!parsed || typeof parsed !== "object") {
    return unknownItem(index, "อ่านผลลัพธ์จาก AI ไม่ได้ (รูปแบบไม่ถูกต้อง)");
  }
  const body = parsed as Record<string, unknown>;
  const workpieces = parseWorkpieces(body["workpieces"]);
  const primary = workpieces[0];
  const summary = primary
    ? summarizeFirstWorkpiece(primary)
    : {
        shape: parseShape(body["shape"]),
        runAMm: parseDimensionToMm(body["runAMm"]),
        runBMm: parseDimensionToMm(body["runBMm"]),
        runCMm: parseDimensionToMm(body["runCMm"]),
        depthMm: parseDimensionToMm(body["depthMm"]),
        basinCount: parseBasinCount(body["basinCount"]),
      };
  return {
    index,
    shape: summary.shape,
    runAMm: summary.runAMm,
    runBMm: summary.runBMm,
    runCMm: summary.runCMm,
    depthMm: summary.depthMm,
    basinCount: summary.basinCount,
    stoneHint: parseNullableString(body["stoneHint"]),
    rawText: parseNullableString(body["rawText"]),
    confidence: parseConfidence(body["confidence"]),
    notes: parseNullableString(body["notes"]),
    workpieceCount: workpieces.length,
    workpieces,
  };
}

const NOT_CONFIGURED_NOTE = "ตอนนี้ระบบอ่านภาพด้วย AI ยังไม่พร้อมใช้งาน กรุณากรอกขนาดด้วยตนเอง";
const READ_FAILED_NOTE = "ตอนนี้ระบบอ่านภาพไม่สำเร็จ กรุณากรอกขนาดด้วยตนเอง";
const TIMEOUT_NOTE = "เรียกวิเคราะห์ภาพหมดเวลา (timeout) กรุณาลองใหม่อีกครั้ง";
// a little past the budget, so the calls' own timeouts (which end exactly at it) win whenever they can
const HARD_STOP_GRACE_MS = 500;
const NETWORK_NOTE = "ไม่สามารถเชื่อมต่อระบบวิเคราะห์ภาพได้ในขณะนี้ กรุณากรอกขนาดด้วยตนเอง";

/** The Thai sentence for the last failure; none of it comes from the provider. */
function noteForFailure(failure: ProviderFailure | null): string {
  if (failure?.kind === "timeout") return TIMEOUT_NOTE;
  if (failure?.kind === "network") return NETWORK_NOTE;
  return READ_FAILED_NOTE;
}

/** True when the text is a JSON object, i.e. worth showing; otherwise the next provider gets a chance. */
function isUsableJsonObject(text: string): boolean {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

/**
 * Reads one sketch image with the configured provider(s) and returns the typed result together with the token usage of
 * every call that got an answer. Never throws and never returns a rejected promise: nothing configured, a network
 * failure, a timeout, a rejection or an unusable answer all come back as the "unknown" shape with every measurement null
 * and a Thai `notes` explanation, so /api/sketch/analyze can always answer 200 (spec: a broken AI call must never break
 * the sketch page).
 *
 * Provider order comes from SKETCH_VISION_PROVIDER (see sketch-vision-config.ts); when the first provider fails for any
 * reason the next configured one is tried. With nothing configured no request is made at all.
 */
export async function analyzeSketchImageWithUsage(buffer: Buffer, mimeType: string, index = 0): Promise<SketchVisionAnalysis> {
  const plan = sketchVisionPlan();
  if (plan.length === 0) return { item: unknownItem(index, NOT_CONFIGURED_NOTE), usages: [] };

  const totalMs = sketchVisionTotalBudgetMs();
  const budget = new TimeBudget(totalMs, sketchVisionAttemptTimeoutMs());
  const usages: SketchVisionUsage[] = [];

  // The provider calls stop themselves at the budget (their own timeouts), but a step that cannot be aborted (the Google
  // token exchange) must not be able to hold the request past it either, so the whole walk is also raced against a hard stop.
  let hardStop: ReturnType<typeof setTimeout> | undefined;
  const stopped = new Promise<SketchVisionAnalysis>((resolve) => {
    hardStop = setTimeout(() => {
      console.warn(`[sketch-vision] the ${totalMs} ms budget for one request ran out; answering "could not read"`);
      resolve({ item: unknownItem(index, TIMEOUT_NOTE), usages: [...usages] });
    }, totalMs + HARD_STOP_GRACE_MS);
  });
  try {
    return await Promise.race([walkProviders(plan, buffer, mimeType, index, budget, usages), stopped]);
  } finally {
    clearTimeout(hardStop);
  }
}

async function walkProviders(plan: ProviderPlan[], buffer: Buffer, mimeType: string, index: number, budget: TimeBudget, usages: SketchVisionUsage[]): Promise<SketchVisionAnalysis> {
  let lastFailure: ProviderFailure | null = null;
  for (const step of plan) {
    const startedAt = Date.now();
    let model: string = step.provider === "openrouter" ? step.config.model : step.models[0]!;
    try {
      let answer: ModelAnswer;
      if (step.provider === "openrouter") {
        answer = await askOpenRouter(step.config, buffer, mimeType, budget);
      } else {
        const gemini = await askGemini(step, buffer, mimeType, budget);
        answer = gemini;
        model = gemini.model;
      }
      const text = stripCodeFence(answer.text);
      const usable = isUsableJsonObject(text);
      usages.push({
        provider: step.provider,
        model,
        promptTokens: answer.promptTokens,
        completionTokens: answer.completionTokens,
        durationMs: Date.now() - startedAt,
        success: usable,
      });
      if (usable) return { item: parseSketchVisionResponse(text, index), usages };
      // finish_reason "length" here means the answer was cut off by the token limit (raise OPENROUTER_VISION_MAX_TOKENS)
      console.warn(`[sketch-vision] ${step.provider} (${model}) answered with something that is not a JSON object (${text.length} chars, finish_reason=${answer.finishReason ?? "none"}, completion_tokens=${answer.completionTokens ?? "?"})`);
      lastFailure = new ProviderFailure("empty", "unusable answer");
    } catch (error) {
      lastFailure = error instanceof ProviderFailure ? error : new ProviderFailure("network", "unexpected error");
      // an empty answer can still have been charged for: it is a call that was billed, so the cost center must see it
      if (error instanceof ProviderFailure && error.billed && (error.billed.promptTokens !== null || error.billed.completionTokens !== null)) {
        usages.push({ provider: step.provider, model, promptTokens: error.billed.promptTokens, completionTokens: error.billed.completionTokens, durationMs: Date.now() - startedAt, success: false });
      }
      console.warn(`[sketch-vision] ${step.provider} failed: ${error instanceof ProviderFailure ? error.message : logSafe(error instanceof Error ? error.message : String(error))}`);
      // nothing is left of the request's time: the next provider could not be given a fair chance, so stop here
      if (error instanceof ProviderFailure && error.kind === "timeout" && /budget/.test(error.message)) break;
    }
  }
  return { item: unknownItem(index, noteForFailure(lastFailure)), usages };
}

/** The result without the usage, for callers that only need the reading. Same guarantees as analyzeSketchImageWithUsage. */
export async function analyzeSketchImage(buffer: Buffer, mimeType: string, index = 0): Promise<SketchVisionItem> {
  return (await analyzeSketchImageWithUsage(buffer, mimeType, index)).item;
}
