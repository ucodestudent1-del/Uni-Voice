-- ============================================================================
-- Document Presets: pre-filled creation templates for documents
-- These are NOT PDF/email layout templates — they store form defaults
-- (line items, terms, tax rates, payment terms) for quick document creation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_presets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  document_type   VARCHAR(50) NOT NULL DEFAULT 'invoice',
  data            JSONB NOT NULL,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID,
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_document_presets_business_name
  ON document_presets (business_id, name);

CREATE INDEX IF NOT EXISTS idx_document_presets_business
  ON document_presets (business_id);

CREATE INDEX IF NOT EXISTS idx_document_presets_business_type
  ON document_presets (business_id, document_type);

CREATE INDEX IF NOT EXISTS idx_document_presets_default
  ON document_presets (business_id, is_default)
  WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_document_presets_active
  ON document_presets (business_id, is_active)
  WHERE is_active = TRUE;
