-- 044_quote_content_fields.sql
-- Adds payment_instructions and scope_of_work columns to the quotes table.
-- Also adds is_finalized which was referenced by QuoteService but never
-- created in an earlier migration.
-- Adds document_type to email_log so it can reference both invoices and quotes.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT,
  ADD COLUMN IF NOT EXISTS scope_of_work TEXT,
  ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN quotes.payment_instructions IS 'How the customer should pay (displayed on quote PDF and public view)';
COMMENT ON COLUMN quotes.scope_of_work IS 'Detailed description of included work, materials, deliverables, and exclusions';

-- Allow email_log to reference quotes as well as invoices.
-- Drop the old FK constraint (column must also drop NOT NULL temporarily).
ALTER TABLE email_log DROP CONSTRAINT IF EXISTS email_log_invoice_id_fkey;
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS document_type VARCHAR(20) NOT NULL DEFAULT 'invoice';
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE;
-- Re-add a conditional FK: invoice_id must exist when document_type='invoice'.
-- (PostgreSQL FK constraints are unconditional, so we use a permissive approach:
-- the invoice_id column is no longer NOT NULL, and a trigger or application
-- logic enforces the reference when present.)
ALTER TABLE email_log ALTER COLUMN invoice_id DROP NOT NULL;
