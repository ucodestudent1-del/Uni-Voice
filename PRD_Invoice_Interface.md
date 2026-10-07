# Product Requirements Document & UI Design Specification

## Invoice Interface: Foundation to Production-Ready

**Document Status:** Draft v1.0  
**Last Updated:** 2026-10-06  
**Product Owner:** Senior UX/UI Designer & Product Manager  
**Target Release:** Phases 1–3

---

## 1. Executive Summary

### Current State

The Universal Invoice Generator's frontend (`webapp/`) has a functional but **foundational-tier** invoice interface. The codebase has:

- A full accounting data model (`ApiInvoice`, `ApiInvoiceItem`, `ApiInvoiceFee`, `ApiPayment`, `ApiInvoiceEvent`) with backend-authoritative calculations (`CalculationEngine`, `decimal.js` for integer minor-unit math)
- A semantic design token system (`index.css`) with light/dark themes, status colors, form controls, and utility classes
- Shared UI primitives (`StatusBadge`, `Button`, `Money`, `FormField`, `KPICard`, `EmptyState`, `PageHeader`, `SectionCard`)
- State machine enforcement (`invoice-state-machine.ts` — `ALLOWED_TRANSITIONS`, `TERMINAL_STATUSES`, `isOverdueStatus`)
- Three distinct invoice views: `InvoiceWorkspace` (edit/draft), `InvoiceDetail` (read-only admin view), `PublicInvoice` (customer-facing view)

**However**, the interface has gaps that prevent it from being a polished, professional accounting tool:

1. **Financial transparency** — Tax is shown as a single flat line; no tax breakdown by rate/name. No "Paid" line in the detail view totals (only Amount Due). `InvoiceDetailView` recomputes line totals with naive `qty × unitPrice` instead of using computed values from the backend.
2. **Information architecture** — Billing/customer info is scattered. The `InvoiceDetailView` has issue/due dates duplicated in the totals sidebar and the bottom strip. No dedicated "Customer / Billing" section. No payment history table in the main detail view (it exists in `InvoiceDetail.tsx` but is separate from the invoice display).
3. **Status & workflow** — Status badges use color-only indicators with no dot. The `InvoiceLifecycle` component exists but is only used in `InvoiceDetail.tsx`. Action buttons in `InvoiceDetail` are inline `<button>` elements with inconsistent styling vs. the `Button` component used elsewhere. No state-aware action panel.
4. **Data formatting** — `InvoiceDetailView` line items show raw `item.quantity` (e.g. "1" with no decimal normalization). `PublicInvoice.tsx` duplicates status color logic instead of using `StatusBadge`. Tax rate formatting is inconsistent (`"${new Decimal(item.tax_rate).mul(100).toFixed(2)}%"` inline vs. `fmtRate()` in `InvoicePreview`).
5. **Layout density** — The workspace table has 10 columns (Description, Qty, Unit, Rate, Disc, Disc Type, Tax %, Inc., Total, Actions) — too dense for professional use. The `InvoicePreview` table has 6 columns (more reasonable). The detail view table has 6 columns but is missing the `#`/line number column.

### High-Level Goal

Transform the invoice interface from a "foundation" implementation to a **production-ready professional accounting tool** by:

1. Establishing a **single source of truth** for invoice display — a shared `InvoiceDisplay` component that powers `InvoiceDetail`, `PublicInvoice`, and the `InvoicePreview` sidebar
2. Creating a **cohesive visual language** for financial data — structured totals breakdown, tax-by-rate grouping, status dots, action buttons tied to state
3. Building a **consistent component library** that all invoice views consume — no inline styles or duplicated formatting logic
4. Delivering a **polished user experience** that handles all edge cases (empty, zero, loading, long text, missing data, mobile)

---

## 2. UX Improvements & Functional Requirements

### 2.1 Status & Workflow Management

#### User Stories

| ID | Story |
|---|---|
| US-STATUS-1 | As an accounting team member, I want a **color + dot status badge** at the top of the invoice so I can instantly identify the invoice state. |
| US-STATUS-2 | As an invoice viewer, I want a **visual lifecycle stepper** showing Draft → Sent → Viewed → Partially Paid → Paid so I can understand where this invoice is in its journey. |
| US-STATUS-3 | As an invoice editor, I want **action buttons that are contextually relevant** to the current status (Edit, Send, Record Payment, Cancel, Void, Download PDF) so I don't waste time hunting for the right action. |
| US-STATUS-4 | As a user, when an invoice is **overdue**, I want the status badge to turn error color and show the days overdue count so I can prioritize collection. |

