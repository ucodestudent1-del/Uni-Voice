# Functional Requirements Document (FRD)
## SaaS Quote Creation Module

**Document Status:** Draft v1.0  
**Last Updated:** 2026-10-11  
**Author:** Senior Product Manager  
**Target Release:** Phase 6  

---

## 1. Executive Summary

### 1.1 Purpose

This document specifies the complete functional requirements for the **Quote Creation Module** of the Universal Invoice Generator SaaS. The module enables users to prepare, send, track, and convert professional quotations (estimates/proposals) into invoices, following the same architectural patterns and design-system conventions as the existing Invoice Creation Module.

### 1.2 Product Vision

The Quote Creation Module is a full-page, single-page, editable-form interface that allows businesses to prepare accurate, branded quotations quickly and intuitively. It reuses the existing calculation engine, data models, template system, and backend service abstractions, while introducing quote-specific concepts: validity periods, deposits, scope of work, customer acceptance/rejection, and one-click conversion to invoice.

### 1.3 Current State

After codebase analysis, the following exists and can be reused:

| Layer | Component | Location | Status |
|---|---|---|---|
| **Frontend calculation engine** | `CalculationEngine` with `decimal.js` | `webapp/src/utils/calculation.ts:32` | Complete, tested |
| **Backend calculation engine** | `CalculationEngine` (Decimal + ROUND_HALF_UP) | `src/domain/calculation.ts:1` | Complete |
| **Quote data model** | `quotes`, `quote_items`, `quote_fees` tables | `src/db/migrations/001_initial_schema.sql:389` | Schema complete (with 023 additions) |
| **Quote numbering** | `quote_number_sequences` table | `src/db/migrations/021_quote_number_sequences.sql` | Complete |
| **Quote deposit fields** | `deposit_type`, `deposit_value`, etc. | `src/db/migrations/042_quote_deposit_fields.sql` | Complete |
| **Quote content fields** | `scope_of_work`, `payment_instructions`, `is_finalized` | `src/db/migrations/044_quote_content_fields.sql` | Complete |
| **Quote events table** | `quote_events` activity timeline | `src/db/migrations/049_quote_events_table.sql` | Complete |
| **Business default validity** | `default_quote_validity_days` | `src/db/migrations/043_business_quote_validity.sql` | Complete |
| **Quote internal notes** | `internal_notes` column | `src/db/migrations/050_quote_internal_notes.sql` | Complete |
| **Quote `viewed` status** | Added to enum + `viewed_at` column | `src/db/migrations/053_add_viewed_to_quote_status_enum.sql` | Complete |
| **Quote template (Handlebars)** | `DEFAULT_QUOTE_TEMPLATE` inline | `src/services/templates/template-renderer.ts:880` | Exists (invoice-labeled, needs quote-specific template) |
| **Design tokens / theme** | Semantic status colors, typography | `webapp/src/styles/index.css` | Complete |
| **UI primitives** | `StatusBadge`, `Button`, `Money`, `FormField`, `EmptyState`, `PageHeader` | `webapp/src/components/ui/` | Complete, polished |
| **Public customer portal pattern** | `PublicInvoice.tsx` | `webapp/src/pages/PublicInvoice.tsx` | Complete (invoice-only; needs quote equivalent) |
| **Invoice editor pattern** | `InvoiceWorkspace.tsx` | `webapp/src/pages/InvoiceWorkspace.tsx` | Complete reference for quote builder |
| **Invoice detail pattern** | `InvoiceDetail.tsx` | `webapp/src/pages/InvoiceDetail.tsx` | Complete reference for quote detail |
| **State machine pattern** | `ALLOWED_STATE_TRANSITIONS` | `src/services/invoice-service.ts:82` | Complete reference |
| **API client pattern** | `getInvoices`, `createInvoice`, etc. | `webapp/src/api/client.ts:1265` | Complete reference |
| **Types** | `ApiInvoice`, `ApiQuote`, `ApiQuoteItem`, `ApiQuoteFee` | `webapp/src/types/api.ts:253` | Complete |

### 1.4 What's Missing

The quote creation module is **not yet implemented** at the application layer. Specifically:

1. **No QuoteService** — no backend service for quotes (no `src/services/quote-service.ts`).
2. **No quote API routes** — no `/api/quotes/*` endpoints in `src/index.ts`.
3. **No frontend quote pages** — `App.tsx` has no routes for quotes (no `Quotes.tsx`, no `QuoteWorkspace.tsx`, no `QuoteDetail.tsx`, no `PublicQuote.tsx`).
4. **No quote builder component** — the documented `QuoteBuilder.tsx` and sub-components in `docs/quote-builder-spec.md` are planned but do not exist.
5. **No quote status badge config** — no `quoteStatusConfig` equivalent of `invoiceStatusConfig`.
6. **No quote state machine** — no `canTransition` / `ALLOWED_STATE_TRANSITIONS` for quotes.
7. **No quote-specific template** — the existing `DEFAULT_INVOICE_TEMPLATE` is used for quotes with invoice labeling. A dedicated `DEFAULT_QUOTE_TEMPLATE` with "QUOTATION" branding, "Valid Until", and "Estimated Total" labeling needs to be extracted from the shared template-renderer.
8. **No public quote portal** — no `/api/public/quotes/:token` route, no `PublicQuote.tsx` page, no customer acceptance/rejection endpoints.
9. **No quote events API** — no `GET /api/quotes/:id/events` endpoint.
10. **No quote listing API** — no `GET /api/quotes` with filtering/pagination.

---

## 2. User Personas

| Persona | Role | Goals | Pain Points |
|---|---|---|---|
| **SMB Owner** (Sarah) | Small business owner, 1–10 employees | Create quotes quickly, get customer acceptance, convert to invoice | Too many clicks, complex software, forgotten follow-ups |
| **Accountant** (Alex) | CPA managing 50+ clients | Accurate calculations, audit trail, consistent quoting | Manual data re-entry, rounding errors, version drift |
| **Freelancer** (Jamie) | Solo consultant | Professional quotes, brand consistency, mobile-friendly | Templates don't match brand, no online acceptance |
| **Sales Director** (Maria) | Mid-market, 50–500 employees | Track quote pipeline, expiration reminders, convert approvals | No visibility into viewed/accepted status, missed expirations |

---

## 3. User Stories

### 3.1 Quote Creation & Draft Management

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-CREATE-1 | SMB Owner | start from a blank quote or duplicate an existing quote | I don't waste time on setup |
| US-CREATE-2 | Accountant | see a split-screen with the form on the left and a live preview on the right | I can verify the quote looks correct as I type |
| US-CREATE-3 | Freelancer | have the quote save automatically as I work | I never lose my progress |
| US-CREATE-4 | Finance Manager | see a clear "Saving…" / "Saved" indicator | I know whether my changes are persisted |
| US-CREATE-5 | SMB Owner | get inline validation errors without pop-ups | I can fix problems quickly without disruption |
| US-CREATE-6 | Accountant | duplicate an existing quote to create a new version | I can revise quotes without starting from scratch |
| US-CREATE-7 | Sales Director | save a quote as a reusable template | Standard quotes are faster to create next time |

### 3.2 Customer Selection & Details

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-CUSTOMER-1 | SMB Owner | select an existing customer from a searchable dropdown | I don't have to retype customer info |
| US-CUSTOMER-2 | Accountant | add a new customer inline during quote creation | I can capture new customers without leaving the quote |
| US-CUSTOMER-3 | Freelancer | have the customer's billing address auto-populated | I always have correct details |
| US-CUSTOMER-4 | Sales Director | set different "ship to" / deliver-to address | I can bill one company for work at another location |

### 3.3 Line Item Management

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-LINE-1 | Accountant | add line items with description, quantity, unit price, discount, and tax | I can price any service or product |
| US-LINE-2 | SMB Owner | see subtotals and totals calculated in real time as I edit | I don't have to do math manually |
| US-LINE-3 | Accountant | reorder line items by dragging | The quote reads in the right order for the client |
| US-LINE-4 | Freelancer | duplicate a line item I use frequently | I don't retype common entries |
| US-LINE-5 | SMB Owner | delete a line item with an undo affordance | I can fix mistakes easily |
| US-LINE-6 | Accountant | apply both line-level and quote-level discounts | I can offer flexible pricing |
| US-LINE-7 | SMB Owner | mark items as tax-inclusive with a toggle | The price I quote already includes tax |
| US-LINE-8 | Sales Director | mark certain items as optional | Customers can pick and choose add-ons |
| US-LINE-9 | SMB Owner | see a "Scope of Work" section for project-based pricing | Customers understand what's included |

### 3.4 Real-Time Calculation Engine

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-CALC-1 | Accountant | the calculation engine to use decimal.js integer minor-unit math | There are never floating-point rounding errors |
| US-CALC-2 | Accountant | tax broken down by rate with a per-rate summary | I can verify tax compliance at a glance |
| US-CALC-3 | Freelancer | fees (shipping, processing) added as separate line items | I can track extra charges clearly |
| US-CALC-4 | Accountant | the backend to re-validate all calculations on finalize | The sent quote is always correct |
| US-CALC-5 | Sales Director | the estimated total to update instantly when I change quantities | I can iterate on pricing with confidence |

