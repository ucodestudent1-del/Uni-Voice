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
-- Use DO blocks with exception handling to safely skip if column already exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'status') THEN
    ALTER TABLE recurring_invoices ADD COLUMN status recurring_invoice_status DEFAULT 'draft';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'recurring_invoice_number') THEN
    ALTER TABLE recurring_invoices ADD COLUMN recurring_invoice_number VARCHAR(100);
  END IF;
END $$;

-- template_id is added by migration 013 (referencing templates table) — skip if exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'template_id') THEN
    ALTER TABLE recurring_invoices ADD COLUMN template_id UUID REFERENCES templates(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'finalized_at') THEN
    ALTER TABLE recurring_invoices ADD COLUMN finalized_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'cancelled_at') THEN
    ALTER TABLE recurring_invoices ADD COLUMN cancelled_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'cancelled_reason') THEN
    ALTER TABLE recurring_invoices ADD COLUMN cancelled_reason TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'voided_at') THEN
    ALTER TABLE recurring_invoices ADD COLUMN voided_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'void_reason') THEN
    ALTER TABLE recurring_invoices ADD COLUMN void_reason TEXT;
  END IF;
END $$;

-- Numbering config on business_settings for recurring invoices
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'business_settings'::regclass AND attname = 'recurring_invoice_prefix') THEN
    ALTER TABLE business_settings ADD COLUMN recurring_invoice_prefix VARCHAR(50) DEFAULT 'RI';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'business_settings'::regclass AND attname = 'recurring_invoice_padding') THEN
    ALTER TABLE business_settings ADD COLUMN recurring_invoice_padding SMALLINT DEFAULT 6;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'business_settings'::regclass AND attname = 'recurring_invoice_includes_year') THEN
    ALTER TABLE business_settings ADD COLUMN recurring_invoice_includes_year BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recurring_invoices_status ON recurring_invoices(status);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_number ON recurring_invoices(recurring_invoice_number);
