DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_note_status') THEN
    CREATE TYPE credit_note_status AS ENUM ('draft', 'finalized', 'cancelled', 'void');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scheduled_email_status') THEN
    CREATE TYPE scheduled_email_status AS ENUM ('pending', 'processing', 'sent', 'failed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'receipt_status') THEN
    CREATE TYPE receipt_status AS ENUM ('pending', 'issued', 'sent', 'failed');
  END IF;
END$$;

ALTER TYPE invoice_event_type ADD VALUE IF NOT EXISTS 'credit_note_applied';
ALTER TYPE invoice_event_type ADD VALUE IF NOT EXISTS 'receipt_generated';
ALTER TYPE invoice_event_type ADD VALUE IF NOT EXISTS 'receipt_sent';

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_type VARCHAR(30) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS deposit_due_date DATE,
  ADD COLUMN IF NOT EXISTS deposit_payment_purpose VARCHAR(255),
  ADD COLUMN IF NOT EXISTS credit_applied NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD CONSTRAINT chk_invoices_deposit_type CHECK (deposit_type IN ('none', 'fixed', 'percentage')),
  ADD CONSTRAINT chk_invoices_deposit_amount CHECK (deposit_amount >= 0 AND deposit_amount <= total);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_purpose VARCHAR(255);

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_purpose VARCHAR(255),
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS credit_note_number_sequences (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix VARCHAR(50) NOT NULL DEFAULT 'CN',
  next_number BIGINT NOT NULL DEFAULT 1,
  padding SMALLINT NOT NULL DEFAULT 6,
  includes_year BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  reference_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  credit_note_number VARCHAR(100),
  status credit_note_status NOT NULL DEFAULT 'draft',
  issue_date DATE,
  currency VARCHAR(3) NOT NULL,
  reason TEXT,
  notes TEXT,
  terms TEXT,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  subtotal NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_total NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total NUMERIC(18,6) NOT NULL DEFAULT 0,
  fee_total NUMERIC(18,6) NOT NULL DEFAULT 0,
  total NUMERIC(18,6) NOT NULL DEFAULT 0,
  applied_total NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_due NUMERIC(18,6) NOT NULL DEFAULT 0,
  is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  public_token VARCHAR(64) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_credit_note_number_business UNIQUE (business_id, credit_note_number),
  CONSTRAINT chk_credit_note_total CHECK (total >= 0),
  CONSTRAINT chk_credit_note_applied CHECK (applied_total >= 0 AND applied_total <= total)
);

ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS credit_note_id UUID REFERENCES credit_notes(id) ON DELETE CASCADE,
  ALTER COLUMN invoice_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS credit_note_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  snapshot_hash VARCHAR(64) NOT NULL,
  rendered_html TEXT,
  pdf_stored BOOLEAN NOT NULL DEFAULT FALSE,
  pdf_hash VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT uq_credit_note_snapshot UNIQUE (credit_note_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_note_snapshots_credit_note ON credit_note_snapshots(credit_note_id);

CREATE INDEX IF NOT EXISTS idx_credit_notes_business ON credit_notes(business_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer ON credit_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_reference_invoice ON credit_notes(reference_invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON credit_notes(status);
CREATE INDEX IF NOT EXISTS idx_credit_notes_created ON credit_notes(created_at DESC);

CREATE TABLE IF NOT EXISTS credit_note_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  description VARCHAR(500) NOT NULL,
  quantity NUMERIC(18,6) NOT NULL,
  unit VARCHAR(50) NOT NULL DEFAULT 'each',
  unit_price NUMERIC(18,6) NOT NULL,
  discount NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'fixed',
  tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  line_subtotal NUMERIC(18,6) NOT NULL,
  line_total NUMERIC(18,6) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
  catalog_name VARCHAR(255),
  catalog_sku VARCHAR(100),
  catalog_tax_category VARCHAR(100),
  catalog_unit_price NUMERIC(18,6),
  catalog_tax_rate NUMERIC(5,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_credit_note_item_quantity CHECK (quantity > 0),
  CONSTRAINT chk_credit_note_item_price CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_credit_note_items_credit_note ON credit_note_items(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_items_product ON credit_note_items(product_id);

CREATE TABLE IF NOT EXISTS credit_note_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount NUMERIC(18,6) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key VARCHAR(255) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_credit_note_application UNIQUE (credit_note_id, invoice_id),
  CONSTRAINT uq_credit_note_application_idempotency UNIQUE (business_id, idempotency_key),
  CONSTRAINT chk_credit_note_application_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_credit_note_applications_invoice ON credit_note_applications(invoice_id);

ALTER TABLE recurring_invoices
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issue_offset_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_offset_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_send BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(30) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS email_template_id UUID,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT,
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_type VARCHAR(30) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS deposit_due_offset_days INTEGER,
  ADD COLUMN IF NOT EXISTS deposit_payment_purpose VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_generation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generation_version INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT chk_recurring_issue_offset CHECK (issue_offset_days >= 0),
  ADD CONSTRAINT chk_recurring_due_offset CHECK (due_offset_days >= 0),
  ADD CONSTRAINT chk_recurring_deposit_type CHECK (deposit_type IN ('none', 'fixed', 'percentage'));

CREATE TABLE IF NOT EXISTS recurring_invoice_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recurring_invoice_id UUID NOT NULL REFERENCES recurring_invoices(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  amount NUMERIC(18,6) NOT NULL,
  tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_fees ON recurring_invoice_fees(recurring_invoice_id);

CREATE TABLE IF NOT EXISTS recurring_generation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recurring_invoice_id UUID NOT NULL REFERENCES recurring_invoices(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  scheduled_for DATE NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'processing',
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT uq_recurring_generation_run UNIQUE (recurring_invoice_id, scheduled_for),
  CONSTRAINT uq_recurring_generation_idempotency UNIQUE (business_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_recurring_generation_runs_status ON recurring_generation_runs(status, started_at);

ALTER TABLE invoice_reminder_rules
  ADD COLUMN IF NOT EXISTS include_pdf BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_template_id UUID,
  ADD COLUMN IF NOT EXISTS repeat_every_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ,
  ADD CONSTRAINT chk_reminder_repeat_days CHECK (repeat_every_days >= 0);

ALTER TABLE invoice_reminders
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS attachment_filename VARCHAR(255),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'sent';

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_reminders_idempotency
  ON invoice_reminders(business_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  template_type VARCHAR(50) NOT NULL DEFAULT 'custom',
  locale VARCHAR(10) NOT NULL DEFAULT 'en-US',
  subject_template VARCHAR(500) NOT NULL,
  body_template TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT uq_email_template_business_default UNIQUE (business_id, template_type, locale, is_default)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_business ON email_templates(business_id, template_type, is_active);

CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  credit_note_id UUID REFERENCES credit_notes(id) ON DELETE CASCADE,
  email_template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  recipient VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  attachment_type VARCHAR(30),
  attachment_filename VARCHAR(255),
  idempotency_key VARCHAR(255) NOT NULL,
  status scheduled_email_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_scheduled_email_idempotency UNIQUE (business_id, idempotency_key),
  CONSTRAINT chk_scheduled_email_attempts CHECK (attempts >= 0 AND max_attempts > 0)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_due ON scheduled_emails(status, available_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_invoice ON scheduled_emails(invoice_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_credit_note ON scheduled_emails(credit_note_id);

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  receipt_number VARCHAR(100) NOT NULL,
  amount NUMERIC(18,6) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  payment_method VARCHAR(50),
  payment_purpose VARCHAR(255),
  status receipt_status NOT NULL DEFAULT 'pending',
  issued_at TIMESTAMPTZ,
  email_log_id UUID REFERENCES email_log(id) ON DELETE SET NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  pdf BYTEA,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_receipt_payment UNIQUE (payment_id),
  CONSTRAINT uq_receipt_number_business UNIQUE (business_id, receipt_number),
  CONSTRAINT uq_receipt_idempotency UNIQUE (business_id, idempotency_key),
  CONSTRAINT chk_receipt_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_receipts_invoice ON receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipts_business_issued ON receipts(business_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  stripe_event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL
);
