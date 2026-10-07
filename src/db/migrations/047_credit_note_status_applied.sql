-- 047_credit_note_status_applied.sql
-- Adds 'applied' status to the credit_note_status enum.
-- The enum is created in migration 013; we need to add the value 'applied'.
-- PostgreSQL does not support removing enum values or reordering in older versions,
-- but adding a value is supported. We add 'applied' after 'finalized' conceptually.
-- Since ALTER TYPE ... ADD VALUE does not support IF NOT EXISTS in PG < 10,
-- we check for the value existence first.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'applied'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'credit_note_status')::regtype::oid
  ) THEN
    ALTER TYPE credit_note_status ADD VALUE 'applied';
  END IF;
END $$;
