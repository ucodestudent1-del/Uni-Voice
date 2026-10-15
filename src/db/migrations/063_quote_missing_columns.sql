ALTER TABLE IF EXISTS quote_items
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) NOT NULL DEFAULT 'fixed';

COMMENT ON COLUMN quote_items.discount_type IS 'Discount type for line item: fixed or percentage';

ALTER TABLE IF EXISTS quotes
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

COMMENT ON COLUMN quotes.cancelled_reason IS 'Reason for cancellation (mirrors invoices.cancelled_reason)';

ALTER TABLE IF EXISTS quote_events
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_quote_events_business ON quote_events(business_id);