#### Functional Requirements

| ID | Requirement | Source |
|---|---|---|
| FR-STATUS-1 | Status badges must use the existing `StatusBadge` component with `invoiceStatusConfig`. A colored dot (2px circle) must appear before the label. | `StatusBadge.tsx:127-141`, `InvoicePreview.tsx:192` |
| FR-STATUS-2 | The `InvoiceLifecycle` component (`InvoiceLifecycle.tsx:60`) must be rendered on `InvoiceDetail` pages, positioned immediately below the invoice title. | `InvoiceDetail.tsx:546` (already present) |
| FR-STATUS-3 | An **action panel** must render based on status. Actions and their availability: | `InvoiceDetail.tsx:234-291`, `InvoiceWorkspace.tsx:2109-2168` |
| | - **Draft**: Edit, Duplicate, Download PDF, Delete, Review & Send | |
| | - **Sent/Viewed**: Record Payment, Send Reminder, Duplicate, Download PDF, Cancel | |
| | - **Partially Paid**: Record Payment, Send Reminder, Duplicate, Download PDF, Cancel | |
| | - **Paid**: Generate Receipt, Download PDF, Duplicate | |
| | - **Overdue**: Record Payment, Send Reminder, Download PDF | |
| | - **Cancelled/Void**: Download PDF, Duplicate | |
| FR-STATUS-4 | Overdue status overrides `sent`/`viewed`/`partially_paid` when `due_date < now` and `amount_due > 0` and status is not terminal. | `invoice-state-machine.ts:89-99`, `StatusBadge.tsx:122` |
| FR-STATUS-5 | Terminal statuses (`paid`, `cancelled`, `void`) must not show mutable actions (Edit, Cancel, Void). | `invoice-state-machine.ts:35` |
| FR-STATUS-6 | The "Review & Send" primary button must be **prominent** (primary variant, full-width on mobile) and must show validation errors inline before allowing finalization. | `InvoiceWorkspace.tsx:2157-2166` |

### 2.2 Information Architecture

#### User Stories

| ID | Story |
|---|---|
| US-IA-1 | As a user viewing an invoice, I want a **dedicated "Customer / Billing" section** with all customer details in one card so I can quickly find billing info. |
| US-IA-2 | As a user, I want the **invoice metadata** (number, dates, currency, PO) grouped in a single "Invoice Details" block. |
| US-IA-3 | As an accounting team member, I want a **payment history table** on the invoice detail page showing all payments with date, amount, method, and status. |
| US-IA-4 | As a user, I want **activity timeline** showing all invoice events (created, sent, viewed, paid, etc.) in chronological order. |

#### Functional Requirements

| ID | Requirement | Source |
|---|---|---|
| FR-IA-1 | A **Customer / Billing section** must appear above the line items table. It contains: customer name (heading), company name, email (mailto link), phone, full address (multi-line). | `InvoicePreview.tsx:242-266`, `InvoiceDetail.tsx:386-400` |
| FR-IA-2 | An **Invoice Details block** must contain: invoice number (prominent), issue date, due date, currency + symbol, PO number (if set), payment terms (if set), tax ID (if set). Dates use `formatDateLong`. | `InvoicePreview.tsx:201-238` |
| FR-IA-3 | The **totals summary** must show: Subtotal, Discount (if > 0), Tax (expandable to per-rate breakdown), Fees (if > 0), **Paid** (if > 0), Total, Amount Due. Labels on left, values right-aligned, all use `font-tabular-nums`. | `InvoicePreview.tsx:364-410`, `InvoiceDetailView.tsx:589-631` |
| FR-IA-4 | **Tax breakdown** is required when multiple tax rates exist on line items. Group by rate: shows rate name + percentage on the left, taxable base, tax amount, and line total on the right. | `InvoicePreview.tsx:143-151` (tax rates detected), needs expansion |
| FR-IA-5 | **Payment History table** columns: Date, Amount, Method, Status, Reference (if available). Uses `DataTable` component with `table-zebra` styling. Empty state: "No payments recorded yet." | `InvoiceDetail.tsx:406-437` |
| FR-IA-6 | **Activity Timeline** items: event type (human-readable, capitalized), actor type, timestamp. Uses a dot + label layout with `status-primary` colored dots. | `InvoiceDetail.tsx:440-451`, `517-533` |
| FR-IA-7 | On mobile, the layout collapses to a single column. The totals summary remains right-aligned but narrows. Action buttons stack vertically. | `InvoiceDetail.tsx:295-364` (grid), needs responsive refinement |

