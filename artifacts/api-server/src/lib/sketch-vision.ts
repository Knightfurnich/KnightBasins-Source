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

const REQUEST_TIMEOUT_MS = 30_000;
const GEMINI_MODEL = "gemini-2.5-flash";

export type SketchVisionShape = "I" | "L-left" | "L-right" | "U" | "unknown";
export type SketchVisionConfidence = "high" | "medium" | "low";

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
};

const SKETCH_VISION_PROMPT = `คุณคือช่างประเมินหน้างานหินสังเคราะห์ที่มีประสบการณ์ กำลังดูภาพแบบร่าง (สเก็ตช์มือหรือแปลน) ของเคาน์เตอร์ครัว/อ่างล้างหน้าที่ลูกค้าวาดมา

อ่านภาพแล้วตอบกลับเป็น JSON ตาม schema นี้เท่านั้น ไม่ต้องมีข้อความอื่นนอกเหนือจาก JSON:
{
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
- runAMm/runBMm/runCMm/depthMm ต้องเป็นหน่วยมิลลิเมตร (mm) เสมอ ไม่ว่าตัวเลขในภาพจะเขียนเป็นเมตร (ม.), เซนติเมตร (ซม.), หรือไม่มีหน่วยกำกับก็ตาม ให้แปลงเป็นมิลลิเมตรก่อนตอบ
- shape "I" มีด้านเดียว (runAMm), "L-left"/"L-right" มีสองด้าน (runAMm, runBMm), "U" มีสามด้าน (runAMm, runBMm, runCMm)
- basinCount คือจำนวนอ่างที่วาดหรือระบุในภาพ
- stoneHint คือรหัส/ชื่อสีหินถ้าอ่านเจอในภาพ ไม่งั้นเป็น null
- rawText คือข้อความ/ตัวเลขทั้งหมดที่อ่านได้จากภาพ (สำหรับให้ทีมขายตรวจทาน)
- ถ้าอ่านตัวเลขหรือรูปทรงไม่ได้ชัดเจน ห้ามเดา ให้ตอบ null สำหรับค่านั้น และถ้าอ่านรูปทรงไม่ได้เลยให้ตอบ shape เป็น "unknown"
- confidence สะท้อนความมั่นใจโดยรวมของการอ่านภาพนี้`;

function sketchVisionConfig() {
  const apiKey = process.env["GOOGLE_API_KEY"];
  if (!apiKey) return null;
  return { apiKey };
}

export function sketchVisionConfigured() {
  return sketchVisionConfig() !== null;
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
  };
}

const SKETCH_SHAPES: readonly SketchVisionShape[] = ["I", "L-left", "L-right", "U", "unknown"];
const SKETCH_CONFIDENCES: readonly SketchVisionConfidence[] = ["high", "medium", "low"];

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
    return Number.isFinite(value) ? Math.round(value < 10 ? value * 1000 : value * 10) : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|m|มม\.?|ซม\.?|ม\.?)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = (match[2] ?? "").toLowerCase().replace(/\.$/, "");
  if (unit === "mm" || unit === "มม") return Math.round(amount);
  if (unit === "cm" || unit === "ซม") return Math.round(amount * 10);
  if (unit === "m" || unit === "ม") return Math.round(amount * 1000);
  return Math.round(amount < 10 ? amount * 1000 : amount * 10);
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
  return {
    index,
    shape: parseShape(body["shape"]),
    runAMm: parseDimensionToMm(body["runAMm"]),
    runBMm: parseDimensionToMm(body["runBMm"]),
    runCMm: parseDimensionToMm(body["runCMm"]),
    depthMm: parseDimensionToMm(body["depthMm"]),
    basinCount: parseBasinCount(body["basinCount"]),
    stoneHint: parseNullableString(body["stoneHint"]),
    rawText: parseNullableString(body["rawText"]),
    confidence: parseConfidence(body["confidence"]),
    notes: parseNullableString(body["notes"]),
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
  if (!config) return unknownItem(index, "ยังไม่ได้ตั้งค่า GOOGLE_API_KEY");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${config.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: SKETCH_VISION_PROMPT },
            { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
          ],
        }],
        generationConfig: { responseMimeType: "application/json" },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null) as
      { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } } | null;

    if (!response.ok) {
      return unknownItem(index, payload?.error?.message ?? `เรียก Gemini Vision ไม่สำเร็จ (${response.status})`);
    }
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) {
      return unknownItem(index, "Gemini Vision ไม่ได้ตอบข้อความกลับมา");
    }
    return parseSketchVisionResponse(text, index);
  } catch (error) {
    const message = error instanceof Error
      ? (error.name === "AbortError" ? "เรียก Gemini Vision หมดเวลา (timeout)" : `เรียก Gemini Vision ไม่สำเร็จ: ${error.message}`)
      : "เรียก Gemini Vision ไม่สำเร็จ";
    return unknownItem(index, message);
  } finally {
    clearTimeout(timeout);
  }
}
