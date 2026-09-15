-- ============================================================================
-- Phase 6 (part 2): Invoice template lifecycle states and published revision
-- tracking. Extends document_templates with lifecycle enum, published_at,
-- archived_at columns, and a published_revision column capturing the revision
-- that was active at publish time. Also adds the invoice_template_migrations
-- table for schema/version migration history.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enum type for invoice template lifecycle.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_template_lifecycle') THEN
    CREATE TYPE invoice_template_lifecycle AS ENUM ('draft', 'published', 'archived');
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- Extend document_templates with lifecycle columns.
-- ----------------------------------------------------------------------------
ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS lifecycle invoice_template_lifecycle NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_revision BIGINT,
  ADD COLUMN IF NOT EXISTS lifecycle_updated_by UUID,
  ADD COLUMN IF NOT EXISTS lifecycle_updated_at TIMESTAMPTZ;

-- Set existing defaults to published (they were active templates before lifecycle).
UPDATE document_templates
  SET lifecycle = 'published',
      published_at = created_at,
      published_revision = revision
WHERE lifecycle = 'draft'
  AND is_active = TRUE
  AND published_at IS NULL;

-- ----------------------------------------------------------------------------
-- Index for fast lookup of templates by business + lifecycle state.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_document_templates_biz_lifecycle
  ON document_templates(business_id, lifecycle);

-- ----------------------------------------------------------------------------
-- Index for default templates scoped by lifecycle.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_document_templates_biz_default_lifecycle
  ON document_templates(business_id, is_default, lifecycle)
  WHERE lifecycle = 'published';

-- ----------------------------------------------------------------------------
-- Table: invoice_template_migrations
-- Tracks schema version migrations applied to templates, so we can
-- programmatically upgrade older template documents when the schema evolves.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_template_migrations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_id       UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  from_version      VARCHAR(20) NOT NULL,
  to_version        VARCHAR(20) NOT NULL,
  migrated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  migrated_by       UUID,
  migration_data    JSONB,
  CONSTRAINT uq_template_migration UNIQUE (template_id, from_version, to_version)
);

CREATE INDEX IF NOT EXISTS idx_invoice_template_migrations_template
  ON invoice_template_migrations(template_id);

-- ----------------------------------------------------------------------------
-- Table: invoice_template_permissions
-- Fine-grained permissions for template access beyond tenant isolation.
-- Records which user IDs have explicit view/edit permissions on a template.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_template_permissions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_id       UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL,
  permission        VARCHAR(50) NOT NULL CHECK (permission IN ('view', 'edit', 'publish', 'archive')),
  granted_by        UUID,
  granted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_template_user_permission UNIQUE (template_id, user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_invoice_template_permissions_template
  ON invoice_template_permissions(template_id);
CREATE INDEX IF NOT EXISTS idx_invoice_template_permissions_user
  ON invoice_template_permissions(user_id);

-- ----------------------------------------------------------------------------
-- Table: invoice_template_usage
-- Tracks how many times a template has been applied to invoices (analytics).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_template_usage (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_id       UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  invoice_id        UUID REFERENCES invoices(id) ON DELETE SET NULL,
  used_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_template_usage_template
  ON invoice_template_usage(template_id);
CREATE INDEX IF NOT EXISTS idx_invoice_template_usage_invoice
  ON invoice_template_usage(invoice_id);
