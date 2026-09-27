// Turns a น้องไนท์ (KnightSupport) reply into spoken audio via Google Cloud
// Text-to-Speech. ElevenLabs' premade voices were evaluated first but none
// had a genuinely native Thai accent (they're English voices speaking Thai
// phonetically); Google's th-TH Chirp3-HD voices are built for Thai
// specifically and were picked after a side-by-side listening comparison.
// This is opt-in per message (a 🔊 button in the chat widget), never
// auto-played, since each call spends real quota.
//
// Authenticates with a Google service account (the org's GCP project
// disallows API keys) via lib/google-service-account.ts -- the same JWT
// Bearer Token flow the admin stock-sheet sync uses, just with the
// cloud-platform scope instead of spreadsheets.readonly.

import { loadGoogleServiceAccountCredentials, fetchGoogleAccessToken } from "./google-service-account.ts";

const TTS_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_LANGUAGE_CODE = "th-TH";
// "Kore" -- picked after comparing all th-TH Chirp3-HD/Neural2 voices side
// by side. Override with GOOGLE_TTS_VOICE_NAME to use a different voice, or
// (since Phase 2) let an admin pick one of SUPPORT_VOICE_OPTIONS below from
// the admin UI -- that DB setting takes priority over the env var.
const DEFAULT_VOICE_NAME = "th-TH-Chirp3-HD-Kore";
const MAX_TEXT_LENGTH = 600;

// The curated list an admin can choose from (AdminVoiceSettings.tsx). All
// female th-TH Chirp3-HD voices -- น้องไนท์'s identity is locked female, so
// no male voice is ever offered here.
export const SUPPORT_VOICE_OPTIONS = [
  { voiceName: "th-TH-Chirp3-HD-Kore", label: "นุ่มนวล สุภาพ เป็นกันเอง (ค่าเริ่มต้น)" },
  { voiceName: "th-TH-Chirp3-HD-Zephyr", label: "มืออาชีพ มั่นใจ ชัดถ้อยชัดคำ" },
  { voiceName: "th-TH-Chirp3-HD-Autonoe", label: "สดใส กระฉับกระเฉง คล่องแคล่ว" },
  { voiceName: "th-TH-Chirp3-HD-Leda", label: "เรียบร้อย สุขุม นิ่งสงบ" },
  { voiceName: "th-TH-Chirp3-HD-Despina", label: "อบอุ่น ฟังสบาย เป็นมิตร" },
] as const;

// Bounds how long a *cold-cache* support_voice_settings lookup will wait
// before falling back to the env var / hardcoded default. A real same-host
// Postgres answers in a few ms; this only matters when the DB is unreachable.
const VOICE_SETTINGS_TIMEOUT_MS = 1200;
// How long a resolved row (or "no row") is trusted before re-checking the DB.
// Keeps synthesizeSpeech's warm path fully synchronous (see below) and keeps
// a 🔊 click from paying a DB round trip every single time; an admin's voice
// change takes up to this long to reach the next customer request.
const VOICE_SETTINGS_CACHE_TTL_MS = 30_000;

export type SpeechResult =
  | { ok: true; audio: Buffer; contentType: string }
  | { ok: false; message: string };

type ActiveVoiceRow = { voiceName: string; languageCode: string; speakingRate: number };
type ActiveVoiceConfig = { languageCode: string; voiceName: string; speakingRate: number };

/**
 * Turns a support_voice_settings row (or null, when the table is empty or
 * unreachable) into the voice to speak with. Pure and DB-free on purpose --
 * this is what admin-support-voice.test.ts exercises directly to prove the
 * admin's saved choice governs synthesis, without needing a real Postgres.
 */
export function resolveVoiceConfig(row: ActiveVoiceRow | null): ActiveVoiceConfig {
  if (row?.voiceName) {
    return {
      languageCode: row.languageCode || DEFAULT_LANGUAGE_CODE,
      voiceName: row.voiceName,
      speakingRate: row.speakingRate || 1,
    };
  }
  return {
    languageCode: process.env["GOOGLE_TTS_LANGUAGE_CODE"] || DEFAULT_LANGUAGE_CODE,
    voiceName: process.env["GOOGLE_TTS_VOICE_NAME"] || DEFAULT_VOICE_NAME,
    speakingRate: 1,
  };
}

