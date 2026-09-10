-- ============================================================================
-- Onboarding Workflow — tracks new-user setup progress
-- ============================================================================
-- Stores per-business onboarding steps so the application can guide new users
-- through setup (business profile, first customer, first product, first invoice)
-- and persist completion state.
-- ============================================================================

CREATE TYPE onboarding_step_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped');

-- ----------------------------------------------------------------------------
-- Onboarding steps — one row per (business, step)
-- ----------------------------------------------------------------------------
CREATE TABLE onboarding_steps (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    step            VARCHAR(50) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    status          onboarding_step_status NOT NULL DEFAULT 'pending',
    completed_at    TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_onboarding_business_step UNIQUE (business_id, step)
);

CREATE INDEX idx_onboarding_business ON onboarding_steps(business_id);
CREATE INDEX idx_onboarding_status ON onboarding_steps(business_id, status);
