-- ============================================================================
-- Phase 19: Receipts persistence & indexing
-- Creates the receipt_number_sequences table for atomic per-business receipt
-- numbering and adds indexes to the receipts table (which already exists from
-- migration 013). All DDL is idempotent (CREATE TABLE IF NOT EXISTS / IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS receipt_number_sequences (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix      VARCHAR(50) NOT NULL DEFAULT 'RCPT',
  next_number BIGINT NOT NULL DEFAULT 1,
  padding     SMALLINT NOT NULL DEFAULT 6,
  includes_year BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_business_status
  ON receipts(business_id, status);

CREATE INDEX IF NOT EXISTS idx_receipts_business_invoice
  ON receipts(business_id, invoice_id);

CREATE INDEX IF NOT EXISTS idx_receipts_payment
  ON receipts(payment_id);

CREATE INDEX IF NOT EXISTS idx_receipts_number_business
  ON receipts(business_id, receipt_number);

CREATE INDEX IF NOT EXISTS idx_receipts_created
  ON receipts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_receipts_status_business
  ON receipts(business_id, status, created_at DESC);
