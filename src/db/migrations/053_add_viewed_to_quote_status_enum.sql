-- 053_add_viewed_to_quote_status_enum.sql
-- Adds the 'viewed' value to the quote_status enum so that quote status
-- transitions to 'viewed' can be persisted in the database.
-- The enum is backed by PostgreSQL; we add the new value AFTER 'sent' to
-- preserve existing ordering semantics in application code.

-- Check if 'viewed' already exists in the enum; if not, add it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'quote_status' AND e.enumlabel = 'viewed'
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'viewed' AFTER 'sent';
  END IF;
END$$;

-- Add viewed_at column if it doesn't exist (redundant with view events, but
-- provides a quick lookup for the "viewed" status).
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
