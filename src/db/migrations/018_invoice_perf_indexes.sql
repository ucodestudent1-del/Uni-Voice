-- ----------------------------------------------------------------------------
-- Performance indexes for invoice loading optimization
-- ----------------------------------------------------------------------------

-- Composite index for invoices list queries by business + status (used by
-- findRecentlyPaid, findRequiringAttention, findManyPage with status filter)
CREATE INDEX IF NOT EXISTS idx_invoices_business_status ON invoices(business_id, status);

-- Composite index for invoices list queries by business + status + due_date DESC
-- (used by findUpcomingInvoices and findRequiringAttention)
CREATE INDEX IF NOT EXISTS idx_invoices_business_status_due ON invoices(business_id, status, due_date DESC);

-- Composite index for invoice_events queries by invoice_id + created_at DESC
-- (avoids sort when fetching events for an invoice)
CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice_created ON invoice_events(invoice_id, created_at DESC);

-- Composite index for invoice_snapshots by invoice_id + revision DESC
-- (avoids sort when getting latest snapshot)
CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_invoice_rev ON invoice_snapshots(invoice_id, revision DESC);

-- Composite index for payments by invoice_id + created_at DESC
-- (used by getInvoicePayments endpoint)
CREATE INDEX IF NOT EXISTS idx_payments_invoice_created ON payments(invoice_id, created_at DESC);

-- Composite index for payments by business_id + status + paid_at DESC
-- (used by sumPaidSince)
CREATE INDEX IF NOT EXISTS idx_payments_business_status_paid ON payments(business_id, status, paid_at DESC);
