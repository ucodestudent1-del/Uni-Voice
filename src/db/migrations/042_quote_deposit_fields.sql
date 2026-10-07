-- 042_quote_deposit_fields.sql
-- Adds deposit tracking fields to the quotes table, mirroring the invoice
-- deposit columns already used by the public invoice payment flow.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS deposit_type VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS deposit_value NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_due_date DATE,
  ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN quotes.deposit_type IS 'none | percentage | fixed';
COMMENT ON COLUMN quotes.deposit_value IS 'percentage: 0-100; fixed: currency amount';

-- Indexes for deposit-based filtering (e.g. "show quotes awaiting deposit")
CREATE INDEX IF NOT EXISTS idx_quotes_deposit_paid ON quotes(business_id, deposit_paid)
  WHERE deposit_paid = FALSE AND status = 'sent';

-- ----------------------------------------------------------------------------
-- Quote deposit payments (idempotent record of deposit payments on quotes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quote_deposit_payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id         UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount           NUMERIC(18,6) NOT NULL,
  provider         VARCHAR(50) NOT NULL DEFAULT 'stub',
  idempotency_key  VARCHAR(255) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_deposits_quote ON quote_deposit_payments(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_deposits_business ON quote_deposit_payments(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_deposits_idempotency ON quote_deposit_payments(idempotency_key, quote_id);

-- ----------------------------------------------------------------------------
-- Quote view log (tracks customer views of public quote links)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quote_view_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id         UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  viewed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_views_quote ON quote_view_log(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_views_business ON quote_view_log(business_id, viewed_at DESC);
