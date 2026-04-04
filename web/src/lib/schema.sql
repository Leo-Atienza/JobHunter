-- JobHunter database schema
-- Reflects current state after all migrations (001–018)
-- dream_job (sessions) and dream_score (jobs) removed per migration 018

-- ─────────────────────────────────────────
-- Auth tables (Auth.js / NextAuth)
-- Uses JWT strategy — no auth sessions table needed
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name              TEXT,
  email             TEXT UNIQUE,
  "emailVerified"   TIMESTAMPTZ,
  image             TEXT,
  -- Resume data for match scoring (migration 006)
  resume_skills     JSONB,
  resume_filename   TEXT,
  resume_updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS accounts (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "userId"            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  provider            TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          BIGINT,
  token_type          TEXT,
  scope               TEXT,
  id_token            TEXT,
  session_state       TEXT,
  UNIQUE(provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  expires    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(identifier, token)
);

-- ─────────────────────────────────────────
-- Job search sessions
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  code           VARCHAR(8) PRIMARY KEY,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at     TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
  -- Search parameters
  keywords       TEXT[],
  location       VARCHAR(255),          -- legacy single-location field
  locations      TEXT[],                -- multi-city support (migration 014)
  sources        TEXT[],                -- scraper sources to run (migration 001)
  remote         BOOLEAN DEFAULT false,
  include_remote BOOLEAN DEFAULT true,  -- exclude remote jobs when false (migration 016)
  companies      TEXT[],                -- company-specific scraping (migration 002)
  country        VARCHAR(10),           -- strict location/country filter (migration 003)
  firecrawl_urls TEXT[],               -- custom Firecrawl URLs (migration 010)
  -- Anonymous resume matching (migration 012)
  resume_skills  JSONB,
  -- Auth link (migration 005)
  user_id        TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);

-- ─────────────────────────────────────────
-- Job listings
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jobs (
  id               SERIAL PRIMARY KEY,
  session_code     VARCHAR(8) REFERENCES sessions(code) ON DELETE CASCADE,
  title            VARCHAR(500) NOT NULL,
  company          VARCHAR(500),
  location         VARCHAR(500),
  url              TEXT NOT NULL,
  source           VARCHAR(50) NOT NULL,
  scraped_at       TIMESTAMPTZ DEFAULT NOW(),
  -- Job details (migration 003)
  salary           VARCHAR(255),
  description      TEXT,
  posted_date      VARCHAR(255),
  status           VARCHAR(20) DEFAULT 'new',
  status_changed_at TIMESTAMPTZ,        -- application tracker timeline (migration 013)
  notes            TEXT,
  job_type         VARCHAR(50),
  experience_level VARCHAR(50),
  skills           TEXT,
  benefits         TEXT,
  country          VARCHAR(100),        -- strict location filter (migration 003)
  -- Match scoring (migration 003 / 017)
  relevance_score  INTEGER DEFAULT 0,
  score_breakdown  JSONB,               -- detailed score breakdown (migration 017)
  -- Deduplication and parsed salary (migration 004)
  duplicate_of     INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  salary_min       INTEGER,
  salary_max       INTEGER,
  -- AI summary (migration 004)
  ai_summary       TEXT,
  -- Ghost job detection (migration 007)
  is_ghost         BOOLEAN DEFAULT false,
  ghost_checked_at TIMESTAMPTZ,
  UNIQUE(session_code, url)
);

CREATE INDEX IF NOT EXISTS idx_jobs_session        ON jobs(session_code);
CREATE INDEX IF NOT EXISTS idx_jobs_source         ON jobs(session_code, source);
CREATE INDEX IF NOT EXISTS idx_jobs_status         ON jobs(session_code, status);
CREATE INDEX IF NOT EXISTS idx_jobs_duplicate      ON jobs(duplicate_of);
CREATE INDEX IF NOT EXISTS idx_jobs_ghost          ON jobs(is_ghost) WHERE is_ghost = true;
CREATE INDEX IF NOT EXISTS idx_jobs_status_changed ON jobs(session_code, status_changed_at DESC);

-- ─────────────────────────────────────────
-- Scraper health monitoring (migration 008)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scrape_logs (
  id             SERIAL PRIMARY KEY,
  session_code   VARCHAR(8) REFERENCES sessions(code) ON DELETE CASCADE,
  source         VARCHAR(50) NOT NULL,
  status         VARCHAR(10) NOT NULL,   -- 'success' | 'error'
  jobs_found     INTEGER DEFAULT 0,
  jobs_inserted  INTEGER DEFAULT 0,
  duplicates     INTEGER DEFAULT 0,
  error_message  TEXT,
  duration_ms    INTEGER,
  credits_used   INTEGER,                -- Firecrawl credits consumed (migration 015)
  scraped_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_logs_source     ON scrape_logs(source);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_scraped_at ON scrape_logs(scraped_at);

-- ─────────────────────────────────────────
-- Serverless-safe rate limiting (migration 009)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- ─────────────────────────────────────────
-- Auth indexes
-- ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts("userId");