### 2.3 Financial Logic & Transparency

#### User Stories

| ID | Story |
|---|---|
| US-FIN-1 | As a customer, I want to see the **tax rate name** (e.g. "GST @ 5%") on each line item so I understand what tax I'm paying. |
| US-FIN-2 | As an accountant, I want a **tax breakdown section** below the line items that groups taxable amounts by rate and shows the total tax per rate. |
| US-FIN-3 | As a user, I want the totals to clearly distinguish **Total**, **Paid**, and **Amount Due** with visual weight so there's no confusion. |
| US-FIN-4 | As a user, I want **partial payments** to be handled correctly — the Amount Due decreases by the total paid, and a "Paid" line shows the cumulative amount received. |
| US-FIN-5 | As a user, I want **quantities** formatted consistently (no trailing zeros for whole numbers, but 2 decimal places for fractions). |

#### Functional Requirements

| ID | Requirement | Source |
|---|---|---|
| FR-FIN-1 | Each line item's tax cell must show: `Tax Rate: 8.5% (GST)` — the rate as a percentage with the tax name in parentheses if available. | `InvoicePreview.tsx:76-80, 285-308` (shows `fmtRate` but no name) |
| FR-FIN-2 | A **Tax Breakdown** block renders when `taxTotal > 0`. It lists each unique tax rate with: rate label, taxable base, tax amount. | Backend `ApiInvoiceItem.tax_rate` is a decimal string; no tax `name` field exists yet on `ApiInvoiceItem` |
| FR-FIN-3 | Totals summary order: Subtotal → Discount (if shown) → Tax (expandable) → Fees (if shown) → **Total** (bold, larger) → **Paid** (green, if > 0) → **Amount Due** (primary color, largest). | `InvoicePreview.tsx:389-408`, `InvoiceDetailView.tsx:615-630` |
| FR-FIN-4 | **Paid** amount must always be shown (even if 0) in finalized invoices. Amount Due = Total − Paid. If Amount Due ≤ 0, show "Fully Paid" in success color. | `InvoicePreview.tsx:138, 395-408` |
| FR-FIN-5 | `Paid` line: green text (`text-success-text`), prefixed with `+`. `Amount Due`: primary brand color, bold, 1.5× font size. | `InvoicePreview.tsx:397-406` |
| FR-FIN-6 | **Quantity formatting**: integers display without decimals (`1`, `3`), fractions display with up to 2 decimal places (`1.5`, `0.25`), trailing zeros stripped (`3.50` → `3.5`). | `InvoicePreview.tsx:82-86` (`fmtQuantity`) |
| FR-FIN-7 | **Tax-inclusive line items** must display a small note below the description: `incl. 8.5% tax`. | `InvoicePreview.tsx:291-296` |
| FR-FIN-8 | **Currency values** always use `font-tabular-nums` for consistent digit alignment. Symbols precede amounts with a non-breaking space. | `index.css:469`, `formatCurrency` in `format.ts:32` |
| FR-FIN-9 | All money calculations must be **rounded to 2 decimal places** (or currency-native decimal places) using `Decimal.ROUND_HALF_UP`. | `calculation.ts:37`, `format.ts:34` |
| FR-FIN-10 | When `amount_due` is exactly 0 but invoice is not `paid` status, show `0.00` in primary color, not error. | State machine `statusAfterPayment` |

### 2.4 Tax Rate Name Support (New Data Field)

| ID | Requirement | Source |
|---|---|---|
| FR-TAX-1 | `ApiInvoiceItem` must include a `tax_name?: string \| null` field populated from the `tax_rates` table (`ApiTaxRate.name`). | `api.ts:34-46` (TaxRate has `name`), `ApiInvoiceItem` lacks it |
| FR-TAX-2 | `ApiInvoiceFee` must include `tax_name?: string \| null` for consistency. | `api.ts:141-148` |
| FR-TAX-3 | The calculation engine output (`CalculatedLineItem`, `CalculatedFee`) must carry the tax name through. | `types/calculation.ts:37-49, 51-57` |
| FR-TAX-4 | `WorkspaceLineItem` and `WorkspaceFee` interfaces must carry `taxName` for editable display. | `InvoiceWorkspace.tsx:73-91` |

