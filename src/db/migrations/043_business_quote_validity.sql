-- 043_business_quote_validity.sql
-- Adds a default quote validity period to the businesses table.
-- When a quote is created without an explicit expiry_date, the backend
-- will auto-calculate it from issue_date + default_quote_validity_days.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS default_quote_validity_days INTEGER NOT NULL DEFAULT 30;

COMMENT ON COLUMN businesses.default_quote_validity_days IS 'Default number of days a quote remains valid after issue date';

-- Index to support the expireQuotes background job (find sent quotes past expiry)
CREATE INDEX IF NOT EXISTS idx_quotes_expiry_status
  ON quotes(business_id, expiry_date, status)
  WHERE expiry_date IS NOT NULL
    AND status = 'sent';
