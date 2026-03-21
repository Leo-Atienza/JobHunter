-- P0.3: Cross-source deduplication
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS duplicate_of INTEGER REFERENCES jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_duplicate ON jobs(duplicate_of);

-- P1.1: Parsed salary for range filtering
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_min INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_max INTEGER;

-- P1.2: AI job summaries (future)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ai_summary TEXT;
