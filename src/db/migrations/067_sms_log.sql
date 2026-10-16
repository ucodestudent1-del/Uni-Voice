-- 067_sms_log.sql
-- Adds an SMS delivery log table mirroring the email_log pattern for
-- observability, idempotency, and delivery-status tracking.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sms_status') THEN
        CREATE TYPE sms_status AS ENUM ('pending', 'sent', 'failed');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS sms_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider        VARCHAR(50) NOT NULL,
  status          sms_status NOT NULL DEFAULT 'pending',
  recipient       VARCHAR(255) NOT NULL,
  message         TEXT,
  message_id      VARCHAR(255),
  error_message   TEXT,
  idempotency_key VARCHAR(255) UNIQUE,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_log_business ON sms_log(business_id);
CREATE INDEX IF NOT EXISTS idx_sms_log_recipient ON sms_log(recipient);
CREATE INDEX IF NOT EXISTS idx_sms_log_idempotency ON sms_log(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_sms_log_created ON sms_log(created_at DESC);
