# Quote Template Redesign & Implementation Plan

## Executive Summary

The existing codebase already has a **robust quotes system**: a backend `QuoteService` (`src/services/quote-service.ts`) with full CRUD, atomic numbering, PDF generation via Handlebars templates, email sending, conversion-to-invoice, and a `public_token` flow. The frontend has a `QuoteBuilder` component with line items, fees, calculation engine integration, validation, autosave, and a `ReviewAndSendDialog`. The `PublicInvoice` page already models the customer-facing approval/payment portal pattern.

The gap is that **quotes reuse the invoice template and labeling**, so they read as invoices rather than formal estimates/offers. The customer-facing experience (public view, acceptance flow, deposit handling) is not yet built for quotes — only for invoices.

This plan addresses all four tasks by producing a **production-ready quote document** and the backend/frontend changes to support it.

---

## 1. Template Optimization — Refined Quote Layout

### Current State
Quotes render through `templateRenderer.render()` in `template-renderer.ts:642`, which uses the `DEFAULT_INVOICE_TEMPLATE` (a Handlebars string). This template is invoice-labeled ("Invoice", "Invoice #", "Amount Due", "Due date", "Payment instructions"). The `quote-service.ts:renderQuoteHtml` (line 565) passes the quote data through `buildTemplateData` which labels it as `invoice` internally. There is **no dedicated quote template**, no `Valid Until` field in the rendered output, and acceptance terms are not rendered.

### Refined Layout (Optimized)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [LOGO]            QUOTE                 Q-2026-0045     [Status Badge] │
│  Business Name     Issue Date: Oct 6, 2026   Valid Until: Nov 5, 2026   │
│  Address                                                               │
│  Phone • Email • Website                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PREPARED FOR                              DELIVER TO:                  │
│  Customer Name                             (optional, if different)     │
│  Company Name                                                              │
│  Address                                                               │
│  Phone • Email                                                            │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  DESCRIPTION                    QTY    UNIT PRICE    LINE TOTAL         │
├─────────────────────────────────────────────────────────────────────────┤
│  [Service/product 1]            1      $1,000.00     $1,000.00            │
│  [Service/product 2]            2      $250.00       $500.00              │
│  [Materials]                    1      $150.00       $150.00              │
├─────────────────────────────────────────────────────────────────────────|
│  SUBTOTAL                                              $1,650.00          │
│  DISCOUNT                                              —$0.00             │
│  TAX (8.25%)                                            $165.00           │
│  FEES                                                  +$0.00             │
│                                                                    ──────│
│  ESTIMATED TOTAL                                       $1,815.00          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  ⚠ This is a fixed-price estimate. Final total may vary if scope    │ │
│  │    changes. See Terms and Scope of Work below.                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│  SCOPE OF WORK                                                            │
│  Detailed explanation of what's included: labor, materials, deliverables, │
│  installation, specific hours/visits, exclusions, timeline.              │
├─────────────────────────────────────────────────────────────────────────┤
│  TERMS                                                                    │
│  • This quote is valid until Nov 5, 2026.                                │
│  • A 50% deposit ($907.50) is required to begin work.                   │
│  • Remaining balance due upon completion.                                │
│  • Changes outside the described scope require written approval.        │
│  • Payment accepted via bank transfer, credit card, or check.           │
├─────────────────────────────────────────────────────────────────────────┤
│  ACCEPTANCE                                                               │
│  By signing below, you accept this quote and authorize work to begin.    │
│  ─────────────────────────────────────────────────                       │
│  Signature                             Print Name           Date          │
│  ─────────────────────────────────     ─────────────────    ──────        │
│  ┌──┐ [  ACCEPT  ]  [  REJECT  ]                                         │
│  (electronic acceptance)                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Thank you for your business. We look forward to working with you.       │
│  Business Name • Contact: [phone] or [email]                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Information Hierarchy Improvements