---

## 3. UI Design & Styling Specifications

### 3.1 Typography & Hierarchy

| Element | Font Size | Font Weight | Color | Notes |
|---|---|---|---|---|
| Page Title (h1) | 1.5rem (24px) | 700 | `text-primary` | Truncated with ellipsis; followed by status badge |
| Section Title | 1.25rem (20px) | 600 | `text-primary` | `.invoice-section-heading` |
| Section Subtitle (uppercase) | 0.75rem (12px) | 600 | `text-tertiary` | `.invoice-section-title` — `tracking-wider` |
| Body Text | 0.875rem (14px) | 400 | `text-secondary` | `.invoice-body-text` |
| Caption | 0.75rem (12px) | 400 | `text-tertiary` | `.invoice-caption` |
| Label (form) | 0.75rem (12px) | 500 | `text-secondary` | `.form-label` |
| Label (form, uppercase) | 0.75rem (12px) | 500 | `text-tertiary` | `.form-label-secondary` — `uppercase tracking-wider` |

#### Product Name vs. Description Separation

| Element | Font Size | Font Weight | Color | Layout |
|---|---|---|---|---|
| **Product/Service Name** | 0.875rem (14px) | 600 | `text-primary` | First line, bold |
| **Description** | 0.8125rem (13px) | 400 | `text-secondary` | Second line, muted, optional |

**Implementation note:** In `InvoiceWorkspace.tsx:1608-1614`, the line item description uses a `<textarea>` with no visual distinction for product name vs. description. The `InvoicePreview.tsx:290-296` shows only description + tax note. A future enhancement would allow separate product name and description fields, but for now, the first line of the description is treated as the "name" and subsequent lines as "details."

### 3.2 Data Formatting Rules

#### 3.2.1 Quantities

| Rule | Value |
|---|---|
| **Whole numbers** | Display as integers (e.g., `1`, `3`, `10`) — no decimal point |
| **Fractions** | Display with up to 2 decimal places, trailing zeros stripped (e.g., `1.5`, `0.25`, `3.14`) |
| **Zero** | Display as `0` |
| **Negative** | Display with leading minus (e.g., `-2`) |
| **Implementation** | `fmtQuantity()` in `InvoicePreview.tsx:82-86` — `Decimal.toFixed(2).replace(/\.?0+$/, "")` |
| **Font** | Always `font-tabular-nums` |
| **Input step** | `step="any"` to allow fractional entry |

**Rationale:** Quantities like "3 hours" or "1.5 days" should not show "3.00" or "1.50". This matches professional invoicing tools like QuickBooks, FreshBooks, and Xero.

#### 3.2.2 Dates

| Rule | Value |
|---|---|
| **Short form** (tables, sidebars) | `MMM D, YYYY` (e.g., `Oct 6, 2026`) via `formatDate()` |
| **Long form** (invoice view, detail headers) | `MMMM D, YYYY` (e.g., `October 6, 2026`) via `formatDateLong()` |
| **Timezone** | Always rendered in customer's local timezone via `toLocaleDateString` with `timeZone: "UTC"` — all dates stored in UTC on the backend |
| **Layout** | Label above value: `Issue date` / `2026-10-06` → `Oct 6, 2026` |
| **Spacing** | 0.125rem (2px) gap between label and value, `text-sm` for value |
| **Accessibility** | Provide ISO date string in `aria-label` for screen readers |

**Current issue:** `InvoiceDetailView.tsx:636-639` and `InvoiceDetail.tsx:389-393` both show dates but in slightly different layouts. Must consolidate.

#### 3.2.3 Currency and Labels

| Rule | Value |
|---|---|
| **Symbol position** | Symbol precedes amount with narrow no-break space (U+202F) |
| **Decimal places** | 2 for most currencies; 0 for JPY, KRW, VND (per `getCurrencyMetadata`) |
| **Thousands separator** | Comma (en-US locale via `Intl.NumberFormat`) |
| **Negative values** | Minus sign before symbol (e.g., `-$10.00`) |
| **Zero values** | Display as `$0.00` (never blank or "—") unless explicitly a placeholder |
| **Font** | Always `font-tabular-nums` for consistent column alignment |
| **Label spacing** | 0.5rem (8px) horizontal gap between label and value in flex rows |