### 3.5 Payment Terms, Dates & Expiry

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-DATE-1 | SMB Owner | issue date to default to today and expiry date to be set automatically | I save clicks on every quote |
| US-DATE-2 | Freelancer | choose from standard validity periods (7, 14, 30, 60, 90 days) | I don't calculate dates manually |
| US-DATE-3 | Accountant | set a custom expiry date | I handle edge-case quoting cycles |
| US-DATE-4 | Sales Director | see an urgency warning when a quote is expiring soon (< 7 days) | I can follow up before quotes expire |
| US-DATE-5 | SMB Owner | set payment terms (Net 7, Net 15, Net 30, etc.) | Customers know when payment is due |

### 3.6 Currency & Multi-Currency

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-CURR-1 | Freelancer (international) | select from all supported currencies | My international clients see the right currency |
| US-CURR-2 | Accountant | currency symbol and decimal places adapt automatically | There are no display errors for JPY (0 dp) vs EUR (2 dp) |

### 3.7 Reusable Products & Services & Customer-Specific Pricing

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-PRODUCT-1 | SMB Owner | select from a catalog of saved products/services when adding a line item | I don't retype descriptions and prices |
| US-PRODUCT-2 | Accountant | save a new product to the catalog from within the line item | Future quotes are faster |
| US-PRODUCT-3 | Sales Director | see customer-specific pricing automatically applied for known customers | VIP clients get their negotiated rates |
| US-PRODUCT-4 | Freelancer | search the product catalog with type-ahead | I find products fast |

### 3.8 Branding & Templates

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-BRAND-1 | Freelancer | my company logo, colors, and contact info to appear on the quote | Quotes look professional and on-brand |
| US-BRAND-2 | SMB Owner | choose from multiple saved quote templates | Different clients get different layouts |
| US-BRAND-3 | Accountant | set default terms, notes, and payment instructions at the business level | Every quote starts with the right boilerplate |

### 3.9 Quote Finalization & Sending

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-SEND-1 | Finance Manager | a "Review & Send" confirmation step that shows validation errors | I never send a broken quote |
| US-SEND-2 | SMB Owner | to download a PDF of the finished quote | I can attach it to an email manually if needed |
| US-SEND-3 | Freelancer | to email the quote directly to the customer from the app | Customers get the quote instantly |
| US-SEND-4 | Sales Director | to share a secure link to the quote online | Clients can review and accept/decline digitally |
| US-SEND-5 | SMB Owner | a confirmation before the quote is sent | I avoid accidental sends |

### 3.10 Customer Interaction — Online Review, Acceptance & Rejection

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-CUST-1 | Customer (via portal) | to view the full quote online with pricing and terms | I understand exactly what I'm accepting |
| US-CUST-2 | Customer | to accept the quote with a single click (electronic signature) | I don't need to print, sign, and scan |
| US-CUST-3 | Customer | to reject the quote with an optional comment | I can communicate my reasons clearly |
| US-CUST-4 | Customer | to request changes before accepting | We can clarify scope before committing |
| US-CUST-5 | Sales Director | to receive a notification when a customer views the quote | I know when to follow up |
| US-CUST-6 | SMB Owner | to receive a notification when a customer accepts the quote | I can start work immediately |

### 3.11 Invoice Conversion

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-CONVERT-1 | Accountant | to convert an accepted quote into an invoice with a single click | I don't re-enter customer details, line items, or prices |
| US-CONVERT-2 | Finance Manager | the converted invoice to carry over all agreed terms, discounts, and taxes | The invoice matches the accepted quote exactly |
| US-CONVERT-3 | Sales Director | to convert a quote even if the customer hasn't fully accepted (with confirmation) | I can start billing for partial approval |

### 3.12 Status Tracking & Filtering

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-STATUS-1 | Sales Director | to see clear status badges (Draft, Sent, Viewed, Accepted, Rejected, Expired, Converted) | I can scan my quote list and know where things stand |
| US-STATUS-2 | Accountant | an activity timeline showing all events (created, sent, viewed, accepted, etc.) | I have an audit trail |
| US-STATUS-3 | Finance Manager | to filter the quote list by status, customer, date range, and amount | I find the quotes I need quickly |
| US-STATUS-4 | Sales Director | to be notified when a quote is approaching its expiry date | I don't lose deals to expired quotes |
| US-STATUS-5 | SMB Owner | the quote list to show a color-coded pipeline overview | I understand my sales funnel at a glance |

---

## 4. Functional Specifications

### 4.1 UI/UX Design

#### 4.1.1 Layout — Single-Page Split-Screen

**Desktop (≥ 1024px):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PageHeader: "New Quote"  |  [← Back]  |  StatusBadge: Draft / Saving / Saved │
│  ┌─────────────┐ ┌───────────────────────────────────────────────────────┐  │
│  │  LEFT (45%) │ │  RIGHT (55%)                                            │  │
│  │  ┌────────┐ │ │  Live Preview (rendered quote HTML)                   │  │
│  │  │Customer│ │ │                                                       │  │
│  │  │Selector│ │ │  Header: QUOTATION badge, quote number, issue date,    │  │
│  │  └────────┘ │ │           valid-until date, status badge               │  │
│  │             │ │                                                       │  │
│  │  ┌────────┐ │ │  Customer block ("Prepared For")                        │  │
│  │  │Details │ │ │  Line items table                                     │  │
│  │  │(Curr,  │ │ │  Scope of Work box                                    │  │
│  │  │Dates,  │ │ │  Financial summary (Estimated Total)                    │  │
│  │  │Terms)  │ │ │  Deposit callout (if applicable)                      │  │
│  │  └────────┘ │ │  Acceptance section hint                              │  │
│  │             │ │                                                       │  │
│  │  ┌────────┐ │ │                                                       │  │
│  │  │Line    │ │ │                                                       │  │
│  │  │Items   │ │ │                                                       │  │
│  │  │+ Add   │ │ │                                                       │  │
│  │  │line    │ │ │                                                       │  │
│  │  │item    │ │ │                                                       │  │
│  │  └────────┘ │ │                                                       │  │
│  │             │ │                                                       │  │
│  │  ┌────────┐ │ │                                                       │  │
│  │  │Deposit │ │ │                                                       │  │
│  │  │Config  │ │ │                                                       │  │
│  │  └────────┘ │ │                                                       │  │
│  │             │ │                                                       │  │
│  │  ┌────────┐ │ │                                                       │  │
│  │  │Fees    │ │ │                                                       │  │
│  │  │+ Add   │ │ │                                                       │  │
│  │  │fee     │ │ │                                                       │  │
│  │  └────────┘ │ │                                                       │  │
│  │             │ │                                                       │  │
│  │  ┌────────┐ │ │                                                       │  │
│  │  │Quote   │ │ │                                                       │  │
│  │  │Discount│ │ │                                                       │  │
│  │  └────────┘ │ │                                                       │  │
│  │             │ │                                                       │  │
│  │  ┌────────┐ │ │                                                       │  │
│  │  │Notes,  │ │ │                                                       │  │
│  │  │Terms,  │ │ │                                                       │  │
│  │  │Scope,  │ │ │                                                       │  │
│  │  │Internal│ │ │                                                       │  │
│  │  └────────┘ │ │                                                       │  │
│  └─────────────┘ └───────────────────────────────────────────────────────┘  │
│                                                                             │
│  Sticky Action Bar: [Save Draft] [Duplicate] [Download PDF] [Preview]       │
│                [Review & Send] [Convert to Invoice]                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tablet (768px – 1023px):** Left panel becomes 48%, preview becomes 52%. Line item table columns compress.

**Mobile (< 768px):** Single column — form on top, preview collapses into a toggleable drawer at the bottom. Action buttons stack vertically at the bottom of the viewport with a backdrop blur.

#### 4.1.2 Input Fields

##### Quote Details Section

| Field | Control Type | Default | Notes |
|---|---|---|---|
| Customer | CustomerSelector dropdown | — | Searchable; shows name, email, company |
| Currency | Select dropdown | Business default | Locked after first line item with a price is entered |
| Issue Date | Date picker | Today | ISO date string |
| Expiry Date | Date picker | Issue + business `default_quote_validity_days` (default 30) | Shown prominently; red warning if < 7 days from now |
| Payment Terms | Select dropdown | "Net 30" | Options: Net 7, Net 15, Net 30, Net 60, Custom, Upfront |
| Notes | Textarea | Business default notes | Shown on PDF and public view |
| Terms | Textarea | Business default terms | Shown on PDF and public view |
| Scope of Work | Textarea | — | Detailed project description shown on PDF |
| Internal Notes | Textarea | — | Visible only to the business team, never to customers |
| Payment Instructions | Textarea | Business default | How customer should pay |

##### Deposit Configuration

| Field | Control Type | Options | Notes |
|---|---|---|---|
| Deposit Type | Radio toggle | None / Percentage / Fixed Amount | Default: None |
| Deposit Value | Number input | 0–100 (percentage) or currency amount (fixed) | Disabled when "None" |
| Deposit Due Date | Date picker | Defaults to a date before expiry | Shown on PDF and public view |

##### Line Items Table (Desktop)

