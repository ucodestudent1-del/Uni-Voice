-- 055_credit_note_public_token.sql
-- Adds public_token and public_token_expires_at for client portal sharing links.

ALTER TABLE credit_notes
  ADD COLUMN IF NOT EXISTS public_token VARCHAR(64) UNIQUE,
  ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_credit_notes_public_token ON credit_notes(public_token);
