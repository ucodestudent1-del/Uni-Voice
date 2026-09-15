-- ============================================================================
-- 002_customers_enhancements.sql
-- Customer as a bounded domain: tenant ownership, identity, billing, tax IDs,
-- addresses, payment terms, status lifecycle, audit metadata, and search.
-- Invoices reference customers via foreign key with ON DELETE SET NULL so that
-- deleting/archiving a customer never destroys historical invoice data.
-- ============================================================================

CREATE TYPE customer_status AS ENUM ('active', 'inactive', 'archived');

-- ----------------------------------------------------------------------------
-- Customer addresses (address book — supports billing / shipping differentiation)
-- ----------------------------------------------------------------------------
CREATE TABLE customer_addresses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label           VARCHAR(100),
  type            VARCHAR(20) NOT NULL DEFAULT 'billing',
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  address_line_1  VARCHAR(255) NOT NULL,
  address_line_2  VARCHAR(255),
  city            VARCHAR(100) NOT NULL,
  state_or_region VARCHAR(100),
  postal_code     VARCHAR(20),
  country_code    VARCHAR(3) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_addresses_customer ON customer_addresses(customer_id);
CREATE INDEX idx_customer_addresses_type ON customer_addresses(type);
CREATE INDEX idx_customer_addresses_default ON customer_addresses(customer_id, is_default DESC);

-- ----------------------------------------------------------------------------
-- Tax identifiers (multiple per customer — VAT, EIN, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE customer_tax_identifiers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type            VARCHAR(30) NOT NULL,
  value           VARCHAR(100) NOT NULL,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_tax_ids_customer ON customer_tax_identifiers(customer_id);
CREATE UNIQUE INDEX uq_customer_tax_id_value ON customer_tax_identifiers(customer_id, type);

-- ----------------------------------------------------------------------------
-- Customer events / audit log
-- ----------------------------------------------------------------------------
CREATE TYPE customer_event_type AS ENUM (
  'created', 'updated', 'archived', 'restored', 'tax_id_added', 'tax_id_removed'
);

CREATE TABLE customer_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type      customer_event_type NOT NULL,
  actor_id        UUID,
  actor_type      VARCHAR(20),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_events_customer ON customer_events(customer_id);
CREATE INDEX idx_customer_events_business ON customer_events(business_id);
CREATE INDEX idx_customer_events_type ON customer_events(event_type);
CREATE INDEX idx_customer_events_created ON customer_events(created_at);

-- ----------------------------------------------------------------------------
-- Schema changes to existing customers table
-- ----------------------------------------------------------------------------

-- Add new columns (idempotent with IF NOT EXISTS)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS status          customer_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS payment_terms   INTEGER,
  ADD COLUMN IF NOT EXISTS archived_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by     UUID,
  ADD COLUMN IF NOT EXISTS updated_by      UUID,
  ADD COLUMN IF NOT EXISTS billing_address_id UUID REFERENCES customer_addresses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_address_id UUID REFERENCES customer_addresses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS search_name     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS search_email    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS search_company  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS version         INTEGER NOT NULL DEFAULT 1;

-- Populate normalized search fields for existing rows
UPDATE customers
  SET search_name = LOWER(name),
      search_email = LOWER(email),
      search_company = LOWER(company_name);

-- Add constraint: name and business_id are required (already enforced at table level)
-- Add constraint: archived_at only set when status is 'archived'
ALTER TABLE customers
  ADD CONSTRAINT chk_customer_archived_status
  CHECK (
    (archived_at IS NOT NULL AND status = 'archived') OR
    (archived_at IS NULL AND status != 'archived')
  );

-- Indexes for search, filtering, and sorting (performance at scale)
CREATE INDEX IF NOT EXISTS idx_customers_search_name    ON customers(business_id, search_name);
CREATE INDEX IF NOT EXISTS idx_customers_search_email   ON customers(business_id, search_email);
CREATE INDEX IF NOT EXISTS idx_customers_search_company ON customers(business_id, search_company);
CREATE INDEX IF NOT EXISTS idx_customers_status         ON customers(business_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_archived       ON customers(business_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_customers_business_name  ON customers(business_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_business_email ON customers(business_id, email);
CREATE INDEX IF NOT EXISTS idx_customers_country       ON customers(business_id, country_code);
CREATE INDEX IF NOT EXISTS idx_customers_currency       ON customers(business_id, default_currency);
CREATE INDEX IF NOT EXISTS idx_customers_created_desc   ON customers(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_updated_desc   ON customers(business_id, updated_at DESC);

-- Full-text search support: trgm indexes on key columns for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_customers_search_trgm_name    ON customers USING GIN (search_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_search_trgm_company ON customers USING GIN (search_company gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_search_trgm_email   ON customers USING GIN (search_email gin_trgm_ops);
