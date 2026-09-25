-- Lets an admin pick which Google Cloud TTS voice น้องไนท์ (KnightSupport)
-- speaks with, instead of the voice being hardcoded via GOOGLE_TTS_VOICE_NAME.
-- Single-row settings table: synthesizeSpeech() in google-tts.ts reads the
-- most recent row and always falls back to th-TH-Chirp3-HD-Kore if the table
-- is empty or unreachable, so TTS keeps working even before this migration
-- has run or if the admin has never opened the voice settings page.

CREATE TABLE IF NOT EXISTS public.support_voice_settings (
  id             serial PRIMARY KEY,
  voice_name     varchar(64) NOT NULL,
  language_code  varchar(16) NOT NULL DEFAULT 'th-TH',
  speaking_rate  real        NOT NULL DEFAULT 1.0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.support_voice_settings (voice_name, language_code, speaking_rate)
SELECT 'th-TH-Chirp3-HD-Kore', 'th-TH', 1.0
WHERE NOT EXISTS (SELECT 1 FROM public.support_voice_settings);
