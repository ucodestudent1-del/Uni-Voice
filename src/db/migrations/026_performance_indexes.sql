-- ----------------------------------------------------------------------------
-- Performance indexes for expenses, projects, and quotes tables.
-- These tables were missing composite indexes that the list endpoints filter
-- on, causing sequential scans on every request.
-- ----------------------------------------------------------------------------

-- Expenses: business_id + expense_date DESC (used by findMany and getSummary)
CREATE INDEX IF NOT EXISTS idx_expenses_business_date_desc
  ON expenses(business_id, expense_date DESC);

-- Expenses: business_id + category (used by category filter)
CREATE INDEX IF NOT EXISTS idx_expenses_business_category
  ON expenses(business_id, category);

-- Expenses: business_id + created_at DESC (used by default sort fallback)
CREATE INDEX IF NOT EXISTS idx_expenses_business_created_desc
  ON expenses(business_id, created_at DESC);

-- Projects: business_id + status (used by status filter and archived exclusion)
CREATE INDEX IF NOT EXISTS idx_projects_business_status
  ON projects(business_id, status);

-- Projects: business_id + created_at DESC (used by default sort)
CREATE INDEX IF NOT EXISTS idx_projects_business_created_desc
  ON projects(business_id, created_at DESC);

-- Projects: search_name + search_desc (used by ILIKE search on search_name/search_desc)
-- PostgreSQL can use a trigram index for ILIKE '%term%' patterns.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_projects_search_name_trgm
  ON projects USING gin (search_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_search_desc_trgm
  ON projects USING gin (search_desc gin_trgm_ops);

-- Quotes: business_id + status (used by status filter)
CREATE INDEX IF NOT EXISTS idx_quotes_business_status
  ON quotes(business_id, status);

-- Quotes: business_id + created_at DESC (used by default sort)
CREATE INDEX IF NOT EXISTS idx_quotes_business_created_desc
  ON quotes(business_id, created_at DESC);

-- Quotes: business_id + quote_number (used by quote_number ILIKE search)
CREATE INDEX IF NOT EXISTS idx_quotes_business_quote_number
  ON quotes(business_id, quote_number);

-- Expenses: business_id + description (used by ILIKE search)
CREATE INDEX IF NOT EXISTS idx_expenses_business_description_trgm
  ON expenses USING gin (description gin_trgm_ops);

-- Invoices: business_id + customer_id (used by customer filter)
CREATE INDEX IF NOT EXISTS idx_invoices_business_customer
  ON invoices(business_id, customer_id);

-- Invoices: business_id + project_id (used by project filter)
CREATE INDEX IF NOT EXISTS idx_invoices_business_project
  ON invoices(business_id, project_id);