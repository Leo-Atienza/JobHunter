-- Add locations array column for multi-city search
-- Backfill from existing single-location sessions

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS locations TEXT[];

UPDATE sessions
SET locations = ARRAY[location]
WHERE location IS NOT NULL AND locations IS NULL;
