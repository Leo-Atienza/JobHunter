-- Migration 003: Add job details, relevance scoring, and country support
-- Features: More Job Details (#3), Relevance Scoring (#4), Strict Location + Country (#5)

-- Feature 3: More Job Details
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type VARCHAR(50);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience_level VARCHAR(50);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS skills TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS benefits TEXT;

-- Feature 4: Relevance Scoring
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS relevance_score INTEGER DEFAULT 0;

-- Feature 5: Strict Location + Country
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS country VARCHAR(10);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS country VARCHAR(100);
