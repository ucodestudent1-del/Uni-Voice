# PRD: Credit Note Module

## Executive Summary

| **Field** | **Value** |
|---|---|
| Document | PRD_Credit_Note_Module.md |
| Created | 2026-10-12 |
| Author | Engineering |
| Status | Approved for Frontend Implementation |
| Priority | P1 (post-invoice parity) |
| Phase | Phase 2 (Documents) extension |

### Purpose

This document specifies the product requirements for the **Credit Note Module** — a feature that allows users to issue credit notes (credit memos) against invoices, apply them to reduce receivables, and manage the full credit lifecycle from draft through refund.

### Context

The backend credit note infrastructure is fully implemented (Phase 2 of the Universal Invoice Generator). The database schema, calculation engine integration, API routes, and service-layer logic all exist and are production-ready. What remains is the **frontend UI**: the views, editors, and workflows that let finance teams create, list, view, and apply credit notes.

### Scope

**In Scope**
- Credit note list page with filtering, sorting, and pagination
- Credit note detail page with full read-only view
- Credit note creation form (single-page, editable, real-time calculations)
- Credit note application workflow (apply credit to an outstanding invoice)
- Status badge display and status transition visualization
- PDF generation and email delivery (via existing backend services)
- Tenant isolation and permission checks (backend-enforced)

**Out of Scope**
- Credit note cancellation or voiding (may be added in a follow-up)
- Refund processing (backend `refunded` status and `partially_refunded` status exist but refund execution is a separate payment feature)
- Recurring credit notes / automated credit issuance

## User Stories

### As an Accounting Manager
- I want to see all credit notes in a single list so I can review what has been issued.
- I want to filter credit notes by reference invoice and search by number so I can find specific ones quickly.
- I want to see the status of each credit note (draft, finalized, sent, applied, partially applied, etc.) so I know what still needs attention.
- I want to click into a credit note to see all its details: line items, taxes, fees, reason, notes, and application history.

### As an Invoice Creator
- I want to create a credit note from an existing invoice so I can correct errors or issue refunds for returns.
- I want the credit note form to pre-fill the customer and currency from the source invoice so I don't have to re-enter them.
- I want to add line items with descriptions, quantities, unit prices, discounts, and tax rates, just like invoices.
- I want to see real-time calculation updates (subtotal, tax total, fee total, grand total) as I edit so I can verify correctness.
- I want to add custom fees and see them included in the total.
- I want to enter a reason (e.g., "Return", "Abatement", "Correction") and optional notes and terms so the customer understands why.
- I want to finalize the credit note and see a confirmation that it was issued successfully.
- I want to send the credit note via email to the customer directly from the UI.
- I want to download or preview the credit note as a PDF.

### As an Accounts Receivable Clerk
- I want to apply a credit note to an outstanding invoice so I can reduce the customer's balance.
- I want to see how much credit is remaining and how much is already applied so I don't over-apply.
- I want to apply a partial amount if needed so I can match it to a specific open amount on the invoice.
- I want to see the application recorded in the credit note's application history so there is an audit trail.

### As an Administrator
- I want status badges and colors to be consistent with the rest of the application so the UI feels cohesive.
- I want the UI to handle empty states gracefully so pages don't look broken when there is no data.
- I want the UI to handle loading and error states so users always know what is happening.

## Current State

### Backend (fully implemented)

| Component | Location | Status |
|---|---|---|
| Database schema | `src/db/migrations/013_invoice_lifecycle.sql`, `035`, `046`, `047`, `048`, `054` | Complete |
| Service methods | `src/services/invoice-service.ts` lines 1272–1566 | Complete |
| API routes | `src/index.ts` lines 1348–1391 | Complete |
| Types | `webapp/src/types/api.ts` lines 368–497 | Complete |

### Frontend (not yet implemented)

| Component | Status |
|---|---|
| API client functions | `webapp/src/api/client.ts` lines 1440–1479 — **exists** |
| Credit note routes in `App.tsx` | **Missing** |
| Credit note list page | **Missing** |
| Credit note detail page | **Missing** |
| Credit note creation/edit form | **Missing** |
| Credit note apply workflow | **Missing** |
| Status badge config for credit notes | **Missing** (existing `invoiceStatusConfig` can be referenced) |
| Shared components available | `PageHeader`, `SectionCard`, `FormField`, `FormTextareaField`, `ConfirmationDialog`, `DataTable`, `StatusBadge`, `Button`, `Money`, `EmptyState` — all **available** |

