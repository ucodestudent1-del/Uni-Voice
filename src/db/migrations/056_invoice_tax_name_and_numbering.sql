-- 056_invoice_tax_name_and_numbering.sql
-- Adds tax_name column to invoice_items and invoice_fees for tax rate name display.
-- Adds numbering config to business_settings for invoice, credit note, and quote prefixes.

-- Tax name on invoice line items
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS tax_name VARCHAR(255);

-- Tax name on invoice fees (for consistency)
ALTER TABLE invoice_fees
  ADD COLUMN IF NOT EXISTS tax_name VARCHAR(255);

-- Tax name on credit note items and fees
ALTER TABLE credit_note_items
  ADD COLUMN IF NOT EXISTS tax_name VARCHAR(255);

ALTER TABLE credit_note_fees
  ADD COLUMN IF NOT EXISTS tax_name VARCHAR(255);

-- Numbering configuration on business_settings
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS invoice_number_prefix VARCHAR(50) DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS invoice_number_padding SMALLINT DEFAULT 6,
  ADD COLUMN IF NOT EXISTS invoice_includes_year BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS credit_note_prefix VARCHAR(50) DEFAULT 'CN',
  ADD COLUMN IF NOT EXISTS credit_note_padding SMALLINT DEFAULT 6,
  ADD COLUMN IF NOT EXISTS credit_note_includes_year BOOLEAN DEFAULT TRUE;
