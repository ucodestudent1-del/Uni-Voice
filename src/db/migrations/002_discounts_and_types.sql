-- Invoice-level discount (MVP: supports fixed and percentage)
ALTER TABLE invoices
  ADD COLUMN invoice_discount_type VARCHAR(20) NOT NULL DEFAULT 'fixed',
  ADD COLUMN invoice_discount_value NUMERIC(18,6) NOT NULL DEFAULT 0;

-- Per-line discount type so the engine can distinguish fixed vs percentage
ALTER TABLE invoice_items
  ADD COLUMN discount_type VARCHAR(20) NOT NULL DEFAULT 'fixed';

-- Quote-level discount (Phase 4: quotes reuse the calculation engine)
ALTER TABLE quotes
  ADD COLUMN discount_type VARCHAR(20) NOT NULL DEFAULT 'fixed',
  ADD COLUMN discount_value NUMERIC(18,6) NOT NULL DEFAULT 0;

-- Quote item discount type for consistency
ALTER TABLE quote_items
  ADD COLUMN discount_type VARCHAR(20) NOT NULL DEFAULT 'fixed';

COMMENT ON COLUMN invoices.invoice_discount_type IS 'fixed | percentage';
COMMENT ON COLUMN invoices.invoice_discount_value IS 'fixed => currency amount; percentage => 0-100';
COMMENT ON COLUMN invoice_items.discount_type IS 'fixed | percentage';
