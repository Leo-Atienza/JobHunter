-- Migration 006: Add resume skills columns to users table
-- Stores Gemini-extracted resume data for match scoring

ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_skills JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_filename TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_updated_at TIMESTAMPTZ;
