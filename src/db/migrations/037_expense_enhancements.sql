-- ============================================================================
-- Phase 37: Expense enhancements — custom categories, receipt uploads,
-- tax_amount, reimbursable workflow, and reimbursement status tracking.
-- Gated behind the `expenses.tracking` feature flag (Business plan).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Custom expense categories — businesses can create their own categories
-- in addition to the built-in ENUM values from migration 017.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_custom_categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    color           VARCHAR(30) NOT NULL DEFAULT 'info',
    icon            VARCHAR(10),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_custom_categories_business
    ON expense_custom_categories(business_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_custom_categories_business_name
    ON expense_custom_categories(business_id, LOWER(name));

-- ----------------------------------------------------------------------------
-- Receipt uploads — store receipt file references attached to expenses.
-- An expense can have multiple receipts; the first one is linked via receipt_url.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_receipts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    expense_id      UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    file_name       VARCHAR(255) NOT NULL,
    file_path       TEXT NOT NULL,
    file_size       INTEGER,
    mime_type       VARCHAR(100),
    uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_receipts_expense
    ON expense_receipts(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_receipts_business
    ON expense_receipts(business_id);

-- ----------------------------------------------------------------------------
-- Add tax_amount and reimbursable fields to expenses table.
-- tax_amount: the tax portion of the expense (for tax-deductible calculations)
-- is_reimbursable: if true, the expense is eligible for employee/contractor reimbursement
-- ----------------------------------------------------------------------------
ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_reimbursable BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_expenses_reimbursable
    ON expenses(business_id, is_reimbursable);
CREATE INDEX IF NOT EXISTS idx_expenses_tax_amount
    ON expenses(business_id, tax_amount);

-- ----------------------------------------------------------------------------
-- Triggers: keep updated_at in sync for new tables
-- ----------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_expense_custom_categories_updated_at
    BEFORE UPDATE ON expense_custom_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Ensure old expenses have is_reimbursable set (they were already reimbursed
-- if is_reimbursed = true, so backfill them as reimbursable).
-- ----------------------------------------------------------------------------
UPDATE expenses
    SET is_reimbursable = is_reimbursed
    WHERE is_reimbursable = false AND is_reimbursed = true;
