-- ============================================================================
-- Phase 8: Projects — centralized workspace for organizing client work and
-- connecting it directly to invoices, customers, and payments.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM: project status
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
    CREATE TYPE project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_event_type') THEN
    CREATE TYPE project_event_type AS ENUM (
      'created', 'updated', 'status_changed', 'archived', 'restored',
      'tag_added', 'tag_removed', 'team_member_added', 'team_member_removed',
      'invoice_created', 'budget_updated'
    );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Projects
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  status          project_status NOT NULL DEFAULT 'planning',
  start_date      DATE,
  due_date        DATE,
  budget          NUMERIC(18,6) NOT NULL DEFAULT 0,
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  amount_invoiced NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_paid     NUMERIC(18,6) NOT NULL DEFAULT 0,
  remaining_billable NUMERIC(18,6) NOT NULL DEFAULT 0,
  search_name     VARCHAR(255),
  search_desc     TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  updated_by      UUID,
  CONSTRAINT chk_project_dates CHECK (due_date >= start_date),
  CONSTRAINT chk_project_budget_positive CHECK (budget >= 0)
);

CREATE INDEX IF NOT EXISTS idx_projects_business ON projects(business_id);
CREATE INDEX IF NOT EXISTS idx_projects_business_status ON projects(business_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_business_customer ON projects(business_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_business_created_desc ON projects(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_business_name ON projects(business_id, name);
CREATE INDEX IF NOT EXISTS idx_projects_search_name ON projects(business_id, search_name);
CREATE INDEX IF NOT EXISTS idx_projects_search_desc ON projects(business_id, search_desc);

-- ----------------------------------------------------------------------------
-- Project tags
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_tags (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  color           VARCHAR(7) NOT NULL DEFAULT '#6b7280',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_tag_business_name UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_project_tags_business ON project_tags(business_id);

-- ----------------------------------------------------------------------------
-- Project-tag associations (many-to-many)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_taggings (
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag_id          UUID NOT NULL REFERENCES project_tags(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_tagging UNIQUE (project_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_project_taggings_project ON project_taggings(project_id);
CREATE INDEX IF NOT EXISTS idx_project_taggings_tag ON project_taggings(tag_id);

-- ----------------------------------------------------------------------------
-- Project team members (many-to-many with users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_team_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  role            VARCHAR(50) NOT NULL DEFAULT 'member',
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by     UUID,
  CONSTRAINT uq_project_team_member UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_team_project ON project_team_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_user ON project_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_team_business ON project_team_members(business_id);

-- ----------------------------------------------------------------------------
-- Project events / audit log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type      project_event_type NOT NULL,
  actor_id        UUID,
  actor_type      VARCHAR(20),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_events_project ON project_events(project_id);
CREATE INDEX IF NOT EXISTS idx_project_events_business ON project_events(business_id);
CREATE INDEX IF NOT EXISTS idx_project_events_type ON project_events(event_type);
CREATE INDEX IF NOT EXISTS idx_project_events_created ON project_events(created_at);

-- ----------------------------------------------------------------------------
-- Link invoices to projects (nullable for backward compatibility)
-- ----------------------------------------------------------------------------
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_project_business ON invoices(project_id, business_id) WHERE project_id IS NOT NULL;
