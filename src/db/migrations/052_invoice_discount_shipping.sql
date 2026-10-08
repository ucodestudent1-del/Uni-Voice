-- ============================================================================
-- Add shipping fields to invoices
-- ============================================================================

ALTER TABLE invoices
  ADD COLUMN shipping_description VARCHAR(500),
  ADD COLUMN shipping_amount NUMERIC(18,6) DEFAULT 0,
  ADD COLUMN shipping_tax_rate NUMERIC(5,4) DEFAULT 0;

-- Ensure existing rows have sensible defaults
UPDATE invoices SET shipping_amount = 0 WHERE shipping_amount IS NULL;
UPDATE invoices SET shipping_tax_rate = 0 WHERE shipping_tax_rate IS NULL;
