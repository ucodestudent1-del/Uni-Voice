-- ============================================================================
-- Add missing JSONB reminder settings columns to business_settings
-- ============================================================================

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS reminders_before_due JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reminders_after_due JSONB DEFAULT '[]'::jsonb;

-- Ensure existing rows have default empty arrays
UPDATE business_settings
SET reminders_before_due = COALESCE(reminders_before_due, '[]'::jsonb),
    reminders_after_due = COALESCE(reminders_after_due, '[]'::jsonb)
WHERE reminders_before_due IS NULL OR reminders_after_due IS NULL;