| Column | Width | Alignment | Content |
|---|---|---|---|
| `#` | 32px | Center | Line number (1, 2, 3…) — also serves as drag handle |
| **Description** | flex-1 (min 200px) | Left | Textarea, multi-line, auto-expand; optional product selector icon |
| **Qty** | 70px | Right | Number input, step 0.01, default 1 |
| **Unit** | 80px | Left | Select: "each", "hour", "day", "week", "month", "fixed", custom |
| **Unit Price** | 100px | Right | Currency input with symbol prefix |
| **Disc** | 80px | Right | Number + type toggle (fixed/%) |
| **Tax** | 90px | Right | Select from business tax rates |
| **Optional** | 50px | Center | Checkbox — if checked, item is marked optional and can be excluded |
| **Line Total** | 100px | Right | Money component, bold; updates on every keystroke |
| **Actions** | 72px | Center | Duplicate icon, Delete icon |

##### Fees Section

| Field | Control Type | Notes |
|---|---|---|
| Description | Text input | e.g. "Shipping", "Processing Fee" |
| Amount | Currency input | |
| Tax Rate | Select / Number | From business tax rates |
| + Add Fee | Button | Appends a new fee row |

##### Quote-Level Discount

| Field | Control Type | Notes |
|---|---|---|
| Discount Type | Dropdown | None / Fixed Amount / Percentage |
| Discount Value | Number input | Appears when type ≠ None |

#### 4.1.3 Real-Time Visual Feedback

1. **Live Preview (right panel)** updates on every keystroke using the frontend `CalculationEngine`. Shows the rendered quote exactly as it will appear on PDF / public view.
2. **Validation** — fields with issues get a red border and error icon. A `ValidationPanel` at the bottom of the form shows a summary. The "Review & Send" button is disabled until all blocking errors are resolved.
3. **Save state indicator** in the PageHeader:
   - "Saving…" (spinner) while debounced save is in-flight
   - "Saved" (green check) when save completes
   - "Save failed" (red) on error with retry link
   - "Unsaved changes" (orange dot) when dirty and not yet saved
4. **Expiry urgency** — if `expiryDate` is within 7 days, the PageHeader shows a red warning badge with countdown.
5. **Line item row highlighting** — rows that fail validation get a subtle red background.

### 4.2 Core Management

#### 4.2.1 Quote Lifecycle & State Machine

**Status Enum** (from `src/db/migrations/001_initial_schema.sql:389`, extended by `053`):

```sql
CREATE TYPE quote_status AS ENUM (
  'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'
);
```

**Allowed State Transitions:**

| Current State | Allowed Next States | Trigger |
|---|---|---|
| `draft` | `sent`, `cancelled` | Finalize & Send, Cancel |
| `sent` | `viewed`, `accepted`, `rejected`, `expired`, `cancelled` | Customer views link, customer accepts, customer rejects, expiry date passes, user cancels |
| `viewed` | `accepted`, `rejected`, `expired`, `cancelled` | Customer accepts/rejects, expiry, user cancels |
| `accepted` | `converted` (→ invoice) | User converts to invoice |
| `rejected` | `cancelled` | User cancels manually |
| `expired` | `cancelled` | User cancels (quote is no longer active) |
| `cancelled` | *(terminal)* | — |

**Quote State Transition Triggers:**

| Trigger | From → To | Side Effects |
|---|---|---|
| **Finalize & Send** | `draft → sent` | Generates quote number (atomic via `quote_number_sequences`); sets `is_finalized = true`; `finalized_at = NOW()`; generates `public_token`; logs `finalized` event; logs `number_assigned` event |
| **Customer views public link** | `sent → viewed` | `viewed_at = NOW()`; inserts into `quote_view_log`; logs `viewed` event |
| **Customer accepts** | `sent`/`viewed → accepted` | `is_accepted = true`; `accepted_at = NOW()`; logs `accepted` event; sends notification to business |
| **Customer rejects** | `sent`/`viewed → rejected` | `rejected_at = NOW()`; stores rejection comment; logs `rejected` event; sends notification to business |
| **Expiry date passes** | `sent`/`viewed → expired` | `expireQuotes` cron job; logs `expired` event; sends expiry notification to business |
| **Convert to Invoice** | `accepted → converted` | Creates invoice via `invoiceService.create()` with quote data; sets `converted_invoice_id`; logs `converted` event; logs `invoice_created` event |
| **Cancel** | `draft`/`sent`/`viewed`/`rejected`/`expired → cancelled` | `cancelled_at = NOW()`; requires `cancelled_reason`; logs `cancelled` event |

**Terminal Statuses:** `cancelled` — no further transitions allowed.

#### 4.2.2 Quote Numbering

- Quote numbers are **atomic** at the database level, using the same pattern as `InvoiceNumberService` (`src/services/invoice-number-service.ts:30`).
- A `quote_number_sequences` table (`src/db/migrations/021_quote_number_sequences.sql`) stores per-business prefix, padding, and `includes_year` config.
- Default format: `QOT-2026-000001` (prefix `QOT`, year included, 6-digit padding).
- The number is assigned during `finalize`, not on draft creation.
- A `QuoteNumberService` class (mirroring `InvoiceNumberService`) must be created in `src/services/quote-number-service.ts`.

#### 4.2.3 Draft Autosave

| Policy | Value |
|---|---|
| **Trigger** | 500ms debounce after last keystroke |
| **Persistence** | `POST /api/quotes` (create) or `PATCH /api/quotes/:id` (update) |
| **Concurrency** | Optimistic concurrency via `version` field on the quotes table |
| **Conflict handling** | If version mismatch → 409 Conflict → UI shows "Someone else updated this quote. Reload?" banner |
| **Offline** | Changes cached in `localStorage`; synced when online |
| **Before unload** | `beforeunload` event warns user if unsaved changes exist |
| **Save indicator** | Three states: "Saving…" (spinner), "Saved" (green check), error (red alert) |

#### 4.2.4 Quote Search, List & Filtering

- `GET /api/quotes` with query parameters:
  - `limit` (default 25, max 200)
  - `offset` (default 0)
  - `status` (filter by status enum value(s))
  - `search` (search by quote number, customer name, or notes)
  - `customerId` (filter by customer)
  - `dateFrom` / `dateTo` (ISO date strings — filters by `issue_date`)
  - `sortBy` (default: `created_at`)
  - `sortOrder` (default: `desc`)

- The quote list page (`Quotes.tsx`) shows:
  - Status filter tabs (All, Draft, Sent, Viewed, Accepted, Rejected, Expired, Cancelled)
  - Search bar
  - Sortable columns: Quote #, Customer, Issue Date, Expiry Date, Estimated Total, Status
  - Color-coded status badges (using `quoteStatusConfig`)
  - Empty state with "Create your first quote" CTA
  - Expiry urgency indicator (red dot + countdown for quotes expiring in <7 days)

#### 4.2.5 Activity Timeline & Events

- Every status transition, view, acceptance, and rejection is logged in the `quote_events` table (`src/db/migrations/049_quote_events_table.sql`).
- `GET /api/quotes/:id/events` returns the activity timeline.
- The quote detail page (`QuoteDetail.tsx`) shows:
  - Event type (e.g., "Quote created", "Quote sent", "Customer viewed", "Accepted by customer")
  - Actor (user name or "Customer")
  - Timestamp
  - Metadata (e.g., customer comments on rejection)

#### 4.2.6 Internal Notes

- The `internal_notes` column (`src/db/migrations/050_quote_internal_notes.sql`) stores private team notes.
- Visible in the quote builder and detail page, but never on the PDF or public portal.
- Stored as plain text, rendered with `whitespace-pre-wrap`.

### 4.3 Line Item Logic

#### 4.3.1 Calculation Engine Integration

The Quote Builder reuses the existing `CalculationEngine` from `webapp/src/utils/calculation.ts:32`, identical to the Invoice Editor. The same `decimal.js`-based engine ensures consistency between quotes and invoices.

#### 4.3.2 Line Item Operations

| Action | Behavior | Notes |
|---|---|---|
| **Add** | Appends a new row with defaults: qty=1, unit="each", tax=0%, exclusive, no discount | New row auto-focuses the description field |
| **Edit** | Any field change triggers live recalculation via `useMemo` | Debounced save (500ms) |
| **Duplicate** | Creates a copy with same values but new ID | Shift+D keyboard shortcut |
| **Reorder** | Drag-and-drop via the line-number column (drag handle) | `sort_order` updated on save |
| **Remove** | Row fades → removed from array | Undo toast appears |
| **Optional flag** | Checkbox marks item as optional; in preview/PDF, optional items are visually de-emphasized and labeled "(Optional)" | Optional items can be excluded from conversion if unchecked by customer |

#### 4.3.3 Discount Logic

| Discount Type | Application |
|---|---|
| **Line-item fixed** | Subtracted from the line subtotal (`qty × unitPrice`) before tax |
| **Line-item percentage** | Percentage of the line subtotal, before tax |
| **Quote-level fixed** | Subtracted from the quote subtotal (after line-level discounts) |
| **Quote-level percentage** | Percentage of the quote subtotal (after line-level discounts) |

Discounts are **never** allowed to make a line total or the overall total negative.

#### 4.3.4 Variable Dependencies

1. **Currency** → drives formatting and decimal precision for all monetary fields
2. **Tax rate** → affects line totals and tax totals
3. **Quantity × Unit Price** → drives line subtotal
4. **Line discount** → affects taxable amount, which affects tax
5. **Tax-inclusive flag** → if true, the tax is extracted from the unit price using reverse calculation
6. **Quote-level discount** → affects the overall taxable base
7. **Fees** → added after subtotal and tax, each fee may carry its own tax
8. **Deposit** → shown as a separate callout but does NOT reduce the estimated total

#### 4.3.5 Tax Logic

