-- 068_document_artifacts.sql
-- Stores generated file artifacts (PDF, DOCX, HTML, TXT, CSV, etc.) for any document type.
-- Each artifact links back to a business + document (invoice, quote, credit_note, debit_note,
-- payment_voucher, receipt, purchase_order) and stores a SHA-256 hash for immutability verification.

CREATE TABLE IF NOT EXISTS document_artifacts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  document_id     UUID NOT NULL,
  document_type   VARCHAR(50) NOT NULL,
  output_format   VARCHAR(20) NOT NULL,
  file_path       TEXT NOT NULL,
  file_url        TEXT,
  sha256          VARCHAR(64) NOT NULL,
  file_size_bytes BIGINT,
  generated_by    VARCHAR(50),
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_document_artifacts_format CHECK (
    output_format IN ('pdf', 'html', 'docx', 'txt', 'csv', 'email-html', 'png', 'svg')
  ),
  CONSTRAINT chk_document_artifacts_type CHECK (
    document_type IN ('invoice', 'credit_note', 'debit_note', 'payment_voucher',
                      'quote', 'receipt', 'purchase_order')
  )
);

CREATE INDEX IF NOT EXISTS idx_document_artifacts_business ON document_artifacts(business_id);
CREATE INDEX IF NOT EXISTS idx_document_artifacts_document ON document_artifacts(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_document_artifacts_format ON document_artifacts(output_format);
CREATE INDEX IF NOT EXISTS idx_document_artifacts_expires ON document_artifacts(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_artifacts_sha256 ON document_artifacts(sha256);
