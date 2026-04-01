-- Add resume skills to sessions for anonymous resume matching (no auth required)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS resume_skills JSONB;
