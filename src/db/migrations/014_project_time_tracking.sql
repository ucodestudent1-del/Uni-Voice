-- ============================================================================
-- Phase 14: Project Time Tracking — support hourly billing models by recording
-- time against projects and converting logged hours into invoice line items.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Time entries: record billable and non-billable work against projects
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_time_entries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id           UUID,
  catalog_service_id UUID REFERENCES products(id) ON DELETE SET NULL,
  description       TEXT NOT NULL,
  billable          BOOLEAN NOT NULL DEFAULT true,
  start_time        TIMESTAMPTZ,
  end_time          TIMESTAMPTZ,
  duration_minutes  INTEGER,
  billable_rate     NUMERIC(18,6) NOT NULL,
  billable_amount   NUMERIC(18,6) NOT NULL DEFAULT 0,
  is_invoiced       BOOLEAN NOT NULL DEFAULT false,
  invoice_id        UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_project
  ON project_time_entries(business_id, project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_unbilled
  ON project_time_entries(project_id)
  WHERE is_invoiced = false AND billable = true;
CREATE INDEX IF NOT EXISTS idx_time_entries_user
  ON project_time_entries(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_invoice
  ON project_time_entries(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_business
  ON project_time_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_created
  ON project_time_entries(created_at DESC);

-- ----------------------------------------------------------------------------
-- Constraints
-- ----------------------------------------------------------------------------
ALTER TABLE project_time_entries
  ADD CONSTRAINT chk_duration_positive CHECK (duration_minutes > 0),
  ADD CONSTRAINT chk_end_after_start CHECK (end_time IS NULL OR start_time IS NULL OR end_time >= start_time),
  ADD CONSTRAINT chk_billable_rate_nonneg CHECK (billable_rate >= 0),
  ADD CONSTRAINT chk_billable_amount_nonneg CHECK (billable_amount >= 0);

-- ----------------------------------------------------------------------------
-- Triggers: keep updated_at in sync
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER trg_time_entries_updated_at
  BEFORE UPDATE ON project_time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Project notes: simple free-form notes associated with projects
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID,
  title       VARCHAR(255),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_notes_project
  ON project_notes(business_id, project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_created
  ON project_notes(project_id, created_at DESC);

CREATE OR REPLACE TRIGGER trg_project_notes_updated_at
  BEFORE UPDATE ON project_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
