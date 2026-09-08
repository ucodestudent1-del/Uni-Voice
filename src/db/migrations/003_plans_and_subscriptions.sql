-- ============================================================================
-- Phase 6: Subscription & Entitlement System (Freemium SaaS)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Subscription plans (Free / Pro / Business)
-- ----------------------------------------------------------------------------
DROP TYPE IF EXISTS subscription_plan CASCADE;
CREATE TYPE subscription_plan AS ENUM ('free', 'pro', 'business');

CREATE TABLE plans (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              subscription_plan NOT NULL UNIQUE,
  name              VARCHAR(100) NOT NULL,
  description       TEXT,
  price_monthly     NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly      NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency          VARCHAR(3) NOT NULL DEFAULT 'USD',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Business subscriptions (current plan + billing cycle)
-- ----------------------------------------------------------------------------
DROP TYPE IF EXISTS subscription_status CASCADE;
CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'cancelled', 'expired');

CREATE TABLE business_subscriptions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id           UUID NOT NULL REFERENCES plans(id),
  status            subscription_status NOT NULL DEFAULT 'active',
  billing_cycle     VARCHAR(20) NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_ends_at     TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  stripe_subscription_id VARCHAR(255),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_business_subscription UNIQUE (business_id)
);

CREATE INDEX idx_business_subscriptions_business ON business_subscriptions(business_id);
CREATE INDEX idx_business_subscriptions_plan ON business_subscriptions(plan_id);

-- ----------------------------------------------------------------------------
-- Feature flags / entitlements per plan
-- ----------------------------------------------------------------------------
CREATE TABLE feature_flags (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              VARCHAR(100) NOT NULL UNIQUE,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  category          VARCHAR(100),
  is_premium        BOOLEAN NOT NULL DEFAULT FALSE,
  requires_plan     subscription_plan,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Usage quotas per business (for enforcing limits like max invoices)
-- ----------------------------------------------------------------------------
CREATE TABLE usage_quotas (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  feature_code      VARCHAR(100) NOT NULL,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  used_count        INTEGER NOT NULL DEFAULT 0,
  limit_count       INTEGER NOT NULL DEFAULT -1,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_business_feature_period UNIQUE (business_id, feature_code, period_start)
);

CREATE INDEX idx_usage_quotas_business ON usage_quotas(business_id);
CREATE INDEX idx_usage_quotas_feature ON usage_quotas(feature_code);

-- ----------------------------------------------------------------------------
-- Plan change history / audit
-- ----------------------------------------------------------------------------
CREATE TABLE subscription_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  subscription_id   UUID NOT NULL REFERENCES business_subscriptions(id) ON DELETE CASCADE,
  event_type        VARCHAR(50) NOT NULL,
  from_plan         subscription_plan,
  to_plan           subscription_plan,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_events_business ON subscription_events(business_id);
CREATE INDEX idx_subscription_events_subscription ON subscription_events(subscription_id);