| Label Text | Color | Weight |
|---|---|---|
| `Subtotal` | `text-tertiary` | 500 |
| `Discount` | `text-tertiary` | 500 |
| `Tax` | `text-tertiary` | 500 |
| `Fees` | `text-tertiary` | 500 |
| `Total` | `text-secondary` | 600 |
| `Paid` | `text-success-text` | 500 (+ prefix) |
| `Amount Due` / `Balance Due` | `text-primary-brand` | 600 |

**Implementation:** Use `Money` component (`Money.tsx:25-48`) which applies `font-tabular-nums` and color classes. Or use `formatCurrency()` from `format.ts:32`.

### 3.3 Layout & Spacing

#### 3.3.1 Table Density

| Element | Padding | Min Height | Font Size |
|---|---|---|---|
| **Table header cell** | `px-4 py-3` (mobile), `px-6 py-3` (desktop) | 44px (mobile touch target) | 0.75rem (12px), uppercase, `text-tertiary` |
| **Table body cell** | `px-4 py-2.5` (mobile), `px-6 py-2.5` (desktop) | 48px | 0.875rem (14px) |
| **Table row** | — | — | — |
| **Zebra striping** | — | — | `table-zebra` class (even rows `bg-surface-alt`) |
| **Row hover** | — | — | `hover:bg-surface-alt` transition-colors |

#### 3.3.2 Column Widths

| Context | Column | Width | Notes |
|---|---|---|---|
| **Line Items Table** | `#` (number) | 32px | Centered, `text-tertiary` |
| | Description | `flex-1` (min 200px) | Left-aligned, wraps |
| | Qty | 70px | Right-aligned, `font-tabular-nums` |
| | Unit | 80px | Left-aligned |
| | Rate | 100px | Right-aligned |
| | Tax Rate | 90px | Right-aligned |
| | Amount | 100px | Right-aligned, bold |
| **Payment History** | Date | 120px | |
| | Amount | 100px | Right-aligned |
| | Method | 120px | |
| | Status | 100px | Centered |
| | Reference | `flex-1` | Right-aligned, truncated |

#### 3.3.3 Financial Summary Grouping

```
┌──────────────────────────────────────────────────────────┐
│  SUBTOTAL                    $1,250.00                   │
│  Discount                    −$100.00                    │
│  Tax                           $87.50                    │
│  Fees                          $15.00                     │
│  ──────────────────────────────────────────────────────   │
│  TOTAL                       $1,252.50                  │
│  Paid                       +$500.00                    │
│  ──────────────────────────────────────────────────────   │
│  AMOUNT DUE                  $752.50                    │
└──────────────────────────────────────────────────────────┘
```

| Element | Width | Alignment | Visual |
|---|---|---|---|
| Summary block | `w-64` (desktop), `w-full` (mobile) | Right-aligned labels, values right-aligned | Bordered left: `border-l-2 border-color` |
| Subtotal row | — | `text-sm`, `text-tertiary` label | |
| Total row | — | `text-lg font-semibold`, `border-t-2` | Strong top border |
| Amount Due row | — | `text-2xl font-extrabold`, `text-primary-brand`, `border-t-2` | Prominent — primary color |
| Paid row | — | `text-success-text`, prefixed with `+` | Green text |
| Padding | `py-2` per row | — | Consistent vertical rhythm |

#### 3.3.4 Action Button Layout

**Desktop (inline):**
```
[ Edit ] [ Duplicate ] [ Send Reminder ] [ Download PDF ] [ Record Payment ] [ Cancel ]  [ Void ]
```

**Mobile (stacked):**
```
[    Edit     ]    (full width)
[  Duplicate  ]
[ Download    ]
...
[ Record Payment ]  (primary, full width, if applicable)
```

| Button Variant | Usage | Class |
|---|---|---|
| Primary | Main action (Record Payment, Review & Send) | `bg-primary-action text-on-primary` |
| Secondary | Edit, Duplicate, Download PDF | `border border-input-border text-secondary` |
| Warning | Send Reminder | `bg-warning-bg text-warning-text` |
| Danger | Void | `bg-error-bg text-error-text` |
| Ghost | Copy link, Cancel | `text-secondary hover:bg-hover` |

