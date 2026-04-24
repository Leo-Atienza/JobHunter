-- Migration 019: Job alerts (email digest of new jobs in a saved session)
-- Ships disabled; activates when RESEND_API_KEY is provisioned.

CREATE TABLE IF NOT EXISTS job_alerts (
  id                  SERIAL PRIMARY KEY,
  session_code        VARCHAR(8) NOT NULL REFERENCES sessions(code) ON DELETE CASCADE,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  frequency           VARCHAR(10) NOT NULL DEFAULT 'daily',
  enabled             BOOLEAN DEFAULT true,
  last_sent_at        TIMESTAMPTZ,
  unsubscribe_token   TEXT NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_alerts_user    ON job_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_job_alerts_enabled ON job_alerts(enabled) WHERE enabled = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_alerts_unsub ON job_alerts(unsubscribe_token);

-- Prevent duplicate alerts for the same session
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_alerts_session ON job_alerts(session_code);
