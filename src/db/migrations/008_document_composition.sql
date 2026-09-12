-- ============================================================================
-- Phase 6: Versioned, tenant-scoped structured document/template model
-- Consolidated: optimistic concurrency, snapshot revisions, template
-- revisions, structured document tables, and snapshot rendering metadata.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Businesses: row-level version counter for optimistic concurrency control.
-- ----------------------------------------------------------------------------
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- ----------------------------------------------------------------------------
-- Templates: track schema version and monotonically increasing revision.
-- ----------------------------------------------------------------------------
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS schema_version VARCHAR(20) NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- ----------------------------------------------------------------------------
-- Invoices: row-level version counter for optimistic concurrency on draft
-- updates, plus captured template revision metadata for finalization.
-- ----------------------------------------------------------------------------
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS template_schema_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS template_revision BIGINT;

-- ----------------------------------------------------------------------------
-- Snapshots: support multiple revisions and capture historical template
-- metadata and rendered HTML for reproducible PDF/email/public views.
-- ----------------------------------------------------------------------------
ALTER TABLE invoice_snapshots
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS template_id UUID,
  ADD COLUMN IF NOT EXISTS template_schema_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS template_revision INTEGER,
  ADD COLUMN IF NOT EXISTS rendered_html TEXT;

ALTER TABLE invoice_snapshots
  DROP CONSTRAINT IF EXISTS uq_snapshot_invoice;

CREATE UNIQUE INDEX IF NOT EXISTS uq_snapshot_latest
  ON invoice_snapshots (invoice_id, revision);

-- ----------------------------------------------------------------------------
-- Document template schema versions (registry of supported schemas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_template_schema_versions (
  version         VARCHAR(20) PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  schema          JSONB NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Document templates (structured, versioned, tenant-scoped)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_templates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  schema_version    VARCHAR(20) NOT NULL DEFAULT '1.0',
  revision          BIGINT NOT NULL DEFAULT 1,
  document          JSONB NOT NULL,
  html_template     TEXT,
  config            JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default        BOOLEAN NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID,
  updated_by        UUID,
  CONSTRAINT uq_document_template_business_name UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_document_templates_business ON document_templates(business_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_default ON document_templates(business_id, is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_document_templates_active ON document_templates(business_id, is_active);

CREATE TABLE IF NOT EXISTS document_template_revisions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id       UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  revision          BIGINT NOT NULL,
  schema_version    VARCHAR(20) NOT NULL,
  document          JSONB NOT NULL,
  html_template     TEXT,
  config            JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary    VARCHAR(500),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID,
  CONSTRAINT uq_template_revision UNIQUE (template_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_document_template_revisions_template ON document_template_revisions(template_id, revision DESC);

-- Seed the initial schema version
INSERT INTO document_template_schema_versions (version, name, description, schema, is_active)
VALUES (
  '1.0',
  'Standard Invoice Document',
  'Default structured document schema for invoices. Fields: business, customer, lineItems, fees, totals, metadata.',
  '{
     "type": "object",
     "required": ["business", "lineItems", "totals", "metadata"],
     "properties": {
       "business": {
         "type": "object",
         "required": ["id", "name"],
         "properties": {
           "id": {"type": "string"},
           "name": {"type": "string"},
           "legalName": {"type": ["string", "null"]},
           "email": {"type": ["string", "null"]},
           "phone": {"type": ["string", "null"]},
           "website": {"type": ["string", "null"]},
           "taxId": {"type": ["string", "null"]},
           "address": {"type": "object"},
           "countryCode": {"type": "string"},
           "defaultCurrency": {"type": "string"},
           "logoUrl": {"type": ["string", "null"]}
         }
       },
       "customer": {"type": ["object", "null"]},
       "lineItems": {
         "type": "array",
         "items": {
           "type": "object",
           "required": ["description", "quantity", "unitPrice", "taxRate"],
           "properties": {
             "description": {"type": "string"},
             "quantity": {"type": "number"},
             "unit": {"type": "string"},
             "unitPrice": {"type": "number"},
             "discount": {"type": "number"},
             "discountType": {"type": "string", "enum": ["fixed", "percentage"]},
             "taxRate": {"type": "number"},
             "taxAmount": {"type": "number"},
             "lineSubtotal": {"type": "number"},
             "lineTotal": {"type": "number"},
             "isTaxInclusive": {"type": "boolean"}
           }
         }
       },
       "fees": {
         "type": "array",
         "items": {
           "type": "object",
           "required": ["description", "amount"],
           "properties": {
             "description": {"type": "string"},
             "amount": {"type": "number"},
             "taxRate": {"type": "number"},
             "taxAmount": {"type": "number"}
           }
         }
       },
       "totals": {
         "type": "object",
         "required": ["subtotal", "taxTotal", "total"],
         "properties": {
           "subtotal": {"type": "number"},
           "discountTotal": {"type": "number"},
           "taxTotal": {"type": "number"},
           "feeTotal": {"type": "number"},
           "total": {"type": "number"},
           "amountPaid": {"type": "number"},
           "amountDue": {"type": "number"}
         }
       },
       "metadata": {
         "type": "object",
         "properties": {
           "invoiceId": {"type": "string"},
           "invoiceNumber": {"type": ["string", "null"]},
           "status": {"type": "string"},
           "issueDate": {"type": ["string", "null"]},
           "dueDate": {"type": ["string", "null"]},
           "currency": {"type": "string"},
           "notes": {"type": ["string", "null"]},
           "terms": {"type": ["string", "null"]},
           "paymentInstructions": {"type": ["string", "null"]},
           "language": {"type": "string"}
         }
       }
     }
   }'::jsonb,
  TRUE
)
ON CONFLICT (version) DO NOTHING;