- Default tax rate per line item is resolved from the product's default tax rate, or the business's default tax rate, or 0%.
- Tax-inclusive toggle: when enabled, the displayed unit price is the gross price; tax is extracted via reverse calculation.
- Tax breakdown groups by rate name (e.g., "GST @ 8.5%") in the totals area.
- Backend re-validates all tax calculations on finalize (server-authoritative).

#### 4.3.6 Reusable Products & Customer-Specific Pricing

- The product catalog (`GET /api/products`) is available via a search/select widget in the line item description cell.
- When a product is selected, its `unit_price`, `tax_category`, and `default_tax_rate` are pre-filled.
- If the selected customer has customer-specific pricing for the product (via `product_catalog_prices` or similar), the customer-specific price is used instead.
- Users can also type a manual description if the product isn't in the catalog.

### 4.4 Customer Interaction

#### 4.4.1 Public Quote Portal

A public-facing page (`PublicQuote.tsx`) at `/public/quote/:token` mirrors the `PublicInvoice.tsx` pattern. It renders the same HTML as the PDF (server-rendered via Handlebars template).

**Features:**
- Status badge: "Sent" / "Viewed" / "Accepted" / "Rejected" / "Expired"
- Expiry urgency banner (red, when < 7 days remaining)
- Full quote details: business info, customer info, line items, fees, scope of work, terms, estimated total
- **Accept button:** `POST /api/public/quotes/:token/accept` → sets `status = 'accepted'`, `is_accepted = true`, `accepted_at = NOW()`
- **Reject button:** `POST /api/public/quotes/:token/reject` → sets `status = 'rejected'`, stores optional comment
- **Request changes:** Textarea + submit button; logs a `change_requested` event; does not change status
- **Download PDF:** Fetches `/api/public/quotes/:token/pdf`
- **Deposit payment:** If a deposit is configured and not yet paid, a "Pay Deposit" button appears (Stripe or stub provider, mirroring `PublicInvoice.tsx`'s deposit flow)
- **Print:** Browser-native print button

#### 4.4.2 Secure Token Mechanism

- The `public_token` (64-char unique string) is generated during `finalize & send`.
- Token expires after 30 days (configurable via `public_token_expires_at`).
- Each view is logged to `quote_view_log` (`src/db/migrations/042_quote_deposit_fields.sql`).
- Multiple views of the same token accumulate in the view log (audit trail).

#### 4.4.3 Automated Notifications

| Event | Trigger | Recipients | Channel |
|---|---|---|---|
| Quote sent | `POST /api/quotes/:id/send` | Customer | Email (with PDF attachment + public link) |
| Quote viewed | Customer opens the public portal link | Business (user who sent) | Email |
| Quote accepted | Customer clicks "Accept" | Business (user who sent) | Email |
| Quote rejected | Customer clicks "Reject" | Business (user who sent) | Email + in-app notification |
| Quote expiring soon | Daily cron job; `expiry_date` within 7 days, status = `sent` or `viewed` | Business (user who sent) | Email |
| Quote expired | Daily cron job moves `sent`/`viewed` → `expired` | Business (user who sent) | Email |
| Deposit due | Daily cron; `deposit_due_date` within 3 days, `deposit_paid = false` | Customer | Email |

**Background jobs:** The `expireQuotes` cron job (daily) queries for quotes where `expiry_date < NOW()` AND `status` IN ('sent', 'viewed') AND `is_finalized = true`, and transitions them to `expired`.

### 4.5 Conversion

#### 4.5.1 Convert Accepted Quote to Invoice

- Triggered via `POST /api/quotes/:id/convert` (one-click from the QuoteDetail page).
- **Backend:** Creates a draft invoice via `InvoiceService.create()` with:
  - Customer ID carried over from the quote
  - All line items, quantities, unit prices, discounts, and taxes
  - All fees
  - Quote-level discount
  - Terms, notes, and payment instructions
  - Currency
  - The accepted quote's `quote_number` is stored in the invoice's `reference_quote_id` field
- The quote's `converted_invoice_id` is set to the new invoice's ID.
- The quote's status is updated to a new value `converted` (if the enum supports it) or remains `accepted` with a `converted` flag.
- **Frontend:** After successful conversion, the user is redirected to `/app/invoices/{new_invoice_id}/edit`.

#### 4.5.2 Conversion from Non-Accepted States

- Quotes in `draft` or `cancelled` status **cannot** be converted (blocking validation error).
- Quotes in `sent` or `viewed` status **can** be converted but require a confirmation dialog: "This quote has not been accepted. Convert anyway?"
- Quotes in `rejected` status show a dialog: "This quote was rejected. Are you sure you want to convert it?"

#### 4.5.3 Optimistic Updates

The QuoteDetail page's `handleFinalizeAndSend` uses optimistic updates from the `finalizeQuote` and `sendQuote` responses — no redundant `getQuote` fetches. The `FinalizeQuoteResult` type should include a `status` field for robust optimistic status updates.

### 4.6 Validation

#### 4.6.1 Inline Validation (non-blocking during editing)

| Field | Validation Rule | Error Message | Error Level |
|---|---|---|---|
| Customer | Must be selected | "Select a customer to proceed" | Error |
| Currency | Must be a valid currency code | "Select a valid currency" | Error |
| Issue Date | Must be set | "Set an issue date" | Error |
| Expiry Date | Must be after issue date | "Expiry date must be after the issue date" | Error |
| Line items | At least one non-empty item | "Add at least one line item" | Error |
| Each line item | Description non-empty | "Description is required" | Error |
| Each line item | Quantity > 0 | "Quantity must be greater than 0" | Error |
| Each line item | Unit price ≥ 0 | "Unit price must be 0 or more" | Error |
| Tax rate | Must be ≥ 0 and ≤ 1 | "Tax rate must be between 0% and 100%" | Error |
| Deposit value | ≥ 0 | "Deposit value must be 0 or more" | Error |

#### 4.6.2 Pre-Send Validation Modal

When the user clicks "Review & Send", a modal appears:

```
Issues found:
⚠ ⚠  2 line items are missing descriptions
⚠    Expiry date is before issue date

[ Fix and continue ]  [ Send anyway ]
```

- **Blocking errors** (red): Prevent sending (e.g., no customer, no line items)
- **Warnings** (amber): Allow sending but highlight (e.g., missing line item descriptions)
- "Send anyway" is available for warnings, not errors

### 4.7 Data Integrity Protocols

#### 4.7.1 Tenant Isolation

Every database query MUST include `business_id` in the WHERE clause. The `requireAuth` middleware extracts `business_id` from the JWT and attaches it to `req.user`. All quote operations use `req.user!.businessId`.

#### 4.7.2 Calculation Integrity

- Frontend calculations are for display only (live preview).
- The backend recalculates totals on every `save` and `finalize` using the authoritative `CalculationEngine` from `src/domain/calculation.ts`.
- On `finalize`, if the frontend's stored totals don't match the backend's recalculated totals → `CALCULATION_MISMATCH` error, finalize is aborted.
- All monetary values stored as `NUMERIC(18,6)` in PostgreSQL.
- All calculations use `Decimal.ROUND_HALF_UP` at currency-specific decimal places.

#### 4.7.3 Optimistic Concurrency

- Quote updates use optimistic locking via a `version` field (added to the `quotes` table).
- The frontend sends `If-Match: "version-N"` header.
- The backend checks `WHERE version = $N AND business_id = $1` and increments on success.
- If version mismatch → 409 Conflict → frontend shows "Someone else updated this quote. Reload?" banner.

#### 4.7.4 Finalized Quote Immutability

- Once `is_finalized = true`, the quote's line items, totals, customer, dates, and terms cannot be edited.
- Only mutable fields: `status`, `amount_paid`, `deposit_paid`, `viewed_at`, `accepted_at`, `rejected_at`.
- Any structural change after finalization requires cancelling the old quote and creating a new one (with a "revision" reference to the original).

#### 4.7.5 Soft Deletes

- Draft quotes can be hard-deleted (`DELETE /api/quotes/:id`).
- Sent/accepted/expired quotes are never hard-deleted. Use Cancel (transitions to `cancelled`).

---

## 5. API Specification

### 5.1 Authenticated Endpoints (all require `Authorization: Bearer <token>`)

#### `POST /api/quotes`

Create a new draft quote.

**Request Body:**
```json
{
  "customer_id": "uuid",
  "currency": "USD",
  "issue_date": "2026-10-06",
  "expiry_date": "2026-11-05",
  "terms": "Net 30...",
  "notes": "Thank you...",
  "scope_of_work": "Detailed project description...",
  "internal_notes": "Private team notes...",
  "payment_instructions": "Pay to account #1234...",
  "template_id": "uuid",
  "deposit_type": "percentage",
  "deposit_value": "50",
  "deposit_due_date": "2026-10-20",
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
      "is_optional": false,
      "product_id": "uuid",
      "sort_order": 0
    }
  ],
  "fees": [
    {
      "description": "Shipping",
      "amount": "15",
      "tax_rate": "0",
      "tax_name": null,
      "sort_order": 0
    }
  ],
  "invoice_discount": "0",
  "invoice_discount_type": "fixed"
}
```

**Response: `201 Created`**
```json
{
  "quote": { ... full ApiQuote object ... }
}
```

#### `GET /api/quotes`

List quotes (paginated, filterable).

**Query Parameters:**
- `limit` (default: 25, max: 200)
- `offset` (default: 0)
- `status` (filter by status or comma-separated list)
- `search` (search by quote number, customer name, or notes)
- `customerId`
- `dateFrom` / `dateTo` (ISO date strings, filters by `issue_date`)
- `sortBy` (default: `created_at`; options: `issue_date`, `total`, `expiry_date`)
- `sortOrder` (default: `desc`)

**Response: `200 OK`**
```json
{
  "quotes": [ ... ApiQuoteListItem[] ... ],
  "total": 120,
  "limit": 25,
  "offset": 0
}
```

#### `GET /api/quotes/:id`

Fetch a single quote with items, fees, events, and customer details.

**Response: `200 OK`**
```json
{
  "quote": { ... full ApiQuote object including items, fees, events ... }
}
```

#### `PATCH /api/quotes/:id`

Auto-save / update draft quote. Only allowed when `is_finalized = false`.

**Request Body:** `Partial<QuoteCreateInput>` + `version` field for optimistic concurrency.

**Response: `200 OK`** with updated quote.

**Error: `409 Conflict`** if version mismatch.

#### `POST /api/quotes/:id/finalize`

Assign a quote number, set `is_finalized = true`, status → `sent`, generate `public_token`.

**Response: `200 OK`**
```json
{
  "quote": { ... finalized quote ... },
  "quote_number": "QOT-2026-000001",
  "status": "sent"
}
```

#### `POST /api/quotes/:id/send`

Send quote by email with PDF attachment and public link.

**Request Body:**
```json
{
  "to": "customer@example.com",
  "cc": ["optional@example.com"],
  "subject": "Quote QOT-2026-000001 from Your Company",
  "message": "Hi, please find your quote attached..."
}
```

**Response: `200 OK`**
```json
{
  "ok": true,
  "message_id": "uuid",
  "status": "sent",
  "quote": { ... updated quote ... }
}
```

#### `POST /api/quotes/:id/duplicate`

Duplicate an existing quote as a new draft.

**Response: `201 Created`** with the new draft quote (prefixed with "Copy of" in notes).

#### `DELETE /api/quotes/:id`

Delete a draft quote. Only allowed for `draft` status.

**Response: `204 No Content`**

#### `GET /api/quotes/:id/events`

Return the activity timeline for a quote.

**Response: `200 OK`**
```json
{
  "events": [ ... ApiQuoteEvent[] ... ]
}
```

#### `GET /api/quotes/:id/pdf`

Generate and return the quote PDF.

**Response: `200 OK`** with `Content-Type: application/pdf`.

#### `GET /api/quotes/:id/share-link`

Generate or retrieve a secure shareable link.

**Response: `200 OK`**
```json
{
  "url": "https://app.example.com/public/quote/abc123",
  "token": "abc123",
  "expires_at": "2026-11-11T00:00:00Z"
}
```

#### `POST /api/quotes/:id/convert`

Convert a quote to an invoice.

**Response: `200 OK`**
```json
{
  "quote": { ... updated quote with converted_invoice_id ... },
  "invoice": { ... new invoice ... },
  "invoice_id": "uuid"
}
```

#### `POST /api/quotes/:id/cancel`

Cancel a quote.

**Request Body:**
```json
{
  "reason": "Customer no longer needs the work"
}
```

**Response: `200 OK`** with updated quote.

### 5.2 Public (Unauthenticated) Endpoints

#### `GET /api/public/quotes/:token`

Public view of a quote — no auth required, accessed via secure tokenized link.

**Response: `200 OK`** with full quote data + business info.

#### `POST /api/public/quotes/:token/view`

Record a view of the quote.

**Response: `200 OK`** `{ "ok": true }`

#### `POST /api/public/quotes/:token/accept`

Customer accepts the quote.

**Response: `200 OK`**
```json
{
  "ok": true,
  "status": "accepted",
  "accepted_at": "2026-10-11T10:30:00Z"
}
```

#### `POST /api/public/quotes/:token/reject`

Customer rejects the quote.

**Request Body:**
```json
{
  "comment": "The pricing is too high for our budget."
}
```

**Response: `200 OK`**
```json
{
  "ok": true,
  "status": "rejected",
  "rejected_at": "2026-10-11T10:30:00Z"
}
```

#### `GET /api/public/quotes/:token/pdf`

Generate and return the quote PDF for public download.

#### `POST /api/public/quotes/:token/request-changes`

Customer requests changes.

**Request Body:**
```json
{
  "comment": "Please add more detail on the timeline."
}
```

**Response: `200 OK`** `{ "ok": true }`

#### `POST /api/public/quotes/:token/pay-deposit`

Record a deposit payment (via Stripe or stub).

**Response: `200 OK`**
```json
{
  "ok": true,
  "deposit_paid": true,
  "amount_paid": "907.50",
  "amount_remaining": "907.50"
}
```

### 5.3 Supporting Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/businesses/current` | Pre-fill currency, terms, notes, payment instructions, default validity days, deposit defaults |
| `GET` | `/api/customers` | Customer selector (limit/offset, search) |
| `GET` | `/api/products` | Product catalog lookup for line items |
| `GET` | `/api/tax-rates` | Business tax rates for line item tax selection |
| `GET` | `/api/quote-number-config` | Quote number prefix, padding, year inclusion |

---

## 6. Workflow — Status Transitions & Automated Notifications

### 6.1 Quote Status Transition Workflow

```
┌─────────┐     ┌──────┐     ┌───────┐     ┌──────────┐
│  Draft  │──F──▶│ Sent │──C──▶│ Viewed │──C──▶│ Accepted │
│         │     │      │     │        │     │          │─Conv─▶ Invoice
└─────────┘     └──────┘     └───────┘     └──────────┘
     │             │              │              │
     │ Cancel      │ Reject ◀─────┘              │
     ▼             ▼                             │
  Cancelled    ┌────────────────────────┐        │
               │ Rejected │ Expired     │        │
               └────────────────────────┘        │
                     │                           │
                     ▼                           │
                  Cancelled ◀─ Cancel           │
                                    (from any
                                     non-terminal)

F = Finalize & Send    C = Customer action or cron
```

### 6.2 Detailed Transition Flow

| Step | Actor | Action | System Response | Notification |
|---|---|---|---|---|
| 1 | User | Navigates to `/app/quotes/new` or clicks "New Quote" | Empty `QuoteBuilder` loads with defaults (currency from business, issue date = today, expiry = today + `default_quote_validity_days`) | None |
| 2 | User | Fills in customer, line items, details | Real-time calculation updates; 500ms debounced autosave creates/updates draft | Save indicator: "Saving…" → "Saved" |
| 3 | User | Clicks "Review & Send" | Pre-send validation modal appears; if valid, `ReviewAndSendDialog` opens | None |
| 4 | User | Confirms send in dialog | `POST /api/quotes/:id/finalize` assigns quote number, sets `is_finalized`, generates `public_token`; then `POST /api/quotes/:id/send` sends email | Customer: email with PDF + link; User: success toast |
| 5 | System | Quote status → `sent` | QuoteDetail page shows `Sent` badge; activity timeline logs "Quote sent" | None |
| 6 | Customer | Opens the email link | `POST /api/public/quotes/:token/view` records view; status → `viewed` | User: email notification "Customer viewed your quote" |
| 7 | Customer | Clicks "Accept" | `POST /api/public/quotes/:token/accept`; status → `accepted`; `accepted_at` set | User: email notification "Quote accepted by customer" |
| 8 | User | Clicks "Convert to Invoice" | `POST /api/quotes/:id/convert` creates invoice; quote `converted_invoice_id` set; status → `converted` | None (user is redirected to new invoice) |
| 9 | System | Daily cron: `expiry_date < NOW()`, status in (`sent`, `viewed`) | Status → `expired`; logs `expired` event | User: email notification "Quote expired — follow up needed" |
| 10 | User | Clicks "Cancel" | `POST /api/quotes/:id/cancel` with reason; status → `cancelled` | None |
| 11 | Customer | Clicks "Reject" with comment | `POST /api/public/quotes/:token/reject`; status → `rejected`; `rejected_at` set; comment stored | User: email notification "Quote was rejected" |
| 12 | Customer | Clicks "Request Changes" with comment | `POST /api/public/quotes/:token/request-changes`; logs `change_requested` event; status remains `sent`/`viewed` | User: email notification "Customer requested changes to your quote" |

### 6.3 Automated Notification Configuration

| Notification Type | Trigger Condition | Timing | Channel | Template Variables |
|---|---|---|---|---|
| Quote viewed | First view of a quote (or every N-th view) | Real-time (on view event) | Email | `customer_name`, `quote_number`, `view_count` |
| Quote accepted | Customer clicks Accept | Real-time | Email | `customer_name`, `quote_number`, `accepted_at`, `quote_total`, `invoice_id` (if auto-converted) |
| Quote rejected | Customer clicks Reject | Real-time | Email | `customer_name`, `quote_number`, `rejected_at`, `rejection_comment` |
| Quote expiring soon | `expiry_date` within 7 days, status `sent`/`viewed` | Daily cron at 09:00 business time | Email | `customer_name`, `quote_number`, `expiry_date`, `days_remaining` |
| Quote expired | `expiry_date` passed, status `sent`/`viewed` | Daily cron at 02:00 | Email | `customer_name`, `quote_number`, `expiry_date` |
| Deposit due | `deposit_due_date` within 3 days, `deposit_paid = false` | Daily cron at 09:00 | Email to customer | `customer_name`, `quote_number`, `deposit_amount`, `deposit_due_date` |

### 6.4 Email Templates

| Trigger | Subject | Body |
|---|---|---|
| Quote sent | "Your Quote {{quote_number}} from {{business_name}}" | "Hi {{customer_name}},\n\nPlease find your quote attached. You can also view it online at {{public_url}}.\n\nThis quote is valid until {{expiry_date}}.\n\nBest regards,\n{{business_name}}" |
| Quote viewed | "Your quote {{quote_number}} was viewed" | "{{customer_name}} viewed your quote. Valid until {{expiry_date}}." |
| Quote accepted | "{{customer_name}} accepted your quote" | "Great news! {{customer_name}} has accepted quote {{quote_number}}. You can now convert it to an invoice." |
| Quote rejected | "{{customer_name}} rejected your quote" | "{{customer_name}} rejected quote {{quote_number}}. Reason: {{rejection_comment}}" |
| Quote expiring soon | "Quote {{quote_number}} expires soon" | "Your quote to {{customer_name}} expires on {{expiry_date}} ({{days_remaining}} days remaining)." |
| Quote expired | "Quote {{quote_number}} has expired" | "Your quote to {{customer_name}} has expired. You can create a new quote or extend the validity." |
| Deposit due | "Deposit payment for quote {{quote_number}}" | "A deposit of {{deposit_amount}} is due by {{deposit_due_date}} to confirm your quote. Pay now at {{public_url}}." |

---

## 7. UI/UX Design Guidelines

### 7.1 Component Inventory

| Component | Type | Purpose | Source of Truth |
|---|---|---|---|
| `QuoteBuilder` | Page | Full-page split-screen editor | To create, mirrors `InvoiceWorkspace.tsx` |
| `QuotePreview` | Component | Live preview in right panel | Reuses template-renderer output |
| `QuoteDetail` | Page | Read-only view of a quote | To create, mirrors `InvoiceDetail.tsx` |
| `PublicQuote` | Page | Customer-facing view via secure link | To create, mirrors `PublicInvoice.tsx` |
| `Quotes` | Page | List/filter/sort quotes | To create, mirrors `InvoiceList.tsx` |
| `StatusBadge` | Shared UI | Color-coded status with dot | Exists — `webapp/src/components/ui/StatusBadge.tsx:11` |
| `quoteStatusConfig` | Shared UI | Status config for quotes | To create, mirrors `invoiceStatusConfig` |
| `Button` | Shared UI | Consistent button styles | Exists — `webapp/src/components/ui/Button.tsx:41` |
| `Money` | Shared UI | Currency-aware money display | Exists — `webapp/src/components/ui/Money.tsx:25` |
| `EmptyState` | Shared UI | Empty/loading/error states | Exists — `webapp/src/components/ui/EmptyState.tsx:10` |
| `PageHeader` | Shared UI | Page header with breadcrumbs + actions | Exists |
| `FormField` | Shared UI | Form input with label + validation | Exists |
| `SectionCard` | Shared UI | Card with title + optional action | Exists — `webapp/src/components/SectionCard.tsx` |

### 7.2 Status Badge Configuration

A new `quoteStatusConfig` must be created (mirroring `invoiceStatusConfig` at `webapp/src/components/ui/StatusBadge.tsx:27`):

| Status | Label | CSS Classes | Description |
|---|---|---|---|
| `draft` | "Draft" | `status-warning-bg status-warning-text` | Quote has not been sent to the customer |
| `sent` | "Sent" | `status-info-bg status-info-text` | Quote has been sent to the customer |
| `viewed` | "Viewed" | `status-info-bg status-info-text` | Customer has viewed the quote |
| `accepted` | "Accepted" | `status-success-bg status-success-text` | Customer has accepted the quote |
| `rejected` | "Rejected" | `status-error-bg status-error-text` | Customer has rejected the quote |
| `expired` | "Expired" | `status-tertiary-bg status-tertiary-text` | Quote validity period has passed |
| `converted` | "Converted" | `status-success-bg status-success-text` | Quote has been converted to an invoice |
| `cancelled` | "Cancelled" | `status-tertiary-bg status-tertiary-text` | Quote has been cancelled |

### 7.3 Line Items Table (Mobile)

Each line item becomes an **expandable card**:
- **Header**: Description (truncated) + Line Total (right)
- **Expanded content**: Qty, Unit, Rate, Discount, Tax, Optional — in a 2-column grid
- **Actions**: Duplicate / Delete icons in the card header

### 7.4 Totals Summary

```
SUBTOTAL                   $1,650.00
Discount                   -$0.00
Tax (8.25%)                 $165.00
Fees                        +$0.00
────────────────────────────────
ESTIMATED TOTAL             $1,815.00

Deposit Required (50%)      $907.50

ESTIMATED TOTAL             $1,815.00
```

- **Estimated Total** uses the `big-total-label` / `big-total-value` CSS classes (from template-renderer)
- **Deposit Required** appears as a highlighted sub-row when `deposit_type ≠ 'none'`
- All amounts use `font-tabular-nums`
- Zero values always show `$0.00` (never blank or "—")

### 7.5 Lifecycle Stepper (QuoteDetail page)

```
Draft → Sent → Viewed → Accepted → Converted to Invoice
```

Each step is either:
- **Completed** (filled circle with check — all steps before current)
- **Active** (outlined circle with fill — current step)
- **Inactive** (outlined circle — future steps)

A separate parallel path shows possible negative outcomes:
```
Rejected    Expired    Cancelled
```
These are terminal states that appear as branches from the main flow when reached.

### 7.6 State-Aware Action Panel

| Status | Available Actions |
|---|---|
| **Draft** | Edit (if not finalized), Duplicate, Download PDF (preview), Delete, Review & Send |
| **Sent** | Download PDF, Share Link, Record Deposit Payment (if applicable), Cancel |
| **Viewed** | Download PDF, Share Link, Record Deposit Payment, Cancel |
| **Accepted** | Convert to Invoice (primary), Download PDF, View Invoice (if already converted), Cancel |
| **Rejected** | Download PDF, Add Note (re-send option), Cancel |
| **Expired** | Duplicate (as new quote), Download PDF, Cancel |
| **Converted** | Download PDF, View Invoice |
| **Cancelled** | Download PDF |

### 7.7 Sticky Action Bar (QuoteBuilder)

| Button | Variant | Conditions |
|---|---|---|
| **Save Draft** | Secondary | Always visible |
| **Duplicate** | Secondary | Visible when draft is saved (has ID) |
| **Download PDF** | Secondary | Available in any state (generates from current state) |
| **Preview** | Secondary | Opens a full-screen preview overlay |
| **Review & Send** | Primary | Enabled only when validation passes |
| **Convert to Invoice** | Primary | Visible only when status is `accepted` (or `sent`/`viewed` with confirmation) |

**Mobile:** Action bar is `position: sticky; bottom: 0` with backdrop blur. Only "Review & Send" is shown as full-width; other actions in an overflow menu.

### 7.8 Validation & Error Handling

#### Inline Validation (non-blocking during editing)

| Field | Validation Rule | Error Message |
|---|---|---|
| Customer | Must be selected | "Select a customer to proceed" |
| Currency | Must be a valid currency code | "Select a valid currency" |
| Issue Date | Must be set | "Set an issue date" |
| Expiry Date | Must be after issue date | "Expiry date must be after the issue date" |
| Line items | At least one non-empty item | "Add at least one line item" |
| Each line item | Description non-empty | "Description is required" |
| Each line item | Quantity > 0 | "Quantity must be greater than 0" |
| Each line item | Unit price ≥ 0 | "Unit price must be 0 or more" |
| Tax rate | Must be ≥ 0 and ≤ 1 | "Tax rate must be between 0% and 100%" |

#### Pre-Send Validation Modal

When user clicks "Review & Send":

```
Issues found:
⚠ ⚠  2 line items are missing descriptions
⚠    Expiry date is before issue date

[ Fix and continue ]  [ Send anyway ]
```

- **Blocking errors** (red): Prevent sending
- **Warnings** (amber): Allow sending but highlight
- "Send anyway" available for warnings, not errors

#### API Error Handling

| HTTP Status | Behavior |
|---|---|
| 400 | Inline error on the relevant field |
| 401 | Redirect to login |
| 403 | Show "You don't have permission" message |
| 409 | Show "Someone else updated this quote. Reload?" banner with reload button |
| 500 | Show generic "Something went wrong. Please try again." with retry |

### 7.9 Data Formatting Rules

#### Quantities
| Rule | Example |
|---|---|
| Whole numbers | `1`, `3`, `10` (no decimal point) |
| Fractions | `1.5`, `0.25`, `3.14` (up to 2 decimals, trailing zeros stripped) |
| Input step | `step="any"` |
| Font | `font-tabular-nums` |

#### Dates
| Rule | Implementation |
|---|---|
| Short form | `formatDate()` → `MMM D, YYYY` (e.g. "Oct 6, 2026") |
| Long form | `formatDateLong()` → `MMMM D, YYYY` |
| Timezone | All dates stored UTC, rendered in user's local timezone |
| Expiry urgency | Red banner if `< 7 days` remaining |

#### Currency
| Rule | Implementation |
|---|---|
| Symbol position | Symbol precedes amount with narrow no-break space (U+202F) |
| Decimal places | Currency-native (2 for USD, 0 for JPY) via `getCurrencyMetadata` |
| Thousands separator | Comma (en-US via `Intl.NumberFormat`) |
| Negative values | Minus sign before symbol (e.g. `-$10.00`) |
| Zero values | `$0.00` (never blank or "—") |
| Component | `Money` component (wraps `Intl.NumberFormat` + `font-tabular-nums`) |

#### Tax Rates
| Rule | Implementation |
|---|---|
| Display rate | `formatTaxRate(rate)` → `8.50%` |
| Display rate + name | `formatTaxRateWithName(rate, name)` → `8.50% (GST)` |
| Zero rate | Shows `-` in read-only, `0%` in edit inputs |

---

## 8. Integration Points

### 8.1 Backend (Express + TypeScript)

| Component | File | Purpose |
|---|---|---|
| `CalculationEngine` | `src/domain/calculation.ts:1` | Authoritative calculation with Decimal.js |
| `InvoiceService` | `src/services/invoice-service.ts:119` | Invoice creation (for conversion); must be called by quote service |
| `InvoiceNumberService` | `src/services/invoice-number-service.ts:30` | Atomic invoice numbering (reused during conversion) |
| `QuoteNumberService` | `src/services/quote-number-service.ts` | **To create** — mirrors InvoiceNumberService for quotes |
| `TemplateRenderer` | `src/services/templates/template-renderer.ts:1` | Handlebars templates; must add `DEFAULT_QUOTE_TEMPLATE` |
| `PDF Service` | `src/services/pdf/pdf-service.ts:53` | Pluggable abstraction; reuse for quote PDFs |
| `Email Service` | `src/services/email/email-service.ts` | Reused for quote emails |
| `Tax Service` | `src/services/tax/tax-service.ts` | Tax rate lookup; reuse for quote line items |

### 8.2 Frontend (React + Vite)

| Component | File | Purpose |
|---|---|---|
| `CalculationEngine` | `webapp/src/utils/calculation.ts:32` | Client-side preview calculations |
| `StatusBadge` | `webapp/src/components/ui/StatusBadge.tsx:11` | Status display with semantic colors |
| `quoteStatusConfig` | `webapp/src/components/ui/StatusBadge.tsx` | **To create** — quote-specific status config |
| `Money` | `webapp/src/components/ui/Money.tsx:25` | Currency-aware money formatting |
| `Button` | `webapp/src/components/ui/Button.tsx:41` | Consistent button component |
| API client | `webapp/src/api/client.ts` | **To extend** — add `getQuotes`, `createQuote`, `updateQuote`, `finalizeQuote`, `sendQuote`, `duplicateQuote`, `convertQuote`, `cancelQuote`, `getQuotePdf`, `getQuoteShareLink`, `getPublicQuote`, `getQuoteEvents` |
| Types | `webapp/src/types/api.ts:283` | `ApiQuote`, `ApiQuoteItem`, `ApiQuoteFee`, `ApiQuoteEvent` — already exist |
| `InvoiceWorkspace.tsx` | `webapp/src/pages/InvoiceWorkspace.tsx` | Reference pattern for `QuoteBuilder.tsx` |
| `InvoiceDetail.tsx` | `webapp/src/pages/InvoiceDetail.tsx` | Reference pattern for `QuoteDetail.tsx` |
| `PublicInvoice.tsx` | `webapp/src/pages/PublicInvoice.tsx` | Reference pattern for `PublicQuote.tsx` |
| `InvoiceList.tsx` | `webapp/src/pages/InvoiceList.tsx` | Reference pattern for `Quotes.tsx` |

### 8.3 CSS Design Tokens

The semantic CSS variable system (from `webapp/src/styles/index.css`):

| Category | CSS Variables |
|---|---|
| **Status colors** | `--color-warning`, `--color-info`, `--color-success`, `--color-error`, `--color-text-tertiary` |
| **Status backgrounds** | `status-warning-bg`, `status-info-bg`, `status-success-bg`, `status-error-bg`, `status-tertiary-bg` |
| **Status text** | `status-warning-text`, `status-info-text`, `status-success-text`, `status-error-text`, `status-tertiary-text` |
| **Brand colors** | `--color-primary-action`, `--color-primary`, `--color-on-primary` |
| **Surfaces** | `--color-surface`, `--color-surface-alt` |
| **Tabular numbers** | `font-tabular-nums` utility class |

### 8.4 Template Integration

The existing `DEFAULT_INVOICE_TEMPLATE` in `template-renderer.ts:880` contains some quote-specific strings ("This quote is valid until", "QUOTATION" badge, "Estimated Total"). A new `DEFAULT_QUOTE_TEMPLATE` constant must be extracted that:

- Uses "QUOTATION" as the document type label (not "Invoice")
- Shows "Quote #" (not "Invoice #")
- Shows "Valid Until" prominently (not "Due Date")
- Shows "Estimated Total" (not "Total")
- Includes a "Scope of Work" section
- Includes deposit callout when `deposit_type ≠ 'none'`
- Includes acceptance terms and electronic acceptance hint
- Shows expiry urgency (red banner if < 7 days)

The `buildTemplateData()` function (`template-renderer.ts`) already maps quote data through an `invoice`-shaped interface. The `renderQuoteHtml()` path needs to pass quote-specific fields (`expiryDate`, `scopeOfWork`, `depositType`, `depositValue`, `depositDueDate`, `depositPaid`) through to the template.

---

## 9. Acceptance Criteria

### 9.1 Quote Creation

- [ ] User can create a new quote from `/app/quotes/new` or "New Quote" button
- [ ] Customer is selectable from existing customers with live search
- [ ] New customer can be created inline with name, email, address, tax ID
- [ ] Quote number is auto-generated on finalize (sequential, unique per business, atomic)
- [ ] Issue date defaults to today, expiry date defaults to issue + `default_quote_validity_days`
- [ ] Currency defaults to business default currency with override option
- [ ] Payment terms selectable (Net 7, Net 15, Net 30, Net 60, Custom, Upfront)
- [ ] Draft is saved automatically within 500ms of last edit
- [ ] Save indicator shows "Saving…" → "Saved" → (error state if failure)
- [ ] User can duplicate an existing quote
- [ ] User can delete a draft quote

### 9.2 Line Item Management

- [ ] User can add unlimited line items
- [ ] Each line item: description (textarea), quantity (number), unit (select), rate (currency), discount (amount + type), tax (select)
- [ ] Line items can be marked as optional
- [ ] Subtotals, tax, and total update in real-time using `CalculationEngine`
- [ ] Tax-inclusive toggle extracts tax from gross amount correctly
- [ ] Quote-level discount applies proportionally across all line items
- [ ] Fees can be added (shipping, processing, etc.)
- [ ] Line items can be reordered via drag-and-drop
- [ ] Line items can be duplicated
- [ ] Line items can be deleted with undo
- [ ] Line totals use `Decimal.ROUND_HALF_UP` — no floating point errors
- [ ] Tax breakdown groups by rate name (e.g., "GST @ 8.5%")

### 9.3 Real-Time Preview

- [ ] Right panel updates immediately as user types in left form
- [ ] Preview matches final PDF layout (same template, same CSS)
- [ ] Customer details auto-populate in preview
- [ ] Tax breakdown shows per-rate breakdown
- [ ] Totals clearly distinguish Subtotal, Discount, Tax, Fees, Estimated Total
- [ ] Deposit callout appears when deposit is configured
- [ ] Expiry urgency banner appears when < 7 days remaining
- [ ] On mobile, preview collapses into toggleable drawer

### 9.4 Finalization & Sending

- [ ] "Review & Send" button is primary and prominent
- [ ] Clicking "Review & Send" opens pre-send validation modal
- [ ] Modal shows blocking errors (red) and warnings (amber)
- [ ] User can proceed with warnings but not errors
- [ ] On confirm: quote is finalized (snapshot created, number assigned, status → `sent`, public token generated)
- [ ] User can download PDF
- [ ] User can email quote directly to customer (with PDF attachment + public link)
- [ ] User can generate secure shareable link
- [ ] After sending, status badge shows "Sent"
- [ ] Confirmation step appears before sending (cancel/confirm buttons)

### 9.5 Customer Interaction

- [ ] Customer can view the full quote online via secure tokenized link
- [ ] Customer can accept the quote with a single click
- [ ] Customer can reject the quote with an optional comment
- [ ] Customer can request changes with a comment
- [ ] Customer can download the PDF from the public portal
- [ ] Customer can pay deposit (if configured) via Stripe or stub
- [ ] Status updates to "Viewed" when customer opens the link
- [ ] Activity timeline records all customer actions

### 9.6 Conversion

- [ ] "Convert to Invoice" button visible when quote is `accepted`
- [ ] Conversion carries over customer details, line items, prices, discounts, taxes, terms
- [ ] New invoice is created as a draft
- [ ] User is redirected to `/app/invoices/{id}/edit` after conversion
- [ ] Quote's `converted_invoice_id` is set
- [ ] Conversion from non-accepted status requires confirmation

### 9.7 Status Management

- [ ] Status badge renders in page header with colored dot
- [ ] Status transitions follow the defined state machine
- [ ] Activity timeline shows all events (created, finalized, sent, viewed, accepted, rejected, expired, converted, cancelled)
- [ ] Lifecycle stepper shows position in the funnel
- [ ] Action panel shows contextually-relevant buttons based on status
- [ ] Quote list supports filtering by status with badge-colored tabs
- [ ] Expired quotes are highlighted with urgency indicator

### 9.8 Automated Notifications

- [ ] Customer receives email when quote is sent (with PDF + link)
- [ ] Business receives email when quote is viewed
- [ ] Business receives email when quote is accepted
- [ ] Business receives email when quote is rejected (with comment)
- [ ] Business receives email when quote is expiring soon (< 7 days)
- [ ] Business receives email when quote has expired
- [ ] Customer receives email when deposit is due (if configured)
- [ ] Daily cron job expires stale quotes

### 9.9 Data Integrity

- [ ] All backend quote queries scoped to `business_id` (tenant isolation)
- [ ] Backend recalculates totals on every save and finalize
- [ ] Finalize rejects if stored totals don't match recalculated totals
- [ ] Optimistic concurrency control via `version` field
- [ ] Finalized quotes are immutable (only status/date fields mutable)
- [ ] Quote numbers are atomic (DB-level transaction)
- [ ] Public tokens are unique and expire after 30 days

### 9.10 Error Handling

- [ ] Failed saves show inline error message with retry option
- [ ] 401 redirects to login
- [ ] 409 conflict on version mismatch shows "Reload?" banner
- [ ] Network errors show retry pattern
- [ ] Validation errors are shown as you type (non-blocking)
- [ ] Pre-send validation prevents sending with blocking errors

### 9.11 Performance

- [ ] Quote creation form loads in < 500ms
- [ ] Live preview updates within 50ms
- [ ] Save operation completes in < 200ms
- [ ] PDF generation completes in < 1s
- [ ] Status badge colors resolve in < 1ms
- [ ] Quote list with 100 quotes loads in < 300ms

### 9.12 Responsive Design

- [ ] Desktop (≥1024px): split-screen layout
- [ ] Tablet (768px–1023px): compressed columns
- [ ] Mobile (<768px): stacked layout with toggleable preview drawer
- [ ] All pages handle: normal data, empty data, loading, errors, long text
- [ ] Empty states look intentional and polished

---

## 10. Implementation Roadmap

### Phase 1: Backend Foundation (Weeks 1–2)

1. Create `src/services/quote-number-service.ts` (mirrors `invoice-number-service.ts`)
2. Create `src/services/quote-service.ts` with `QuoteService` class:
   - `create()`, `update()`, `findById()`, `findMany()`
   - `finalize()`, `send()`, `generatePdf()`
   - `accept()`, `reject()`, `requestChanges()`
   - `recordDepositPayment()`, `convertToInvoice()`
   - `cancel()`, `recordQuoteView()`
   - `getQuoteEvents()`, `findByPublicToken()`
3. Add `/api/quotes/*` routes to `src/index.ts`
4. Add `/api/public/quotes/:token/*` routes to `src/index.ts`
5. Add `expireQuotes` function (called by daily cron or on read)
6. Create `DEFAULT_QUOTE_TEMPLATE` in `template-renderer.ts`
7. Add `quoteStatusConfig` to frontend `StatusBadge.tsx`

### Phase 2: Frontend Core (Weeks 3–4)

1. Add quote API client functions to `webapp/src/api/client.ts`
2. Create `webapp/src/pages/QuoteBuilder.tsx` (mirrors `InvoiceWorkspace.tsx`)
3. Create `webapp/src/pages/QuoteDetail.tsx` (mirrors `InvoiceDetail.tsx`)
4. Create `webapp/src/pages/PublicQuote.tsx` (mirrors `PublicInvoice.tsx`)
5. Create `webapp/src/pages/Quotes.tsx` (mirrors `InvoiceList.tsx`)
6. Add routes to `App.tsx`

### Phase 3: Polish & Notifications (Weeks 5–6)

1. Implement automated notifications (email templates + cron)
2. Add keyboard shortcuts (Cmd/Ctrl+S to save, Esc to discard)
3. Add "Save as Template" functionality
4. Add quote acceptance/rejection UI in `ReviewAndSendDialog`
5. Add quote template gallery (filter by document type)
6. Add quote-specific status badge to `StatusBadge.tsx`

### Phase 4: Future Enhancements

1. Quote versioning / revision history
2. Multi-language quote templates
3. Quote expiration reminder scheduling (via scheduler service)
4. Quote-to-recurring-invoice conversion
5. Quote analytics dashboard

---

## 11. Appendix A: Quote Status Enum Values

```sql
-- From src/db/migrations/001_initial_schema.sql:389
-- Extended by src/db/migrations/053_add_viewed_to_quote_status_enum.sql
CREATE TYPE quote_status AS ENUM (
  'draft',       -- Initial state, not yet finalized
  'sent',        -- Finalized and sent to customer
  'viewed',      -- Customer has viewed the quote online
  'accepted',    -- Customer has accepted the quote
  'rejected',    -- Customer has rejected the quote
  'expired',     -- Quote validity period has passed
  'cancelled'    -- Manually cancelled by user
);

-- Note: 'converted' is tracked as a separate state or flag.
-- The quote remains 'accepted' but converted_invoice_id is set.
-- OR a 'converted' value is added to the enum in a migration.
```

## 12. Appendix B: Quote Schema (Consolidated)

### `quotes` table (with all migration additions)

```sql
CREATE TABLE quotes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  quote_number    VARCHAR(100),
  status          quote_status NOT NULL DEFAULT 'draft',
  issue_date      DATE,
  due_date        DATE,
  expiry_date     DATE,               -- migration 023
  currency        VARCHAR(3) NOT NULL,
  subtotal        NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_total  NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(18,6) NOT NULL DEFAULT 0,
  fee_total       NUMERIC(18,6) NOT NULL DEFAULT 0,
  total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_paid     NUMERIC(18,6) NOT NULL DEFAULT 0,  -- migration 023
  amount_due      NUMERIC(18,6) NOT NULL DEFAULT 0,   -- migration 023
  notes           TEXT,
  terms           TEXT,
  payment_instructions TEXT,                         -- migration 044
  scope_of_work   TEXT,                              -- migration 044
  is_finalized    BOOLEAN NOT NULL DEFAULT FALSE,    -- migration 044
  finalized_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,                       -- migration 023
  accepted_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,                       -- migration 023
  internal_notes  TEXT,                              -- migration 050
  deposit_type    VARCHAR(20) NOT NULL DEFAULT 'none',  -- migration 042
  deposit_value   NUMERIC(18,6) NOT NULL DEFAULT 0,     -- migration 042
  deposit_due_date DATE,                                 -- migration 042
  deposit_paid    BOOLEAN NOT NULL DEFAULT FALSE,         -- migration 042
  public_token    VARCHAR(64) UNIQUE,
  public_token_expires_at TIMESTAMPTZ,
  converted_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  is_accepted     BOOLEAN NOT NULL DEFAULT FALSE,
  version         INTEGER NOT NULL DEFAULT 1,        -- for optimistic concurrency
  created_by      UUID,
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `quote_items` table

```sql
CREATE TABLE quote_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  description     VARCHAR(500) NOT NULL,
  quantity        NUMERIC(18,6) NOT NULL,
  unit            VARCHAR(50) NOT NULL DEFAULT 'each',
  unit_price      NUMERIC(18,6) NOT NULL,
  discount        NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_type   VARCHAR(20) NOT NULL DEFAULT 'fixed',
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  line_subtotal   NUMERIC(18,6) NOT NULL,
  line_total      NUMERIC(18,6) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
  is_optional     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Supporting tables

```sql
-- quote_number_sequences (migration 021)
CREATE TABLE quote_number_sequences (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix      VARCHAR(50) NOT NULL DEFAULT 'QOT',
  next_number BIGINT NOT NULL DEFAULT 1,
  padding     SMALLINT NOT NULL DEFAULT 6,
  includes_year BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- quote_fees (migration 023)
CREATE TABLE quote_fees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description     VARCHAR(500) NOT NULL,
  amount          NUMERIC(18,6) NOT NULL,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- quote_events (migration 049)
CREATE TABLE quote_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  event_type      VARCHAR(100) NOT NULL,
  actor_id        UUID,
  actor_type      VARCHAR(20),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- quote_view_log (migration 042)
CREATE TABLE quote_view_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- quote_deposit_payments (migration 042)
CREATE TABLE quote_deposit_payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id         UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount           NUMERIC(18,6) NOT NULL,
  provider         VARCHAR(50) NOT NULL DEFAULT 'stub',
  idempotency_key  VARCHAR(255) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 13. Appendix C: Terminology

| Invoice Term | Quote Term | Rationale |
|---|---|---|
| "Invoice" / "Invoice #" | "Quote" / "Quote #" | Establishes document type |
| "Bill To" | "Prepared For" | Softer, collaborative tone |
| "Due Date" | "Valid Until" / "Expiry Date" | Quote is an offer with a deadline |
| "Amount Due" | "Estimated Total" | Final amount may differ |
| "Payment Instructions" | "Payment Terms" (in Terms section) | More formal for estimates |
| "Total" | "Estimated Total" | Explicit estimate framing |
| "Paid" / "Partially Paid" | N/A (deposit tracking only) | Quotes don't have payment status — use deposit fields |
| "Send" | "Issue" / "Send to Customer" | "Issue" is standard for quotes |
| "Convert to Invoice" | "Accept & Create Invoice" | Clarifies the workflow step |

---

*End of document.*
