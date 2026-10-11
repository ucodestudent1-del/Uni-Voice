# Product Requirements Document (PRD)
## SaaS Invoice Creation Module

**Document Status:** Draft v1.0  
**Last Updated:** 2026-10-11  
**Product Owner:** Senior Product Manager & UX Architect  
**Target Release:** Phase 5  

---

## 1. Executive Summary

### Product Vision

The Invoice Creation Module is the core workflow of the Universal Invoice Generator SaaS. It enables users — primarily SMB owners, accountants, and freelancers — to create, edit, finalize, send, and track professional invoices through a single-page, split-screen interface with real-time calculation.

The module sits at the intersection of the **Frontend Document Model** (`webapp/src/document-model/`) and the **Backend Domain Layer** (`src/domain/`), bridging a structured drag-and-drop editor with a server-authoritative calculation engine.

### Current State

After codebase analysis, the following components exist:

| Layer | Component | Location | Status |
|---|---|---|---|
| **Frontend calculation engine** | `CalculationEngine` with `decimal.js` | `webapp/src/utils/calculation.ts:32` | ✅ Complete, tested |
| **Backend calculation engine** | `CalculationEngine` (Decimal + ROUND_HALF_UP) | `src/domain/calculation.ts:93` | ✅ Complete |
| **Invoice data model** | `Invoice`, `InvoiceLineItem`, `InvoiceFee`, `InvoiceEvent` | `src/domain/models/index.ts:137` | ✅ Complete |
| **Currency support** | 29 currencies with metadata (symbol, decimal places, locale) | `src/domain/value-objects/currency.ts`, `webapp/src/types/currency.ts:4` | ✅ Complete |
| **Design tokens / theme** | Semantic status colors, typography, form controls | `webapp/src/styles/index.css` | ✅ Complete |
| **UI primitives** | `StatusBadge`, `Button`, `Money`, `FormField`, `EmptyState`, `PageHeader`, `SectionCard` | `webapp/src/components/ui/` | ✅ Complete, polished |
| **Document template model** | 24 component types, structured layout, renderer, schema validation | `webapp/src/document-model/types.ts:70` | ✅ Complete |
| **Credit note data model** | `credit_notes`, `credit_note_items`, `credit_note_fees`, `credit_note_applications` | `src/db/migrations/013_invoice_lifecycle.sql:45` | ✅ Schema complete |
| **Invoice status enum** | 8 statuses: draft, sent, viewed, partially_paid, paid, overdue, cancelled, void | `src/db/migrations/001_initial_schema.sql:145` | ✅ Complete |
| **Draft autosave** | `EditorContext` with debounced autosave + beforeunload guard | `webapp/src/document-model/editor/EditorContext.tsx` | ✅ Complete (for templates) |
| **PDF service** | Pluggable abstraction | `src/services/pdf/pdf-service.ts:53` | ✅ Exists (needs invoice integration) |
| **Email service** | Stub provider with template rendering | `src/services/email/email-service.ts` | ✅ Exists |

### What's Missing

The invoice creation/editing/viewing workflow is **not yet wired up** at the application layer. Specifically:

1. **No invoice CRUD routes** exist in `src/index.ts` — the existing PRD (`PRD_Invoice_Interface.md`) references `InvoiceWorkspace`, `InvoiceDetail`, `InvoicePreview`, and `PublicInvoice` components that do not exist in the `webapp/` codebase.
2. **No invoice state machine** — the AGENTS_PLAN references `src/services/state-machine/` with `ALLOWED_TRANSITIONS`, but no such directory exists. Status transitions are handled by ad-hoc SQL.
3. **No frontend invoice pages** — `App.tsx` has no routes for invoices (only projects, receipts, customers, products, templates).
4. **No `InvoiceService`** in the backend — only repositories exist for customers, products, projects, and templates.

This PRD defines the complete specification for building the invoice creation module from scratch, using the existing data models and infrastructure as the foundation.

---

## 2. User Personas

| Persona | Role | Goals | Pain Points |
|---|---|---|---|
| **SMB Owner** (Sarah) | Small business owner, 1–10 employees | Create invoices quickly, get paid faster | Too many clicks, complex software |
| **Accountant** (Alex) | CPA managing 50+ clients | Accurate calculations, audit trail, batch operations | Manual data re-entry, rounding errors |
| **Freelancer** (Jamie) | Solo consultant | Professional invoices, brand consistency, mobile-friendly | Templates don't match brand |
| **Finance Manager** (Maria) | Mid-market, 50–500 employees | Approval workflows, payment tracking, AR management | No visibility into overdue invoices |

---

## 3. User Stories

### 3.1 Invoice Creation & Draft Management

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-CREATE-1 | SMB Owner | start from a blank invoice or an existing template | I don't waste time on setup |
| US-CREATE-2 | Accountant | see a split-screen with the edit form on the left and a live preview on the right | I can verify the invoice looks correct as I type |
| US-CREATE-3 | Freelancer | have the form save automatically as I work | I never lose my progress |
| US-CREATE-4 | Finance Manager | see a clear "Saving…" / "Saved" indicator | I know whether my changes are persisted |
| US-CREATE-5 | SMB Owner | get inline validation errors without pop-ups | I can fix problems quickly without disruption |

### 3.2 Customer Selection & Details

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-CUSTOMER-1 | SMB Owner | select an existing customer from a searchable dropdown | I don't have to retype customer info |
| US-CUSTOMER-2 | Accountant | add a new customer inline during invoice creation | I can capture new customers without leaving the invoice |
| US-CUSTOMER-3 | Freelancer | have the customer's default currency and payment terms pre-filled | I always use their preferred terms |

### 3.3 Line Item Management

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-LINE-1 | Accountant | add line items with description, quantity, unit price, discount, and tax | I can bill for any service or product |
| US-LINE-2 | SMB Owner | see subtotals and totals calculated in real time as I edit | I don't have to do math manually |
| US-LINE-3 | Accountant | reorder line items by dragging | The invoice reads in the right order for the client |
| US-LINE-4 | Freelancer | duplicate a line item I use frequently | I don't retype common entries |
| US-LINE-5 | SMB Owner | delete a line item with a clear undo affordance | I can fix mistakes easily |
| US-LINE-6 | Accountant | apply both line-level and invoice-level discounts | I can offer flexible pricing |
| US-LINE-7 | SMB Owner | mark items as tax-inclusive with a toggle | The price I quote already includes tax |

### 3.4 Real-Time Calculation Engine

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-CALC-1 | Accountant | the calculation engine to use integer minor-unit math (Decimal.js) | There are never floating-point rounding errors |
| US-CALC-2 | Accountant | tax broken down by rate with a per-rate summary | I can verify tax compliance at a glance |
| US-CALC-3 | Finance Manager | fees (e.g. shipping, processing) added as separate line items | I can track extra charges clearly |
| US-CALC-4 | Accountant | the backend to re-validate all calculations on finalize | The published invoice is always correct |