**Spacing:** `gap-2` between buttons, `gap-3` on mobile stacked. All buttons have `min-height: 44px` for touch target compliance.

---

## 4. Implementation Roadmap

### Phase 1: Critical Fixes (MVP)

**Priority:** Must-have for production launch. Addresses correctness, data integrity, and core formatting.

| # | Task | Files | Effort |
|---|---|---|---|
| 1 | Fix `InvoiceDetailView` line total calculation — use backend-computed values instead of `qty × unitPrice` | `InvoiceDetail.tsx:564-584` | 2h |
| 2 | Add `tax_name` to `ApiInvoiceItem` and `ApiInvoiceFee` types | `api.ts:119-148` | 1h |
| 3 | Create shared `formatTaxRate()` utility (replace inline `new Decimal(item.tax_rate).mul(100).toFixed(2) + "%"`) | `format.ts` or new `formatTax.ts` | 2h |
| 4 | Fix `PublicInvoice.tsx` to use `StatusBadge` component instead of inline `getStatusColor()` | `PublicInvoice.tsx:147-159` | 2h |
| 5 | Add "Paid" row to `InvoiceDetailView` totals (currently missing) | `InvoiceDetail.tsx:589-631` | 1.5h |
| 6 | Use `Money` component everywhere in invoice display for consistent tabular-nums | Various | 3h |
| 7 | Add `tax_name` to `InvoicePreview` types and display | `InvoicePreview.tsx` | 2h |
| 8 | Add `tax_name` to `WorkspaceLineItem` and `CalculatedLineItem` | `InvoiceWorkspace.tsx`, `calculation.ts`, `types/calculation.ts` | 2h |

**Total estimated effort:** ~15h

### Phase 2: Core Functionality

**Priority:** High. Adds the major workflow pieces and structural improvements.

| # | Task | Files | Effort |
|---|---|---|---|
| 1 | Create `InvoiceDisplay` shared component (read-only view of an invoice) | New component | 8h |
| 2 | Create `InvoiceActionPanel` component with state-aware buttons | New component | 6h |
| 3 | Refactor `InvoiceDetail.tsx` to use `InvoiceDisplay` + `InvoiceActionPanel` | `InvoiceDetail.tsx` | 6h |
| 4 | Refactor `InvoicePreview.tsx` to share line-item rendering with `InvoiceDisplay` | `InvoicePreview.tsx` | 4h |
| 5 | Add Tax Breakdown section (group by rate, show taxable base + tax per rate) | `InvoiceDisplay` | 4h |
| 6 | Add Payment History table to `InvoiceDetail` (already exists, needs styling alignment) | `InvoiceDetail.tsx:406-437` | 3h |
| 7 | Add Customer/Billing section as a proper card in `InvoiceDetail` | `InvoiceDetail.tsx` | 3h |

**Total estimated effort:** ~34h

### Phase 3: Advanced UX & Polish

**Priorit**y: Medium-High. Visual refinement and edge case handling.

| # | Task | Files | Effort |
|---|---|---|---|
| 1 | Status dot indicators (2px colored circle before badge text) | `StatusBadge.tsx` | 1.5h |
| 2 | Add `#`/`line number` column to `InvoicePreview` and `InvoiceDetailView` tables | `InvoicePreview.tsx`, `InvoiceDetail.tsx` | 1h |
| 3 | Product name vs. description visual separation in line items | `InvoicePreview.tsx:290-296`, `InvoiceWorkspace.tsx:1608-1614` | 3h |
| 4 | Mobile responsiveness for all invoice views (stacked layout) | All components | 4h |
| 5 | Tax-inclusive note refinement (`incl. 8.5% tax`) — improve placement | `InvoicePreview.tsx:292-296` | 1.5h |
| 6 | Empty states for line items, fees, attachments, payments | `EmptyState` component | 2h |
| 7 | Consistent "Paid in full" success display when `amount_due ≤ 0` | `InvoiceDetail.tsx:246-259`, `PublicInvoice.tsx:465-481` | 2h |
| 8 | Refactor `InvoiceWorkspace` line items table to reduce column density (merge Qty+Unit, inline Disc+Type) | `InvoiceWorkspace.tsx:1563-1755` | 4h |

**Total estimated effort:** ~19h

---

