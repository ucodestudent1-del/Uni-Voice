-- 030_pdf_cache_and_indexes.sql
-- Performance: PDF caching columns + missing indexes

-- 1. PDF cache columns for invoices (cache generated PDFs to avoid puppeteer re-runs)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS pdf_cache bytea,
  ADD COLUMN IF NOT EXISTS pdf_cache_hash text,
  ADD COLUMN IF NOT EXISTS pdf_cached_at timestamptz;

-- 2. PDF cache columns for quotes
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS pdf_cache bytea,
  ADD COLUMN IF NOT EXISTS pdf_cache_hash text,
  ADD COLUMN IF NOT EXISTS pdf_cached_at timestamptz;

-- 3. PDF cache columns for receipts
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS pdf_cache bytea,
  ADD COLUMN IF NOT EXISTS pdf_cache_hash text,
  ADD COLUMN IF NOT EXISTS pdf_cached_at timestamptz;

-- 4. Missing indexes for invoice queries
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices (project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_business_status ON invoices (business_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_business_created ON invoices (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_business_due ON invoices (business_id, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_business_issue ON invoices (business_id, issue_date);

-- 5. Missing indexes for quote queries
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes (customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_business_status ON quotes (business_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_business_created ON quotes (business_id, created_at DESC);

-- 6. Missing indexes for receipt queries
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON receipts (receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_business_status ON receipts (business_id, status);
CREATE INDEX IF NOT EXISTS idx_receipts_business_created ON receipts (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_invoice_id ON receipts (invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_id ON receipts (payment_id);

-- 7. Index for payments lookup by invoice (used by receipt generation)
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id_status ON payments (invoice_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_business_status ON payments (business_id, status);

-- 8. Index for invoice_snapshots lookup by invoice (used by PDF cache invalidation)
CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_invoice_revision ON invoice_snapshots (invoice_id, revision DESC);