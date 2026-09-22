-- ============================================================================
-- Phase 21: Quote number sequences
-- Creates the quote_number_sequences table for atomic per-business quote
-- numbering, mirroring the invoice_number_sequences pattern.
-- ============================================================================

CREATE TABLE IF NOT EXISTS quote_number_sequences (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix      VARCHAR(50) NOT NULL DEFAULT 'QOT',
  next_number BIGINT NOT NULL DEFAULT 1,
  padding     SMALLINT NOT NULL DEFAULT 6,
  includes_year BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_business_number
  ON quotes(business_id, quote_number) WHERE quote_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_business_status
  ON quotes(business_id, status);

CREATE INDEX IF NOT EXISTS idx_quotes_business_created
  ON quotes(business_id, created_at DESC);
