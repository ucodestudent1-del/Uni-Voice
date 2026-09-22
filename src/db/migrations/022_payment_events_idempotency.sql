/* ============================================================================
 * Migration 022: Payment event idempotency
 * ---------------------------------------------------------------------------
 * The refund flow (invoice-service.refundPayment) records refund audit rows in
 * the payment_events table and guards against double-processing by checking an
 * idempotency key. Add the column + unique index idempotently.
 * ============================================================================ */

ALTER TABLE payment_events
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_events_idempotency
  ON payment_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
