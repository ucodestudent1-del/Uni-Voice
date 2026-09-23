-- ----------------------------------------------------------------------------
-- Performance index for the tax summary report query.
-- The tax summary endpoint (GET /api/reports/tax-summary) runs:
--   SELECT DATE_TRUNC('month', created_at) as month, SUM(tax_total)
--   FROM invoices WHERE business_id = $1 AND is_finalized = TRUE
--   GROUP BY month ORDER BY month DESC LIMIT 12
--
-- Without a composite index on (business_id, is_finalized, created_at) the
-- planner falls back to a sequential scan over all invoices for the business.
-- This index lets PostgreSQL use an index-only scan for the filter.
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_invoices_business_finalized_created
  ON invoices(business_id, is_finalized, created_at DESC);