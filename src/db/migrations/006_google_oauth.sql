-- ============================================================================
-- OAuth / Social Login support (Phase: Google OAuth 2.0)
-- ============================================================================
-- Adds columns to the users table to support external identity providers.
-- A user created via Google OAuth has a non-null google_id and
-- oauth_provider = 'google'. Password-based users have
-- oauth_provider = 'password' (and password_hash is required).
-- password_hash is made nullable so OAuth users (who have no password) can
-- be inserted without a placeholder.
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS oauth_provider   VARCHAR(20)  NOT NULL DEFAULT 'password',
  ADD COLUMN IF NOT EXISTS google_id        VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS avatar_url       TEXT;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider ON users(oauth_provider);
