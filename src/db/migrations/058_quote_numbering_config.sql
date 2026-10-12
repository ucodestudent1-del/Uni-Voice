-- 058_quote_numbering_config.sql
-- Adds quote numbering configuration columns to business_settings,
-- mirroring the invoice numbering config added in migration 056.

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS quote_number_prefix VARCHAR(50) DEFAULT 'QOT',
  ADD COLUMN IF NOT EXISTS quote_number_padding SMALLINT DEFAULT 6,
  ADD COLUMN IF NOT EXISTS quote_includes_year BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN business_settings.quote_number_prefix IS 'Prefix for generated quote numbers (default: QOT)';
COMMENT ON COLUMN business_settings.quote_number_padding IS 'Zero-padding width for quote sequence numbers (default: 6)';
COMMENT ON COLUMN business_settings.quote_includes_year IS 'Whether to include the year in the quote number (default: true)';

-- Also adds quote_default_payment_terms and quote_reminder_days
-- for automated expiry and reminder notifications
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS quote_reminder_days INTEGER DEFAULT 7;

COMMENT ON COLUMN business_settings.quote_reminder_days IS 'Days before expiry to send reminder notification (default: 7)';