### 3.5 Payment Terms & Dates

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-DATE-1 | SMB Owner | issue date to default to today and due date to be set via payment terms | I save clicks on every invoice |
| US-DATE-2 | Freelancer | choose from standard payment terms (Net 7, Net 15, Net 30, etc.) | I don't calculate dates manually |
| US-DATE-3 | Accountant | set custom due dates | I handle edge-case billing cycles |

### 3.6 Currency & Multi-Currency

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-CURR-1 | Freelancer (international) | select from 29 supported currencies | My international clients see the right currency |
| US-CURR-2 | Accountant | currency symbol and decimal places adapt automatically | There are no display errors for JPY (0 decimals) vs EUR (2 decimals) |

### 3.7 Reusable Products & Services

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-PRODUCT-1 | SMB Owner | select from a catalog of saved products/services when adding a line item | I don't retype descriptions and prices |
| US-PRODUCT-2 | Accountant | save a new product to the catalog from the line item | Future invoices are faster |

### 3.8 Invoice Finalization & Sending

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-SEND-1 | Finance Manager | a "Review & Send" step that shows validation errors before I send | I never send a broken invoice |
| US-SEND-2 | SMB Owner | to download a PDF of the finished invoice | I can attach it to an email manually if needed |
| US-SEND-3 | Freelancer | to email the invoice directly to the customer from the app | I get paid faster |
| US-SEND-4 | Finance Manager | to share a secure link to the invoice | Clients can view and pay online |

### 3.9 Invoice Status & Lifecycle

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-STATUS-1 | Finance Manager | to see clear status badges (Draft, Sent, Viewed, Partially Paid, Paid, Overdue, Cancelled, Void) | I can scan my invoice list and know where things stand |
| US-STATUS-2 | Accountant | an activity timeline showing all events (created, sent, viewed, paid, etc.) | I have an audit trail |
| US-STATUS-3 | Finance Manager | overdue invoices to be highlighted automatically | I prioritize follow-up |

### 3.10 Corrections & Data Integrity

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-CORRECT-1 | Accountant | issued invoices to be immutable — no silent edits | I maintain an audit trail |
| US-CORRECT-2 | Accountant | to issue a credit note for a correction | The original invoice stays intact for compliance |
| US-CORRECT-3 | Accountant | to void an incorrect invoice before it's paid | I can correct mistakes without creating noise |
| US-CORRECT-4 | Finance Manager | a full snapshot of the finalized invoice to be saved | The PDF I sent matches the record in the system |

---

## 4. Functional Specifications

### 4.1 Real-Time Calculation Engine

#### Architecture

The calculation engine exists in two places:

1. **Frontend** (`webapp/src/utils/calculation.ts:32`) — `CalculationEngine` class using `decimal.js`. Runs client-side for instant feedback on the live preview. This is a **best-effort preview** — the backend is authoritative.

2. **Backend** (`src/domain/calculation.ts:93`) — `CalculationEngine` class using `decimal.js` with `ROUND_HALF_UP`. Runs on every `finalize` and `update` to validate that the frontend's preview matches.

#### Calculation Rules

| Rule | Description | Implementation |
|---|---|---|
| **Line subtotal** | `quantity × unitPrice`, rounded to `decimalPlaces` | `calculation.ts:120` |
| **Line discount** | Applied to line subtotal. `fixed` subtracts absolute amount; `percentage` takes % off | `calculation.ts:121` |
| **Invoice discount** | Applied to net subtotal (after line discounts), distributed proportionally across line items | `calculation.ts:147-161` |
| **Tax exclusive** | `taxableAmount × taxRate` added to line total | `calculation.ts:186-189` |
| **Tax inclusive** | Tax extracted from gross: `effectiveTaxable × (rate / (1 + rate))` | `calculation.ts:173-184` |
| **Fees** | Flat amount + optional tax, added to total | `calculation.ts:199-217` |
| **Rounding** | All intermediate values rounded to currency `decimalPlaces` using `ROUND_HALF_UP` | `calculation.ts:99-100` |
| **Amount due** | `total - amount_paid - credit_applied` | `calculation.ts:224` |

#### Data Types

```typescript
// Input (frontend → backend)
interface InvoiceCalculationInput {
  currency: CurrencyCode;
  lineItems: LineItemInput[];
  fees?: FeeInput[];
  invoiceDiscount?: DiscountDefinition;
  amountPaid?: Decimal.Value;
}

interface LineItemInput {
  description: string;
  quantity: Decimal.Value;
  unit: string;
  unitPrice: Decimal.Value;
  discount?: DiscountDefinition;
  taxRate: Decimal.Value;
  tax_name?: string | null;    // <-- carries tax rate name (FR-TAX-1)
  isTaxInclusive: boolean;
  sortOrder?: number;
}

// Output (backend → frontend)
interface CalculationResult {
  currency: CurrencyCode;
  decimalPlaces: number;
  lineItems: CalculatedLineItem[];
  fees: CalculatedFee[];
  subtotal: Decimal;
  discountTotal: Decimal;
  taxableTotal: Decimal;
  taxTotal: Decimal;
  feeTotal: Decimal;
  total: Decimal;
  amountDue: Decimal;
  amountPaid: Decimal;
  isTaxInclusive: boolean;
}
```

#### Validation Rules

| Condition | Error Thrown |
|---|---|
| `quantity ≤ 0` | `"Quantity must be greater than 0 for line item …"` |
| `unitPrice < 0` | `"Unit price must be >= 0 for line item …"` |
| `taxRate < 0` | `"Tax rate must be >= 0 for line item …"` |
| `fee amount < 0` | `"Fee amount must be >= 0 for fee …"` |
| `amountPaid < 0` | `"Amount paid must be >= 0"` |

### 4.2 Line Item Management

#### Operations

| Action | Behavior | Notes |
|---|---|---|
| **Add** | Appends a new row with empty fields + sensible defaults (qty=1, unit="each", tax=0%, exclusive) | New row auto-focuses the description field |
| **Duplicate** | Creates a copy of the line item with the same field values but a new ID | Shift+D keyboard shortcut |
| **Reorder** | Drag-and-drop via `dnd-kit` (already used in document model) | Visual drop indicator; `sort_order` updated on save |
| **Edit** | Any field change triggers live recalculation | Debounced autosave (500ms) |
| **Delete** | Row fades out → removed from array | Undo toast appears |
| **Tax name** | Each line item carries `tax_name` from the selected tax rate (e.g. "GST", "VAT", "Sales Tax") | FR-TAX-1 in existing PRD |

#### Default Tax Assignment

When a line item is added:
1. If the product has a default tax rate, use it.
2. Otherwise, use the business's `default_tax_rate` setting.
3. Otherwise, tax rate = 0%.

#### Tax-Inclusive Toggle

