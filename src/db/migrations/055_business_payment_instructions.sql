-- 055_business_payment_instructions.sql
-- Adds payment instruction fields to business_settings for template rendering.

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS default_bank_details TEXT,
  ADD COLUMN IF NOT EXISTS default_payment_portal_url TEXT,
  ADD COLUMN IF NOT EXISTS tax_exemption TEXT,
  ADD COLUMN IF NOT EXISTS delivery_details TEXT,
  ADD COLUMN IF NOT EXISTS warranty_info TEXT,
  ADD COLUMN IF NOT EXISTS return_policy TEXT,
  ADD COLUMN IF NOT EXISTS late_fee_period_days INTEGER DEFAULT 10;

CREATE INDEX IF NOT EXISTS idx_business_settings_payment_fields
  ON business_settings (business_id)
  WHERE default_bank_details IS NOT NULL
     OR default_payment_portal_url IS NOT NULL;
