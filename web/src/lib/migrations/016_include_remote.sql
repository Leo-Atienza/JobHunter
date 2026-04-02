-- Add include_remote toggle for sessions
-- When false, remote jobs are excluded from results

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS include_remote BOOLEAN DEFAULT TRUE;
