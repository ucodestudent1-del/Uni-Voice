-- ============================================================================
-- Phase 17: Expense Tracking — allow businesses to record, categorise, and
-- summarise business expenses. Gated behind the `expenses.tracking` feature
-- flag (Business plan).
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_category') THEN
    CREATE TYPE expense_category AS ENUM (
      'supplies',
      'software',
      'meals',
      'travel',
      'office',
      'marketing',
      'utilities',
      'professional_fees',
      'taxes',
      'insurance',
      'equipment',
      'other'
    );
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- Expenses: record business spend with a category, date, optional receipt, and
-- an optional link to a customer/project for attribution.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  invoice_id      UUID REFERENCES invoices(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  amount          NUMERIC(18,2) NOT NULL,
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  category        expense_category NOT NULL DEFAULT 'other',
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method  VARCHAR(50) DEFAULT 'cash',
  receipt_url     TEXT,
  notes           TEXT,
  is_billable     BOOLEAN NOT NULL DEFAULT false,
  is_reimbursed   BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_business
  ON expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_business_date
  ON expenses(business_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category
  ON expenses(business_id, category);
CREATE INDEX IF NOT EXISTS idx_expenses_customer
  ON expenses(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_project
  ON expenses(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_invoice
  ON expenses(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_user
  ON expenses(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_reimbursed
  ON expenses(business_id, is_reimbursed);

-- ----------------------------------------------------------------------------
-- Constraints
-- ----------------------------------------------------------------------------
ALTER TABLE expenses
  ADD CONSTRAINT chk_expense_amount_nonneg CHECK (amount >= 0);

-- ----------------------------------------------------------------------------
-- Triggers: keep updated_at in sync
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