let voiceRowCache: { row: ActiveVoiceRow | null; expiresAt: number } | null = null;

/**
 * Synchronous fast path: returns the cached row/null when the cache is warm,
 * or `undefined` when a fresh DB read is needed. synthesizeSpeech only awaits
 * anything when this returns undefined -- on a warm cache it stays on the
 * exact same synchronous call path as before this feature existed, which
 * matters because it calls fetch() (and attaches the abort signal listener)
 * synchronously within the same tick it was invoked in.
 */
function cachedActiveVoiceRow(): ActiveVoiceRow | null | undefined {
  if (voiceRowCache && voiceRowCache.expiresAt > Date.now()) return voiceRowCache.row;
  return undefined;
}

/**
 * Dynamic import (not a static one) so that test files which never touch the
 * database -- google-tts.test.ts -- don't pay @workspace/db's "DATABASE_URL
 * must be set" module-load check just for importing this file. Any failure
 * (missing DATABASE_URL, unreachable host, slow network) resolves to null,
 * which resolveVoiceConfig() turns into the env-var/default fallback.
 */
async function refreshActiveVoiceRow(): Promise<ActiveVoiceRow | null> {
  let row: ActiveVoiceRow | null = null;
  try {
    const { db, supportVoiceSettings } = await import("@workspace/db");
    const { desc } = await import("drizzle-orm");
    const query = db.select().from(supportVoiceSettings).orderBy(desc(supportVoiceSettings.id)).limit(1);
    query.catch(() => {});
    const timeout = new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Loading support voice settings timed out")), VOICE_SETTINGS_TIMEOUT_MS);
      timer.unref?.();
    });
    const rows = (await Promise.race([query, timeout])) as ActiveVoiceRow[];
    row = rows[0] ?? null;
  } catch {
    row = null;
  }
  voiceRowCache = { row, expiresAt: Date.now() + VOICE_SETTINGS_CACHE_TTL_MS };
  return row;
}

export function googleTtsConfigured() {
  return loadGoogleServiceAccountCredentials() !== null;
}

/**
 * @param voiceNameOverride Bypasses the DB/env-resolved voice entirely --
 * used only by the admin "ฟังตัวอย่าง" preview button (AdminVoiceSettings.tsx)
 * so an admin can preview a candidate voice before saving it as the one
 * customers hear. Trusted input: callers must validate it's one of
 * SUPPORT_VOICE_OPTIONS themselves (admin-router.ts does).
 */
export async function synthesizeSpeech(text: string, voiceNameOverride?: string): Promise<SpeechResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: "ไม่มีข้อความให้อ่านออกเสียง" };
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return { ok: false, message: `ข้อความยาวเกินไป (จำกัด ${MAX_TEXT_LENGTH} ตัวอักษรต่อครั้ง)` };
  }

  const credentials = loadGoogleServiceAccountCredentials();
  if (!credentials) return { ok: false, message: "ยังไม่ได้ตั้งค่า Google Service Account (GOOGLE_SERVICE_ACCOUNT_JSON)" };

  let voice: ActiveVoiceConfig;
  if (voiceNameOverride) {
    voice = { languageCode: DEFAULT_LANGUAGE_CODE, voiceName: voiceNameOverride, speakingRate: 1 };
  } else {
    const cached = cachedActiveVoiceRow();
    voice = resolveVoiceConfig(cached === undefined ? await refreshActiveVoiceRow() : cached);
  }
  const audioConfig: { audioEncoding: "MP3"; speakingRate?: number } = { audioEncoding: "MP3" };
  if (voice.speakingRate !== 1) audioConfig.speakingRate = voice.speakingRate;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const accessToken = await fetchGoogleAccessToken(credentials, TTS_SCOPE);
    const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        input: { text: trimmed },
        voice: { languageCode: voice.languageCode, name: voice.voiceName },
        audioConfig,
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