### Credit Note Data Model

The `ApiCreditNote` interface (`webapp/src/types/api.ts:408`) defines the full shape:

```typescript
interface ApiCreditNote {
  id: string;
  business_id: string;
  customer_id?: string | null;
  reference_invoice_id?: string | null;
  reference_invoice_number?: string | null;
  credit_note_number?: string | null;
  status: "draft" | "finalized" | "sent" | "partially_applied" | "applied"
       | "partially_refunded" | "refunded" | "cancelled" | "void" | string;
  issue_date?: string | null;
  currency: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  fee_total: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  applied_total?: string;
  reason?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
  terms?: string | null;
  is_finalized: boolean;
  finalized_at?: string | null;
  sent_at?: string | null;
  cancelled_at?: string | null;
  cancelled_reason?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  public_token?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  items: ApiCreditNoteItem[];
  fees: ApiCreditNoteFee[];
  applications: ApiCreditNoteApplication[];
}
```

### Credit Note Status Enum

| Status | Description |
|---|---|
| `draft` | Created but not yet finalized. Can be edited. |
| `finalized` | Finalized and locked. Cannot be edited. |
| `sent` | Sent to the customer. Cannot be edited. |
| `partially_applied` | Partially applied to one or more invoices. |
| `applied` | Fully applied to invoices. |
| `partially_refunded` | Partially refunded in cash. |
| `refunded` | Fully refunded in cash. |
| `cancelled` | Cancelled before sending. |
| `void` | Voided after sending (error correction). |

### Available Backend API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/credit-notes` | Create a credit note (auto-finalizes) |
| `GET` | `/api/credit-notes` | List credit notes with filters (`invoiceId`, `limit`, `offset`) |
| `GET` | `/api/credit-notes/:id` | Get a single credit note by ID |
| `POST` | `/api/credit-notes/:id/apply` | Apply a credit note to an invoice |

### Existing Frontend API Client Functions

```typescript
// webapp/src/api/client.ts
listCreditNotes(businessId, filters)
getCreditNote(businessId, creditNoteId)
createCreditNote(businessId, payload)
applyCreditNote(businessId, creditNoteId, payload)
```

### Design System

The application uses a semantic CSS token system (`webapp/src/index.css`) with light and dark themes. Key status color tokens:

| Token | Light | Dark | Used For |
|---|---|---|---|
| `--color-success` | `34 197 94` (green-500) | `74 222 128` (green-400) | Finalized/applied states |
| `--color-warning` | `245 158 11` (amber-500) | `251 191 21` (amber-400) | Draft/partial states |
| `--color-info` | `59 130 246` (blue-500) | `96 165 250` (blue-400) | Sent states |
| `--color-error` | `239 68 68` (red-500) | `248 113 113` (red-400) | Cancelled/void states |
| `--color-tertiary` | `71 85 105` (slate-600) | `148 163 184` (slate-500) | Refunded/inactive states |

Badge class patterns: `status-warning-bg`, `status-success-bg`, `status-info-bg`, `status-error-bg`, `status-tertiary-bg` (and corresponding `-text` variants).

## Functional Specifications

### 1. Credit Note List Page

**Route:** `/credit-notes`

#### UI Elements
- **PageHeader** with title "Credit Notes", description "Manage credit notes and credit memos.", and a primary action button "New Credit Note" linking to `/credit-notes/new`
- **Filter bar** above the table containing:
  - Search input (credit note number)
  - Reference invoice filter (dropdown or text)
  - Status filter (multi-select dropdown)
- **DataTable** with columns:
  - Credit Note Number (sortable)
  - Status Badge (using a new `creditNoteStatusConfig`)
  - Issue Date (sortable)
  - Reference Invoice (sortable)
  - Customer Name
  - Total (right-aligned, using `Money` component with `signed` prop for negative display)
  - Applied (right-aligned)
  - Balance Due (right-aligned)
  - Actions (View button → `/credit-notes/:id`)

