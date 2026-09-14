-- ============================================================================
-- Phase 2: Document Template persistence — extend structured templates table
-- Adds industry, description, and version columns plus supporting indices.
-- The base document_templates table was created in 008_document_composition.sql;
-- these changes are non-destructive (ADD COLUMN IF NOT EXISTS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Add columns for industry-scoped, versioned document templates
-- ----------------------------------------------------------------------------
ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- ----------------------------------------------------------------------------
-- Index: business_id + is_default for fast default-template lookup per business
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_document_templates_biz_default
  ON document_templates(business_id, is_default);

-- ----------------------------------------------------------------------------
-- Index: industry for filtering templates by industry
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_document_templates_industry
  ON document_templates(industry);
