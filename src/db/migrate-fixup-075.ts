import { Client } from "pg";
import { env } from "../config/index.js";

const FIXUP_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recurring_invoice_status') THEN
    CREATE TYPE recurring_invoice_status AS ENUM ('draft', 'active', 'paused', 'cancelled', 'void');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS recurring_invoice_number_sequences (
  business_id   UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix        VARCHAR(50) NOT NULL DEFAULT 'RI',
  next_number   BIGINT NOT NULL DEFAULT 1,
  padding       SMALLINT NOT NULL DEFAULT 6,
  includes_year BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'status') THEN
    ALTER TABLE recurring_invoices ADD COLUMN status recurring_invoice_status DEFAULT 'draft';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'recurring_invoice_number') THEN
    ALTER TABLE recurring_invoices ADD COLUMN recurring_invoice_number VARCHAR(100);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'template_id') THEN
    ALTER TABLE recurring_invoices ADD COLUMN template_id UUID REFERENCES templates(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'finalized_at') THEN
    ALTER TABLE recurring_invoices ADD COLUMN finalized_at TIMESTAMPTZ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'cancelled_at') THEN
    ALTER TABLE recurring_invoices ADD COLUMN cancelled_at TIMESTAMPTZ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'cancelled_reason') THEN
    ALTER TABLE recurring_invoices ADD COLUMN cancelled_reason TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'voided_at') THEN
    ALTER TABLE recurring_invoices ADD COLUMN voided_at TIMESTAMPTZ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'recurring_invoices'::regclass AND attname = 'void_reason') THEN
    ALTER TABLE recurring_invoices ADD COLUMN void_reason TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'business_settings'::regclass AND attname = 'recurring_invoice_prefix') THEN
    ALTER TABLE business_settings ADD COLUMN recurring_invoice_prefix VARCHAR(50) DEFAULT 'RI';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'business_settings'::regclass AND attname = 'recurring_invoice_padding') THEN
    ALTER TABLE business_settings ADD COLUMN recurring_invoice_padding SMALLINT DEFAULT 6;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'business_settings'::regclass AND attname = 'recurring_invoice_includes_year') THEN
    ALTER TABLE business_settings ADD COLUMN recurring_invoice_includes_year BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recurring_invoices_status ON recurring_invoices(status);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_number ON recurring_invoices(recurring_invoice_number);

INSERT INTO migrations (name) VALUES ('075_recurring_invoice_numbering.sql')
  ON CONFLICT (name) DO NOTHING;
`;

async function main() {
  const client = new Client({ connectionString: env.DATABASE_URL });
  try {
    await client.connect();
    await client.query(FIXUP_SQL);
    console.log("Migration 075 fixup applied successfully");
  } catch (err) {
    console.error("Migration 075 fixup failed:", err);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Fixup script error:", e);
  process.exit(1);
});
