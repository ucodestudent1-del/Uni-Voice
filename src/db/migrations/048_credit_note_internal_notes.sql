-- 048_credit_note_internal_notes.sql
-- Adds internal_notes field to credit_notes.
-- Internal notes are visible only to the business/team, not to customers.

ALTER TABLE credit_notes
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;
