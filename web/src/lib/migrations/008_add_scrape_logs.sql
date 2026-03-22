-- Track every scraper run for health monitoring
CREATE TABLE IF NOT EXISTS scrape_logs (
  id SERIAL PRIMARY KEY,
  session_code VARCHAR(8) REFERENCES sessions(code) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL,
  status VARCHAR(10) NOT NULL,       -- 'success' | 'error'
  jobs_found INTEGER DEFAULT 0,
  jobs_inserted INTEGER DEFAULT 0,
  duplicates INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_logs_source ON scrape_logs(source);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_scraped_at ON scrape_logs(scraped_at);
