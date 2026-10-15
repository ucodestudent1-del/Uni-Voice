-- 066_payment_vouchers_debit_notes.sql
-- Adds tables for Payment Vouchers and Debit Notes (Documents section extensions)

-- ----------------------------------------------------------------------------
-- Payment vouchers: used to record a payment made by the business (e.g. paying
-- a supplier, paying expenses, paying taxes). The voucher has line items that
-- describe what was paid.
-- ----------------------------------------------------------------------------

CREATE TYPE payment_voucher_status AS ENUM (
  'draft', 'issued', 'cancelled', 'void'
);

CREATE TABLE IF NOT EXISTS payment_voucher_number_sequences (
  business_id   UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix        VARCHAR(50) NOT NULL DEFAULT 'PV',
  next_number   BIGINT NOT NULL DEFAULT 1,
  padding       SMALLINT NOT NULL DEFAULT 6,
  includes_year BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_vouchers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  payment_voucher_number VARCHAR(100),
  status          payment_voucher_status NOT NULL DEFAULT 'draft',
  voucher_date    DATE,
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  payee_name      VARCHAR(255),
  payee_email     VARCHAR(255),
  payee_phone     VARCHAR(50),
  payee_address_line_1 VARCHAR(255),
  payee_address_line_2 VARCHAR(255),
  payee_city      VARCHAR(100),
  payee_state_or_region VARCHAR(100),
  payee_postal_code VARCHAR(20),
  payee_country_code VARCHAR(3),
  payee_tax_id    VARCHAR(100),
  reference_number VARCHAR(255),
  payment_method  VARCHAR(50),
  payment_provider VARCHAR(50),
  notes           TEXT,
  terms           TEXT,
  subtotal        NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(18,6) NOT NULL DEFAULT 0,
  total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  is_finalized    BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancelled_reason TEXT,
  voided_at       TIMESTAMPTZ,
  void_reason     TEXT,
  public_token    VARCHAR(64) UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  updated_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_payment_voucher_number_business UNIQUE (business_id, payment_voucher_number),
  CONSTRAINT chk_payment_voucher_total CHECK (total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payment_vouchers_business ON payment_vouchers(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_status ON payment_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_number ON payment_vouchers(payment_voucher_number);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_date ON payment_vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_public_token ON payment_vouchers(public_token);

CREATE TABLE IF NOT EXISTS payment_voucher_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_voucher_id UUID NOT NULL REFERENCES payment_vouchers(id) ON DELETE CASCADE,
  description     VARCHAR(500) NOT NULL,
  quantity        NUMERIC(18,6) NOT NULL DEFAULT 1,
  unit            VARCHAR(50) NOT NULL DEFAULT 'each',
  unit_price      NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_name        VARCHAR(255),
  tax_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  line_subtotal   NUMERIC(18,6) NOT NULL,
  line_total      NUMERIC(18,6) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_voucher_items_voucher ON payment_voucher_items(payment_voucher_id);

CREATE TABLE IF NOT EXISTS payment_voucher_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_voucher_id UUID NOT NULL REFERENCES payment_vouchers(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type      VARCHAR(50) NOT NULL,
  actor_id        UUID,
  actor_type      VARCHAR(20),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_voucher_events_voucher ON payment_voucher_events(payment_voucher_id);
CREATE INDEX IF NOT EXISTS idx_payment_voucher_events_type ON payment_voucher_events(event_type);

-- ----------------------------------------------------------------------------
-- Debit notes: issued by a business to a customer to request additional payment
-- (e.g. for undercharged amounts, additional charges, or corrections).
-- ----------------------------------------------------------------------------

CREATE TYPE debit_note_status AS ENUM (
  'draft', 'finalized', 'sent', 'cancelled', 'void'
);

CREATE TABLE IF NOT EXISTS debit_note_number_sequences (
  business_id   UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix        VARCHAR(50) NOT NULL DEFAULT 'DN',
  next_number   BIGINT NOT NULL DEFAULT 1,
  padding       SMALLINT NOT NULL DEFAULT 6,
  includes_year BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS debit_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  debit_note_number VARCHAR(100),
  status          debit_note_status NOT NULL DEFAULT 'draft',
  issue_date      DATE,
  due_date        DATE,
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  customer_name   VARCHAR(255),
  customer_email  VARCHAR(255),
  customer_phone  VARCHAR(50),
  customer_address_line_1 VARCHAR(255),
  customer_address_line_2 VARCHAR(255),
  customer_city   VARCHAR(100),
  customer_state_or_region VARCHAR(100),
  customer_postal_code VARCHAR(20),
  customer_country_code VARCHAR(3),
  customer_tax_id VARCHAR(100),
  reference_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  reference_invoice_number VARCHAR(100),
  reason          TEXT,
  notes           TEXT,
  terms           TEXT,
  payment_instructions TEXT,
  subtotal        NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(18,6) NOT NULL DEFAULT 0,
  total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_due      NUMERIC(18,6) NOT NULL DEFAULT 0,
  is_finalized    BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancelled_reason TEXT,
  voided_at       TIMESTAMPTZ,
  void_reason     TEXT,
  public_token    VARCHAR(64) UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  updated_by      UUID,
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_debit_note_number_business UNIQUE (business_id, debit_note_number),
  CONSTRAINT chk_debit_note_total CHECK (total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_debit_notes_business ON debit_notes(business_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_status ON debit_notes(status);
CREATE INDEX IF NOT EXISTS idx_debit_notes_number ON debit_notes(debit_note_number);
CREATE INDEX IF NOT EXISTS idx_debit_notes_customer ON debit_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_date ON debit_notes(issue_date);
CREATE INDEX IF NOT EXISTS idx_debit_notes_public_token ON debit_notes(public_token);

CREATE TABLE IF NOT EXISTS debit_note_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debit_note_id   UUID NOT NULL REFERENCES debit_notes(id) ON DELETE CASCADE,
  description     VARCHAR(500) NOT NULL,
  quantity        NUMERIC(18,6) NOT NULL DEFAULT 1,
  unit            VARCHAR(50) NOT NULL DEFAULT 'each',
  unit_price      NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_name        VARCHAR(255),
  tax_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  line_subtotal   NUMERIC(18,6) NOT NULL,
  line_total      NUMERIC(18,6) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debit_note_items_note ON debit_note_items(debit_note_id);

CREATE TABLE IF NOT EXISTS debit_note_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debit_note_id   UUID NOT NULL REFERENCES debit_notes(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type      VARCHAR(50) NOT NULL,
  actor_id        UUID,
  actor_type      VARCHAR(20),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debit_note_events_note ON debit_note_events(debit_note_id);
CREATE INDEX IF NOT EXISTS idx_debit_note_events_type ON debit_note_events(event_type);

-- ----------------------------------------------------------------------------
-- Numbering config on business_settings for payment vouchers and debit notes
-- ----------------------------------------------------------------------------
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS payment_voucher_prefix VARCHAR(50) DEFAULT 'PV',
  ADD COLUMN IF NOT EXISTS payment_voucher_padding SMALLINT DEFAULT 6,
  ADD COLUMN IF NOT EXISTS payment_voucher_includes_year BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS debit_note_prefix VARCHAR(50) DEFAULT 'DN',
  ADD COLUMN IF NOT EXISTS debit_note_padding SMALLINT DEFAULT 6,
  ADD COLUMN IF NOT EXISTS debit_note_includes_year BOOLEAN DEFAULT TRUE;
