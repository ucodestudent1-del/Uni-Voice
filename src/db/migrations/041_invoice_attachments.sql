-- ============================================================================
-- Invoice attachments (job photos, documents) persisted with the invoice.
--
-- Attachments are part of the mutable draft state: they can only be
-- modified while the invoice is a draft (is_finalized = FALSE). Once
-- finalized, the attachment set is immutable and is rendered on the
-- customer-facing public invoice view and captured in the invoice
-- snapshot for reproduction.
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_attachments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  category    VARCHAR(20) NOT NULL CHECK (category IN ('attachment', 'before', 'after')),
  name        VARCHAR(255) NOT NULL,
  size        BIGINT NOT NULL DEFAULT 0,
  mime_type   VARCHAR(100),
  data_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_attachments_invoice ON invoice_attachments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_attachments_business_invoice ON invoice_attachments(business_id, invoice_id);

-- Audit events for attachment changes and SMS notifications.
ALTER TYPE invoice_event_type ADD VALUE IF NOT EXISTS 'attachments_updated';
ALTER TYPE invoice_event_type ADD VALUE IF NOT EXISTS 'sms_sent';
