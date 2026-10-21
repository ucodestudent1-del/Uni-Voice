-- 076_new_document_types.sql
-- Adds tables and numbering sequences for:
--   - delivery_note
--   - packing_slip
--   - pro_forma_invoice
--   - estimate

-- ============================================================================
-- Delivery Notes
-- ============================================================================
CREATE TYPE IF NOT EXISTS delivery_note_status AS ENUM (
  'draft', 'finalized', 'shipped', 'delivered', 'returned', 'cancelled', 'void'
);

CREATE TABLE IF NOT EXISTS delivery_note_number_sequences (
  business_id   UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix        VARCHAR(50) NOT NULL DEFAULT 'DN',
  next_number   BIGINT NOT NULL DEFAULT 1,
  padding       SMALLINT NOT NULL DEFAULT 6,
  includes_year BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_notes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  delivery_note_number VARCHAR(100),
  status              delivery_note_status NOT NULL DEFAULT 'draft',
  invoice_id          UUID REFERENCES invoices(id) ON DELETE SET NULL,
  purchase_order_id   UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
  issue_date          DATE,
  due_date            DATE,
  shipped_at          TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
  notes               TEXT,
  terms               TEXT,
  subtotal            NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  total               NUMERIC(18,6) NOT NULL DEFAULT 0,
  is_finalized        BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancelled_reason    TEXT,
  voided_at           TIMESTAMPTZ,
  void_reason         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  updated_by          UUID
);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_business ON delivery_notes(business_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_status ON delivery_notes(status);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_number ON delivery_notes(delivery_note_number);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_invoice ON delivery_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_po ON delivery_notes(purchase_order_id);

CREATE TABLE IF NOT EXISTS delivery_note_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_note_id UUID NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_delivery_note_items_note ON delivery_note_items(delivery_note_id);

-- ============================================================================
-- Packing Slips
-- ============================================================================
CREATE TYPE IF NOT EXISTS packing_slip_status AS ENUM (
  'draft', 'finalized', 'packed', 'shipped', 'delivered', 'returned', 'cancelled', 'void'
);

CREATE TABLE IF NOT EXISTS packing_slip_number_sequences (
  business_id   UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix        VARCHAR(50) NOT NULL DEFAULT 'PS',
  next_number   BIGINT NOT NULL DEFAULT 1,
  padding       SMALLINT NOT NULL DEFAULT 6,
  includes_year BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS packing_slips (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  packing_slip_number VARCHAR(100),
  status              packing_slip_status NOT NULL DEFAULT 'draft',
  purchase_order_id   UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  invoice_id          UUID REFERENCES invoices(id) ON DELETE SET NULL,
  supplier_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
  issue_date          DATE,
  due_date            DATE,
  shipped_at          TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
  notes               TEXT,
  terms               TEXT,
  subtotal            NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  total               NUMERIC(18,6) NOT NULL DEFAULT 0,
  is_finalized        BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancelled_reason    TEXT,
  voided_at           TIMESTAMPTZ,
  void_reason         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  updated_by          UUID
);

CREATE INDEX IF NOT EXISTS idx_packing_slips_business ON packing_slips(business_id);
CREATE INDEX IF NOT EXISTS idx_packing_slips_status ON packing_slips(status);
CREATE INDEX IF NOT EXISTS idx_packing_slips_number ON packing_slips(packing_slip_number);
CREATE INDEX IF NOT EXISTS idx_packing_slips_po ON packing_slips(purchase_order_id);

CREATE TABLE IF NOT EXISTS packing_slip_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  packing_slip_id  UUID NOT NULL REFERENCES packing_slips(id) ON DELETE CASCADE,
  description      VARCHAR(500) NOT NULL,
  quantity         NUMERIC(18,6) NOT NULL DEFAULT 1,
  unit             VARCHAR(50) NOT NULL DEFAULT 'each',
  unit_price       NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_rate         NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_name         VARCHAR(255),
  tax_amount       NUMERIC(18,6) NOT NULL DEFAULT 0,
  line_subtotal    NUMERIC(18,6) NOT NULL,
  line_total       NUMERIC(18,6) NOT NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_packing_slip_items_slip ON packing_slip_items(packing_slip_id);

-- ============================================================================
-- Pro Forma Invoices
-- ============================================================================
CREATE TYPE IF NOT EXISTS pro_forma_invoice_status AS ENUM (
  'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted', 'cancelled', 'void'
);

CREATE TABLE IF NOT EXISTS pro_forma_invoice_number_sequences (
  business_id   UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix        VARCHAR(50) NOT NULL DEFAULT 'PI',
  next_number   BIGINT NOT NULL DEFAULT 1,
  padding       SMALLINT NOT NULL DEFAULT 6,
  includes_year BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pro_forma_invoices (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  pro_forma_invoice_number VARCHAR(100),
  status                pro_forma_invoice_status NOT NULL DEFAULT 'draft',
  invoice_id            UUID REFERENCES invoices(id) ON DELETE SET NULL,
  customer_id           UUID REFERENCES customers(id) ON DELETE SET NULL,
  issue_date            DATE,
  due_date              DATE,
  expiry_date           DATE,
  valid_until           DATE,
  currency              VARCHAR(3) NOT NULL DEFAULT 'USD',
  po_number             VARCHAR(100),
  notes                 TEXT,
  terms                 TEXT,
  payment_instructions  TEXT,
  subtotal              NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_total        NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total             NUMERIC(18,6) NOT NULL DEFAULT 0,
  total                 NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_paid           NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_due            NUMERIC(18,6) NOT NULL DEFAULT 0,
  is_finalized          BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at          TIMESTAMPTZ,
  sent_at               TIMESTAMPTZ,
  viewed_at             TIMESTAMPTZ,
  accepted_at           TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancelled_reason      TEXT,
  voided_at             TIMESTAMPTZ,
  void_reason           TEXT,
  public_token          VARCHAR(64) UNIQUE,
  public_token_expires_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID,
  updated_by            UUID
);

CREATE INDEX IF NOT EXISTS idx_pro_forma_business ON pro_forma_invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_pro_forma_status ON pro_forma_invoices(status);
CREATE INDEX IF NOT EXISTS idx_pro_forma_number ON pro_forma_invoices(pro_forma_invoice_number);
CREATE INDEX IF NOT EXISTS idx_pro_forma_invoice ON pro_forma_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pro_forma_token ON pro_forma_invoices(public_token);

CREATE TABLE IF NOT EXISTS pro_forma_invoice_items (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pro_forma_invoice_id UUID NOT NULL REFERENCES pro_forma_invoices(id) ON DELETE CASCADE,
  description          VARCHAR(500) NOT NULL,
  quantity             NUMERIC(18,6) NOT NULL DEFAULT 1,
  unit                 VARCHAR(50) NOT NULL DEFAULT 'each',
  unit_price           NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_rate             NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_name             VARCHAR(255),
  tax_amount           NUMERIC(18,6) NOT NULL DEFAULT 0,
  line_subtotal        NUMERIC(18,6) NOT NULL,
  line_total           NUMERIC(18,6) NOT NULL,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_forma_items_inv ON pro_forma_invoice_items(pro_forma_invoice_id);

-- ============================================================================
-- Estimates
-- ============================================================================
CREATE TYPE IF NOT EXISTS estimate_status AS ENUM (
  'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted', 'cancelled'
);

CREATE TABLE IF NOT EXISTS estimate_number_sequences (
  business_id   UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix        VARCHAR(50) NOT NULL DEFAULT 'EST',
  next_number   BIGINT NOT NULL DEFAULT 1,
  padding       SMALLINT NOT NULL DEFAULT 6,
  includes_year BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estimates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  estimate_number VARCHAR(100),
  status          estimate_status NOT NULL DEFAULT 'draft',
  quote_id        UUID REFERENCES quotes(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  issue_date      DATE,
  expiry_date     DATE,
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  scope_of_work   TEXT,
  notes           TEXT,
  terms           TEXT,
  payment_terms   TEXT,
  subtotal        NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_total  NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(18,6) NOT NULL DEFAULT 0,
  total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  is_finalized    BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  updated_by      UUID
);

CREATE INDEX IF NOT EXISTS idx_estimates_business ON estimates(business_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_number ON estimates(estimate_number);
CREATE INDEX IF NOT EXISTS idx_estimates_quote ON estimates(quote_id);

CREATE TABLE IF NOT EXISTS estimate_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  quantity    NUMERIC(18,6) NOT NULL DEFAULT 1,
  unit        VARCHAR(50) NOT NULL DEFAULT 'each',
  unit_price  NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_rate    NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_name    VARCHAR(255),
  tax_amount  NUMERIC(18,6) NOT NULL DEFAULT 0,
  line_subtotal NUMERIC(18,6) NOT NULL,
  line_total  NUMERIC(18,6) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate ON estimate_items(estimate_id);

-- ============================================================================
-- business_settings columns for all new document types
-- Note: Split into individual ALTER TABLE statements for maximum compatibility
-- ============================================================================
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS delivery_note_prefix VARCHAR(50) DEFAULT 'DN';

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS delivery_note_padding SMALLINT DEFAULT 6;

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS delivery_note_includes_year BOOLEAN DEFAULT TRUE;

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS packing_slip_prefix VARCHAR(50) DEFAULT 'PS';

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS packing_slip_padding SMALLINT DEFAULT 6;

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS packing_slip_includes_year BOOLEAN DEFAULT TRUE;

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS pro_forma_invoice_prefix VARCHAR(50) DEFAULT 'PI';

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS pro_forma_invoice_padding SMALLINT DEFAULT 6;

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS pro_forma_invoice_includes_year BOOLEAN DEFAULT TRUE;

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS estimate_prefix VARCHAR(50) DEFAULT 'EST';

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS estimate_padding SMALLINT DEFAULT 6;

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS estimate_includes_year BOOLEAN DEFAULT TRUE;

-- ============================================================================
-- Update document_snapshots CHECK constraint to include new types
-- Note: Split DROP CONSTRAINT and ADD CONSTRAINT into separate statements
-- ============================================================================
ALTER TABLE document_snapshots
  DROP CONSTRAINT IF EXISTS chk_document_snapshots_type;

ALTER TABLE document_snapshots
  ADD CONSTRAINT chk_document_snapshots_type CHECK (
    document_type IN ('invoice', 'quote', 'credit_note', 'debit_note',
                      'payment_voucher', 'receipt', 'purchase_order',
                      'recurring_invoice', 'delivery_note', 'packing_slip',
                      'pro_forma_invoice', 'estimate')
  );

-- ============================================================================
-- Update document_artifacts CHECK constraint to include new types
-- Note: Split DROP CONSTRAINT and ADD CONSTRAINT into separate statements
-- ============================================================================
ALTER TABLE document_artifacts
  DROP CONSTRAINT IF EXISTS chk_document_artifacts_type;

ALTER TABLE document_artifacts
  ADD CONSTRAINT chk_document_artifacts_type CHECK (
    document_type IN ('invoice', 'credit_note', 'debit_note', 'payment_voucher',
                      'quote', 'receipt', 'purchase_order',
                      'recurring_invoice', 'delivery_note', 'packing_slip',
                      'pro_forma_invoice', 'estimate')
  );

-- ============================================================================
-- Add email_log FK columns for new document types
-- Note: Split into individual ALTER TABLE statements for maximum compatibility
-- ============================================================================
ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS delivery_note_id UUID REFERENCES delivery_notes(id) ON DELETE CASCADE;

ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS packing_slip_id UUID REFERENCES packing_slips(id) ON DELETE CASCADE;

ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS pro_forma_invoice_id UUID REFERENCES pro_forma_invoices(id) ON DELETE CASCADE;

ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE;
