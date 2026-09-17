-- ============================================================================
-- Add document_type column to document_templates to support multi-document
-- template segmentation (invoice, quote, recurring_invoice).
-- All three document types share the same InvoiceTemplate entity and
-- InvoiceDocument model; document_type distinguishes which document kind
-- a template is designed for.
-- ============================================================================

ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) NOT NULL DEFAULT 'invoice';

-- Existing templates are assumed to be invoice templates (the original use case).
-- The DEFAULT above handles new rows; existing rows get 'invoice' via the
-- NOT NULL DEFAULT since ADD COLUMN ... NOT NULL with a default backfills
-- existing rows in PostgreSQL.

COMMENT ON COLUMN document_templates.document_type IS 'invoice | quote | recurring_invoice';

-- Ensure only valid document types are stored.
-- Uses a DO block so we only add the constraint if it doesn't already exist
-- (supports re-running migrations safely).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_document_templates_document_type'
    AND conrelid = 'document_templates'::regclass
  ) THEN
    ALTER TABLE document_templates
      ADD CONSTRAINT chk_document_templates_document_type
      CHECK (document_type IN ('invoice', 'quote', 'recurring_invoice'));
  END IF;
END$$;

-- Index for filtering templates by document type per business.
CREATE INDEX IF NOT EXISTS idx_document_templates_biz_doctype
  ON document_templates(business_id, document_type);
