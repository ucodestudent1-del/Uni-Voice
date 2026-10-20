-- 072_purchase_orders.sql
-- Adds tables for Purchase Orders (Documents section)
-- A purchase order is issued by a business TO a supplier to request goods/services.
-- It is the counterpart to an invoice (which is issued TO a customer).

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_order_status') THEN
        CREATE TYPE purchase_order_status AS ENUM (
            'draft', 'finalized', 'sent', 'viewed', 'received', 'cancelled', 'void'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS purchase_order_number_sequences (
  business_id   UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix        VARCHAR(50) NOT NULL DEFAULT 'PO',
  next_number   BIGINT NOT NULL DEFAULT 1,
  padding       SMALLINT NOT NULL DEFAULT 6,
  includes_year BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_id       UUID REFERENCES customers(id) ON DELETE SET NULL,
  purchase_order_number VARCHAR(100),
  status            purchase_order_status NOT NULL DEFAULT 'draft',
  issue_date        DATE,
  due_date          DATE,
  delivery_date     DATE,
  currency          VARCHAR(3) NOT NULL DEFAULT 'USD',
  supplier_name     VARCHAR(255),
  supplier_email    VARCHAR(255),
  supplier_phone    VARCHAR(50),
  supplier_address_line_1 VARCHAR(255),
  supplier_address_line_2 VARCHAR(255),
  supplier_city     VARCHAR(100),
  supplier_state_or_region VARCHAR(100),
  supplier_postal_code VARCHAR(20),
  supplier_country_code VARCHAR(3),
  supplier_tax_id   VARCHAR(100),
  reference_number  VARCHAR(255),
  notes             TEXT,
  terms             TEXT,
  payment_instructions TEXT,
  subtotal          NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total         NUMERIC(18,6) NOT NULL DEFAULT 0,
  total             NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_due        NUMERIC(18,6) NOT NULL DEFAULT 0,
  is_finalized      BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at      TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  viewed_at         TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  cancelled_reason  TEXT,
  voided_at        TIMESTAMPTZ,
  void_reason       TEXT,
  public_token      VARCHAR(64) UNIQUE,
  public_token_expires_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID,
  updated_by        UUID,
  version           INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_purchase_order_number_business UNIQUE (business_id, purchase_order_number),
  CONSTRAINT chk_purchase_order_total CHECK (total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_business ON purchase_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_number ON purchase_orders(purchase_order_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(issue_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_due_date ON purchase_orders(due_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_public_token ON purchase_orders(public_token);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);

CREATE TABLE IF NOT EXISTS purchase_order_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type      VARCHAR(50) NOT NULL,
  actor_id        UUID,
  actor_type      VARCHAR(20),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_events_po ON purchase_order_events(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_events_type ON purchase_order_events(event_type);

-- Numbering config on business_settings for purchase orders
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS purchase_order_prefix VARCHAR(50) DEFAULT 'PO',
  ADD COLUMN IF NOT EXISTS purchase_order_padding SMALLINT DEFAULT 6,
  ADD COLUMN IF NOT EXISTS purchase_order_includes_year BOOLEAN DEFAULT TRUE;

-- Numbering config on business_settings for receipts
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS receipt_prefix VARCHAR(50) DEFAULT 'RCPT',
  ADD COLUMN IF NOT EXISTS receipt_padding SMALLINT DEFAULT 6,
  ADD COLUMN IF NOT EXISTS receipt_includes_year BOOLEAN DEFAULT TRUE;

-- Email log support for purchase order emails
ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE;
