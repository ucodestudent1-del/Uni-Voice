-- ============================================================================
-- Phase 20: Team access & RBAC
-- Adds business_users and business_invitations tables for multi-user business
-- membership with role-based access control.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_user_role') THEN
    CREATE TYPE business_user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_invitation_status') THEN
    CREATE TYPE business_invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS business_users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  role            business_user_role NOT NULL DEFAULT 'member',
  invited_email   VARCHAR(255),
  status          VARCHAR(20) NOT NULL DEFAULT 'invited',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by      UUID REFERENCES users(id),
  invited_at      TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  CONSTRAINT uq_business_user UNIQUE (business_id, user_id),
  CONSTRAINT uq_business_user_email UNIQUE (business_id, invited_email),
  CONSTRAINT chk_business_user_status CHECK (status IN ('invited','active','removed'))
);

CREATE INDEX IF NOT EXISTS idx_business_users_business
  ON business_users(business_id);

CREATE INDEX IF NOT EXISTS idx_business_users_user
  ON business_users(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_users_business_role
  ON business_users(business_id, role);

CREATE TABLE IF NOT EXISTS business_invitations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email           VARCHAR(255) NOT NULL,
  role            business_user_role NOT NULL DEFAULT 'member',
  status          business_invitation_status NOT NULL DEFAULT 'pending',
  token           VARCHAR(255) UNIQUE NOT NULL,
  invited_by      UUID REFERENCES users(id),
  expires_at      TIMESTAMPTZ NOT NULL,
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_business_invitation_email UNIQUE (business_id, email)
);

CREATE INDEX IF NOT EXISTS idx_business_invitations_business
  ON business_invitations(business_id);

CREATE INDEX IF NOT EXISTS idx_business_invitations_token
  ON business_invitations(token);

CREATE INDEX IF NOT EXISTS idx_business_invitations_email
  ON business_invitations(email);
