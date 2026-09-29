-- ============================================================================
-- Phase 34: Expense Vendor column — track who the expense was paid to.
-- Gated behind the `expenses.tracking` feature flag (Business plan).
-- ============================================================================

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS vendor VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_expenses_vendor
  ON expenses(business_id)
  WHERE vendor IS NOT NULL;
