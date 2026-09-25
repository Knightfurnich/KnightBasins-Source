// Turns a น้องไนท์ (KnightSupport) reply into spoken audio via Google Cloud
// Text-to-Speech. ElevenLabs' premade voices were evaluated first but none
// had a genuinely native Thai accent (they're English voices speaking Thai
// phonetically); Google's th-TH Chirp3-HD voices are built for Thai
// specifically and were picked after a side-by-side listening comparison.
// This is opt-in per message (a 🔊 button in the chat widget), never
// auto-played, since each call spends real quota.

const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_LANGUAGE_CODE = "th-TH";
// "Kore" -- picked after comparing all th-TH Chirp3-HD/Neural2 voices side
// by side. Override with GOOGLE_TTS_VOICE_NAME to use a different voice.
const DEFAULT_VOICE_NAME = "th-TH-Chirp3-HD-Kore";
const MAX_TEXT_LENGTH = 600;

export type SpeechResult =
  | { ok: true; audio: Buffer; contentType: string }
  | { ok: false; message: string };

function googleTtsConfig() {
  const apiKey = process.env["GOOGLE_TTS_API_KEY"];
  if (!apiKey) return null;
  return {
    apiKey,
    languageCode: process.env["GOOGLE_TTS_LANGUAGE_CODE"] || DEFAULT_LANGUAGE_CODE,
    voiceName: process.env["GOOGLE_TTS_VOICE_NAME"] || DEFAULT_VOICE_NAME,
  };
}

export function googleTtsConfigured() {
  return googleTtsConfig() !== null;
}

export async function synthesizeSpeech(text: string): Promise<SpeechResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: "ไม่มีข้อความให้อ่านออกเสียง" };
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return { ok: false, message: `ข้อความยาวเกินไป (จำกัด ${MAX_TEXT_LENGTH} ตัวอักษรต่อครั้ง)` };
  }

  const config = googleTtsConfig();
  if (!config) return { ok: false, message: "ยังไม่ได้ตั้งค่า GOOGLE_TTS_API_KEY" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${config.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: trimmed },
        voice: { languageCode: config.languageCode, name: config.voiceName },
        audioConfig: { audioEncoding: "MP3" },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null) as
      { audioContent?: string; error?: { message?: string } } | null;

    if (!response.ok || !payload?.audioContent) {
      return { ok: false, message: payload?.error?.message ?? `Google TTS ตอบกลับผิดพลาด (${response.status})` };
    }

    return {
      ok: true,
      audio: Buffer.from(payload.audioContent, "base64"),
      contentType: "audio/mpeg",
    };
  } catch (error) {
    const message = error instanceof Error
      ? (error.name === "AbortError" ? "เรียก Google TTS หมดเวลา (timeout)" : `เรียก Google TTS ไม่สำเร็จ: ${error.message}`)
      : "เรียก Google TTS ไม่สำเร็จ";
    return { ok: false, message };
  } finally {
    clearTimeout(timeout);
  }
}
