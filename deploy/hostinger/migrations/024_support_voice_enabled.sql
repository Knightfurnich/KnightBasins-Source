-- Migration 024: on/off switch for the น้องไนท์ voice feature (POST /api/support/speech spends Google Cloud TTS quota)
-- Approved by Boss (คุณนพ) on 4 Oct 2026. Additive only. The default is FALSE: the feature stays OFF until an admin turns it on.

ALTER TABLE support_voice_settings ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false;
