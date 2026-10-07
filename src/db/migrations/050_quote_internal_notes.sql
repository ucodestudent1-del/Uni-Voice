-- 050_quote_internal_notes.sql
-- Adds internal_notes field to quotes.
-- Internal notes are visible only to the business/team, not to customers.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;
