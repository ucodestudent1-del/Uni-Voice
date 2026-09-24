-- ============================================================================
-- Phase 31: Additional performance indexes for customer/invoice queries.
-- Addresses: Customers list sorting by created_at, invoice due_date filtering
--            for aging reports, subscription context lookups.
-- ============================================================================

-- Customers: business_id + created_at DESC (fallback sort when not searching by name)
CREATE INDEX IF NOT EXISTS idx_customers_business_created_desc
  ON customers(business_id, created_at DESC);

-- Invoices: business_id + status + due_date + amount_due (aging report: overdue filter)
CREATE INDEX IF NOT EXISTS idx_invoices_business_status_due_amount
  ON invoices(business_id, status, due_date, amount_due DESC)
  WHERE status IN ('draft', 'sent', 'viewed', 'partially_paid', 'overdue');

-- Invoices: business_id + status + finalized_at DESC (needs attention queries)
CREATE INDEX IF NOT EXISTS idx_invoices_business_status_finalized_desc
  ON invoices(business_id, status, finalized_at DESC);

-- Invoices: business_id + customer_id + status (customer invoice list filtering)
CREATE INDEX IF NOT EXISTS idx_invoices_business_customer_status
  ON invoices(business_id, customer_id, status, created_at DESC);

-- Business subscriptions: status + current_period_end (for subscription expiry checks)
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_status_period_end
  ON business_subscriptions(status, current_period_end);

-- Feature flags: category + requires_plan (for efficient feature listing by plan)
CREATE INDEX IF NOT EXISTS idx_feature_flags_category_plan
  ON feature_flags(category, requires_plan);
