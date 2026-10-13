-- ============================================================================
-- Phase 6: Invoice Generator Module Replacement
-- New tables for rule-based tax, discounts, templates, and branding
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tax Rules — rule-based tax configuration (supersedes business_tax_rates)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(50),
  rate            NUMERIC(5,4) NOT NULL,
  type            VARCHAR(20) NOT NULL DEFAULT 'percentage',
  country_code    VARCHAR(3),
  region          VARCHAR(100),
  is_compound     BOOLEAN NOT NULL DEFAULT FALSE,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_tax_rate_nonneg CHECK (rate >= 0),
  CONSTRAINT uq_tax_rule_business_name UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tax_rules_business ON tax_rules(business_id);
CREATE INDEX IF NOT EXISTS idx_tax_rules_country ON tax_rules(country_code);
CREATE INDEX IF NOT EXISTS idx_tax_rules_enabled ON tax_rules(enabled) WHERE enabled = TRUE;

-- ----------------------------------------------------------------------------
-- Tax Rule Conditions — conditions for rule-based tax application
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_rule_conditions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tax_rule_id     UUID NOT NULL REFERENCES tax_rules(id) ON DELETE CASCADE,
  field           VARCHAR(50) NOT NULL,
  operator        VARCHAR(20) NOT NULL,
  value           VARCHAR(500) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_condition_field CHECK (field IN ('customer_country', 'customer_state', 'product_category', 'item_description', 'currency', 'total_amount_min', 'total_amount_max'))
);

CREATE INDEX IF NOT EXISTS idx_tax_conditions_rule ON tax_rule_conditions(tax_rule_id);

-- ----------------------------------------------------------------------------
-- Discount Rules — rule-based discount configuration
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discount_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  type            VARCHAR(20) NOT NULL DEFAULT 'percentage',
  value           NUMERIC(18,6) NOT NULL,
  scope           VARCHAR(20) NOT NULL DEFAULT 'invoice',
  applies_to      VARCHAR(50),
  min_amount      NUMERIC(18,6),
  max_discount    NUMERIC(18,6),
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_discount_type CHECK (type IN ('fixed', 'percentage')),
  CONSTRAINT chk_discount_scope CHECK (scope IN ('invoice', 'line_item')),
  CONSTRAINT chk_discount_value_nonneg CHECK (value >= 0),
  CONSTRAINT uq_discount_rule_business_name UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_discount_rules_business ON discount_rules(business_id);
CREATE INDEX IF NOT EXISTS idx_discount_rules_active ON discount_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_discount_rules_active_time ON discount_rules(starts_at, ends_at) WHERE is_active = TRUE;

-- ----------------------------------------------------------------------------
-- Invoice Template Configs — customizable branding templates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_template_configs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  html_template   TEXT NOT NULL,
  schema_version  VARCHAR(50) NOT NULL DEFAULT '1.0',
  revision        INTEGER NOT NULL DEFAULT 1,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  updated_by      UUID,

  CONSTRAINT uq_template_config_business_name UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_template_configs_business ON invoice_template_configs(business_id);
CREATE INDEX IF NOT EXISTS idx_template_configs_default ON invoice_template_configs(business_id, is_default);
CREATE UNIQUE INDEX IF NOT EXISTS uq_template_config_business_default ON invoice_template_configs(business_id) WHERE is_default = TRUE;

-- ----------------------------------------------------------------------------
-- Business Branding — business-level branding settings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_branding (
  business_id         UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  primary_color       VARCHAR(7) NOT NULL DEFAULT '#2563eb',
  secondary_color     VARCHAR(7) NOT NULL DEFAULT '#64748b',
  font_family         VARCHAR(255),
  logo_url            TEXT,
  logo_width_px       INTEGER,
  logo_height_px      INTEGER,
  invoice_title       VARCHAR(255),
  invoice_subtitle    VARCHAR(255),
  footer_text         TEXT,
  show_logo           BOOLEAN NOT NULL DEFAULT TRUE,
  show_page_numbers   BOOLEAN NOT NULL DEFAULT TRUE,
  show_qr_code        BOOLEAN NOT NULL DEFAULT FALSE,
  pdf_page_size       VARCHAR(20) NOT NULL DEFAULT 'A4',
  pdf_margin_top_mm    NUMERIC(6,2) NOT NULL DEFAULT 24,
  pdf_margin_right_mm  NUMERIC(6,2) NOT NULL DEFAULT 24,
  pdf_margin_bottom_mm NUMERIC(6,2) NOT NULL DEFAULT 24,
  pdf_margin_left_mm   NUMERIC(6,2) NOT NULL DEFAULT 24,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_branding_business ON business_branding(business_id);

-- ----------------------------------------------------------------------------
-- Schema modifications to existing tables (additive only)
-- ----------------------------------------------------------------------------

-- Add tax rule integration to invoice_items
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS tax_rule_id UUID REFERENCES tax_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_rule_rate_snapshot NUMERIC(5,4);

CREATE INDEX IF NOT EXISTS idx_invoice_items_tax_rule ON invoice_items(tax_rule_id);

-- Add discount rule integration to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS discount_rule_id UUID REFERENCES discount_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_rule_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_invoices_discount_rule ON invoices(discount_rule_id);

-- Add template config reference to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS template_config_id UUID REFERENCES invoice_template_configs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_template_config ON invoices(template_config_id);

-- Add customer snapshot to invoices (denormalized full customer record for immutability)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS customer_snapshot JSONB;

-- ----------------------------------------------------------------------------
-- Data migration: copy existing business_tax_rates to tax_rules
-- ----------------------------------------------------------------------------

INSERT INTO tax_rules (business_id, name, code, rate, type, country_code, region, is_compound, is_default, enabled, created_at, updated_at)
SELECT
  t.business_id,
  t.name,
  t.code,
  t.rate,
  t.type,
  t.country_code,
  t.region,
  t.is_compound,
  false,
  t.enabled,
  NOW(),
  NOW()
FROM business_tax_rates t
WHERE NOT EXISTS (
  SELECT 1 FROM tax_rules tr
  WHERE tr.business_id = t.business_id AND tr.name = t.name
);

-- Set the first enabled tax rate per business as default
WITH first_tax_per_business AS (
  SELECT business_id, id
  FROM (
    SELECT business_id, id,
           ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY created_at) as rn
    FROM tax_rules
    WHERE is_default = FALSE
  ) ranked
  WHERE rn = 1
)
UPDATE tax_rules
SET is_default = TRUE
FROM first_tax_per_business
WHERE tax_rules.id = first_tax_per_business.id;

-- Copy existing templates to invoice_template_configs
INSERT INTO invoice_template_configs (business_id, name, is_default, config, html_template, schema_version, revision, version, created_at, updated_at)
SELECT
  t.business_id,
  t.name,
  t.is_default,
  t.config,
  t.html_template,
  '1.0',
  1,
  1,
  NOW(),
  NOW()
FROM templates t
WHERE NOT EXISTS (
  SELECT 1 FROM invoice_template_configs itc
  WHERE itc.business_id = t.business_id AND itc.name = t.name
);

-- Populate business_branding with defaults for businesses that don't have it
INSERT INTO business_branding (business_id, created_at, updated_at)
SELECT id, NOW(), NOW()
FROM businesses
WHERE id NOT IN (SELECT business_id FROM business_branding);
