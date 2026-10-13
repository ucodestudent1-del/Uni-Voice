-- 061_credit_note_events.sql
-- Dedicated audit trail for credit note lifecycle events.
-- Tracks all state transitions: create, finalize, send, apply, cancel, void, refund.

CREATE TABLE IF NOT EXISTS credit_note_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_type VARCHAR(20) NOT NULL DEFAULT 'user',
  -- 'user' | 'system' | 'customer' | 'payment'
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_note_events_cn ON credit_note_events(credit_note_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_note_events_type ON credit_note_events(event_type);
CREATE INDEX IF NOT EXISTS idx_credit_note_events_actor ON credit_note_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_events_business ON credit_note_events(business_id, created_at DESC);
