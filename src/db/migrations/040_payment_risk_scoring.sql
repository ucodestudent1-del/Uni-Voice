-- 040_payment_risk_scoring.sql
-- Payment Risk Scoring columns on invoices + payment behavior tracking

-- Store pre-computed risk score for each finalized invoice (0-100)
-- 0 = lowest risk (paid quickly historically), 100 = highest risk
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_risk_score INTEGER,
  ADD COLUMN IF NOT EXISTS payment_risk_factors JSONB,
  ADD COLUMN IF NOT EXISTS payment_risk_scored_at TIMESTAMPTZ;

-- Track per-customer payment behavior for model features
CREATE TABLE IF NOT EXISTS customer_payment_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  avg_payment_days     NUMERIC(8,2) DEFAULT 0,
  median_payment_days  NUMERIC(8,2) DEFAULT 0,
  payment_std_dev      NUMERIC(8,2) DEFAULT 0,
  collection_rate_pct  NUMERIC(5,2) DEFAULT 0,
  dispute_rate_pct     NUMERIC(5,2) DEFAULT 0,
  preferred_period     VARCHAR(10), -- 'morning' | 'afternoon' | 'evening' | 'any'
  invoice_count        INTEGER DEFAULT 0,
  paid_invoice_count   INTEGER DEFAULT 0,
  last_paid_at         TIMESTAMPTZ,
  model_version        VARCHAR(20) DEFAULT '1.0.0',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_payment_profiles_business ON customer_payment_profiles(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_profiles_customer ON customer_payment_profiles(customer_id);

-- Store computed risk scores for batch retrieval (dashboard, aging report)
CREATE INDEX IF NOT EXISTS idx_invoices_risk_score ON invoices(business_id, payment_risk_score DESC) WHERE payment_risk_score IS NOT NULL;
