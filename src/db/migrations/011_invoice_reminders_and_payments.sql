-- ============================================================================
-- Phase 7: Invoice reminders, payment intents (hosted payment page), and
-- automated overdue transitions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Invoice reminder rules (per-business automation config)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_reminder_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  trigger_type    VARCHAR(20) NOT NULL CHECK (trigger_type IN ('before_due', 'after_due', 'manual')),
  offset_days     INTEGER NOT NULL DEFAULT 0,
  min_status      VARCHAR(20) NOT NULL DEFAULT 'sent',
  max_send_count  INTEGER NOT NULL DEFAULT 3,
  subject_template VARCHAR(500) NOT NULL DEFAULT 'Reminder: Invoice {{invoice_number}} is due',
  message_template TEXT NOT NULL DEFAULT 'This is a friendly reminder that invoice {{invoice_number}} for {{amount_due}} is due on {{due_date}}. Please view and pay your invoice using the secure link below.',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminder_rules_business ON invoice_reminder_rules(business_id);
CREATE INDEX IF NOT EXISTS idx_reminder_rules_active ON invoice_reminder_rules(business_id, is_active) WHERE is_active = TRUE;

-- ----------------------------------------------------------------------------
-- Track sent reminders (idempotency + history)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_reminders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  rule_id         UUID REFERENCES invoice_reminder_rules(id) ON DELETE SET NULL,
  email_log_id    UUID REFERENCES email_log(id) ON DELETE SET NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recipient_email VARCHAR(255),
  subject         VARCHAR(500),
  send_count      INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice ON invoice_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_business ON invoice_reminders(business_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_sent_at ON invoice_reminders(sent_at DESC);

-- ----------------------------------------------------------------------------
-- Payment intents for online hosted payments (Stripe-backed)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_intents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider        VARCHAR(50) NOT NULL DEFAULT 'stub',
  provider_intent_id VARCHAR(255),
  amount          NUMERIC(18,6) NOT NULL,
  currency        VARCHAR(3) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  client_secret   VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_invoice ON payment_intents(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_business ON payment_intents(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_invoice_active
  ON payment_intents(invoice_id)
  WHERE status IN ('pending', 'requires_action');

-- ----------------------------------------------------------------------------
-- Business settings: enable/disable online payments
-- ----------------------------------------------------------------------------
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50) DEFAULT 'stub',
  ADD COLUMN IF NOT EXISTS payment_provider_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS overdue_reminder_days INTEGER NOT NULL DEFAULT 7;
