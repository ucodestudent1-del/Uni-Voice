/* ============================================================================
 * Migration 023: Complete the quotes schema
 * ---------------------------------------------------------------------------
 * Adds the columns and tables needed by the Quote service and the frontend
 * quote API that were referenced but not yet created by earlier migrations:
 *   - quote_fees table (mirrors invoice_fees)
 *   - quotes: amount_paid, amount_due, expiry_date, finalized_at, sent_at,
 *             viewed_at, rejected_at, public_token_expires_at, created_by
 * All DDL is idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 * ============================================================================ */

CREATE TABLE IF NOT EXISTS quote_fees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description     VARCHAR(500) NOT NULL,
  amount          NUMERIC(18,6) NOT NULL,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_fees_quote ON quote_fees(quote_id);

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS amount_paid        NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_due         NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expiry_date        DATE,
  ADD COLUMN IF NOT EXISTS finalized_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS viewed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by         UUID,
  ADD COLUMN IF NOT EXISTS updated_by         UUID;

CREATE INDEX IF NOT EXISTS idx_quotes_status_business ON quotes(business_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_public_token_expires ON quotes(public_token_expires_at) WHERE public_token IS NOT NULL;

-- Add the Scale ($30/mo) tier to the subscription_plan enum if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'subscription_plan' AND e.enumlabel = 'scale'
  ) THEN
    ALTER TYPE subscription_plan ADD VALUE 'scale';
  END IF;
END$$;
