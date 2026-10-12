-- 059_quote_status_viewed_existing.sql
-- Ensures the quote_status enum includes all values needed by the quote state machine,
-- and adds computed helper columns for quick status lookups.
-- The 'viewed' value was already added by migration 053, but we ensure
-- all enum values are present for a clean state machine.

DO $$
BEGIN
  -- 'viewed' — already added by 053, but safe to check
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'quote_status' AND e.enumlabel = 'viewed'
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'viewed' AFTER 'sent';
  END IF;

  -- 'converted' — added by 057
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'quote_status' AND e.enumlabel = 'converted'
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'converted' AFTER 'accepted';
  END IF;
END$$;

-- Ensure quote_fees has is_tax_inclusive column for parity with invoice_fees
ALTER TABLE quote_fees
  ADD COLUMN IF NOT EXISTS is_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure quote_items has is_optional column
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure quote_items and quote_fees have tax_name columns (for display parity with invoices)
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS tax_name VARCHAR(255);
ALTER TABLE quote_fees
  ADD COLUMN IF NOT EXISTS tax_name VARCHAR(255);

-- Ensure quote_items has catalog_name, catalog_sku, etc. for product catalog integration
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS catalog_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS catalog_sku VARCHAR(255),
  ADD COLUMN IF NOT EXISTS catalog_tax_category VARCHAR(255),
  ADD COLUMN IF NOT EXISTS catalog_unit_price NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS catalog_tax_rate NUMERIC(5,4);

-- Add quote_discount_type column for quote-level discount tracking
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS quote_discount_value NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_discount_type VARCHAR(20) NOT NULL DEFAULT 'fixed';

COMMENT ON COLUMN quotes.quote_discount_value IS 'Quote-level discount amount (applied to subtotal after line discounts)';
COMMENT ON COLUMN quotes.quote_discount_type IS 'Quote-level discount type: fixed | percentage';
