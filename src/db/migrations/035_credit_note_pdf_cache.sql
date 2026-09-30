-- 035_credit_note_pdf_cache.sql
-- PDF cache columns for credit notes

ALTER TABLE credit_notes
  ADD COLUMN IF NOT EXISTS pdf_cache bytea,
  ADD COLUMN IF NOT EXISTS pdf_cache_hash text,
  ADD COLUMN IF NOT EXISTS pdf_cached_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_credit_notes_reference_invoice ON credit_notes (reference_invoice_id);
