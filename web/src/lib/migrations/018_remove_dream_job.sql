-- Remove unused dream job feature columns
ALTER TABLE sessions DROP COLUMN IF EXISTS dream_job;
ALTER TABLE jobs DROP COLUMN IF EXISTS dream_score;
