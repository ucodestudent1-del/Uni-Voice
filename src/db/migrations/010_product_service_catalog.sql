-- ============================================================================
-- Phase 6: Enhanced Product/Service Catalog domain
-- Adds type (product | service), tax_category, status, discount fields, and
-- version counter to the products table. Adds catalog snapshot columns to
-- invoice_items so that historical invoices are immutable even when a catalog
-- entry is renamed, repriced, re-taxed, or archived.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM: product/service type
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_service_type') THEN
    CREATE TYPE product_service_type AS ENUM ('product', 'service');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_service_status') THEN
    CREATE TYPE product_service_status AS ENUM ('active', 'archived', 'draft');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Products table: add catalog-domain columns (idempotent)
-- ----------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type   product_service_type  NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS tax_category   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status         product_service_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS discount_type  VARCHAR(20) NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS version        INTEGER NOT NULL DEFAULT 1;

-- ----------------------------------------------------------------------------
-- Indexes: tenant isolation + common filter combinations
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_business_status
  ON products(business_id, status);
CREATE INDEX IF NOT EXISTS idx_products_business_type_status
  ON products(business_id, product_type, status);
CREATE INDEX IF NOT EXISTS idx_products_business_sku
  ON products(business_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_business_name
  ON products(business_id, name);
CREATE INDEX IF NOT EXISTS idx_products_active
  ON products(business_id) WHERE status = 'active';

-- Unique constraint: SKU must be unique per tenant (when present)
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_business_sku
  ON products(business_id, sku) WHERE sku IS NOT NULL AND sku != '';

-- ----------------------------------------------------------------------------
-- Invoice items: snapshot columns from catalog (immutable history)
-- ----------------------------------------------------------------------------
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS catalog_name            VARCHAR(255),
  ADD COLUMN IF NOT EXISTS catalog_sku             VARCHAR(100),
  ADD COLUMN IF NOT EXISTS catalog_tax_category    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS catalog_unit_price      NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS catalog_tax_rate        NUMERIC(5,4);

-- ----------------------------------------------------------------------------
-- Catalog snapshot history (for audit / revision tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_service_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  sku             VARCHAR(100),
  unit            VARCHAR(50) NOT NULL DEFAULT 'each',
  unit_price      NUMERIC(18,6) NOT NULL,
  tax_category    VARCHAR(50),
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  discount_type   VARCHAR(20) NOT NULL DEFAULT 'percentage',
  discount_value  NUMERIC(18,6) NOT NULL DEFAULT 0,
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  product_type    product_service_type NOT NULL DEFAULT 'product',
  snapshot_hash   VARCHAR(64) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID
);

CREATE INDEX IF NOT EXISTS idx_ps_snapshots_product
  ON product_service_snapshots(product_id);
CREATE INDEX IF NOT EXISTS idx_ps_snapshots_business
  ON product_service_snapshots(business_id);
CREATE INDEX IF NOT EXISTS idx_ps_snapshots_hash
  ON product_service_snapshots(snapshot_hash);

-- ----------------------------------------------------------------------------
-- Invoice line items: backfill snapshot columns from existing data
-- (existing unit_price, tax_rate, etc. are already stored and serve as the
-- snapshot; we also populate the new catalog_* columns where possible)
-- ----------------------------------------------------------------------------
UPDATE invoice_items
  SET catalog_unit_price = unit_price,
      catalog_tax_rate = tax_rate
WHERE catalog_unit_price IS NULL AND unit_price IS NOT NULL;
