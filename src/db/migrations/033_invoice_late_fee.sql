-- ============================================================================
-- Late payment fee configuration on invoices and business settings
-- ============================================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS late_fee_type VARCHAR(30) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS late_fee_value NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_applied BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS late_fee_applied_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD CONSTRAINT chk_invoices_late_fee_type CHECK (late_fee_type IN ('none', 'fixed', 'percentage')),
  ADD CONSTRAINT chk_invoices_late_fee_value CHECK (late_fee_value >= 0);

CREATE INDEX IF NOT EXISTS idx_invoices_late_fee ON invoices(late_fee_applied) WHERE late_fee_applied = FALSE;

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS late_fee_type VARCHAR(30) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS late_fee_value NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD CONSTRAINT chk_business_late_fee_type CHECK (late_fee_type IN ('none', 'fixed', 'percentage')),
  ADD CONSTRAINT chk_business_late_fee_value CHECK (late_fee_value >= 0);
