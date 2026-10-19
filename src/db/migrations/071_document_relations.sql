-- ============================================================================
-- Document Relations: tracks relationships between different document types
-- e.g., Credit Note → references → Invoice
--       Quote → converts → Invoice
--       Debit Note → references → Invoice
--       Receipt → references → Invoice
--       Recurring Invoice Template → generates → Invoice
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_relations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source_doc_type VARCHAR(50) NOT NULL,
  source_doc_id   UUID NOT NULL,
  target_doc_type VARCHAR(50) NOT NULL,
  target_doc_id   UUID NOT NULL,
  relation_type   VARCHAR(50) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,

  CONSTRAINT uq_document_relation UNIQUE (business_id, source_doc_type, source_doc_id, target_doc_type, target_doc_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_document_relations_source
  ON document_relations (business_id, source_doc_type, source_doc_id);

CREATE INDEX IF NOT EXISTS idx_document_relations_target
  ON document_relations (business_id, target_doc_type, target_doc_id);

CREATE INDEX IF NOT EXISTS idx_document_relations_relation
  ON document_relations (business_id, relation_type);
