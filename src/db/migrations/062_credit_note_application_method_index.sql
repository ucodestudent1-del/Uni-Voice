-- 062_credit_note_application_method_index.sql
-- Adds a GIN index on credit_note_applications.metadata->'method'
-- to support fast filtering by application method (invoice_offset, balance_credit, refund).

CREATE INDEX IF NOT EXISTS idx_credit_note_applications_method
  ON credit_note_applications USING GIN ((metadata->'method'))
  WHERE metadata ? 'method';