## 5. Final Visual Concept

### Overall Layout (Invoice Detail Page)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Invoices    Invoice #INV-001    [ Draft ]               │
│  [ Edit ] [ Duplicate ] [ Download PDF ] [ Send Reminder ]         │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  ┌─────────────┐   Draft                                   │ │
│  │  │ InvoiceFlow │   ──────  Sent  ──────  Viewed             │ │
│  │  │ Logo        │            ↘                               │ │
│  │  │  Acmecorp   │   Partially Paid  ────  Paid               │ │
│  │  │  Inc.       │                                            │ │
│  │  └─────────────┘                                            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────┐   ┌──────────────────────────────┐   │
│  │  CUSTOMER / BILLING      │   │  INVOICE DETAILS             │   │
│  │  John Smith              │   │  Invoice #     INV-001        │   │
│  │  Acme Corp               │   │  Issue date    Oct 6, 2026    │   │
│  │  johnsmith@example.com   │   │  Due date      Oct 36, 2026   │   │
│  │  +1 (555) 123-4567        │   │  Currency      USD ($)       │   │
│  │  123 Main St             │   │  P.O. #        PO-789        │   │
│  │  New York, NY 10001      │   │  Terms         Net 30        │   │
│  │  United States           │   │                              │   │
│  └──────────────────────────┘   └──────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  LINE ITEMS                               Tax         Amount   │ │
│  │  ┌─────┬──────────────────────────┬─────┬─────┬─────┬─────┬─────┤ │
│  │  │  #  │Description (product + desc)│ Qty │ Unit│ Rate│ Tax │Total│ │
│  │  ├─────┼──────────────────────────┼─────┼─────┼─────┼─────┼─────┤ │
│  │  │ 1   │Web Design                  │  1  │ hrs │$100 │ 8.5 │$108.5│ │
│  │  │    │Landing page redesign       │     │     │     │ %   │     │ │
│  │  ├─────┼──────────────────────────┼─────┼─────┼─────┼─────┼─────┤ │
│  │  │ 2   │Hosting (Annual)            │  1  │ each│$200 │ 0   │$200 │ │
│  │  └─────┴──────────────────────────┴─────┴─────┴─────┴─────┴─────┘ │
│  │                                                                   │
│  │  TAX BREAKDOWN                                                   │
│  │  GST @ 8.5%       Taxable: $100.00    Tax: $8.50                  │
│  │  ─────────────────────────────────────────────────────────────   │
│  │                                                                   │
│  │  SUBTOTAL              $1,250.00                                  │
│  │  Discount              −$100.00                                   │
│  │  Tax                   $87.50                                     │
│  │  ──────────────────────────────                                 │
│  │  TOTAL                 $1,252.50                                  │
│  │  Paid                 +$500.00                                    │
│  │  ──────────────────────────────                                 │
│  │  AMOUNT DUE              $752.50    [ Record Payment ] [ Pay Now ] │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────┐   ┌──────────────────────────────┐   │
│  │  PAYMENT HISTORY         │   │  ACTIVITY TIMELINE          │   │
│  │  ┌───────────────────────────────────────────────────────┐     │   │
│  │  │Date      Amount   Method      Status                   │     │   │
│  │  │Oct 6     $500.00  Card ****42 Paid                    │     │   │
│  │  └───────────────────────────────────────────────────────┘     │   │
│  │  No payments... or  table with zebra stripes                  │   │
│  └──────────────────────────┘   │ • Invoice created  Oct 6      │   │
│                                 │ • Invoice sent     Oct 6      │   │
│                                 │ • Customer viewed  Oct 6      │   │
│                                 │ • Payment received Oct 6      │   │
│                                 └───────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Visual Style Details

