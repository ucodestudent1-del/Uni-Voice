-- 075_recurring_invoice_numbering.sql
-- Adds numbering sequence table and business_settings columns for recurring invoices.
-- Recurring invoices generate actual invoices on schedule, so they have their own
-- numbering sequence used when a scheduled invoice is created from the template.

-- Ensure the enum type exists before using it in ALTER TABLE
CREATE TYPE IF NOT EXISTS recurring_invoice_status AS ENUM (
  'draft', 'active', 'paused', 'cancelled', 'void'
);

CREATE TABLE IF NOT EXISTS recurring_invoice_number_sequences (
  business_id   UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix        VARCHAR(50) NOT NULL DEFAULT 'RI',
  next_number   BIGINT NOT NULL DEFAULT 1,
  padding       SMALLINT NOT NULL DEFAULT 6,
  includes_year BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add recurrence schedule fields to recurring_invoices table
-- Note: We split into multiple ALTER TABLE statements for maximum compatibility
ALTER TABLE recurring_invoices
  ADD COLUMN IF NOT EXISTS status recurring_invoice_status DEFAULT 'draft';

ALTER TABLE recurring_invoices
  ADD COLUMN IF NOT EXISTS recurring_invoice_number VARCHAR(100);

ALTER TABLE recurring_invoices
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES invoice_templates(id) ON DELETE SET NULL;

ALTER TABLE recurring_invoices
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

ALTER TABLE recurring_invoices
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE recurring_invoices
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

ALTER TABLE recurring_invoices
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

ALTER TABLE recurring_invoices
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- Numbering config on business_settings for recurring invoices
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS recurring_invoice_prefix VARCHAR(50) DEFAULT 'RI';

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS recurring_invoice_padding SMALLINT DEFAULT 6;

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS recurring_invoice_includes_year BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_recurring_invoices_status ON recurring_invoices(status);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_number ON recurring_invoices(recurring_invoice_number);