#### Behavior
- Fetches up to 100 credit notes by default (matching invoice list pattern)
- Supports pagination via `limit` and `offset` query params
- Supports `invoiceId` filter to show credit notes for a specific invoice
- Shows loading spinner while fetching
- Shows `EmptyState` when no credit notes exist ("No credit notes found")
- Shows `EmptyState` when filters return no results ("No credit notes match your filters")

### 2. Credit Note Detail Page

**Route:** `/credit-notes/:id`

#### UI Elements
- **PageHeader** with title "Credit Note #{creditNoteNumber}", breadcrumbs [Credit Notes > #number]
- **Status badge** at the top showing current status
- **SectionCard** "Credit Note Details" containing:
  - Issue date
  - Reference invoice (linked to invoice detail if exists)
  - Currency
  - Customer information (name, email, address)
  - Reason, Notes, Terms (if populated)
  - Internal Notes (only visible to internal users)

- **SectionCard** "Line Items" containing a table:
  - Description
  - Quantity
  - Unit
  - Unit Price
  - Tax Rate
  - Tax Amount
  - Line Total
  - Total row with subtotal, discount, tax, fees, grand total

- **SectionCard** "Applications" showing the application history:
  - If no applications: "This credit note has not been applied to any invoice yet."
  - If applications exist: table with Invoice, Date, Amount Applied

- **Action buttons** (visible based on status):
  - "Send" (when status is `finalized`) — opens send email dialog
  - "Download PDF" (always) — triggers PDF download
  - "Apply to Invoice" (when status is `finalized` or `sent` and balance > 0) — opens apply dialog

### 3. Credit Note Creation Page

**Route:** `/credit-notes/new?invoiceId=<uuid>`

#### Prerequisites
- The `invoiceId` query parameter is required (credit notes are always created against a specific invoice)
- On load, fetch the referenced invoice to pre-fill customer and currency

#### UI Elements
- **PageHeader** with title "New Credit Note" and back link to credit note list
- **SectionCard** "Source Invoice" (read-only summary):
  - Invoice number (linked)
  - Customer name and email
  - Invoice total and balance due

- **SectionCard** "Credit Note Details":
  - Reason selector (dropdown: "Return", "Abatement", "Correction", "Other")
  - If "Other" is selected: show a text input for custom reason
  - Notes textarea (optional)
  - Terms textarea (optional, with default terms from business settings)

- **SectionCard** "Line Items" (editable):
  - Uses the same line item editor component as the invoice creation form
  - Each line item has: Description (required), Quantity, Unit, Unit Price, Tax Rate, Tax Name, Is Tax Inclusive toggle
  - "Add Line Item" button
  - "Remove" button per line item
  - Real-time recalculation as items are edited or removed

- **SectionCard** "Fees" (editable):
  - Each fee has: Description (required), Amount, Tax Rate, Tax Name
  - "Add Fee" button
  - "Remove" button per fee
  - Fees are subtracted from the total (negative) or added (positive)

- **SectionCard** "Totals" (read-only, real-time):
  - Subtotal
  - Discount Total
  - Tax Total
  - Fee Total
  - Grand Total (shown in bold, with `Money` component using `signed` prop to indicate credit)

- **Action bar** at the bottom:
  - "Cancel" button (secondary, navigates back)
  - "Finalize & Send" button (primary, triggers creation + email)

#### Behavior
- The form is a **single page** — no step-by-step wizard
- All calculations happen client-side using the `CalculationEngine` from `webapp/src/utils/calculation.ts`
- The `Money` component displays credit amounts in red (using `status-error-text` or inline styling) per the `signed` prop
- On "Finalize & Send":
  - Validates required fields (at least one line item, reason selected, customer exists)
  - Transforms form data to the API payload shape
  - Calls `createCreditNote` API
  - Shows success toast and navigates to the detail page
  - Shows error toast if validation or API fails

### 4. Credit Note Apply Workflow

**Access:** From the credit note detail page, clicking "Apply to Invoice"

#### Modal / Dialog
- **Title:** "Apply Credit Note"
- **Body:**
  - Total credit amount (read-only)
  - Already applied amount (read-only)
  - Remaining credit amount (read-only, bold)
  - Dropdown to select target invoice (only shows invoices for the same customer with an outstanding balance)
  - Amount to apply input (defaults to the lesser of remaining credit or invoice balance due)
  - Invoice balance due for the selected invoice (read-only, updates when invoice selection changes)

- **Buttons:**
  - "Cancel" (secondary)
  - "Apply Credit" (primary)

#### Behavior
- On "Apply Credit":
  - Validates amount > 0 and amount <= remaining credit
  - Validates selected invoice belongs to the same customer
  - Calls `applyCreditNote` API
  - On success: shows success toast, closes dialog, refreshes credit note data
  - On error: shows error toast with the backend-provided message
- After application, the credit note status may change to `partially_applied` or `applied` automatically (backend handles this)

### 5. Credit Note Send / PDF

**Access:** From the credit note detail page

- "Download PDF" calls `GET /api/credit-notes/:id/pdf` (to be added to backend — see Future Enhancements)
- "Send" opens a dialog with:
  - To: customer email (pre-filled, editable)
  - Subject: default "Credit Note #{number}"
  - Message: default template with credit note details
  - Send button

## Status Badge Mapping

A new `creditNoteStatusConfig` should be created following the pattern of `invoiceStatusConfig` in `webapp/src/components/ui/StatusBadge.tsx`:

| Status | Label | Badge Classes | Dot Color |
|---|---|---|---|
| `draft` | Draft | `status-warning-bg status-warning-text` | `--color-warning` |
| `finalized` | Finalized | `status-info-bg status-info-text` | `--color-info` |
| `sent` | Sent | `status-info-bg status-info-text` | `--color-info` |
| `partially_applied` | Part. Applied | `status-warning-bg status-warning-text` | `--color-warning` |
| `applied` | Applied | `status-success-bg status-success-text` | `--color-success` |
| `partially_refunded` | Part. Refunded | `status-warning-bg status-warning-text` | `--color-warning` |
| `refunded` | Refunded | `status-tertiary-bg status-tertiary-text` | `--color-tertiary` |
| `cancelled` | Cancelled | `status-tertiary-bg status-tertiary-text` | `--color-tertiary` |
| `void` | Void | `status-error-bg status-error-text` | `--color-error` |

## Calculation Engine Integration

The frontend `CalculationEngine` (`webapp/src/utils/calculation.ts`) accepts `CalculationEngineInput` with `lineItems` and `fees`. Credit notes use the same input structure as invoices, so the existing engine can be reused with no modification.

Key methods:
- `CalculationEngine.calculate(input: InvoiceCalculationInput): CalculationResult`
- Returns `CalculatedLineItem[]` with per-line tax amounts
- All math uses `decimal.js` (integer minor-unit math, never float)

## Validation Rules

### Client-Side Validation
| Field | Rule | Error Message |
|---|---|---|
| Reason | Required | "Please select a reason for this credit note." |
| Line Items | At least one required | "Add at least one line item." |
| Line Item → Description | Required | "Description is required." |
| Line Item → Quantity | Must be > 0 | "Quantity must be greater than 0." |
| Line Item → Unit Price | Must be >= 0 | "Unit price must be 0 or greater." |
| Fee → Description | Required | "Fee description is required." |
| Fee → Amount | Must be a number | "Fee amount must be a number." |
| Apply → Amount | Must be > 0 | "Amount must be greater than 0." |
| Apply → Amount | Must be <= remaining credit | "Cannot apply more than the remaining credit." |

### Backend Validation (already implemented)
- `createCreditNote` validates that the reference invoice exists and belongs to the business
- `createCreditNote` auto-finalizes the credit note (no separate finalize step)
- `applyCreditNote` validates:
  - Credit note exists and belongs to the business
  - Credit note status is `finalized` or `sent`
  - Target invoice exists, belongs to the business, and the customer matches
  - Application amount > 0
  - Application amount does not exceed remaining credit
  - Application amount does not exceed invoice balance due (capped automatically)

## State Machine

```
                    ┌──────────┐
                    │   draft  │
                    └────┬─────┘
                         │ (finalize — happens on creation)
                         │
                         ▼
                    ┌────────────┐
               ┌───▶│ finalized   │──────┐
               │    └─────┬──────┘      │
               │          │              │
               │          │ (send)      │
              │          ▼              │
              │    ┌─────────┐          │
              │    │   sent   │          │
              │    └────┬────┘          │
              │         │                │
              │         │ (apply)        │
              │         ▼                │
              │  ┌──────────────┐       │
              │  │ partially    │       │
      (cancel)│  │ _applied     │       │
      or(void)│  └─────┬───────┘       │
              │         │ (apply more)  │
              │         ▼               │
              │  ┌──────────┐           │
              │  │  applied  │           │
              │  └──────────┘           │
              │                          │
              │     (refund)             │
              ▼                          │
         ┌────────────┐                  │
         │ partially   │                  │
         │ _refunded    │                  │
         └─────┬───────┘                  │
               │ (full refund)            │
               ▼                          │
         ┌──────────┐                    │
         │ refunded  │                    │
         └──────────┘                    │
                                         │
        ┌──────────┐                     │
        │ cancelled │ ◄───────────────────┘
        │ (before send) │
        └──────────┘

        ┌──────────┐
        │   void    │ (error correction)
        └──────────┘
```

**Transitions:**
1. Creation → `finalized` (automatic on POST `/api/credit-notes`)
2. `finalized` → `sent` (via send action)
3. `finalized` or `sent` → `partially_applied` (via apply action with partial amount)
4. `finalized` or `sent` → `applied` (via apply action with full amount)
5. `partially_applied` → `applied` (via additional application)
6. `finalized` → `cancelled` (before send — not yet in frontend scope)
7. Any post-send state → `void` (error correction — not yet in frontend scope)
8. `applied` → `partially_refunded` / `refunded` (via refund — not yet in frontend scope)

## Document Management

### PDF Generation
- Credit notes should be renderable as PDFs using the existing PDF service (`src/services/pdf/pdf-service.ts`)
- A Handlebars template for credit notes should be created (separate from invoice template) or the invoice template adapted
- The `public_token` field allows external (unauthenticated) access to a credit note's PDF via a public link

### Email Delivery
- Credit notes can be emailed to customers using the existing email service (`src/services/email/email-service.ts`)
- The email template should be a credit-note-specific template or adapted from the invoice email template
- The `sent_at` timestamp is set when the credit note is sent

### Events / Audit Trail
- Credit note creation logs an `invoice_event_type` event (`credit_note_applied`) on the reference invoice
- Credit note application logs a `credit_note_applied` event on the target invoice
- The `ApiCreditNoteEvent` type (`webapp/src/types/api.ts:472`) captures all credit note events for display in the detail page timeline

## Internationalization

- Currency formatting uses `formatCurrencyValue` (cached `Intl.NumberFormat` per currency)
- All currencies supported by the `SUPPORTED_CURRENCIES` array (28 currencies)
- Currency metadata (symbol, decimal places, minor unit name) comes from `CurrencyMetadata`
- Dates use `formatDate` utility from `webapp/src/utils/format.ts`

## Accessibility

- All interactive elements have accessible labels
- Status badges have `aria-label` with status and description
- Modal dialogs use proper focus trapping and escape-to-close
- Form fields have associated `<label>` elements and error messages with `aria-live="polite"`
- Empty states include descriptive text for screen readers

## Future Enhancements (Post-MVP)

1. **Credit note cancellation** — allow cancelling a credit note in `draft` or `finalized` (before send) status
2. **Credit note voiding** — allow voiding a sent credit note for error correction
3. **Refund processing** — wire up the `refunded` and `partially_refunded` statuses to actual payment provider refunds
4. **Public credit note view** — allow customers to view credit notes via `/api/public/credit-note/:token` (mirroring the public invoice view)
5. **Credit note PDF endpoint** — `GET /api/credit-notes/:id/pdf` for direct PDF download
6. **Batch credit notes** — allow creating credit notes for multiple invoices at once

## Related Documents

- `PRD_Invoice_Creation_Module.md` — structural template for this document
- `PRD_Invoice_Interface.md` — UI/UX reference for invoice patterns
- `credit-notes-ui-restructuring-plan.md` — audit of existing credit note data model
- `AGENTS.md` — project commands and architecture overview
