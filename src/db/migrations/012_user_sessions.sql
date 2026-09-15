-- ============================================================================
-- Phase 8: User sessions table for active session management in Settings.
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token   VARCHAR(255),
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_seen ON user_sessions(last_seen DESC);
