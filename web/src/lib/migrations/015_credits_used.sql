-- Track actual credits consumed per scrape run (primarily for Firecrawl)
ALTER TABLE scrape_logs ADD COLUMN IF NOT EXISTS credits_used INTEGER;
