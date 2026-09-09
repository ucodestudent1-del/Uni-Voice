-- ============================================================================
-- Two-Factor Authentication (2FA) — TOTP (authenticator app) workflow
-- ============================================================================
-- Adds 2FA columns to the users table. `two_factor_secret` holds the
-- base32-encoded TOTP shared secret. It is stored server-side and never
-- returned by the API except during the in-app setup flow (to the
-- authenticated owner of the account). In production this column should
-- be encrypted at rest (TDE / column-level encryption); the application
-- logic itself is agnostic to that.
--
-- Replay protection for captured codes relies on the 30-second TOTP
-- window plus database-backed brute-force rate limiting (see
-- twofa_attempts). This matches the UX of mainstream authenticator
-- providers (Google/Microsoft Authenticator) and avoids locking users
-- out when they sign in twice within the same time step.

ALTER TABLE users
  ADD COLUMN two_factor_method        VARCHAR(20)  NOT NULL DEFAULT 'totp',
  ADD COLUMN two_factor_secret        VARCHAR(255),
  ADD COLUMN two_factor_enabled       BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN two_factor_confirmed_at  TIMESTAMPTZ;

CREATE INDEX idx_users_two_factor_enabled ON users(two_factor_enabled);

-- ----------------------------------------------------------------------------
-- Audit log for 2FA authentication attempts (rate-limiting + forensics).
-- ----------------------------------------------------------------------------
CREATE TABLE twofa_attempts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address      VARCHAR(45),
  success         BOOLEAN NOT NULL,
  error_code      VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_twofa_attempts_user ON twofa_attempts(user_id);
CREATE INDEX idx_twofa_attempts_time ON twofa_attempts(created_at);

-- ----------------------------------------------------------------------------
-- Recovery codes — single-use backup codes that bypass the TOTP check.
-- Only the SHA-256 hash of each code is stored. A fresh set is issued
-- each time 2FA is enabled, and each code can be used exactly once.
-- ----------------------------------------------------------------------------
CREATE TABLE twofa_recovery_codes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash       VARCHAR(255) NOT NULL,
  used            BOOLEAN NOT NULL DEFAULT FALSE,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_twofa_recovery_user ON twofa_recovery_codes(user_id);
CREATE UNIQUE INDEX uq_twofa_recovery_code ON twofa_recovery_codes(code_hash) WHERE used = FALSE;
