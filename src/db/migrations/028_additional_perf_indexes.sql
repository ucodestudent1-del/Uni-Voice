-- ============================================================================
-- Phase 28: Additional performance indexes for filtered list endpoints.
-- These indexes optimize query patterns discovered during the slow-listing
-- investigation: receipts by provider, invoices by status + due date range
-- (aging report), and customers by business + name search.
-- ============================================================================

-- Receipts: business_id + status + created_at DESC (used by findManyWithDetailsAndCount
-- default ORDER BY when no date range filter is applied; existing idx covers status but
-- not the created_at DESC ordering for the default sort direction)
CREATE INDEX IF NOT EXISTS idx_receipts_business_status_created_desc
  ON receipts(business_id, status, created_at DESC);

-- Receipts: provider extracted from metadata JSONB (used by provider filter)
CREATE INDEX IF NOT EXISTS idx_receipts_provider
  ON receipts((metadata->>'provider'));

-- Receipts: business_id + provider (compound for filtered list by provider + pagination)
CREATE INDEX IF NOT EXISTS idx_receipts_business_provider
  ON receipts(business_id, (metadata->>'provider'));

-- Receipts: business_id + receipt_number for ILIKE search on receipt_number
-- (already partially covered by idx_receipts_number_business, but this supports
-- searches where business_id filter is applied first)
CREATE INDEX IF NOT EXISTS idx_receipts_business_receipt_number
  ON receipts(business_id, receipt_number);

-- Receipts: trigram index on receipt_number for ILIKE '%term%' search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number_trgm
  ON receipts USING gin (receipt_number gin_trgm_ops);

-- Invoices: business_id + status for status filter (used by report/invoice list)
CREATE INDEX IF NOT EXISTS idx_invoices_business_status
  ON invoices(business_id, status);

-- Invoices: business_id + status + due_date DESC (used by aging report)
CREATE INDEX IF NOT EXISTS idx_invoices_business_status_due_desc
  ON invoices(business_id, status, due_date DESC);

-- Invoices: business_id + due_date (used by due date range filters)
CREATE INDEX IF NOT EXISTS idx_invoices_business_due_date
  ON invoices(business_id, due_date);

-- Invoices: business_id + created_at DESC for default sort without filters
CREATE INDEX IF NOT EXISTS idx_invoices_business_created_desc
  ON invoices(business_id, created_at DESC);

-- Customers: business_id + name for search and ordering
CREATE INDEX IF NOT EXISTS idx_customers_business_name
  ON customers(business_id, name);

-- Customers: trigram index on name for ILIKE '%term%' search
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON customers USING gin (name gin_trgm_ops);
