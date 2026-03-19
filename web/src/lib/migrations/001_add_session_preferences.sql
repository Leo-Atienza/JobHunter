-- Add sources and remote columns to sessions table
-- The keywords and location columns already exist from the initial schema

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS sources TEXT[];
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS remote BOOLEAN DEFAULT false;
