-- ----------------------------------------------------------------------------
-- Performance index for invoice list queries by business_id + created_at DESC
-- Covers findManyPage and findForDashboard which filter on business_id and
-- sort by created_at DESC. Without this index PostgreSQL performs an in-memory
-- filesort on every list query.
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_invoices_business_created_at_desc
  ON invoices(business_id, created_at DESC);