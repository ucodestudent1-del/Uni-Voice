-- 049_quote_events_table.sql
-- Adds a quote_events table to track the activity timeline for quotes.
-- Mirrors the invoice_events table structure.

CREATE TABLE IF NOT EXISTS quote_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  event_type      VARCHAR(100) NOT NULL,
  actor_id        UUID,
  actor_type      VARCHAR(20),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_events_quote ON quote_events(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_events_type ON quote_events(event_type);
CREATE INDEX IF NOT EXISTS idx_quote_events_created ON quote_events(created_at);
