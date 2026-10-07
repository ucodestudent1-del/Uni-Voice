-- 046_credit_note_fees_table.sql
-- Adds the missing credit_note_fees table that the repository queries
-- but was never created in migration 013.

CREATE TABLE IF NOT EXISTS credit_note_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  amount NUMERIC(18,6) NOT NULL,
  tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_credit_note_fee_positive CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_credit_note_fees_credit_note ON credit_note_fees(credit_note_id);
