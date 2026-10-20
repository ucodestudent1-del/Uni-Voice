-- 074_document_conversions.sql
-- Tracks document-to-document conversions for audit and traceability.

CREATE TABLE IF NOT EXISTS document_conversions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source_document_type VARCHAR(30) NOT NULL,
  source_document_id   UUID NOT NULL,
  target_document_type VARCHAR(30) NOT NULL,
  target_document_id   UUID NOT NULL,
  conversion_data     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_conversions_business ON document_conversions(business_id);
CREATE INDEX IF NOT EXISTS idx_document_conversions_source ON document_conversions(source_document_id);
CREATE INDEX IF NOT EXISTS idx_document_conversions_target ON document_conversions(target_document_id);
CREATE INDEX IF NOT EXISTS idx_document_conversions_created_at ON document_conversions(created_at DESC);
