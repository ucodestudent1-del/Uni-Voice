-- ============================================================================
-- Phase 1-5: Universal Invoice Generator
-- Complete schema covering core domain, documents, payments, automation, AI
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- Businesses (workspace/tenant boundary)
-- ----------------------------------------------------------------------------
CREATE TABLE businesses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL,
  name            VARCHAR(255) NOT NULL,
  legal_name      VARCHAR(255),
  email           VARCHAR(255),
  phone           VARCHAR(50),
  website         VARCHAR(255),
  tax_id          VARCHAR(100),
  registration_number VARCHAR(100),
  address_line_1  VARCHAR(255),
  address_line_2  VARCHAR(255),
  city            VARCHAR(100),
  state_or_region VARCHAR(100),
  postal_code     VARCHAR(20),
  country_code    VARCHAR(3),
  default_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  logo_url        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_businesses_owner ON businesses(owner_id);

-- ----------------------------------------------------------------------------
-- Business settings (branding, defaults, numbering config)
-- ----------------------------------------------------------------------------
CREATE TABLE business_settings (
  business_id       UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  default_currency  VARCHAR(3) NOT NULL DEFAULT 'USD',
  default_tax_rate  NUMERIC(5,4) DEFAULT 0,
  default_terms     TEXT,
  default_notes     TEXT,
  time_zone         VARCHAR(50) NOT NULL DEFAULT 'UTC',
  locale            VARCHAR(10) DEFAULT 'en-US',
  pdf_template_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Invoice number sequences (atomic per-business generation)
-- ----------------------------------------------------------------------------
CREATE TABLE invoice_number_sequences (
  business_id       UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix            VARCHAR(50) NOT NULL DEFAULT 'INV',
  next_number       BIGINT NOT NULL DEFAULT 1,
  padding           SMALLINT NOT NULL DEFAULT 6,
  includes_year     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Customers
-- ----------------------------------------------------------------------------
CREATE TABLE customers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  company_name    VARCHAR(255),
  email           VARCHAR(255),
  phone           VARCHAR(50),
  tax_id          VARCHAR(100),
  address_line_1  VARCHAR(255),
  address_line_2  VARCHAR(255),
  city            VARCHAR(100),
  state_or_region VARCHAR(100),
  postal_code     VARCHAR(20),
  country_code    VARCHAR(3),
  default_currency VARCHAR(3),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_business ON customers(business_id);

-- ----------------------------------------------------------------------------
-- Products / Services
-- ----------------------------------------------------------------------------
CREATE TABLE products (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id        UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name               VARCHAR(255) NOT NULL,
  description        TEXT,
  sku                VARCHAR(100),
  default_unit_price NUMERIC(18,6) NOT NULL DEFAULT 0,
  default_tax_rate   NUMERIC(5,4) DEFAULT 0,
  unit               VARCHAR(50) NOT NULL DEFAULT 'each',
  default_currency   VARCHAR(3) NOT NULL DEFAULT 'USD',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_business ON products(business_id);

-- ----------------------------------------------------------------------------
-- Invoice templates
-- ----------------------------------------------------------------------------
CREATE TABLE templates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  is_default        BOOLEAN NOT NULL DEFAULT FALSE,
  config            JSONB NOT NULL DEFAULT '{}'::jsonb,
  html_template     TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_business ON templates(business_id);

-- ----------------------------------------------------------------------------
-- Manual tax rates (MVP; future TaxProvider replaces/augments)
-- ----------------------------------------------------------------------------
CREATE TABLE business_tax_rates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(50),
  rate            NUMERIC(5,4) NOT NULL,
  type            VARCHAR(20) NOT NULL DEFAULT 'percentage',
  country_code    VARCHAR(3),
  region          VARCHAR(100),
  is_compound     BOOLEAN NOT NULL DEFAULT FALSE,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tax_rates_business ON business_tax_rates(business_id);

-- ----------------------------------------------------------------------------
-- Invoices
-- ----------------------------------------------------------------------------
CREATE TYPE invoice_status AS ENUM (
  'draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void'
);

CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
  invoice_number      VARCHAR(100),
  status              invoice_status NOT NULL DEFAULT 'draft',
  issue_date            DATE,
  due_date              DATE,
  currency            VARCHAR(3) NOT NULL,
  exchange_rate       NUMERIC(18,6),
  subtotal            NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_total      NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  fee_total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  total               NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_paid         NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_due          NUMERIC(18,6) NOT NULL DEFAULT 0,
  notes               TEXT,
  terms               TEXT,
  template_id         UUID REFERENCES templates(id),
  public_token        VARCHAR(64) UNIQUE,
  public_token_expires_at TIMESTAMPTZ,
  payment_instructions TEXT,
  is_finalized        BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at        TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  viewed_at           TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancelled_reason    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  updated_by          UUID,

  CONSTRAINT chk_invoice_total_check CHECK (total >= 0),
  CONSTRAINT chk_invoice_due_after_issue CHECK (due_date >= issue_date),
  CONSTRAINT uq_invoice_number_business UNIQUE (business_id, invoice_number)
);

CREATE INDEX idx_invoices_business ON invoices(business_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_public_token ON invoices(public_token);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- ----------------------------------------------------------------------------
-- Invoice line items
-- ----------------------------------------------------------------------------
CREATE TABLE invoice_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  description     VARCHAR(500) NOT NULL,
  quantity        NUMERIC(18,6) NOT NULL,
  unit            VARCHAR(50) NOT NULL DEFAULT 'each',
  unit_price      NUMERIC(18,6) NOT NULL,
  discount        NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  line_subtotal   NUMERIC(18,6) NOT NULL,
  line_total      NUMERIC(18,6) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product ON invoice_items(product_id);

-- ----------------------------------------------------------------------------
-- Invoice fees (separate from line items)
-- ----------------------------------------------------------------------------
CREATE TABLE invoice_fees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description     VARCHAR(500) NOT NULL,
  amount          NUMERIC(18,6) NOT NULL,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_fees_invoice ON invoice_fees(invoice_id);

-- ----------------------------------------------------------------------------
-- Invoice snapshots — immutable historical record of finalized invoices
-- ----------------------------------------------------------------------------
CREATE TABLE invoice_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  snapshot        JSONB NOT NULL,
  snapshot_hash   VARCHAR(64) NOT NULL,
  pdf_stored      BOOLEAN NOT NULL DEFAULT FALSE,
  pdf_hash        VARCHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  CONSTRAINT uq_snapshot_invoice UNIQUE (invoice_id)
);

CREATE INDEX idx_invoice_snapshots_hash ON invoice_snapshots(snapshot_hash);

-- ----------------------------------------------------------------------------
-- Invoice events / audit log
-- ----------------------------------------------------------------------------
CREATE TYPE invoice_event_type AS ENUM (
  'created', 'updated', 'line_item_added', 'line_item_updated', 'line_item_removed',
  'discount_applied', 'tax_calculated', 'draft_saved', 'finalized',
  'number_assigned', 'sent', 'email_sent', 'email_delivered', 'email_opened',
  'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled', 'voided',
  'payment_recorded', 'payment_refunded', 'fee_added', 'memo_added'
);

CREATE TABLE invoice_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  event_type      invoice_event_type NOT NULL,
  actor_id        UUID,
  actor_type      VARCHAR(20),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_events_invoice ON invoice_events(invoice_id);
CREATE INDEX idx_invoice_events_type ON invoice_events(event_type);
CREATE INDEX idx_invoice_events_created ON invoice_events(created_at);

-- ----------------------------------------------------------------------------
-- Payments (Phase 3)
-- ----------------------------------------------------------------------------
CREATE TYPE payment_status AS ENUM (
  'pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded'
);

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id          UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider            VARCHAR(50) NOT NULL,
  provider_payment_id VARCHAR(255),
  amount              NUMERIC(18,6) NOT NULL,
  currency            VARCHAR(3) NOT NULL,
  status              payment_status NOT NULL DEFAULT 'pending',
  paid_at             TIMESTAMPTZ,
  method              VARCHAR(50),
  idempotency_key     VARCHAR(255) UNIQUE,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_business ON payments(business_id);
CREATE INDEX idx_payments_provider_id ON payments(provider, provider_payment_id);
CREATE INDEX idx_payments_idempotency ON payments(idempotency_key);

-- ----------------------------------------------------------------------------
-- Payment events / audit log
-- ----------------------------------------------------------------------------
CREATE TABLE payment_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  event_type      VARCHAR(50) NOT NULL,
  status          payment_status,
  amount          NUMERIC(18,6),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_events_payment ON payment_events(payment_id);

-- ----------------------------------------------------------------------------
-- Email delivery log
-- ----------------------------------------------------------------------------
CREATE TYPE email_status AS ENUM ('pending', 'sent', 'delivered', 'opened', 'failed');

CREATE TABLE email_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider        VARCHAR(50) NOT NULL,
  status          email_status NOT NULL DEFAULT 'pending',
  recipient       VARCHAR(255) NOT NULL,
  subject         VARCHAR(500),
  idempotency_key VARCHAR(255) UNIQUE,
  message_id      VARCHAR(255),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_log_invoice ON email_log(invoice_id);
CREATE INDEX idx_email_log_idempotency ON email_log(idempotency_key);

-- ----------------------------------------------------------------------------
-- Recurring invoices (Phase 4)
-- ----------------------------------------------------------------------------
CREATE TYPE recurring_frequency AS ENUM ('daily', 'weekly', 'monthly', 'yearly');

CREATE TABLE recurring_invoices (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
  name                VARCHAR(255) NOT NULL,
  frequency           recurring_frequency NOT NULL,
  interval_count      INTEGER NOT NULL DEFAULT 1,
  next_generation_at  DATE NOT NULL,
  end_date            DATE,
  currency            VARCHAR(3) NOT NULL,
  notes               TEXT,
  terms               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  last_generated_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recurring_business ON recurring_invoices(business_id);
CREATE INDEX idx_recurring_next ON recurring_invoices(next_generation_at);

CREATE TABLE recurring_invoice_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recurring_invoice_id UUID NOT NULL REFERENCES recurring_invoices(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  description     VARCHAR(500) NOT NULL,
  quantity        NUMERIC(18,6) NOT NULL,
  unit            VARCHAR(50) NOT NULL DEFAULT 'each',
  unit_price      NUMERIC(18,6) NOT NULL,
  discount        NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recurring_items ON recurring_invoice_items(recurring_invoice_id);

-- ----------------------------------------------------------------------------
-- Quotes (Phase 4)
-- ----------------------------------------------------------------------------
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled');

CREATE TABLE quotes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  quote_number    VARCHAR(100),
  status          quote_status NOT NULL DEFAULT 'draft',
  issue_date      DATE,
  due_date        DATE,
  currency        VARCHAR(3) NOT NULL,
  subtotal        NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_total  NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(18,6) NOT NULL DEFAULT 0,
  fee_total       NUMERIC(18,6) NOT NULL DEFAULT 0,
  total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  notes           TEXT,
  terms           TEXT,
  public_token    VARCHAR(64) UNIQUE,
  is_accepted     BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_at     TIMESTAMPTZ,
  converted_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_business ON quotes(business_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_public_token ON quotes(public_token);

CREATE TABLE quote_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  description     VARCHAR(500) NOT NULL,
  quantity        NUMERIC(18,6) NOT NULL,
  unit            VARCHAR(50) NOT NULL DEFAULT 'each',
  unit_price      NUMERIC(18,6) NOT NULL,
  discount        NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  line_subtotal   NUMERIC(18,6) NOT NULL,
  line_total      NUMERIC(18,6) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);

-- ----------------------------------------------------------------------------
-- AI generation logs (Phase 5)
-- ----------------------------------------------------------------------------
CREATE TABLE ai_generation_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider        VARCHAR(50) NOT NULL,
  prompt          TEXT NOT NULL,
  result          JSONB,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_logs_business ON ai_generation_logs(business_id);
