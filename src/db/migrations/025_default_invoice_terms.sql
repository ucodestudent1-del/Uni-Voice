-- ============================================================================
-- Seed default invoice payment & legal terms for businesses that have not
-- configured custom terms.
--
-- The seeded text covers the core SaaS payment and legal requirements:
-- payment due dates, late fees, taxes, refund policy, dispute window,
-- Terms of Service reference, governing law, and billing contact.
--
-- Businesses may override these per-invoice or via
-- business_settings.default_terms through the API.
-- ============================================================================

DO $$
DECLARE
    default_terms_text TEXT :=
'Payment Terms
Payment is due within the period specified on the invoice.

Late Payment
Overdue balances may accrue interest at the maximum rate permitted by applicable law, plus a reasonable late fee, to the fullest extent permitted by law.

Taxes
The customer is responsible for all applicable taxes, duties, and governmental charges, except for taxes based on our income. If we are required to collect or remit taxes, they will be added to the invoice; a valid exemption certificate is required to avoid taxation.

Refund Policy
All payments are non-refundable except as required by applicable law or as set forth in our applicable refund policy (available at: https://www.example.com/terms).

Dispute Resolution
Any disputes regarding an invoice must be submitted in writing within 30 days of the invoice date. Failure to dispute within this period constitutes acceptance of the invoice as correct.

Terms of Service
Use of the SaaS platform and related services is subject to our Terms of Service and any applicable subscription agreement. The full Terms of Service are available at: https://www.example.com/terms.

Governing Law
This agreement and all invoices are governed by the laws of the State of Delaware, USA, without regard to conflict of law principles.

Contact
Direct all billing inquiries to: billing@example.com';
BEGIN
    UPDATE business_settings
    SET default_terms = default_terms_text,
        default_notes = 'Thank you for your business.',
        updated_at = NOW()
    WHERE default_terms IS NULL OR default_terms = '';
END$$;
