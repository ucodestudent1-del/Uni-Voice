-- 037_speed_optimization_tables.sql
-- Speed optimization tables for predictive UX features

-- Add industry column to businesses for progressive autofill presets
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS industry VARCHAR(50);

-- Add tax_id to customers for autofill (already exists in businesses)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS default_currency VARCHAR(3);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS payment_terms INTEGER;

-- ----------------------------------------------------------------------------
-- Customer Invoice Patterns (cached aggregations for Progressive Autofill + Frequent Items)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_invoice_patterns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  last_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  last_invoice_items JSONB, -- [{description, quantity, unitPrice, unit, taxRate, productId, catalogName}]
  last_invoice_total NUMERIC(18,6) DEFAULT 0,
  last_invoice_currency VARCHAR(3) DEFAULT 'USD',
  last_invoice_terms TEXT,
  last_invoice_template_id UUID,
  last_invoice_sent_at TIMESTAMPTZ,
  frequently_invoiced JSONB, -- [{productId, name, unitPrice, unit, taxRate, frequencyScore}]
  avg_invoice_total NUMERIC(18,6) DEFAULT 0,
  invoice_count INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_patterns_business ON customer_invoice_patterns(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_patterns_customer ON customer_invoice_patterns(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_patterns_customer ON customer_invoice_patterns(business_id, customer_id);

-- ----------------------------------------------------------------------------
-- User Interaction Log (for Adaptive UI field prioritization)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_interaction_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL,
  business_id     UUID NOT NULL REFERENCES businesses(id),
  action_type     VARCHAR(50) NOT NULL, -- 'field_edit', 'invoice_create', 'command_bar_use', 'item_added', 'save', 'finalize', 'send'
  target_field    VARCHAR(100), -- e.g., 'paymentInstructions', 'poNumber', 'customerId'
  invoice_id      UUID REFERENCES invoices(id) ON DELETE SET NULL,
  duration_ms     INTEGER,
  value_from      TEXT,
  value_to        TEXT,
  session_id      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interaction_user ON user_interaction_log(user_id, action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_field ON user_interaction_log(business_id, target_field, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_session ON user_interaction_log(session_id, created_at);

-- ----------------------------------------------------------------------------
-- Speed Metrics Aggregations (for reporting and success metric tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_speed_metrics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  invoice_id      UUID REFERENCES invoices(id) ON DELETE SET NULL,
  session_id      UUID,
  creation_seconds NUMERIC(8,3), -- time from new invoice to finalize/send
  customer_selected_via VARCHAR(20), -- 'search', 'chip', 'autofill', 'recent', 'new'
  used_last_invoice BOOLEAN DEFAULT FALSE,
  command_bar_items INTEGER DEFAULT 0,
  catalog_chip_items INTEGER DEFAULT 0,
  manual_items INTEGER DEFAULT 0,
  items_count INTEGER DEFAULT 0,
  is_returning_customer BOOLEAN DEFAULT FALSE,
  is_mobile BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speed_business ON invoice_speed_metrics(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_speed_user ON invoice_speed_metrics(user_id, created_at DESC);
