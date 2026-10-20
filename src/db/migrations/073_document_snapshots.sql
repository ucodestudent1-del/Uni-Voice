-- 073_document_snapshots.sql
-- Creates a generalized document_snapshots table for immutable document snapshots.
-- This generalizes the invoice_snapshots and credit_note_snapshots tables into a
-- single table that supports all document types.

CREATE TABLE IF NOT EXISTS document_snapshots (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_type       VARCHAR(50) NOT NULL,
  document_id         UUID NOT NULL,
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  snapshot            JSONB NOT NULL,                  -- Full document snapshot (business, customer, items, totals, etc.)
  snapshot_hash       VARCHAR(64) NOT NULL,            -- SHA-256 of JSON payload
  revision            INTEGER NOT NULL DEFAULT 1,
  template_id         UUID,
  template_schema_version VARCHAR(20),
  template_revision   INTEGER,
  rendered_html       TEXT,                            -- Historical rendered HTML for deterministic PDF
  pdf_stored          BOOLEAN NOT NULL DEFAULT FALSE,
  pdf_hash            VARCHAR(64),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  CONSTRAINT chk_document_snapshots_type CHECK (
    document_type IN ('invoice', 'quote', 'credit_note', 'debit_note',
                      'payment_voucher', 'receipt', 'purchase_order')
  ),
  CONSTRAINT uq_document_snapshot UNIQUE (document_type, document_id)
);

CREATE INDEX IF NOT EXISTS idx_document_snapshots_business ON document_snapshots(business_id);
CREATE INDEX IF NOT EXISTS idx_document_snapshots_document ON document_snapshots(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_document_snapshots_hash ON document_snapshots(snapshot_hash);
CREATE INDEX IF NOT EXISTS idx_document_snapshots_created ON document_snapshots(created_at);

-- Add a note about the relationship to existing snapshot tables
COMMENT ON TABLE document_snapshots IS 'Generalized immutable document snapshots for all document types. Replaces invoice_snapshots and credit_note_snapshots.';
