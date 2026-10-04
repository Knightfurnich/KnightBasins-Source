// Reads a customer's hand-drawn counter sketch (photo of a napkin drawing,
// a rough plan, etc.) with Gemini 2.5 Flash Vision and pulls out the shape
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
// never include request content.

import { loadGoogleServiceAccountCredentials, fetchGoogleAccessToken, type GoogleServiceAccountCredentials } from "./google-service-account.ts";
import {
  isVertexModelNotFound,
  resolveVertexPublisherLocation,
  vertexPublisherHost,
  vertexPublisherModels,
} from "./vertex-model.ts";

const REQUEST_TIMEOUT_MS = 30_000;
const VERTEX_AI_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_VERTEX_AI_LOCATION = "asia-southeast1";

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

/** The subset of Gemini's generateContent response this module reads. */
type GeminiGenerateContentPayload = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { status?: string; message?: string };
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

type SketchVisionConfig =
  | { mode: "vertex"; projectId: string; location: string; credentials: GoogleServiceAccountCredentials }
  | { mode: "api-key"; apiKey: string };

/**
 * Google Service Account (Vertex AI) is the primary path -- it needs both
 * VERTEX_AI_PROJECT_ID and a loadable service account. GOOGLE_API_KEY is kept
 * as a graceful fallback for environments that haven't migrated yet, so this
 * module still works during a rollout without a hard cutover.
 */
function sketchVisionConfig(): SketchVisionConfig | null {
  const projectId = process.env["VERTEX_AI_PROJECT_ID"];
  if (projectId) {
    const credentials = loadGoogleServiceAccountCredentials();
    if (credentials) {
      return { mode: "vertex", projectId, location: resolveVertexPublisherLocation(DEFAULT_VERTEX_AI_LOCATION), credentials };
    }
  }
  const apiKey = process.env["GOOGLE_API_KEY"];
  if (apiKey) return { mode: "api-key", apiKey };
  return null;
}

export function sketchVisionConfigured() {
  return sketchVisionConfig() !== null;
}

/** Builds the request URL/headers for whichever auth mode is configured -- the
 * request body (contents/parts/inline_data) is identical either way since
 * Vertex AI's native generateContent endpoint mirrors the AI Studio API. */
async function buildSketchVisionRequest(config: SketchVisionConfig, model: string): Promise<{ url: string; headers: Record<string, string> }> {
  if (config.mode === "vertex") {
    const accessToken = await fetchGoogleAccessToken(config.credentials, VERTEX_AI_SCOPE);
    return {
      url: `https://${vertexPublisherHost(config.location)}/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${model}:generateContent`,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    };
  }
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
    headers: { "Content-Type": "application/json" },
  };
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

/**
 * Sends one sketch image to Gemini 2.5 Flash Vision and returns a typed
 * result. Never throws and never returns a rejected promise: a missing API
 * key, a network failure, a timeout, or a malformed AI response all produce
 * the same "unknown" shape with every measurement null and a Thai `notes`
 * explanation, so /api/sketch/analyze can always answer 200 (spec: a broken
 * AI call must never break the sketch page).
 */
export async function analyzeSketchImage(buffer: Buffer, mimeType: string, index = 0): Promise<SketchVisionItem> {
  const config = sketchVisionConfig();
  if (!config) return unknownItem(index, "ยังไม่ได้ตั้งค่า Google Service Account หรือ GOOGLE_API_KEY");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const models = vertexPublisherModels();
    let response: Response | null = null;
    let payload: GeminiGenerateContentPayload | null = null;

    for (let candidate = 0; candidate < models.length; candidate += 1) {
      const model = models[candidate]!;
      const { url, headers } = await buildSketchVisionRequest(config, model);
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          // Vertex rejects a content entry that carries no role with
          // HTTP 400 "Please use a valid role: user, model." -- every request
          // is a user turn.
          contents: [{
            role: "user",
            parts: [
              { text: SKETCH_VISION_PROMPT },
              { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
            ],
          }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      });
      payload = await response.json().catch(() => null) as GeminiGenerateContentPayload | null;

      if (response.ok) break;
      // A retired/renamed model is the one failure another candidate can fix;
      // anything else (auth, quota, bad request) is reported as-is below.
      const nextModel = models[candidate + 1];
      if (nextModel && isVertexModelNotFound(response.status, payload)) {
        console.warn(`[sketch-vision] model "${model}" is not served by this project (HTTP ${response.status}); retrying with "${nextModel}". Update VERTEX_AI_MODEL to a model the project serves.`);
        continue;
      }
      break;
    }

    if (!response || !response.ok) {
      // The upstream text can name the GCP project, region and model path, so
      // it is logged for operators and never handed to the customer-visible
      // `notes` field (job-194 error hygiene: a public page must not disclose
      // internal error text).
      console.warn(`[sketch-vision] generateContent failed: HTTP ${response?.status ?? "unknown"} ${payload?.error?.message ?? ""}`.trim());
      return unknownItem(index, "ตอนนี้ระบบอ่านภาพไม่สำเร็จ กรุณากรอกขนาดด้วยตนเอง");
    }
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) {
      return unknownItem(index, "Gemini Vision ไม่ได้ตอบข้อความกลับมา");
    }
    return parseSketchVisionResponse(text, index);
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    const message = isTimeout
      ? "เรียกวิเคราะห์ภาพหมดเวลา (timeout) กรุณาลองใหม่อีกครั้ง"
      : "ไม่สามารถเชื่อมต่อระบบวิเคราะห์ภาพได้ในขณะนี้ กรุณากรอกขนาดด้วยตนเอง";
    return unknownItem(index, message);
  } finally {
    clearTimeout(timeout);
  }
}