| Element | Treatment |
|---|---|
| **Status badge** | Rounded full (9999px), colored background (`status-success-bg`, `status-warning-bg`, etc.), 2px dot before label, `text-xs font-medium` |
| **Lifecycle stepper** | 5 steps (Draft → Sent → Viewed → Partially Paid → Paid), circular dots with inner 2px dot in status color, connecting line, step labels below in `text-xs` |
| **Line items table** | White surface, `border` around table, `bg-surface-alt` header with `text-xs uppercase text-tertiary`, zebra striping on body rows, hover state |
| **Totals summary** | Right-aligned, `w-64` on desktop, `border-t-2` above Total, Amount Due in `text-2xl font-extrabold text-primary-brand` |
| **Customer / Billing card** | `bg-surface`, `border`, `rounded-xl`, `p-6`, shadow-sm |
| **Invoice Details card** | Same surface treatment, grid layout `sm:grid-cols-2` |
| **Action buttons** | Consistent `Button` component, `min-h-[44px]` touch targets, `gap-2` spacing |
| **Tax rate** | Small rounded badge `bg-surface px-1.5 py-0.5 text-xs` within the cell |
| **Amount Due (zero)** | When 0, show `$0.00` in `text-secondary` (not primary-brand, not error) |
| **Paid in full** | Green check icon circle + "Paid in full" text in `text-success-text` |

### Status Color Mapping (Semantic)

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

All colors are theme-aware — dark theme variants exist in `index.css:108-200`.

---

## Appendix A: Component Inventory

| Component | Location | Purpose | Status |
|---|---|---|---|
| `InvoiceWorkspace` | `components/InvoiceWorkspace.tsx` | Edit/draft view with live preview sidebar | Existing, needs table refinement |
| `InvoiceDetailView` | `pages/InvoiceDetail.tsx:535` | Read-only display inside detail page | Existing, needs calculation fix |
| `InvoiceDisplay` | *(new)* | Shared read-only invoice component | **TO BUILD** (Phase 2) |
| `InvoiceActionPanel` | *(new)* | State-aware action buttons | **TO BUILD** (Phase 2) |
| `InvoicePreview` | `components/InvoicePreview.tsx` | Live preview in workspace sidebar | Existing, needs shared rendering |
| `PublicInvoice` | `pages/PublicInvoice.tsx` | Customer-facing public view | Existing, needs StatusBadge refactor |
| `StatusBadge` | `components/ui/StatusBadge.tsx` | Color-coded status badge | Existing, add dot support |
| `InvoiceLifecycle` | `components/ui/InvoiceLifecycle.tsx` | Stepper showing invoice journey | Existing, already in detail |
| `Money` | `components/ui/Money.tsx` | Currency-aware money display | Existing, use everywhere |
| `KPICard` | `components/ui/KPICard.tsx` | Metric card for dashboards | Existing |
| `EmptyState` | `components/ui/EmptyState.tsx` | Empty/loading/error states | Existing |
| `SectionCard` | `components/SectionCard.tsx` | Card with title + optional action | Existing |

---

## Appendix B: API Coverage

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /api/invoices/:id` | Fetch invoice with items, fees, attachments | ✅ Exists (`getInvoice`) |
| `GET /api/invoices/:id/payments` | Fetch payment history | ✅ Exists (`getInvoicePayments`) |
| `GET /api/invoices/:id/events` | Fetch activity timeline | ✅ Exists (`getInvoiceEvents`) |
| `PATCH /api/invoices/:id` | Update invoice metadata | ✅ Exists (`updateInvoice`) |
| `POST /api/invoices/:id/finalize` | Finalize invoice | ✅ Exists (`finalizeInvoice`) |
| `POST /api/invoices/:id/send` | Send invoice by email | ✅ Exists (`sendInvoice`) |
| `POST /api/invoices/:id/send-reminder` | Send payment reminder | ✅ Exists (`sendReminder`) |
| `POST /api/invoices/:id/cancel` | Cancel invoice | ✅ Exists (`cancelInvoice`) |
| `POST /api/invoices/:id/void` | Void invoice | ✅ Exists (`voidInvoice`) |
| `GET /api/invoices/:id/pdf` | Download PDF | ✅ Exists (`getInvoicePdf`) |

---

## Appendix C: Tax Name Support — Backend Schema

The backend `tax_rates` table already has a `name` field (`ApiTaxRate.name` at `api.ts:36`). The line items table stores `tax_rate` as a decimal string. To display tax names:

1. **Backend** (`src/index.ts`): When building the invoice response, join `invoice_items.tax_rate` → `tax_rates.rate` to include `tax_rates.name` as `tax_name` on each line item.
2. **Frontend types**: Add `tax_name?: string \| null` to `ApiInvoiceItem` and `ApiInvoiceFee`.
3. **Calculation engine**: Pass `tax_name` through `CalculatedLineItem` and `CalculatedFee`.
4. **Display**: Show `8.5% (GST)` in tax cells, group by rate in tax breakdown.
