CREATE TABLE sessions (
  code VARCHAR(8) PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '48 hours'),
  keywords TEXT[],
  location VARCHAR(255)
);

CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  session_code VARCHAR(8) REFERENCES sessions(code) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  company VARCHAR(500),
  location VARCHAR(500),
  url TEXT NOT NULL,
  source VARCHAR(50) NOT NULL,
  salary VARCHAR(255),
  description TEXT,
  posted_date VARCHAR(255),
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'new',
  notes TEXT,
  UNIQUE(session_code, url)
);

CREATE INDEX idx_jobs_session ON jobs(session_code);
CREATE INDEX idx_jobs_source ON jobs(session_code, source);
CREATE INDEX idx_jobs_status ON jobs(session_code, status);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
