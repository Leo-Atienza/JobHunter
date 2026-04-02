-- Add JSONB column to store the match score breakdown per job
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS score_breakdown JSONB;
