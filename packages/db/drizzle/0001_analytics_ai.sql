ALTER TABLE videos ADD COLUMN IF NOT EXISTS ai_insights jsonb;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS audio_extracted boolean NOT NULL DEFAULT false;
