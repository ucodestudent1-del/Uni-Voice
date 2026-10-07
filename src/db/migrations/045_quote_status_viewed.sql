-- 045_quote_status_viewed.sql
-- Adds 'viewed' to the quote_status enum so quotes can track when a customer
-- has viewed the public quote page.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'quote_status' AND e.enumlabel = 'viewed'
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'viewed';
  END IF;
END$$;
