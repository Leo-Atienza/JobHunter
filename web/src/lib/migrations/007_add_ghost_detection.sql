-- P2.2: Ghost job detection
-- Tracks whether a job listing URL is still live
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_ghost BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ghost_checked_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_jobs_ghost ON jobs(is_ghost) WHERE is_ghost = true;