When `is_tax_inclusive` changes on a line item:
- If switching **to inclusive**: the displayed unit price remains the same (it's the gross price), but the tax component is extracted.
- If switching **to exclusive**: the displayed unit price is treated as net (pre-tax).

### 4.3 Invoice State Machine

#### Status Enum (from `src/db/migrations/001_initial_schema.sql:145`)

```
draft → sent → viewed → partially_paid → paid
                    ↓
                    → cancelled
                    → void
sent → overdue → paid
sent → cancelled
sent → void
```

#### Allowed State Transitions

| Current State | Allowed Next States | Trigger |
|---|---|---|
| `draft` | `sent`, `cancelled`, `void` | Finalize & Send, Cancel, Void |
| `sent` | `viewed`, `overdue`, `partially_paid`, `paid`, `cancelled`, `void` | Customer views, due date passes, payment received, Cancel, Void |
| `viewed` | `partially_paid`, `paid`, `overdue`, `cancelled`, `void` | Payment received, due date passes, Cancel, Void |
| `partially_paid` | `paid`, `overdue`, `cancelled`, `void` | Payment received, due date passes, Cancel, Void |
| `overdue` | `paid`, `partially_paid`, `cancelled`, `void` | Payment received, Cancel, Void |
| `paid` | *(terminal)* | — |
| `cancelled` | *(terminal)* | — |
| `void` | *(terminal)* | — |

#### Terminal Statuses

`paid`, `cancelled`, `void` — no further transitions allowed. These invoices are read-only.

#### Overdue Logic

An invoice is automatically marked `overdue` when:
- Current date > `due_date`
- `amount_due > 0`
- Status is not in a terminal state (`paid`, `cancelled`, `void`)

This is evaluated:
- On every API read of the invoice (computed field)
- On a daily cron job that bulk-updates stale invoices

#### State Transition Triggers

| Trigger | From → To | Side Effects |
|---|---|---|
| **Finalize** | `draft → sent` (if email sent) or stays `sent` (pending send) | Creates invoice snapshot; assigns sequential invoice number; logs `finalized` event |
| **Send email** | `sent` → `sent` (status stays `sent`; `email_sent` event logged) | Email queued/sent; `sent_at` recorded |
| **Customer views** | `sent` → `viewed` | `viewed_at` recorded; `viewed` event logged |
| **Payment received** | `sent`/`viewed`/`overdue` → `paid` (full) or `partially_paid` (partial) | `paid_at` recorded if fully paid; `payment_recorded` event |
| **Due date passes** | `sent`/`viewed`/`partially_paid` → `overdue` | Daily batch job; `overdue` event logged |
| **Cancel** | `draft`/`sent`/`viewed`/`partially_paid`/`overdue` → `cancelled` | `cancelled_at` + `cancelled_reason` recorded; refund any payments (configurable) |
| **Void** | `draft`/`sent`/`viewed`/`overdue` → `void` | `voided` event logged; amount_due set to 0 |

### 4.4 Draft Autosave

| Policy | Value |
|---|---|
| **Trigger** | 500ms debounce after last keystroke |
| **Persistence** | `POST /api/invoices` (create) or `PATCH /api/invoices/:id` (update) |
| **Concurrency** | Optimistic concurrency via `version` field — `updateOptimistic` rejects stale writes |
| **Conflict handling** | If version mismatch, reload from server and notify user |
| **Offline** | Changes cached in `localStorage`; synced when online |
| **Before unload** | `beforeunload` event warns user if unsaved changes exist |
| **Save indicator** | Three states: "Saving…" (spinner), "Saved" (green check), error (red alert) |

### 4.5 Credit Notes & Corrections

#### Credit Note Data Model

From `src/db/migrations/013_invoice_lifecycle.sql:45`:

```sql
CREATE TABLE credit_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  reference_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  credit_note_number VARCHAR(100),
  status          credit_note_status NOT NULL DEFAULT 'draft',
  -- status enum: draft, finalized, sent, partially_applied, applied,
  --               partially_refunded, refunded, cancelled, void
  issue_date      DATE,
  currency        VARCHAR(3) NOT NULL,
  reason          TEXT,
  notes           TEXT,
  terms           TEXT,
  subtotal        NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_total  NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(18,6) NOT NULL DEFAULT 0,
  fee_total       NUMERIC(18,6) NOT NULL DEFAULT 0,
  total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  applied_total   NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_due      NUMERIC(18,6) NOT NULL DEFAULT 0,
  is_finalized    BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancelled_reason TEXT,
  voided_at       TIMESTAMPTZ,
  void_reason     TEXT,
  public_token    VARCHAR(64) UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CONSTRAINT chk_credit_note_applied CHECK (applied_total >= 0 AND applied_total <= total)
```

#### Credit Note Workflow

1. **Issue credit note**: User creates a credit note referencing an invoice. The credit note is a standalone document with its own line items, totals, and number (e.g. `CN-000001`).
2. **Apply to invoice**: The credit note can be applied to the original invoice (or any invoice for the same customer). This creates a `credit_note_applications` record:
   - `amount` (how much of the credit to apply)
   - `idempotency_key` (prevents duplicate application)
   - Constraint: `applied_total ≤ total` (can't apply more than the credit note total)
3. **Invoice status updates**: When a credit note is applied, the original invoice's `amount_due` decreases. If it reaches 0, status may change to `paid`.

#### Voiding Workflow

| Condition | Behavior |
|---|---|
| Invoice status is `draft` | Can be deleted or voided (no side effects) |
| Invoice status is `sent` or `viewed` | Can be voided — `voided` event logged, `amount_due` set to 0, payments NOT refunded automatically |
| Invoice status is `partially_paid` or `overdue` | Can be voided — requires explicit refund of payments first (or refunds are handled separately) |
| Invoice status is `paid` | Cannot be voided (terminal) — must issue a credit note or refund |
| Invoice status is `cancelled` or `void` | Cannot be voided again (terminal) |

#### Immutability of Finalized Invoices

- Finalized invoices are snapshotted (`invoice_snapshots` table) — the snapshot includes template version, rendered HTML, and PDF hash.
- Once finalized, the invoice **cannot be edited**. Any change requires:
  1. A credit note (for corrections to line items/totals)
  2. A void + new invoice (for structural errors)

#### Credit Note vs. Void — When to Use Which

| Scenario | Recommended Action |
|---|---|
| Wrong amount billed | Credit note for the difference |
| Duplicate invoice | Void the duplicate |
| Customer returned goods | Credit note |
| Invoice never sent / no customer action | Void (if not yet sent) |
| Late fee applied in error | Credit note |
| Invoice sent to wrong customer | Void (if early) or credit note + new invoice |

---

## 5. UI/UX Design Guidelines

### 5.1 Layout: Single-Page Split-Screen

#### Desktop (≥ 1024px)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Page Header: Invoice #INV-001 • Draft  [StatusBadge]               │
├──────────────────────────────┬─────────────────────────────────────┤
│  LEFT PANEL (50%)            │  RIGHT PANEL (50%)                  │
│                              │                                     │
│  ┌────────────────────────┐  │  ┌──────────────────────────────┐   │
│  │  Customer Selector     │  │  │  [InvoicePreview]            │   │
│  │  Invoice Details       │  │  │  • Business logo + name       │   │
│  │  Line Items Table      │  │  │  • Customer / Billing        │   │
│  │  Invoice Settings      │  │  │  • Invoice metadata          │   │
│  └────────────────────────┘  │  │  • Line items table          │   │
│                              │  │  • Tax breakdown             │   │
│                              │  │  • Totals summary            │   │
│                              │  │  • Payment instructions      │   │
│                              │  └──────────────────────────────┘   │
└──────────────────────────────┴─────────────────────────────────────┘
│  Sticky Action Bar: [Save Draft] [Preview] [Review & Send]           │
└──────────────────────────────────────────────────────────────────────┘
```

#### Tablet (768px – 1023px)

Left panel becomes 45%, preview becomes 55%. Line item table columns compress.

#### Mobile (< 768px)

- Layout becomes **stacked**: form on top, preview below (toggleable via tab bar).
- The live preview is collapsed into an accordion that can be expanded/collapsed.
- Sticky action bar shows only primary action ("Review & Send") with secondary actions in an overflow menu.

### 5.2 Component Inventory

| Component | Type | Purpose | Source of Truth |
|---|---|---|---|
| `InvoiceWorkspace` | Page | Full-page split-screen editor | **TO BUILD** |
| `InvoicePreview` | Component | Live preview in right panel | **TO BUILD** (or reuse `PRD_Invoice_Interface.md`) |
| `InvoiceDetail` | Page | Read-only view of a finalized invoice | **TO BUILD** |
| `PublicInvoice` | Page | Customer-facing view via secure link | **TO BUILD** (or reuse existing stub) |
| `InvoiceList` | Page | List/filter/sort invoices | **TO BUILD** (new route needed in App.tsx) |
| `StatusBadge` | Shared UI | Color-coded status with dot | ✅ `webapp/src/components/ui/StatusBadge.tsx:114` |
| `Button` | Shared UI | Consistent button styles | ✅ `webapp/src/components/ui/Button.tsx:41` |
| `Money` | Shared UI | Currency-aware money display | ✅ `webapp/src/components/ui/Money.tsx:25` |
| `EmptyState` | Shared UI | Empty/loading/error states | ✅ `webapp/src/components/ui/EmptyState.tsx:10` |
| `PageHeader` | Shared UI | Page header with breadcrumbs + actions | ✅ `webapp/src/components/ui/PageHeader.tsx` |
| `FormField` | Shared UI | Form input with label + validation | ✅ `webapp/src/components/ui/FormField.tsx` |
| `SectionCard` | Shared UI | Card with title + optional action | ✅ `webapp/src/components/SectionCard.tsx` |
| `DataTable` | Shared UI | Sortable, pageable table | ✅ `webapp/src/components/ui/DataTable.tsx` |

### 5.3 Line Items Table (Desktop)

| Column | Width | Alignment | Content |
|---|---|---|---|
| `#` | 32px | Center | Line number (1, 2, 3…) |
| **Description** | flex-1 (min 200px) | Left | Textarea (2 lines visible, expands on focus); first line = product name (600 weight), second line = description (400, muted) |
| **Qty** | 70px | Right | Number input, `step="any"`, `font-tabular-nums` |
| **Unit** | 80px | Left | Select: "each", "hrs", "days", "months", custom |
| **Rate** | 100px | Right | Number input with currency symbol prefix |
| **Disc** | 80px | Right | Number input + type toggle (fixed/%) — only shows when discount > 0 |
| **Tax** | 70px | Right | Select: "0%", "5% GST", "10% VAT", etc. (from business tax rates) |
| **Total** | 100px | Right | `Money` component, bold |
| **Actions** | 64px | Center | Duplicate icon, Delete icon |

### 5.4 Line Items Table (Mobile)

Each line item becomes an **expandable card**:
- **Header**: Description (truncated) + Total (right)
- **Expanded content**: Qty, Unit, Rate, Discount, Tax — in a 2-column grid
- **Actions**: Duplicate / Delete icons in the card header

### 5.5 Totals Summary

```
SUBTOTAL                   $1,250.00
Discount                   −$100.00
Tax                        $87.50
Fees                       $15.00
─────────────────────────────
TOTAL                      $1,252.50
Paid                      +$500.00
─────────────────────────────
AMOUNT DUE                  $752.50
```

| Element | Styling |
|---|---|
| Labels | `text-sm text-tertiary`, left-aligned |
| Values | `text-sm font-tabular-nums`, right-aligned |
| **Total** | `text-lg font-semibold`, `border-t-2` above |
| **Paid** | `text-success-text`, prefixed with `+` |
| **Amount Due** | `text-2xl font-extrabold text-primary-action`, `border-t-2` above |
| **Fully Paid** | Green check icon + "Paid in full" text |
| **Zero balance** | `$0.00` in `text-secondary` (not error color) |

### 5.6 Sticky Action Bar

| Button | Variant | Conditions |
|---|---|---|
| **Save Draft** | Secondary | Always visible |
| **Preview** | Secondary | Always visible |
| **Review & Send** | Primary | Enabled only when validation passes (non-blocking warnings shown inline) |

**Mobile**: Action bar is `position: sticky; bottom: 0` with backdrop blur. Only "Review & Send" is shown as full-width; "Save Draft" and "Preview" are in an overflow `⋯` menu.

### 5.7 Validation & Error Handling

#### Inline Validation (non-blocking)

| Field | Validation Rule | Error Message |
|---|---|---|
| Customer | Must be selected | "Select a customer to proceed" |
| Issue date | Must be set | "Set an issue date" |
| Due date | Must be ≥ issue date | "Due date must be after issue date" |
| Currency | Must be selected | "Select a currency" |
| Line items | At least one with qty > 0 and price ≥ 0 | "Add at least one line item" |
| Each line item | Description non-empty | "Description is required" (shown inline on the row) |
| Each line item | Quantity > 0 | "Quantity must be greater than 0" |
| Each line item | Unit price ≥ 0 | "Unit price must be 0 or more" |
| Tax rate | Must be ≥ 0 and ≤ 1 | "Tax rate must be between 0% and 100%" |

#### Pre-Send Validation Modal

When user clicks "Review & Send", a modal appears with:

```
Issues found:
⚠ ⚠  2 line items are missing descriptions
⚠    Invoice due date is before issue date

[ Fix and continue ]  [ Send anyway ]
```

- **Blocking errors** (red ⚠): Prevent sending (e.g., no customer, no line items)
- **Warnings** (amber ⚠): Allow sending but highlight (e.g., missing descriptions)
- "Send anyway" is available for warnings, not errors

### 5.8 Status & Workflow Management UI

#### Status Badge

- Positioned in the page header next to the invoice title
- Uses `StatusBadge` component (`webapp/src/components/ui/StatusBadge.tsx:114`)
- Shows 2px colored dot before the label
- Color mapping (semantic, theme-aware):

| Status | Background | Text | Dot |
|---|---|---|---|
| `draft` | `status-warning-bg` | `status-warning-text` | `--color-warning` |
| `sent` | `status-info-bg` | `status-info-text` | `--color-info` |
| `viewed` | `status-info-bg` | `status-info-text` | `--color-info` |
| `partially_paid` | `status-warning-bg` | `status-warning-text` | `--color-warning` |
| `paid` | `status-success-bg` | `status-success-text` | `--color-success` |
| `overdue` | `status-error-bg` | `status-error-text` | `--color-error` |
| `cancelled` | `status-tertiary-bg` | `status-tertiary-text` | `--color-text-tertiary` |
| `void` | `status-tertiary-bg` | `status-tertiary-text` | `--color-text-tertiary` |

#### Lifecycle Stepper

Renders on detail pages, positioned below the invoice title. Shows the invoice journey:

```
Draft → Sent → Viewed → Partially Paid → Paid
```

Each step is either active (filled circle), completed (circle with check), or inactive (outlined circle).

#### State-Aware Action Panel

| Status | Available Actions |
|---|---|
| **Draft** | Edit, Duplicate, Download PDF, Delete, Review & Send |
| **Sent / Viewed** | Record Payment, Send Reminder, Duplicate, Download PDF, Cancel, Void |
| **Partially Paid** | Record Payment, Send Reminder, Duplicate, Download PDF, Cancel |
| **Paid** | Generate Receipt, Download PDF, Duplicate |
| **Overdue** | Record Payment, Send Reminder, Download PDF |
| **Cancelled / Void** | Download PDF, Duplicate |

Actions use the `Button` component with appropriate variants:
- `primary` for main action (Record Payment, Review & Send)
- `secondary` for neutral actions (Edit, Duplicate, Download PDF)
- `warning` for Send Reminder
- `danger` for Void
- `ghost` for Cancel, Copy link

### 5.9 Invoice Detail Page (Read-Only)

Layout follows the visual concept from `PRD_Invoice_Interface.md` (lines 350-412):

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Invoices    Invoice #INV-001    [ Sent ]                 │
│  [ Record Payment ] [ Send Reminder ] [ Download PDF ] [ Cancel ]   │
│                                                                     │
│  InvoiceFlow Stepper (Draft → Sent → Viewed → …→ Paid)              │
│                                                                     │
│  ┌──────────────────────┐   ┌──────────────────────────────┐       │
│  │  CUSTOMER / BILLING  │   │  INVOICE DETAILS             │       │
│  │  John Smith           │   │  Invoice #    INV-001        │       │
│  │  Acme Corp            │   │  Issue date   Oct 6, 2026    │       │
│  │  johnsmith@…          │   │  Due date     Oct 36, 2026   │       │
│  │  +1 (555) 123-4567     │   │  Currency     USD ($)       │       │
│  │  123 Main St           │   │  P.O. #       PO-789        │       │
│  │  New York, NY 10001    │   │  Terms        Net 30        │       │
│  └──────────────────────┘   └──────────────────────────────┘       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  LINE ITEMS                  Qty     Unit    Rate    Tax    Total│ │
│  │  ┌─────┬───────────────────┬──────┬───────┬───────┬──────┬──────┤ │ │
│  │  │ 1   │Web Design         │  1   │ hrs   │$100   │ 8.5% │$108.5│ │ │
│  │  │     │Landing page redesign│     │       │       │(GST) │      │ │ │
│  │  └─────┴───────────────────┴──────┴───────┴───────┴──────┴──────┘ │ │
│  │                                                                   │ │
│  │  TAX BREAKDOWN                                                    │ │
│  │  GST @ 8.5%   Taxable: $100.00   Tax: $8.50                       │ │
│  │  ─────────────────────────────────────────────────────────────   │ │
│  │                                                                   │ │
│  │  SUBTOTAL              $1,250.00                                  │ │
│  │  Discount              −$100.00                                   │ │
│  │  Tax                   $87.50                                     │ │
│  │  ──────────────────────────────                                   │ │
│  │  TOTAL                 $1,252.50                                  │ │
│  │  Paid                 +$500.00                                    │ │
│  │  ──────────────────────────────                                   │ │
│  │  AMOUNT DUE              $752.50                                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────┐   ┌──────────────────────────────┐        │
│  │  PAYMENT HISTORY     │   │  ACTIVITY TIMELINE           │        │
│  │  Date      Amount    │   │  • Invoice created  Oct 6    │        │
│  │  Oct 6     $500.00   │   │  • Invoice sent     Oct 6    │        │
│  │  Card ****42  Paid   │   │  • Customer viewed  Oct 6    │        │
│  │                      │   │  • Payment       Oct 6       │        │
│  └──────────────────────┘   └──────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.10 Data Formatting Rules

#### Quantities

| Rule | Example |
|---|---|
| Whole numbers | `1`, `3`, `10` (no decimal point) |
| Fractions | `1.5`, `0.25`, `3.14` (up to 2 decimals, trailing zeros stripped) |
| Zero | `0` |
| Input step | `step="any"` to allow fractional entry |
| Font | Always `font-tabular-nums` |

#### Dates

| Rule | Implementation |
|---|---|
| Short form (tables, metadata) | `formatDate()` → `MMM D, YYYY` (e.g. "Oct 6, 2026") |
| Long form (detail headers) | `formatDateLong()` → `MMMM D, YYYY` (e.g. "October 6, 2026") |
| Timezone | All dates stored UTC, rendered in customer's local timezone |
| Label + value | "Issue date" above "Oct 6, 2026" |

#### Currency

| Rule | Implementation |
|---|---|
| Symbol position | Symbol precedes amount with narrow no-break space (U+202F) |
| Decimal places | Currency-native (2 for USD, 0 for JPY/KRW/VND) via `getCurrencyMetadata` |
| Thousands separator | Comma (en-US locale via `Intl.NumberFormat`) |
| Negative values | Minus sign before symbol (e.g. `-$10.00`) |
| Zero values | `$0.00` (never blank or "—") |
| Font | Always `font-tabular-nums` |
| Component | `Money` component (wraps `Intl.NumberFormat` + `font-tabular-nums`) |

#### Tax Rates

| Rule | Implementation |
|---|---|
| Display rate | `formatTaxRate(rate)` → `8.50%` (decimal → percentage, 2dp) |
| Display rate + name | `formatTaxRateWithName(rate, name)` → `8.50% (GST)` |
| Zero rate | Shows `-` in read-only views, `0%` in edit inputs |

---

## 6. API Specification

### 6.1 Invoice Endpoints

All endpoints require `Authorization: Bearer <token>` (enforced via `requireAuth` middleware). All queries are scoped to `business_id` (tenant isolation enforced at every query).

#### `POST /api/invoices`

Create a new draft invoice.

**Request Body:**
```json
{
  "customer_id": "uuid",
  "currency": "USD",
  "issue_date": "2026-10-06",
  "due_date": "2026-11-05",
  "po_number": "PO-789",
  "notes": "Thank you for your business.",
  "terms": "Net 30. Late fee: 1.5% per month.",
  "payment_instructions": "Pay to account #1234-5678-9012, reference invoice number.",
  "template_id": "uuid",
  "items": [
    {
      "description": "Web Design",
      "quantity": "1",
      "unit": "each",
      "unit_price": "100",
      "discount": "0",
      "discount_type": "fixed",
      "tax_rate": "0.085",
      "tax_name": "GST",
      "is_tax_inclusive": false,
      "product_id": "uuid",
      "sort_order": 0
    }
  ],
  "fees": [],
  "invoice_discount": "0",
  "invoice_discount_type": "fixed"
}
```

**Response: 201 Created**
```json
{
  "invoice": { ... full ApiInvoice object ... }
}
```

#### `GET /api/invoices/:id`

Fetch a single invoice with items, fees, and attachments.

**Response: 200 OK**
```json
{
  "invoice": { ... full ApiInvoice object ... }
}
```

#### `PATCH /api/invoices/:id`

Update draft invoice metadata and line items. Only allowed when `status = 'draft'` and `is_finalized = false`.

**Response: 200 OK** with updated invoice.

#### `GET /api/invoices`

List invoices (paginated).

**Query Parameters:**
- `limit` (default: 50, max: 200)
- `offset` (default: 0)
- `status` (filter by status)
- `search` (search by invoice number, customer name, or PO number)
- `sortBy` (default: `created_at`)
- `sortOrder` (default: `desc`)
- `customerId` (filter by customer)
- `dateFrom` / `dateTo` (ISO date strings)

**Response: 200 OK**
```json
{
  "invoices": [ ... ApiInvoiceListItem[] ... ],
  "total": 120,
  "limit": 50,
  "offset": 0
}
```

#### `POST /api/invoices/:id/finalize`

Finalize a draft invoice. Creates a snapshot, assigns a sequential invoice number, and transitions status to `sent`.

**Response: 200 OK**
```json
{
  "invoice": { ... finalized invoice ... },
  "invoice_number": "INV-0001"
}
```

#### `POST /api/invoices/:id/send`

Send invoice by email.

**Request Body:**
```json
{
  "to": "customer@example.com",
  "cc": [],
  "bcc": [],
  "subject": "Invoice #INV-0001",
  "message": "..."
}
```

**Response: 200 OK**
```json
{
  "ok": true,
  "message_id": "uuid"
}
```

#### `POST /api/invoices/:id/cancel`

Cancel an invoice (before payment).

**Request Body:**
```json
{
  "reason": "Customer requested cancellation"
}
```

#### `POST /api/invoices/:id/void`

Void an invoice. Sets `amount_due = 0` and transitions to `void`.

**Request Body:**
```json
{
  "reason": "Issued in error"
}
```

#### `POST /api/invoices/:id/record-payment`

Record a payment manually (or via Stripe).

**Request Body:**
```json
{
  "amount": "500",
  "currency": "USD",
  "method": "card",
  "reference": "PaymentIntent abc123",
  "paid_at": "2026-10-11T10:30:00Z"
}
```

#### `GET /api/invoices/:id/pdf`

Generate and return PDF (or cached PDF).

**Response: 200 OK** with `Content-Type: application/pdf`.

#### `GET /api/invoices/:id/share-link`

Generate a secure shareable link.

**Response: 200 OK**
```json
{
  "url": "https://app.example.com/invoice/abc123",
  "token": "abc123",
  "expires_at": "2026-11-11T00:00:00Z"
}
```

### 6.2 Credit Note Endpoints

#### `POST /api/credit-notes`

Create a credit note referencing an invoice.

#### `GET /api/credit-notes?invoice_id=uuid`

List credit notes for an invoice.

#### `POST /api/credit-notes/:id/apply`

Apply a credit note to an invoice.

**Request Body:**
```json
{
  "invoice_id": "uuid",
  "amount": "100"
}
```

### 6.3 Public (Unauthenticated) Invoice View

#### `GET /invoices/:publicToken`

Public view of an invoice — no auth required, accessed via secure tokenized link.

---

## 7. Data Integrity Protocols

### 7.1 Tenant Isolation

Every database query MUST include `business_id` in the WHERE clause. The `requireAuth` middleware extracts `business_id` from the JWT and attaches it to `req.user`. All invoice operations use `req.user!.businessId`.

**Verification:** `grep -r "business_id = \$1" src/` — should appear in every invoice query.

### 7.2 Optimistic Concurrency Control

Invoice updates use optimistic locking via a `version` field:

```typescript
// From InvoiceRepository interface (src/types/repositories.ts:33)
updateOptimistic(businessId: string, id: string, input: Partial<...>, expectedVersion: number): Promise<unknown>;
```

- The frontend sends `If-Match: "version-N"` header.
- The backend checks `WHERE version = $N` and increments.
- If version mismatch → 409 Conflict → frontend reloads and notifies user.

### 7.3 Finalized Invoice Immutability

- `is_finalized = true` → no edits to line items, totals, customer, dates allowed.
- Only mutable fields on a finalized invoice: `status`, `amount_paid`, `amount_due`, `paid_at`, `sent_at`, `viewed_at`.
- Any change to a finalized invoice's content requires a credit note.

### 7.4 Snapshot on Finalize

When an invoice transitions from `draft` to `sent`:

1. Backend calls `calculationEngine.calculate()` with the final line items, fees, and discounts.
2. The result validates against the stored values (mismatch → error, abort finalize).
3. A snapshot is stored in `invoice_snapshots` table:
   - `snapshot` JSONB: complete invoice state at finalize time
   - `snapshot_hash`: SHA-256 hash of the snapshot for tamper detection
   - `rendered_html`: the rendered template HTML
   - `pdf_stored`: whether PDF was generated
4. The invoice number is assigned from `invoice_number_sequences` (atomic increment, unique per business).

### 7.5 Rounding Invariants

- All monetary values stored as `NUMERIC(18,6)` in PostgreSQL.
- All calculations use `Decimal.ROUND_HALF_UP` at `decimalPlaces` (typically 2).
- The sum of line item totals must equal the stored invoice `subtotal` (within 1 cent tolerance for floating point, 0 for Decimal).
- Tax per line must sum to invoice `tax_total`.
- The backend re-validates all totals on every finalize.

### 7.6 Credit Note Application Constraints

- `applied_total ≤ total` (CHECK constraint in SQL: `chk_credit_note_applied`)
- A credit note can be applied to any invoice for the same customer.
- `idempotency_key` on `credit_note_applications` prevents duplicate applications.
- Applying a credit note adjusts the original invoice's `amount_due` and `amount_paid`.

### 7.7 Soft Deletes

Invoices are never hard-deleted (except drafts). Status transitions handle removal:
- `cancelled`: soft delete, keeps all data, marks as cancelled with reason.
- `void`: same, but zeroes out `amount_due`.

---

## 8. Integration Points

### 8.1 Backend (Express + TypeScript)

| Component | File | Purpose |
|---|---|---|
| `CalculationEngine` | `src/domain/calculation.ts:93` | Authoritative calculation with Decimal.js |
| `Invoice` model | `src/domain/models/index.ts:137` | TypeScript interface for invoice |
| `InvoiceRepository` | `src/types/repositories.ts:27` | Repository interface (createDraft, update, finalize, setStatus) |
| API routes | `src/index.ts` (to be implemented) | `/api/invoices/*` endpoints |
| DB migrations | `src/db/migrations/001_initial_schema.sql` | Invoice table schema |
| Email service | `src/services/email/email-service.ts` | Sends finalized invoices |
| PDF service | `src/services/pdf/pdf-service.ts:53` | Generates PDF from HTML |
| Tax service | `src/services/tax/tax-service.ts` | Tax rate lookup and application |

### 8.2 Frontend (React + Vite)

| Component | File | Purpose |
|---|---|---|
| `CalculationEngine` | `webapp/src/utils/calculation.ts:32` | Client-side preview calculations |
| `StatusBadge` | `webapp/src/components/ui/StatusBadge.ts` | Status display with semantic colors |
| `Money` | `webapp/src/components/ui/Money.tsx:25` | Currency-aware money formatting |
| `Button` | `webapp/src/components/ui/Button.tsx:41` | Consistent button component |
| API client | `webapp/src/api/client.ts` | REST API calls |
| Types | `webapp/src/types/api.ts:170` | `ApiInvoice`, `ApiInvoiceItem`, `ApiInvoiceFee` |
| Calculation types | `webapp/src/types/calculation.ts` | `CalculatedLineItem`, `CalculationResult` |
| Document model | `webapp/src/document-model/types.ts:401` | `InvoiceDocument` template structure |

### 8.3 CSS Design Tokens

The semantic CSS variable system is defined in `webapp/src/styles/index.css` (referenced in existing PRD). Key variables:

| Category | CSS Variables |
|---|---|
| **Status colors** | `--color-warning`, `--color-info`, `--color-success`, `--color-error`, `--color-text-tertiary` |
| **Status backgrounds** | `status-warning-bg`, `status-info-bg`, `status-success-bg`, `status-error-bg`, `status-tertiary-bg` |
| **Status text** | `status-warning-text`, `status-info-text`, `status-success-text`, `status-error-text`, `status-tertiary-text` |
| **Brand colors** | `--color-primary-action`, `--color-primary`, `--color-on-primary` |
| **Surfaces** | `--color-surface`, `--color-surface-alt` |
| **Typography** | `--font-family-base`, `--font-size-sm`, etc. |
| **Tabular numbers** | `font-tabular-nums` utility class |

---

## 9. Acceptance Criteria

### 9.1 Invoice Creation

- [ ] User can create a new invoice from a template or blank
- [ ] Customer is selectable from existing customers with live search
- [ ] New customer can be created inline with name, email, address, tax ID
- [ ] Invoice number is auto-generated on finalize (sequential, unique per business)
- [ ] Issue date defaults to today, due date defaults based on payment terms
- [ ] Currency defaults to business currency with override option
- [ ] Draft is saved automatically within 500ms of last edit
- [ ] Save indicator shows "Saving…" → "Saved" → (error state if failure)

### 9.2 Line Item Management

- [ ] User can add unlimited line items
- [ ] Each line item: description (textarea), quantity (number), unit (select), rate (currency), discount (amount + type), tax (select)
- [ ] Subtotals, tax, and total update in real-time using `CalculationEngine`
- [ ] Tax-inclusive toggle extracts tax from gross amount correctly
- [ ] Invoice-level discount applies proportionally across all line items
- [ ] Fees can be added (shipping, processing, etc.)
- [ ] Line items can be reordered via drag-and-drop
- [ ] Line items can be duplicated
- [ ] Line items can be deleted with undo
- [ ] Line totals use `Decimal.ROUND_HALF_UP` — no floating point errors
- [ ] Tax breakdown groups by rate name (e.g. "GST @ 8.5%")

### 9.3 Real-Time Preview

- [ ] Right panel updates immediately as user types in left form
- [ ] Preview matches final PDF layout exactly (same CSS classes)
- [ ] Customer details auto-populate in preview
- [ ] Tax breakdown shows per-rate breakdown
- [ ] Totals clearly distinguish Subtotal, Discount, Tax, Fees, Total, Paid, Amount Due
- [ ] On mobile, preview collapses into toggleable section

### 9.4 Finalization & Sending

- [ ] "Review & Send" button is primary and prominent
- [ ] Clicking "Review & Send" opens validation modal
- [ ] Modal shows blocking errors (red) and warnings (amber)
- [ ] User can proceed with warnings but not errors
- [ ] On confirm: invoice is finalized (snapshot created, number assigned, status → `sent`)
- [ ] User can download PDF
- [ ] User can email invoice directly to customer
- [ ] User can generate secure shareable link
- [ ] After sending, status badge shows "Sent"

### 9.5 Status Management

- [ ] Status badge renders in page header with colored dot
- [ ] Overdue status is automatically detected (`due_date < now` AND `amount_due > 0`)
- [ ] Activity timeline shows all events (created, sent, viewed, paid, etc.)
- [ ] Lifecycle stepper shows position in the funnel
- [ ] Action panel shows contextually-relevant buttons based on status

### 9.6 Corrections

- [ ] Finalized invoices cannot be edited (read-only)
- [ ] Credit note workflow: create CN → apply to invoice → invoice `amount_due` decreases
- [ ] Void workflow: invoice `amount_due` set to 0, status → `void`
- [ ] Cancel workflow: status → `cancelled`, reason required
- [ ] Snapshot hash is verified on read (detects tampering)
- [ ] Credit note has its own sequential numbering (`CN-000001`)

### 9.7 Error Handling

- [ ] Failed saves show inline error message, not toast
- [ ] 401 redirects to login
- [ ] 409 conflict on version mismatch reloads from server
- [ ] Network errors show retry pattern
- [ ] All user-facing text is localized-ready (i18n keys, not hardcoded strings)

### 9.8 Performance

- [ ] Invoice creation form loads in < 500ms
- [ ] Live preview updates within 50ms
- [ ] Save operation completes in < 200ms
- [ ] PDF generation completes in < 1s (cached after first generation)
- [ ] Status badge colors resolve in 1ms (no runtime computation)

---

## 10. Implementation Roadmap

### Phase 1: Core Invoice CRUD (Weeks 1–3)

**Goal:** Users can create, edit, and save draft invoices with real-time calculations.

| Sprint | Tasks | Deliverables |
|---|---|---|
| Sprint 1 | - Build `InvoiceService` class (create, update, find) in backend<br>- Add `/api/invoices/*` CRUD routes in `src/index.ts`<br>- Build `InvoiceWorkspace` component (split-screen form + preview)<br>- Add invoice routes to `App.tsx` | Invoice list page, Create/Edit page, live calculations |
| Sprint 2 | - Build invoice numbering service (atomic sequences)<br>- Add autosave with debounce<br>- Build `InvoicePreview` component<br>- Integrate `CalculationEngine` in preview | Auto-save working, invoice numbers assigned |
| Sprint 3 | - Add inline validation<br>- Add customer selection component (searchable dropdown + inline add)<br>- Add payment terms field<br>- Build `InvoiceList` page with filters | Validation working, customer selection, invoice listing |

### Phase 2: Finalization & Sending (Weeks 4–6)

**Goal:** Users can finalize and send invoices with PDF generation.

| Sprint | Tasks | Deliverables |
|---|---|---|
| Sprint 4 | - Build `finalizeInvoice` endpoint (snapshot, numbering)<br>- Build `sendInvoice` endpoint (email via nodemailer)<br>- Build PDF generation endpoint<br>- Build pre-send validation modal | Finalize & Send workflow |
| Sprint 5 | - Build `InvoiceDetail` page (read-only view)<br>- Add activity timeline<br>- Add payment history table<br>- Add shareable link generation | Invoice detail view, email sending |
| Sprint 6 | - Build state machine (`ALLOWED_TRANSITIONS`, `TERMINAL_STATUSES`)<br>- Add status badges throughout<br>- Add lifecycle stepper<br>- Add state-aware action panel | Status management, actions |

### Phase 3: Payments & Corrections (Weeks 7–9)

**Goal:** Users can record payments, issue credit notes, and void invoices.

| Sprint | Tasks | Deliverables |
|---|---|---|
| Sprint 7 | - Build `recordPayment` endpoint<br>- Add payment recording UI<br>- Update invoice status on payment (paid/partially_paid)<br>- Add overdue detection | Payment recording, status transitions |
| Sprint 8 | - Build credit note endpoints (create, apply)<br>- Build credit note UI (creation + application)<br>- Add credit note to invoice detail | Credit notes working |
| Sprint 9 | - Build void/cancel endpoints<br>- Add void/cancel UI with reason dialog<br>- Add immutability enforcement<br>- Snapshot verification on read | Corrections workflow complete |

### Phase 4: Polish & Edge Cases (Weeks 10–11)

**Goal:** Handle all edge cases, mobile, and polish the experience.

| Sprint | Tasks | Deliverables |
|---|---|---|
| Sprint 10 | - Mobile responsive layout (stacked on mobile)<br>- Empty states for all views<br>- Long text handling<br>- Missing/null value handling<br>- Loading states | Mobile-ready, robust edge cases |
| Sprint 11 | - Accessibility audit (ARIA, keyboard nav)<br>- Performance testing<br>- Documentation<br>- QA sign-off | Production-ready |

---

## 12. Appendices

### Appendix A: Tax Name Support

The `tax_name` field is already present in:
- `ApiInvoiceItem.tax_name?` (`webapp/src/types/api.ts:134`)
- `ApiInvoiceFee.tax_name?` (`webapp/src/types/api.ts:153`)
- `ApiCreditNoteItem.tax_name?` (`webapp/src/types/api.ts:331`)
- `LineItemInput.tax_name?` (`webapp/src/types/calculation.ts:18`)
- `CalculatedLineItem.tax_name?` (`webapp/src/types/calculation.ts:46`)

The backend `business_tax_rates` table has a `name` column (`src/db/migrations/001_initial_schema.sql:128`). When building the invoice response, join `invoice_items.tax_rate` → `business_tax_rates.rate` to populate `tax_name`.

Display format: `formatTaxRateWithName(rate, name)` → e.g. "8.50% (GST)"

### Appendix B: Number Formatting Utilities

Key formatting functions in `webapp/src/utils/format.ts`:

| Function | Purpose |
|---|---|
| `formatCurrency(amount, currency, decimalPlaces)` | Full currency formatting with Intl |
| `formatDate(dateString)` | Short date: "Oct 6, 2026" |
| `formatDateLong(dateString)` | Long date: "October 6, 2026" |
| `formatTaxRate(rate)` | Tax rate as percentage: "8.50%" or "-" |
| `formatTaxRateWithName(rate, name)` | Tax rate with name: "8.50% (GST)" |
| `fromPercentage(pct)` | Percentage string → decimal string |
| `toPercent(rate)` | Decimal → percentage string |

### Appendix C: Design System Reference

The semantic CSS design token system is in `webapp/src/styles/index.css`. Key patterns:

```css
/* Status colors (theme-aware) */
.status-success-bg { background-color: var(--color-success-bg); }
.status-success-text { color: var(--color-success-text); }
/* ...same pattern for warning, info, error, tertiary */

/* Tabular numbers for money */
.font-tabular-nums { font-variant-numeric: tabular-nums; }

/* Touch targets */
.min-h-[44px] { min-height: 44px; } /* WCAG minimum */
```

### Appendix D: Testing Strategy

| Layer | Framework | Location | Pattern |
|---|---|---|---|
| Frontend unit | Vitest + Testing Library | `webapp/src/__tests__/` | `*.test.tsx` |
| Frontend calculation | Vitest | `webapp/src/__tests__/calculation.test.ts` | Pure function tests |
| Backend unit | Vitest | `tests/` | `describe`/`it` blocks |
| E2E (future) | Playwright | `e2e/` | Page object model |

Run tests: `npm run test` (backend) / `cd webapp && npx vitest` (frontend)

### Appendix E: Status Color Mapping (Semantic)

| Status | Background | Text | Dot |
|---|---|---|---|
| `draft` | `status-warning-bg` (amber-50) | `status-warning-text` (amber-800) | `--color-warning` (amber-500) |
| `sent` | `status-info-bg` (blue-50) | `status-info-text` (blue-800) | `--color-info` (blue-500) |
| `viewed` | `status-info-bg` | `status-info-text` | `--color-info` |
| `partially_paid` | `status-warning-bg` | `status-warning-text` | `--color-warning` |
| `paid` | `status-success-bg` (green-50) | `status-success-text` (green-800) | `--color-success` (green-500) |
| `overdue` | `status-error-bg` (red-50) | `status-error-text` (red-800) | `--color-error` (red-500) |
| `cancelled` | `status-tertiary-bg` | `status-tertiary-text` | `--color-text-tertiary` |
| `void` | `status-tertiary-bg` | `status-tertiary-text` | `--color-text-tertiary` |

All colors are theme-aware — dark theme variants exist in `index.css`.

### Appendix F: API Endpoint Inventory

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /api/invoices` | List invoices (paginated) | **TO BUILD** |
| `POST /api/invoices` | Create draft invoice | **TO BUILD** |
| `GET /api/invoices/:id` | Fetch single invoice | **TO BUILD** |
| `PATCH /api/invoices/:id` | Update draft invoice | **TO BUILD** |
| `POST /api/invoices/:id/finalize` | Finalize (snapshot + number) | **TO BUILD** |
| `POST /api/invoices/:id/send` | Send by email | **TO BUILD** |
| `POST /api/invoices/:id/record-payment` | Record payment manually | **TO BUILD** |
| `POST /api/invoices/:id/cancel` | Cancel invoice | **TO BUILD** |
| `POST /api/invoices/:id/void` | Void invoice | **TO BUILD** |
| `GET /api/invoices/:id/pdf` | Download PDF | **TO BUILD** |
| `GET /api/invoices/:id/share-link` | Generate shareable link | **TO BUILD** |
| `GET /api/invoices/:id/events` | Activity timeline | **TO BUILD** |
| `GET /api/invoices/:id/payments` | Payment history | **TO BUILD** |
| `POST /api/credit-notes` | Create credit note | **TO BUILD** |
| `POST /api/credit-notes/:id/apply` | Apply CN to invoice | **TO BUILD** |
| `GET /invoices/:publicToken` | Public invoice view (no auth) | **TO BUILD** |
| `GET /api/customers` | Customer list (searchable) | ✅ Exists |
| `POST /api/customers` | Create customer | ✅ Exists |
| `GET /api/products` | Product catalog | ✅ Exists |
| `GET /api/tax-rates` | Tax rates lookup | ✅ Exists |
| `GET /api/businesses/current/settings` | Business defaults | ✅ Exists |
