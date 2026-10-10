-- 054_credit_note_status_extends.sql
-- Adds 'sent', 'refunded', 'partially_applied', 'partially_refunded' to the credit_note_status enum.
-- These statuses are used by the credit note service when sending credit notes and recording refunds.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'sent'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'credit_note_status')::regtype::oid
  ) THEN
    ALTER TYPE credit_note_status ADD VALUE 'sent';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'refunded'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'credit_note_status')::regtype::oid
  ) THEN
    ALTER TYPE credit_note_status ADD VALUE 'refunded';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'partially_applied'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'credit_note_status')::regtype::oid
  ) THEN
    ALTER TYPE credit_note_status ADD VALUE 'partially_applied';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'partially_refunded'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'credit_note_status')::regtype::oid
  ) THEN
    ALTER TYPE credit_note_status ADD VALUE 'partially_refunded';
  END IF;
END $$;

-- Add sent_at column for tracking when credit note was sent to customer
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
