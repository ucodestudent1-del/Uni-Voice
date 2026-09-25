-- ============================================================================
-- Phase 32: Expense Budget Settings — allow businesses to set a monthly
-- spending budget and receive notifications when thresholds are crossed.
-- Gated behind the `expenses.tracking` feature flag (Business plan).
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_budget_settings (
  business_id              UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  monthly_budget         NUMERIC(18,2) NOT NULL DEFAULT '0.00',
  monthly_budget_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  budget_period          VARCHAR(20) NOT NULL DEFAULT 'calendar_month'
                          CHECK (budget_period IN ('calendar_month', 'rolling_30')),
  budget_notifications   BOOLEAN NOT NULL DEFAULT true,
  budget_warning_threshold NUMERIC(5,2) NOT NULL DEFAULT 80,
  budget_over_threshold  NUMERIC(5,2) NOT NULL DEFAULT 100,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_budget_settings_business
  ON expense_budget_settings(business_id);

CREATE INDEX IF NOT EXISTS idx_expense_budget_settings_notifications
  ON expense_budget_settings(business_id) WHERE budget_notifications = true;
