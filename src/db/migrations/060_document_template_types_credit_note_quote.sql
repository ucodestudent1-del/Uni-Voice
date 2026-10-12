-- 060_document_template_types_credit_note_quote.sql
-- Extends document_templates.document_type check constraint to support
-- credit_note and quote document types, aligning the DB constraint with
-- the DocumentTypeSchema (which now includes invoice, recurring_invoice,
-- credit_note, quote).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_document_templates_document_type'
    AND conrelid = 'document_templates'::regclass
  ) THEN
    ALTER TABLE document_templates
      DROP CONSTRAINT IF EXISTS chk_document_templates_document_type;

    ALTER TABLE document_templates
      ADD CONSTRAINT chk_document_templates_document_type
      CHECK (document_type IN ('invoice', 'recurring_invoice', 'credit_note', 'quote'));
  END IF;
END$$;

-- Migrate any existing templates using the old constraint that referenced
-- document_type for quote templates (if any were stored before the constraint
-- was broadened) — these now pass the new constraint.
COMMENT ON COLUMN document_templates.document_type IS 'invoice | recurring_invoice | credit_note | quote';
