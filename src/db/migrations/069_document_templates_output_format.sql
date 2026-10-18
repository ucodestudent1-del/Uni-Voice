-- 069_document_templates_output_format.sql
-- Extends document_templates to support all document types and per-template output format configuration.

DO $$
BEGIN
  -- Extend the document_type check constraint to include debit_note and payment_voucher
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_document_templates_document_type'
    AND conrelid = 'document_templates'::regclass
  ) THEN
    ALTER TABLE document_templates
      DROP CONSTRAINT IF EXISTS chk_document_templates_document_type;

    ALTER TABLE document_templates
      ADD CONSTRAINT chk_document_templates_document_type
      CHECK (document_type IN (
        'invoice', 'recurring_invoice', 'credit_note',
        'debit_note', 'payment_voucher',
        'quote', 'receipt', 'purchase_order'
      ));
  END IF;

  -- Add output_format column: specifies which formats this template supports for rendering.
  -- Default is pdf only; businesses can extend to html, docx, etc.
  ALTER TABLE document_templates
    ADD COLUMN IF NOT EXISTS output_format VARCHAR(20) NOT NULL DEFAULT 'pdf';

  -- Add output_formats array column for multiple supported formats
  ALTER TABLE document_templates
    ADD COLUMN IF NOT EXISTS output_formats TEXT[] DEFAULT ARRAY['pdf'];

  ALTER TABLE document_templates
    ADD COLUMN IF NOT EXISTS default_output_format VARCHAR(20) DEFAULT 'pdf';
END$$;

COMMENT ON COLUMN document_templates.output_format IS 'primary output format (pdf, html, docx, txt, csv, email-html, png, svg)';
COMMENT ON COLUMN document_templates.output_formats IS 'all supported output formats for this template';
COMMENT ON COLUMN document_templates.default_output_format IS 'default format when multiple are supported';
