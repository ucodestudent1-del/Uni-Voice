-- ============================================================================
-- Phase 77: Row-Level Security (RLS) as defense-in-depth for tenant isolation
-- ============================================================================
-- Enables RLS on tenant-scoped tables and sets app.current_business_id
-- at the start of each authenticated request via middleware.
-- ============================================================================

-- Enable the pgcrypto extension for uuid_generate_v4 if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function to set the current business context
CREATE OR REPLACE FUNCTION set_current_business_id(business_id UUID)
RETURNS VOID AS $$
BEGIN
  IF business_id IS NULL THEN
    PERFORM set_config('app.current_business_id', '', true);
  ELSE
    PERFORM set_config('app.current_business_id', business_id::TEXT, true);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Tables that are tenant-scoped (have a business_id column)
DO $$
DECLARE
  tbl RECORD;
  col TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'customers',
        'invoices',
        'invoice_items',
        'invoice_payments',
        'invoice_reminders',
        'invoice_late_fees',
        'quotes',
        'quote_items',
        'quote_events',
        'credit_notes',
        'credit_note_items',
        'credit_note_events',
        'debit_notes',
        'debit_note_items',
        'debit_note_events',
        'payment_vouchers',
        'purchase_orders',
        'products',
        'catalog_items',
        'templates',
        'document_templates',
        'document_presets',
        'document_relations',
        'document_artifacts',
        'document_snapshots',
        'receipts',
        'business_settings',
        'business_users',
        'business_invitations',
        'business_subscriptions',
        'subscription_events',
        'branding',
        'tax_rules',
        'tax_rule_applications',
        'discount_rules',
        'discount_rule_applications',
        'projects',
        'project_team_members',
        'project_time_entries',
        'invoice_attachments',
        'interaction_logs',
        'numbering_configs',
        'payment_methods',
        'payment_events',
        'late_fee_policies',
        'reminder_policies',
        'recurring_invoice_definitions',
        'recurring_invoice_runs',
        'ai_documents',
        'ai_usage_logs',
        'speed_optimization_cache',
        'report_cache',
        'recurring_invoices',
        'recurring_invoice_items',
        'delivery_notes',
        'delivery_note_items',
        'packing_slips',
        'packing_slip_items',
        'pro_forma_invoices',
        'pro_forma_invoice_items',
        'estimates',
        'estimate_items',
        'twofa_recovery_codes',
        'twofa_attempts',
        'refresh_tokens',
        'email_log'
      )
  LOOP
    -- Check if the table has a business_id column
    SELECT column_name INTO col
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = tbl.tablename
      AND column_name = 'business_id';

    IF col IS NOT NULL THEN
      -- Enable RLS
      EXECUTE format('ALTER TABLE "%I" ENABLE ROW LEVEL SECURITY', tbl.tablename);

      -- Create policy: only rows matching the current business_id are visible
      -- Use DROP IF EXISTS + CREATE pattern since PostgreSQL does not support
      -- CREATE POLICY IF NOT EXISTS (added in PG 15 but not for all policy types)
      EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_select_%I" ON "%I"', tbl.tablename, tbl.tablename);
      EXECUTE format($p$
        CREATE POLICY "tenant_isolation_select_%I" ON "%I"
        FOR SELECT USING (
          business_id::TEXT = current_setting('app.current_business_id', true)
        )
      $p$, tbl.tablename, tbl.tablename);

      -- Create policy: INSERT restricted to current business
      EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_insert_%I" ON "%I"', tbl.tablename, tbl.tablename);
      EXECUTE format($p$
        CREATE POLICY "tenant_isolation_insert_%I" ON "%I"
        FOR INSERT WITH CHECK (
          business_id::TEXT = current_setting('app.current_business_id', true)
        )
      $p$, tbl.tablename, tbl.tablename);

      -- Create policy: UPDATE restricted to current business
      EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_update_%I" ON "%I"', tbl.tablename, tbl.tablename);
      EXECUTE format($p$
        CREATE POLICY "tenant_isolation_update_%I" ON "%I"
        FOR UPDATE USING (
          business_id::TEXT = current_setting('app.current_business_id', true)
        )
      $p$, tbl.tablename, tbl.tablename);

      -- Create policy: DELETE restricted to current business
      EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_delete_%I" ON "%I"', tbl.tablename, tbl.tablename);
      EXECUTE format($p$
        CREATE POLICY "tenant_isolation_delete_%I" ON "%I"
        FOR DELETE USING (
          business_id::TEXT = current_setting('app.current_business_id', true)
        )
      $p$, tbl.tablename, tbl.tablename);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
