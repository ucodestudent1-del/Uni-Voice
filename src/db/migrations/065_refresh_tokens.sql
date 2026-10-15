-- ============================================================================
-- Phase: Auth security — refresh tokens table for short-lived JWT access tokens
-- ============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ,
  ip_address    VARCHAR(45),
  user_agent    TEXT
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Invalidate existing refresh tokens for a user when they change their password
-- (password change revokes all sessions except current).
