-- 057_quote_version_and_converted.sql
-- Adds a version column to quotes for optimistic concurrency control
-- (mirrors the invoices table pattern in invoice-service.ts).
-- Also adds the 'converted' value to the quote_status enum so that
-- quotes that have been transformed into invoices can be tracked.

-- Add version column for optimistic concurrency control
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN quotes.version IS 'Optimistic concurrency control version (mirrors invoices.version)';

-- Add 'converted' to the quote_status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'quote_status' AND e.enumlabel = 'converted'
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'converted' AFTER 'accepted';
  END IF;
END$$;