| Priority | Section | Current Issue | Refined Improvement |
|---|---|---|---|
| **Primary** | Header (Business + Quote # + Dates) | Uses invoice label, no "Valid Until" emphasis | Dedicated "QUOTE" title, prominent "Valid Until" with deadline styling (red if <7 days remaining) |
| **Primary** | Customer block | Called "Bill To" (invoice framing) | Renamed "PREPARED FOR" |
| **Primary** | Line items table | Invoice columns | Added tax rate column, line total emphasis |
| **Primary** | Totals block | "Estimated Total" is the only differentiator from invoice | "Estimated Total" + clarifying disclaimer; deposit amount called out |
| **Secondary** | Scope of Work | Not present in template | New dedicated section before Terms |
| **Secondary** | Terms | Merged payment instructions | Separated Terms from Payment Instructions, added scope-change clause |
| **Secondary** | Acceptance | Only signature lines in Handlebars | Added electronic acceptance checkboxes + deposit acknowledgment |
| **Secondary** | Footer | "Invoice #. All rights reserved." | Changed to "Quote #. This quote expires on [date]." |

### Visual Flow Recommendations
1. **Status badge** at top right: Draft / Sent / Viewed / Accepted / Expired (color-coded)
2. **Expiry urgency indicator**: When expiry date is within 7 days, show a warning banner
3. **Deposit callout**: If a deposit is required, show it as a highlighted sub-total row in the totals area (e.g., "Deposit Required: $907.50")
4. **Scope of Work** section uses prose formatting with `nl2br` helper (already registered in template-renderer.ts:107)
5. **Acceptance section** uses a visible signature line plus electronic acceptance buttons

---

## 2. Copywriting & Tone

### Terminology Audit

| Current (Invoice) | Recommended (Quote) | Rationale |
|---|---|---|
| "Invoice" / "Invoice #" | "Quote" / "Quote #" | Establishes document type authority |
| "Bill To" | "Prepared For" | Softer, collaborative tone |
| "Due Date" | "Valid Until" / "Expiration Date" | Clarifies this is an offer, not a demand |
| "Amount Due" | "Estimated Total" | Sets expectation that final amount may differ |
| "Payment Instructions" | "Payment Terms" (in Terms section) | More formal; payment details belong in Terms |
| "Total" | "Estimated Total" | Explicit estimate framing |
| "Paid" / "Partially Paid" | "Deposit Received" / "Deposit Paid" | Deposit tracking for quotes |
| "Send" | "Issue" / "Send to Customer" | "Issue" is standard for quotes |
| "Convert to Invoice" | "Accept & Create Invoice" | Clarifies the workflow step |

### Professional Phrasing for Client Trust

**Header subtitle alternatives:**
- "Professional Estimate" (when not yet sent)
- "Estimate (Valid Until [date])" (when sent)
- "Accepted — Thank You" (when accepted)

**Totals area disclaimer:**
> "This is a fixed-price estimate based on the scope described. Final charges may vary if additional work is required beyond the specified scope. A deposit of [X%] is required to secure your spot in our schedule."

**Scope section header:**
> "Scope of Work — What's Included"
> "What's Included:" / "What's Not Included (Exclusions):"

**Acceptance section preamble:**
> "By signing below or clicking 'Accept', you acknowledge that you have read and agree to the terms above and authorize us to proceed with the described work. Your quote will expire on [date]."

**Footer:**
> "This quote was issued on [date] and expires on [date]. Questions? Contact [phone] or [email]."

### Copy in Code References

- `quote-service.ts:482` — email subject: `"Quote ${number} from ${business.name}"` → already correct
- `ReviewAndSendDialog.tsx:27-33` — email message placeholder already uses "quote" framing
- `ReviewAndSendDialog.tsx:55, 62, 118, 152` — uses "Quote" and "quote" consistently → already correct
- `ReviewAndSendDialog.tsx:143-144` — totals label says "Total" → change to "Estimated Total"
- `QuoteSummary.tsx:100` — totals label says "Total" → change to "Estimated Total"
- `QuoteTotals.tsx:79` — totals label says "Total" → change to "Estimated Total"

---

## 3. Functional Requirements — Backend Data Fields & Logic

### Existing Quote Schema (src/db/migrations/001_initial_schema.sql:391, 023_quote_schema.sql)

The `quotes` table already has: `id`, `business_id`, `customer_id`, `quote_number`, `status`, `issue_date`, `due_date`, `expiry_date`, `subtotal`, `discount_total`, `tax_total`, `fee_total`, `total`, `amount_paid`, `amount_due`, `notes`, `terms`, `public_token`, `is_accepted`, `accepted_at`, `converted_invoice_id`, `created_at`, `updated_at`. The `quote_items` and `quote_fees` tables mirror invoices.

### Missing Fields & Logic Needed

#### A. Automatic Expiration Date Calculation

**Current state:** `expiryDate` is set client-side in `useQuoteBuilder.ts:44` (`addDaysISO(todayISO(), 60)`). The backend does not auto-calculate it.

**Requirement:** The backend should default `expiry_date` from a business-level config when none is provided, or auto-calculate from `issue_date` + `default_validity_days`.

**Implementation:**
1. Add a `default_quote_validity_days` column to the `businesses` table (migration):
   ```sql
   ALTER TABLE businesses ADD COLUMN IF NOT EXISTS default_quote_validity_days INTEGER DEFAULT 30;
   ```
2. In `QuoteService.create()` (`quote-service.ts:171`), if `input.expiryDate` is null and `issueDate` is set, compute `expiryDate = issueDate + business.default_quote_validity_days`.
3. Add an `expireQuotes` background job (cron/scheduler stub) that moves expired quotes from `sent` → `expired` status. The schema already has `status = 'expired'` in the enum (`001_initial_schema.sql:389`).

#### B. Tax Automation

**Current state:** Tax rates are per-line-item, set manually. The `tax_service.ts` exists but is only wired for invoices, not quotes.

**Requirement:** Quotes should auto-populate tax rates based on customer location + business nexus, same as invoices.

**Implementation:**
1. In `QuoteService.create()`, if a line item has no `taxRate` specified (or it's "0"), query `taxService.getRate(businessId, { customerCountry, customerState, productTaxCategory })` to auto-fill.
2. Re-use the existing `tax-service.ts` abstraction — it already has `manual-provider.ts` and a `types.ts` with `TaxRateInput` and `TaxRateResult`.
3. Store the resolved tax rate per line item (already supported via `quote_items.tax_rate`).

#### C. Deposit Tracking

**Current state:** The `quotes` table has `amount_paid` and `amount_due` but no deposit-specific fields. The invoice system has deposit columns (`deposit_type`, `deposit_value`, `deposit_due_date`, `deposit_paid`, `deposit_due`) referenced in `PublicInvoice.tsx:41-44`.

**Requirement:** Quotes need their own deposit tracking to communicate required deposit before work begins.

**Implementation Plan:**

**Migration 042 (new):**
```sql
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS deposit_type VARCHAR(20) NOT NULL DEFAULT 'none',  -- 'none' | 'percentage' | 'fixed'
  ADD COLUMN IF NOT EXISTS deposit_value NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_due_date DATE,
  ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN quotes.deposit_type IS 'none | percentage | fixed';
COMMENT ON COLUMN quotes.deposit_value IS 'percentage: 0-100; fixed: currency amount';
```

**Service layer changes (`quote-service.ts`):**
- Add `QuoteCreateInput.depositType`, `depositValue`, `depositDueDate` fields.
- In `persistTotals()`, compute `deposit_due = deposit_amount` (percentage of total or fixed) and store.
- Add `recordDepositPayment(quoteId, amount)` method that increments `amount_paid` and sets `deposit_paid = true` when `amount_paid >= deposit_due`.
- Add `markExpired()` method called by the cron job.

**API route (`src/index.ts`):**
- `PATCH /api/quotes/:id/deposit` — record deposit payment (idempotent, like invoice payments).
- `POST /api/quotes/:id/accept` — mark as accepted by customer (sets `status = 'accepted'`, `is_accepted = true`, `accepted_at = NOW()`).
- `POST /api/quotes/:id/reject` — mark as rejected.
- `GET /api/public/quotes/:token` — public-facing quote view (mirrors `GET /api/public/invoices/:token`).

#### D. Public Token & Customer-Facing Portal

**Current state:** `quote-service.ts:405` has `setPublicToken()` (30-day expiry). `send()` generates the token and sends email. But there's **no public quote route or public view page**.

**Requirement:** Customers should view quotes online and accept/reject electronically.

**Implementation:**
1. Add `GET /api/public/quotes/:token` route in `src/index.ts` — returns quote data with rendered HTML (like `getPublicInvoice`).
2. Add `GET /api/public/quotes/:token/pdf` route.
3. Add `POST /api/public/quotes/:token/accept` and `POST /api/public/quotes/:token/reject` routes.
4. Add `POST /api/public/quotes/:token/view` to record view.
5. Add `getPublicQuote(token)` method to `QuoteService` (mirrors `invoiceService.getPublicInvoice`).
6. Add `recordQuoteView(token)` method.
7. Create `PublicQuote.tsx` page in the frontend (mirrors `PublicInvoice.tsx:60`).
8. Add route in `App.tsx:92`: `<Route path="/public/quote/:token" element={<PublicQuote />} />`.

#### E. Deposit Payment on Public View

The public quote page should allow depositing via Stripe (if configured) or stub provider. Reuse the `createPaymentIntentPublic` + `payInvoicePublic` pattern from the invoice public flow.

---

## 4. UX/UI Recommendations

### A. Presentation Strategy: Interactive Web Form + Downloadable PDF + Online Approval Portal

The quote should be presented across **three layers**, all integrated:

#### Layer 1: Internal Builder (Interactive Web Form)
- **What:** `QuoteBuilder.tsx` (already exists) — the form where staff create/edit quotes.
- **Improvements needed:**
  - Add deposit configuration fields in `QuoteDetailsForm.tsx` (deposit type, value, due date).
  - Add a "Scope of Work" textarea field.
  - Rename "Total" → "Estimated Total" in `QuoteSummary.tsx` and `QuoteTotals.tsx`.
  - Add an expiry date warning indicator when <7 days remaining.
  - Add "Accept"/"Reject" buttons in the Review & Send dialog to preview the customer-facing flow.

#### Layer 2: PDF (Downloadable/Exportable)
- **What:** Generated by `quote-service.ts:generatePdf` using a **dedicated quote Handlebars template** (new `DEFAULT_QUOTE_TEMPLATE`).
- **Improvements needed:**
  - Create `DEFAULT_QUOTE_TEMPLATE` in `template-renderer.ts` with quote-specific labeling.
  - The template should include: "Valid Until" prominently, "Estimated Total", "Scope of Work", deposit amount in totals, acceptance signature lines, electronic acceptance hint.
  - Reuse all existing helpers: `formatMoney`, `formatRate`, `nl2br`, `add`.

#### Layer 3: Customer-Facing Online Approval Portal
- **What:** `PublicQuote.tsx` page at `/public/quote/:token` — the destination when a customer clicks the link in the quote email.
- **Features:**
  - Renders the same HTML template as the PDF (server-rendered, same as `PublicInvoice` does).
  - Shows status badge: "Sent" / "Viewed" / "Accepted".
  - Shows expiry warning if expired.
  - **Accept button:** POSTs to `/api/public/quotes/:token/accept` → sets status to "accepted", records `accepted_at`.
  - **Reject button:** POSTs to `/api/public/quotes/:token/reject` → sets status to "rejected", records `rejected_at`.
  - **Deposit payment:** If deposit is configured and not yet paid, shows a "Pay Deposit" button (Stripe if configured, stub fallback).
  - **Download PDF:** Same as invoice public view.
  - **Print:** Browser print button.
  - **Mobile-first layout:** The existing `PublicInvoice.tsx` uses `max-w-4xl` with responsive grid — reuse the same pattern.

### B. UI Best Practices

Based on the codebase's existing patterns (see `AGENTS.md` UI Quality Standards and `PublicInvoice.tsx`):

1. **Consistent with Invoice public view**: Use the same card/shadow/spacing language as `PublicInvoice.tsx` so quotes feel like a first-class document type, not a hack.
2. **Status badges**: Reuse the `STATUS_CONFIG` pattern from `InvoicePreview.tsx` but add quote statuses: `draft`, `sent`, `viewed`, `accepted`, `rejected`, `expired`.
3. **Empty states**: Follow `EmptyState.tsx` component patterns (importable from `@/components/ui/EmptyState`).
4. **Loading states**: Use `animate-pulse` skeleton (already in `QuoteBuilder.tsx:119-133`).
5. **Error handling**: Follow the `.catch` pattern in `ReportSection.tsx` — surface errors to the user, don't silently swallow.
6. **Deposit flow**: Mirror the deposit payment UI from `PublicInvoice.tsx:296-331` — warning-colored banner, deposit paid/due display, "Pay Deposit Now" primary button.
7. **Expiration awareness**: Add a prominent banner when a quote is expired or expiring soon (within 7 days), similar to the "Overdue" indicator in `InvoicePreview.tsx:92-99`.
8. **Accessibility**: Reuse existing patterns — `aria-label` attributes, `<span className="sr-only">`, focus rings, semantic headings.

### C. State Machine for Quotes

Extend the existing pattern (`invoice-state-machine.ts`) for quotes:

```
draft → sent → viewed → accepted → (converted to invoice)
                    → rejected
                    → expired (auto, when expiry_date passes)
```

The `status` column already supports all these values (`001_initial_schema.sql:389`).

---

## Implementation Priority

| Priority | Task | Files to Create/Modify |
|---|---|---|
| **P0** | Create dedicated `DEFAULT_QUOTE_TEMPLATE` (Handlebars) | `src/services/templates/template-renderer.ts` |
| **P0** | Add deposit fields migration | New: `src/db/migrations/042_quote_deposit_fields.sql` |
| **P0** | Add `default_quote_validity_days` to businesses migration | New: `src/db/migrations/043_business_quote_validity.sql` |
| **P0** | Extend `QuoteService.create()` with auto-expiry + deposit fields | `src/services/quote-service.ts` |
| **P0** | Add public quote API routes | `src/index.ts` |
| **P0** | Add `getPublicQuote`, `recordQuoteView`, `accept`, `reject`, `recordDepositPayment` to `QuoteService` | `src/services/quote-service.ts` |
| **P1** | Create `PublicQuote.tsx` page | New: `webapp/src/pages/PublicQuote.tsx` |
| **P1** | Add route in App.tsx | `webapp/src/App.tsx` |
| **P1** | Add API client functions | `webapp/src/api/client.ts` |
| **P1** | Rename "Total" → "Estimated Total" in summary/totals | `QuoteSummary.tsx`, `QuoteTotals.tsx`, `ReviewAndSendDialog.tsx` |
| **P1** | Add deposit fields to `QuoteDetailsForm.tsx` | `webapp/src/components/QuoteBuilder/QuoteDetailsForm.tsx` |
| **P1** | Add "Scope of Work" field to `QuoteDetailsForm.tsx` | `webapp/src/components/QuoteBuilder/QuoteDetailsForm.tsx` |
| **P2** | Add quote state machine service | New: `src/services/state-machine/quote-state-machine.ts` |
| **P2** | Add `expireQuotes` cron job | `src/index.ts` or new scheduler module |
| **P2** | Add quote acceptance to `ReviewAndSendDialog` | `ReviewAndSendDialog.tsx` |
| **P2** | Add quote templates to template gallery (filter by `documentType = 'quote'`) | `DocumentTemplateGallery.tsx`, template service |

---

## Files Already in Good Shape

- `webapp/src/pages/Quotes.tsx` — list page with status filters, pagination, PDF download, convert to invoice. No changes needed.
- `webapp/src/pages/QuoteDetail.tsx` — detail page with action buttons. Rename "Total" label if present.
- `webapp/src/components/QuoteBuilder/QuoteBuilder.tsx` — main builder. Wire in new fields.
- `webapp/src/components/QuoteBuilder/LineItemsTable.tsx` — line items. No changes needed.
- `webapp/src/components/QuoteBuilder/FeesSection.tsx` — fees. No changes needed.
- `webapp/src/components/QuoteBuilder/QuoteLineCard.tsx` — line card editor. No changes needed.
- `src/services/calculation.ts` — calculation engine. Reused as-is.
- `src/services/templates/structured-renderer.ts` — structured renderer. Can be reused for quotes with document-type awareness.
- `src/services/pdf/pdf-service.ts` — PDF generation. Reused as-is.
- `src/services/email/email-service.ts` — email sending. Reused as-is.
- `src/services/numbering/service.ts` — atomic numbering. Reused for quotes.
