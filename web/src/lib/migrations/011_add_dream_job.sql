-- Migration 011: Add dream job description to sessions and dream score to jobs
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS dream_job TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dream_score INTEGER DEFAULT 0;
