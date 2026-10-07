-- 051_invoice_po_number.sql
-- Adds po_number field to invoices for customer purchase order references.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS po_number VARCHAR(255);
