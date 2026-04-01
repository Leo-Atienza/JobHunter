-- Migration 013: Add status_changed_at for application tracker timeline
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

-- Backfill existing tracked jobs with scraped_at as a sensible default
UPDATE jobs SET status_changed_at = scraped_at WHERE status != 'new' AND status_changed_at IS NULL;

-- Index for tracker queries that sort by status_changed_at
CREATE INDEX IF NOT EXISTS idx_jobs_status_changed ON jobs(session_code, status_changed_at DESC);
