# Technical Specification: Credit Notes Module

**Document:** PRD_Technical_CreditNotes.md  
**Created:** 2026-10-12  
**Status:** Approved for Implementation  
**Priority:** P1 (Professional-grade credit notes generator)  

## 1. Architecture Summary

### Existing Foundation (Verified Against Codebase)

The backend is fully implemented across the following files:

| Component | Location | Status |
|---|---|---|
| Database migrations | `src/db/migrations/013`, `035`, `046`, `047`, `048`, `054`, `055`, `060` | Complete |
| Service methods | `src/services/invoice-service.ts:1829-2084` | Complete |
| API routes | `src/index.ts:1690-1840` | Complete |
| PDF/email | `src/services/templates/template-renderer.ts:1463` (buildCreditNoteData) | Complete |
| Frontend types | `webapp/src/types/api.ts:285-366` | Complete |
| Frontend API client | `webapp/src/api/client.ts:1688-1744` | Complete |
| Frontend pages | `webapp/src/pages/CreditNotes.tsx`, `CreditNoteDetail.tsx`, `CreditNoteForm.tsx` | Basic implementation |
| Routes | `webapp/src/App.tsx:344-366` | Wired |

### Confirmed Scope Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | **A1: Comprehensive new module** | Complete replacement with professional-grade UI |
| Application methods | **A2: Backend + frontend** | Need refund/balance/invoice_offset capture in metadata |
| Cancel/void | **A3: Include workflows** | Schema already has columns; completes the lifecycle |
| Send/share | **B4: Leave as future** | Backend send endpoint exists but keep UI simple |
| Draft mode | **A5: Draft-save + finalize** | Professional-grade requires draft → finalize flow |
| Tests | **A6: Full suite** | Backend + integration + frontend component tests |
| Deploy | **A7: Docker rebuild + migrate** | Standard production deployment |

---

## 2. Technology Stack

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express.js + TypeScript
- **Database:** PostgreSQL 15
- **ORM:** Raw `pg` queries (no ORM abstraction)
- **Migrations:** node-pg-migrate style (`src/db/migrate.ts`)
- **Money:** `decimal.js` (integer minor-unit math)
- **Validation:** `zod` (DTOs + params)
- **Templates:** Handlebars HTML templates
- **PDF:** `puppeteer` (via `pdf-service.ts` abstraction)
- **Email:** Nodemailer (stub provider by default)
- **Auth:** JWT (dev stub mode uses trusted headers)
- **Tests:** vitest + test database

### Frontend
- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **Routing:** react-router-dom v6
- **Styling:** Tailwind CSS with semantic design tokens (`webapp/src/index.css`)
- **State:** React hooks (useState, useEffect, useCallback)
- **Money display:** `decimal.js` + `Money` component with `font-tabular-nums`
- **Form controls:** Custom `.form-control` / `.form-select` tokens
- **Components:** Shared UI components from `webapp/src/components/ui/`
- **Tests:** vitest + React Testing Library

### Shared Design System
- **Colors:** CSS custom properties (`--color-surface`, `--color-surface-alt`, `--color-surface-elevation`, `--color-text`, `--color-text-secondary`, `--color-text-tertiary`, `--color-border`, `--color-border-strong`, `--color-border-subtle`, `--color-primary`, `--color-success-*`, `--color-warning-*`, `--color-error-*`, `--color-info-*`, `--color-tertiary`)
- **Status badges:** `StatusBadge` + `createStatusBadgeConfig` (used by invoices, payments, customers, projects, credit notes)
- **Typography:** `.invoice-title`, `.invoice-section-title`, `.invoice-section-heading`, `.invoice-body-text`, `.invoice-caption`, `.invoice-amount-*`
- **Shared components:** `PageHeader`, `SectionCard`, `FormField`, `FormTextareaField`, `ConfirmationDialog`, `DataTable`, `StatusBadge`, `Button`, `Money`, `EmptyState`, `Dialog`, `KPICard`, `PageSection`
- **Icons:** `lucide-react`

---

## 3. Functional Requirements

### 3.1 Credit Note List Page

**Route:** `/credit-notes`

#### UI Elements
- **PageHeader** with title "Credit Notes", description "Manage credit notes, refunds, and adjustments."
- **Primary action button:** "New Credit Note" → links to `/credit-notes/new`
- **Secondary actions:** Export (CSV, JSON)
- **Summary KPI cards** (top of page, below header):
  1. Total Credit Notes (count, info tint)
  2. Outstanding Balance (sum of `amount_due`, warning tint)
  3. Fully Applied (count where `amount_due = 0` and status in applied/refunded, success tint)
  4. Draft Credit Notes (count where status = draft, warning tint)
- **Filter bar:**
  - Search input (credit note number, customer name, or reference invoice number)
  - Status filter buttons (all statuses visible as toggle chips)
  - Date range picker (issue date from/to)
  - Customer filter (dropdown)
  - Reference invoice filter (text + clear)
  - "Show only with balance" toggle (remaining > 0)
- **DataTable** with columns:
  | Column | Content | Sortable | Width |
  |---|---|---|---|
  | Credit Note | Number + issue date | ✓ | 180px |
  | Reference Invoice | Linked invoice number with status badge | ✓ | 160px |
  | Customer | Name + email | ✓ | 200px |
  | Total Credit | `-$1,250.00` (red, signed) | ✓ | 120px |
  | Applied | Applied total | ✓ | 120px |
  | Balance | Remaining (green=0, amber=>0) | ✓ | 120px |
  | Status | `CreditNoteStatusBadge` | ✓ | 120px |
  | Actions | View / Edit / Apply / PDF / Cancel | — | 120px |
- **Row-level design:**
  - Click row → navigate to detail page
  - Reference invoice column shows clickable link with `link` icon
  - Balance column color-coded: `0.00` → green "Fully Applied", `> 0` → amber amount
  - Rows for cancelled/void/refunded status have subtle opacity
  - Hover tooltip shows full credit note number
- **Mobile:** Table collapses to card rows; action buttons → kebab menu

#### Behavior
- Fetches up to 100 credit notes by default
- Supports pagination via `limit` / `offset` (25, 50, 100 per page options)
- Supports `invoiceId` filter from query params
- Supports `status` filter from query params
- Shows loading spinner while fetching
- Shows `EmptyState` when no credit notes exist
- Shows `EmptyState` when filters return no results

### 3.2 Credit Note Detail Page

**Route:** `/credit-notes/:id`

#### Two-Column Layout (matching invoice detail pattern)
- **Left column (`lg:col-span-2`):** Full document rendering (print-ready)
- **Right column (`lg:col-span-1`):** Sidebar with contextual actions and metadata

#### Left Column — Document Body

**A. Provenance Header Card** (top of document)
- Visual: full-width card, info-tinted background (`bg-info-bg`, `border-2 border-info-border`)
- Content: Credit note number, reference invoice (clickable link with status badge), dates, amounts
- Answer: "Where did this come from?" — immediately visible

**B. Credit Note Identity + Lifecycle**
- Title: `Credit Note #CN-2024-000345` (or "Draft" for unsaved)
- Status badge inline
- Issue date, finalized date, sent date

**C. Reason for Credit** (audit-critical)
- Warning-tinted callout box (always visible for finalized+)
- Shows the reason text and reference to source invoice

**D. Party Information** (From / Bill To)
- Uses `InvoiceDisplay.tsx` pattern with `SectionCard`
- Business details (From) + Customer details (Credit To)

**E. Line Items Table**
- Columns: Description, Qty, Unit, Unit Price, Tax Rate, Tax Amount, Line Total
- Credit amounts shown in red with `−` prefix
- Uses `InvoiceDisplay.tsx` pattern (catalog SKU, tax name, tax-inclusive indicator)

**F. Totals Summary**
- Subtotal, Discount, Tax, Fees
- **Total Credit** (bold, red, with `−` prefix)
- **Amount Applied** (green, with `−` prefix)
- **Amount Remaining** (green when 0, amber when > 0)

**G. Application History** (enhanced)
- Shows each application with method badge:
  - **Direct Refund:** `ReceiptRefund` icon, purple badge, "Refunded to customer"
  - **Future Balance:** `Wallet` icon, blue badge, "Credit held on account"
  - **Invoice Offset:** `FileText` icon, green badge, "Applied to Invoice INV-XXXX"
- Each row: method badge + amount + date + linked invoice + metadata (refund provider, transaction ID)
- Empty state: "This credit note has not been applied" card with action buttons
- **Progress bar** visualizing applied vs. remaining

**H. Notes, Internal Notes, Terms**
- Customer-facing notes (standard text)
- Internal notes (team-only, lock icon, `bg-surface-alt`)
- Terms & Conditions

#### Right Column — Sidebar

1. **Action Card** (contextual):
   - Draft → "Finalize" button
   - Finalized → "Finalize" (already finalized), "Send" (if not sent), "Apply to Invoice" (if remaining > 0), "Cancel"
   - Applied → "Download PDF", "Send"
   - Cancelled/Void → read-only badge
2. **Credit Note Details Card:** Number, issue date, currency, reference invoice (linked), finalized/sent dates
3. **Application Summary Card** (if applications exist): Method, total applied, remaining, per-application badges
4. **Audit Timeline:** Color-coded events with metadata and actor attribution

### 3.3 Credit Note Creation/Editor Page

**Route:** `/credit-notes/new?invoiceId=<uuid>`

#### Prerequisites
- The `invoiceId` query parameter is required (credit notes always created against a specific invoice)
- On load, fetch the referenced invoice to pre-fill customer and currency

#### UI Elements
- **PageHeader** with title "New Credit Note", back link to credit note list
- **Source Invoice card** (read-only summary): invoice number (linked), customer, total, balance due
- **Credit Note Details section:**
  - Reason selector (dropdown: Return, Abatement, Correction, Other)
  - Custom reason input (conditional)
  - Notes textarea (optional)
  - Terms textarea (with default from business settings)
- **Line Items section** (editable):
  - Uses same line item editor as invoice creation
  - Description, Quantity, Unit, Unit Price, Tax Rate, Tax Name, Is Tax Inclusive toggle
  - "Add Line Item" / "Remove" per item
  - Real-time recalculation
- **Fees section** (editable): description, amount, tax rate, tax name
- **Totals section** (read-only, real-time):
  - Subtotal, discount, tax, fees, grand total
  - Grand total shown in bold red with `−` prefix
- **Action bar:**
  - "Cancel" (secondary, navigates back)
  - "Save Draft" (secondary) — saves as draft, returns to editor
  - "Finalize & Send" (primary) — creates + finalizes, navigates to detail

#### Behavior
- Single-page form (no wizard)
- All calculations client-side using `CalculationEngine` from `webapp/src/utils/calculation.ts`
- Real-time validation with error messages
- On "Finalize & Create":
  - Validates required fields
  - Transforms form data to API payload
  - Calls `createCreditNote` API
  - Optimistic redirect to detail page
  - Error handling with toast notifications

### 3.4 Draft Mode (NEW — requires backend support)

The creation flow must support saving as draft before finalizing:

1. **Save Draft:** Creates a credit note with `status = 'draft'`, `is_finalized = FALSE`. Returns the draft CN ID; user stays in editor (URL becomes `/credit-notes/:id/edit`).
2. **Edit existing:** Opening `/credit-notes/:id/edit` loads the existing draft data into the editor.
3. **Finalize:** PATCH to `/api/credit-notes/:id/finalize` — sets `status = 'finalized'`, `is_finalized = TRUE`, `finalized_at`, and generates `credit_note_number`.
4. **Cancel editing:** Discard dialog with confirmation.

### 3.5 Apply to Invoice Workflow

**Access:** From credit note detail page → "Apply to Invoice" button

#### Modal Dialog (using existing `Dialog` component)
- Title: "Apply Credit Note"
- Body:
  - Total credit amount (read-only)
  - Already applied amount (read-only)
  - Remaining credit amount (read-only, bold)
  - **Application method selector** (radio group):
    - Invoice Offset: "Apply to an existing invoice" — reduces invoice balance
    - Future Balance: "Credit to customer's balance" — held on account
    - Direct Refund: "Issue a refund" — returns money (conditionally available if invoice was paid)
  - Invoice selector (only for Invoice Offset — searchable dropdown of customer's open invoices)
  - Amount input (defaults to lesser of remaining credit or invoice balance due)
  - Invoice balance due (read-only, updates on invoice selection)
- Buttons: "Cancel" (secondary), "Apply Credit" (primary, disabled until valid)

#### Behavior
- Validates amount > 0 and <= remaining credit
- Validates selected invoice belongs to same customer
- Calls `applyCreditNote` API with `invoiceId`, `amount`, and `method` in payload
- Stores method in `credit_note_applications.metadata.method`
- On success: success toast, close dialog, refresh credit note data
- On error: error toast with backend message

### 3.6 Cancel / Void Workflows (NEW)

**Cancel** (from draft or finalized, before send):
- Opens `ConfirmationDialog` with input validation (type "Cancel" to confirm)
- POST `/api/credit-notes/:id/cancel` with reason
- Sets `status = 'cancelled'`, `cancelled_at`, `cancelled_reason`
- Logs event in audit trail

**Void** (from any post-send state):
- Opens `ConfirmationDialog` with input validation (type "Void" to confirm)
- POST `/api/credit-notes/:id/void` with reason
- Sets `status = 'voided'`, `voided_at`, `void_reason`
- Logs event in audit trail
- Credit note becomes read-only

### 3.7 Automated Tax/Total Calculations

- All calculations performed backend-authoritative via `decimal.js`
- Frontend `CalculationEngine` mirrors backend logic for real-time preview
- Tax breakdown by rate shown in totals
- Fee totals included in grand total
- All monetary values use `font-tabular-nums` for alignment
- Credit amounts displayed with `−` prefix in red (`text-error-text`)

### 3.8 Customer Data Integration

- Customer name, email, and address pulled from the source invoice
- Customer selector with search-as-you-type (for override)
- Customer quick-view popover (existing component)
- Customer status badge (active/inactive)

### 3.9 Searchable Transaction History

- Audit timeline shows all lifecycle events:
  - Credit note created/drafted
  - Credit note finalized
  - Credit note sent
  - Credit note applied (to which invoice, for how much, by whom)
  - Credit note cancelled/voided
  - Refund initiated
- Each event shows: timestamp, event type, actor, metadata changes
- Filterable by event type
- Exportable as audit log

---

## 4. Data Modeling

### 4.1 Existing Schema (No Changes Needed)

The `credit_notes` table (`src/db/migrations/013_invoice_lifecycle.sql:45`) already supports all required fields:

```sql
CREATE TABLE credit_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  reference_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  credit_note_number VARCHAR(100),
  status credit_note_status NOT NULL DEFAULT 'draft',
  issue_date DATE,
  currency VARCHAR(3) NOT NULL,
  reason TEXT,
  notes TEXT,
  terms TEXT,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  subtotal NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_total NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total NUMERIC(18,6) NOT NULL DEFAULT 0,
  fee_total NUMERIC(18,6) NOT NULL DEFAULT 0,
  total NUMERIC(18,6) NOT NULL DEFAULT 0,
  applied_total NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_due NUMERIC(18,6) NOT NULL DEFAULT 0,
  is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  public_token VARCHAR(64) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_credit_note_number_business UNIQUE (business_id, credit_note_number),
  CONSTRAINT chk_credit_note_total CHECK (total >= 0),
  CONSTRAINT chk_credit_note_applied CHECK (applied_total >= 0 AND applied_total <= total)
);
```

### 4.2 Status Enum

Extended in migrations `047` and `054`:

```sql
credit_note_status AS ENUM (
  'draft', 'finalized', 'sent',
  'partially_applied', 'applied',
  'partially_refunded', 'refunded',
  'cancelled', 'void'
)
```

### 4.3 Supporting Tables

**credit_note_items** (`013_invoice_lifecycle.sql:107`):
- Line items with description, quantity, unit, unit_price, tax_rate, tax_amount, line_subtotal, line_total
- `is_tax_inclusive` boolean
- `catalog_sku`, `catalog_tax_category` for product catalog integration

**credit_note_fees** (`046_credit_note_fees_table.sql`):
- Description, amount, tax_rate, tax_name, tax_amount
- `sort_order`, `created_at`

**credit_note_applications** (`013_invoice_lifecycle.sql:136`):
- Links CN to invoices: `credit_note_id`, `invoice_id`, `business_id`
- `amount`, `applied_at`, `idempotency_key`
- `metadata JSONB` — **used to store `application_method`** (per decision A2)
- Unique constraint on `(credit_note_id, invoice_id)` — one application per CN+invoice pair
- Unique on `(business_id, idempotency_key)` — prevents duplicates

**credit_note_snapshots** (`013_invoice_lifecycle.sql:86`):
- Immutable snapshot on finalize: `snapshot JSONB`, `snapshot_hash`, `pdf_stored`, `pdf_hash`
- Immutable after finalization (snapshotted)

**credit_note_number_sequences** (`013_invoice_lifecycle.sql:36`):
- Per-business numbering: prefix, next_number, padding, includes_year
- Atomic DB-level number generation (unique per business)

### 4.4 Schema Changes Required (Decision A2 + A5)

#### Migration 061: Application Method Metadata

No new column needed — the existing `metadata JSONB` field on `credit_note_applications` stores `application_method`:

```json
{
  "method": "invoice_offset",  // or "balance_credit" or "refund"
  "refund_provider": "stripe",  // when method = refund
  "refund_transaction_id": "txn_123",  // when method = refund
  "applied_by": "user:uuid",  // actor
  "note": "Partial application"
}
```

**Index for searchability:**
```sql
CREATE INDEX IF NOT EXISTS idx_credit_note_applications_method
  ON credit_note_applications USING GIN ((metadata->'method'))
  WHERE metadata ? 'method';
```

#### Migration 062: Credit Note Events Table (Audit Trail)

The existing architecture uses `invoice_events` for some audit logging. For a dedicated credit note audit trail (decision: searchable transaction history), create a dedicated events table:

```sql
CREATE TABLE IF NOT EXISTS credit_note_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_type VARCHAR(20) NOT NULL DEFAULT 'user',  -- user, system, customer, payment
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_credit_note_events_cn ON credit_note_events(credit_note_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_note_events_type ON credit_note_events(event_type);
CREATE INDEX IF NOT EXISTS idx_credit_note_events_actor ON credit_note_events(actor_id);
```

**Event types logged:**
- `credit_note_created` (draft saved)
- `credit_note_finalized`
- `credit_note_sent`
- `credit_note_applied` (with amount, invoice, method)
- `credit_note_cancelled`
- `credit_note_voided`
- `credit_note_refunded` (future)

### 4.5 Frontend Types (`webapp/src/types/api.ts`)

Update `ApiCreditNoteApplication` to include application method:

```typescript
export interface ApiCreditNoteApplication {
  id: string;
  credit_note_id?: string;
  invoice_id: string;
  amount: string;
  applied_at: string;
  idempotency_key?: string | null;
  metadata?: Record<string, unknown> | null;
  // NEW — application method
  application_method?: "invoice_offset" | "balance_credit" | "refund" | null;
  method?: string | null;  // convenience alias for metadata.method
}

export interface ApiCreditNote {
  // ... existing fields ...
  // NEW for audit trail
  created_by?: string | null;
  updated_by?: string | null;
  events?: ApiCreditNoteEvent[];
}
```

Add `ApiCreditNoteEvent`:

```typescript
export interface ApiCreditNoteEvent {
  id: string;
  credit_note_id: string;
  event_type: string;
  actor_id?: string | null;
  actor_type?: string | null;
  metadata: Record<string, unknown>;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}
```

---

## 5. Technical Architecture

### 5.1 Backend API Endpoints

All endpoints are in `src/index.ts` (lines 1690-1840). New endpoints needed:

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/credit-notes` | Create draft credit note (status='draft') | requireAuth |
| `PATCH` | `/api/credit-notes/:id/finalize` | Finalize draft → finalized + generate number | requireAuth |
| `PATCH` | `/api/credit-notes/:id/send` | Send to customer (set sent_at) | requireAuth |
| `POST` | `/api/credit-notes/:id/apply` | Apply credit to invoice (with method in body) | requireAuth |
| `POST` | `/api/credit-notes/:id/cancel` | Cancel (draft or finalized before send) | requireAuth |
| `POST` | `/api/credit-notes/:id/void` | Void (post-send error correction) | requireAuth |
| `GET` | `/api/credit-notes/:id/pdf` | Generate/download PDF | requireAuth |
| `GET` | `/api/credit-notes/:id/share-link` | Generate public share token | requireAuth |
| `GET` | `/api/credit-notes/:id/events` | Get audit trail events | requireAuth |
| `GET` | `/api/credit-notes` | List (existing, enhance with search + filters) | requireAuth |
| `GET` | `/api/credit-notes/:id` | Get single (existing, enhance with events) | requireAuth |

### 5.2 Service Layer (`src/services/invoice-service.ts`)

**New methods needed:**

```typescript
// Draft creation (status = 'draft', no number assigned yet)
async createCreditNoteDraft(businessId, userId, input): Promise<CreditNoteDraft>

// Finalize draft (generate number, snapshot, set finalized_at)
async finalizeCreditNote(businessId, creditNoteId, userId): Promise<{ creditNote, creditNoteNumber }>

// Cancel
async cancelCreditNote(businessId, creditNoteId, userId, reason): Promise<{ ok: boolean }>

// Void
async voidCreditNote(businessId, creditNoteId, userId, reason): Promise<{ ok: boolean }>

// Get audit events
async getCreditNoteEvents(businessId, creditNoteId): Promise<ApiCreditNoteEvent[]>

// Enhanced apply (with application_method in metadata)
async applyCreditNote(businessId, creditNoteId, data): Promise<{ ok: boolean, remaining: string, status: string }>
```

**Patterns followed:**
- All DB writes wrapped in `BEGIN/COMMIT/ROLLBACK` transactions
- `FOR UPDATE` locks on credit_notes + invoices for atomicity
- Idempotency keys on applications (`ON CONFLICT DO NOTHING`)
- Tenant isolation at every query (`business_id = $N`)
- Version counter increments on writes (optimistic concurrency)
- Immutable snapshots on finalize (credit_note_snapshots table)

### 5.3 Frontend Architecture

```
webapp/src/
├── pages/
│   ├── CreditNotes.tsx          → List page (enhanced)
│   ├── CreditNoteDetail.tsx      → Detail page (enhanced)
│   ├── CreditNoteForm.tsx        → Creation/editor (enhanced for draft mode)
│   └── CreditNoteEdit.tsx        → NEW: Edit existing draft
├── components/
│   ├── CreditNoteInvoiceLink.tsx         → NEW: Provenance header card
│   ├── CreditNoteTotalsSummary.tsx       → NEW: Enhanced totals with progress bar
│   ├── CreditNoteApplicationStatus.tsx   → NEW: Method badge per application
│   ├── CreditNoteAppliedSummary.tsx     → NEW: Sidebar application summary
│   ├── CreditNoteListKPIBar.tsx         → NEW: KPI cards for list page
│   ├── ApplyCreditNoteDialog.tsx        → NEW: Modal replacing prompt()
│   │   └── CreditNoteSendDialog.tsx     → NEW: Email dialog (future, kept out of scope)
│   └── CreditNoteActivityTimeline.tsx   → NEW: Audit trail timeline
├── api/
│   └── client.ts                          → Updated: addCreditNoteDraft, finalizeCreditNote, cancelCreditNote, voidCreditNote, getCreditNoteEvents
├── types/
│   └── api.ts                             → Updated: ApiCreditNoteApplication, ApiCreditNoteEvent
└── utils/
    ├── calculation.ts                     → Reused: CalculationEngine for real-time calc
    └── format.ts                          → Reused: formatDate, formatCurrency
```

### 5.4 Architectural Patterns

1. **Backend is authoritative** for all calculations (AGENTS.md invariant #3)
2. **Frontend CalculationEngine** mirrors backend logic for real-time UX, but all final values come from backend response
3. **Snapshot pattern** — finalized credit notes are snapshotted; immutable thereafter
4. **Atomic numbering** — DB-level unique invoice/credit_note numbers per business
5. **Tenant isolation** — `business_id` filter on every query
6. **Optimistic UI updates** — list/detail pages use response data from mutations; no redundant fetches
7. **Design system consistency** — all new components use existing tokens, `StatusBadge`, `SectionCard`, `Dialog`, `KPICard`, `DataTable`

### 5.5 Security Considerations

- All endpoints require `requireAuth` middleware
- Tenant isolation: `business_id` in every query (never trust client)
- SQL injection prevented: all queries use parameterized `$N` placeholders
- XSS prevention: HandleBars templates compile with `noEscape: true`; frontend uses React escaping
- CSRF: API uses JWT (stateless); dev stub mode uses trusted headers
- File upload: No file uploads; PDFs generated server-side via puppeteer
- Input validation: `zod` DTOs on all POST/PATCH endpoints
- Idempotency: `credit_note_applications` has idempotency key + `ON CONFLICT DO NOTHING`

---

## 6. UI/UX Design Strategy

### 6.1 Visual Hierarchy (most critical → least critical)

**Tier 1 — Identity & Provenance (above the fold, always visible)**
1. Credit note number + status badge (top-left header)
2. Reference to original invoice (prominent linked card — `CreditNoteInvoiceLink`)
3. Reason for credit (audit-critical, always visible — warning callout)

**Tier 2 — Financial Summary (immediately visible)**
4. Total credit amount + remaining balance + applied amount (with progress bar)
5. Line item breakdown (standard business document pattern)

**Tier 3 — Supporting Metadata**
6. Business details (From)
7. Customer details (Credit To / Bill To)
8. Issue date, currency, terms

**Tier 4 — Audit Trail**
9. Application history (how credit was consumed — method badges)
10. Activity timeline (all lifecycle events with actor attribution)
11. Internal notes (team-only)

### 6.2 Design System Compliance

| Element | Existing Pattern | Proposed Usage |
|---|---|---|
| Status badges | `StatusBadge` + config objects | Reuse `creditNoteStatusConfig`, add method badges |
| Card containers | `SectionCard` | Use for provenance header, sidebar cards |
| Page headers | `PageHeader` with breadcrumbs | All list/detail pages + back links |
| Tables | `DataTable` (with sorting, pagination) | List page table |
| Form controls | `FormField`, `FormTextareaField`, `.form-control` | Creation editor |
| Financial values | `Money` component with `signed` prop | All monetary displays |
| Empty states | `EmptyState` component | No data, no search results |
| Dialogs | `Dialog`, `ConfirmationDialog` | Apply, cancel, void, send |
| KPI cards | `KPICard` with `stat` variant | List page summary |
| Modals | `Dialog` with focus trapping | Apply, cancel, void dialogs |
| Icons | `lucide-react` | `FileText`, `ReceiptRefund`, `Wallet`, `Link`, `AlertCircle`, `ArrowLeft`, `Download`, `Send`, `Plus`, `Trash2`, `Save` |

### 6.3 Edge Case Handling Matrix

| Scenario | CN Status | `amount_due` | Applications | UI Treatment |
|---|---|---|---|---|
| New, not finalized | draft | = total | [] | Draft watermark, "Not yet finalized" banner |
| Draft saved, editing | draft | = total | [] | Editor with Save Draft + Finalize buttons |
| Finalized, never applied | finalized | = total | [] | "Not yet applied" card with apply/refund buttons |
| Applied to invoice | applied | 0 | [{invoiceId, amount, method: invoice_offset}] | Green badge: "Fully applied to INV-XXXX" |
| Partially applied | partially_applied | > 0 | [{invoiceId, partial}] | Amber badge: "Partially applied to INV-XXXX" |
| Direct refund | refunded | 0 | [{amount, method: refund}] | Purple badge: "Refunded" + provider ref |
| Credit to balance | applied | 0 | [{method: balance_credit}] | Blue badge: "Credit held on account" |
| Multiple applications | applied | 0 | [{...}, {...}] | Split badge: "Applied to 2 invoices" |
| Cancelled | cancelled | = total | [] | Tertiary badge + "Cancelled on {date} — {reason}" |
| Voided | void | = total | [] | Tertiary badge + "Voided on {date} — {reason}" |
| Reference invoice deleted | finalized/applied | varies | [] or [...] | Warning card: "Reference invoice not found" |
| No customer | draft/finalized | = total | N/A | Warning in header |
| Loading | — | — | — | Skeleton loaders for all sections |
| Error | — | — | — | Error boundary + retry button |

### 6.4 Mobile Responsiveness

| Breakpoint | Layout Changes |
|---|---|
| `lg` (1024px) and up | Two-column: document body (2/3) + sidebar (1/3) |
| `md` (768px) to `lg` | Sidebar moves below document; provenance card full-width |
| `sm` (640px) to `md` | Table horizontal-scroll; action buttons collapse to kebab menu |
| Below `sm` | Party info stacks vertically; totals vertical; table scrollable |

### 6.5 Accessibility

- All interactive elements have `aria-label` with full context
- Status badges include `aria-label` with status + description
- Modal dialogs use proper focus trapping and escape-to-close (existing `Dialog` component)
- Form fields have associated `<label>` elements and error messages with `aria-live="polite"`
- `Money` component uses `aria-label` with currency context
- Empty states include descriptive text for screen readers
- Color is never the sole indicator — method badges include icon + text label

---

## 7. Implementation Roadmap

### Phase 1: Backend Foundation (Week 1)

**Tasks:**
1. `Migration 061` — Credit note events table + indexes
2. `Migration 062` — Application method index on `metadata->'method'`
3. Backend: `createCreditNoteDraft` — creates with `status = 'draft'`, no number
4. Backend: `finalizeCreditNote` — generates number, snapshots, sets status to `finalized`
5. Backend: `cancelCreditNote` — validates state, sets cancelled
6. Backend: `voidCreditNote` — validates state, sets voided
7. Backend: `getCreditNoteEvents` — paginated audit trail
8. Backend: Enhance `applyCreditNote` — accept `applicationMethod` in body, store in metadata
9. Backend: Enhance `listCreditNotes` — join customer names, search by CN number / customer name / invoice number
10. Backend: Log events to `credit_note_events` table at each state transition

**Verification:**
- `npm run typecheck` (backend)
- `npm run lint` (backend)
- Manual DB verification after `npm run migrate`

### Phase 2: Frontend API Client + Types (Week 1-2)

**Tasks:**
1. Update `webapp/src/types/api.ts` — `ApiCreditNoteApplication.application_method`, `ApiCreditNoteEvent`, `ApiCreditNoteDraft`
2. Update `webapp/src/api/client.ts`:
   - `createCreditNoteDraft(data)` → POST `/api/credit-notes` with `status: draft`
   - `finalizeCreditNote(id)` → PATCH `/api/credit-notes/:id/finalize`
   - `cancelCreditNote(id, reason)` → POST `/api/credit-notes/:id/cancel`
   - `voidCreditNote(id, reason)` → POST `/api/credit-notes/:id/void`
   - `getCreditNoteEvents(id)` → GET `/api/credit-notes/:id/events`
   - Enhance `applyCreditNote` — add `applicationMethod` to payload
   - Enhance `getCreditNotes` — add `search`, `customerId`, `dateFrom`, `dateTo`, `sortBy`, `sortOrder` params
3. Add `CreditNoteStatusBadge` enhancement — application status dot indicator

**Verification:**
- `cd webapp && npm run typecheck`
- `cd webapp && npm run lint`

### Phase 3: Shared Components (Week 2)

**Tasks:**
1. `CreditNoteInvoiceLink.tsx` — provenance header card
2. `CreditNoteTotalsSummary.tsx` — totals with progress bar
3. `CreditNoteApplicationStatus.tsx` — method badge per application
4. `CreditNoteAppliedSummary.tsx` — sidebar summary
5. `CreditNoteListKPIBar.tsx` — KPI cards for list page
6. `ApplyCreditNoteDialog.tsx` — modal with method selector (replaces prompt())
7. `CreditNoteActivityTimeline.tsx` — audit trail timeline
8. Re-export all from `webapp/src/components/ui/index.ts`

**Verification:**
- `cd webapp && npm run typecheck`
- `cd webapp && npm run lint`
- Component tests for each (see §8)

### Phase 4: List Page (Week 3)

**Tasks:**
1. Rewrite `CreditNotes.tsx` — add KPI bar, enhanced filters, Reference Invoice column, action menu per row
2. Add row action buttons: View / Edit (draft only) / Apply (finalized) / PDF / Cancel (finalized)
3. Wire up search + filter params to URL (consistent with InvoiceList)
4. Replace inline apply `prompt()` with `ApplyCreditNoteDialog`

**Verification:**
- `cd webapp && npm run typecheck`
- `cd webapp && npm run lint`
- Component test for `CreditNotes` list

### Phase 5: Detail Page (Week 3-4)

**Tasks:**
1. Restructure `CreditNoteDetail.tsx` — two-column layout with provenance header
2. Integrate `CreditNoteInvoiceLink` card (top of document)
3. Integrate `CreditNoteTotalsSummary` with progress bar
4. Integrate `CreditNoteApplicationStatus` in applications table
5. Integrate `CreditNoteActivityTimeline` for audit trail
6. Add sidebar: Action Card, Credit Note Details, Application Summary
7. Wire up Cancel/Void buttons with `ConfirmationDialog`
8. Add "Edit" link for drafts (→ `/credit-notes/:id/edit`)

**Verification:**
- `cd webapp && npm run typecheck`
- `cd webapp && npm run lint`
- Component test for `CreditNoteDetail`

### Phase 6: Creation/Editor + Draft Mode (Week 4)

**Tasks:**
1. Enhance `CreditNoteForm.tsx` — add Save Draft + Finalize mode toggle
2. Create `CreditNoteEdit.tsx` — load existing draft, edit, finalize
3. After draft saved, redirect to `/credit-notes/:id/edit`
4. Finalize button calls `finalizeCreditNote` API → redirect to detail
5. Enhance source invoice selector (currently raw text input)
6. Wire `DocumentPreview` to show draft watermark

**Verification:**
- `cd webapp && npm run typecheck`
- `cd webapp && npm run lint`
- Component test for form validation + calc

### Phase 7: PDF Template Enhancement (Week 4-5)

**Tasks:**
1. Enhance `DEFAULT_CREDIT_NOTE_TEMPLATE` in `template-renderer.ts`:
   - Add prominent invoice link banner at top
   - Add application method labels in applications section
   - Add "Reason for Credit" callout box directly under header
   - Color treatment for credit amounts (red with `−` prefix)
2. Update `buildCreditNoteData` to include `applicationMethod` in applications
3. Update `generateCreditNotePdf` in `invoice-service.ts` to pass method to template
4. Verify PDF renders correctly in both web and print contexts

**Verification:**
- `npm run typecheck`
- Manual PDF output verification

### Phase 8: Testing (Week 5)

**Tasks:**
1. **Backend tests** (`tests/`):
   - `credit-note-create.test.ts` — draft creation, finalize, error cases
   - `credit-note-list.test.ts` — pagination, filtering, search
   - `credit-note-apply.test.ts` — invoice offset, balance credit, refund, idempotency
   - `credit-note-cancel-void.test.ts` — state transitions, invalid states
   - `credit-note-events.test.ts` — audit trail logging
   - `credit-note-pdf.test.ts` — PDF generation with method labels
2. **Frontend tests** (`webapp/src/__tests__/`):
   - `credit-note-list.test.tsx` — KPI bar, filters, table rendering, empty states
   - `credit-note-detail.test.tsx` — provenance card, totals, applications, timeline
   - `credit-note-form.test.tsx` — validation, calc engine, draft save, finalize
   - `apply-credit-note-dialog.test.tsx` — method selection, amount validation
   - `credit-note-totals-summary.test.tsx` — progress bar, remaining display
   - `credit-note-application-status.test.tsx` — method badge rendering
3. **E2E integration tests:**
   - Full lifecycle: create draft → finalize → apply → (cancel or refund)

**Verification:**
- `npm run test` (backend)
- `cd webapp && npm run test` (frontend)
- Coverage: ≥80% on new code

### Phase 9: Final Integration & Polish (Week 6)

**Tasks:**
1. Wire up all new routes in `App.tsx`
2. Update `Layout.tsx` nav links if needed
3. Cross-browser testing (Chrome, Firefox, Safari, Edge)
4. Mobile viewport testing
5. Accessibility audit (axe-core or manual)
6. Performance audit (Lighthouse) — ensure list page < 2s load
7. Fix lint + any type errors
8. Final `npm run build` and `docker compose up --build`

---

## 8. Testing Strategy

### 8.1 Backend Tests (vitest + test database)

**File:** `tests/credit-note-*.test.ts`

| Test File | Scenarios |
|---|---|
| `credit-note-create.test.ts` | Create draft, create with invoice prefill, validation errors, finalize generates number, snapshot stored, is_finalized = true |
| `credit-note-list.test.ts` | Paginated list, filter by invoiceId, filter by status, search by CN number/customer/invoice, total count accurate |
| `credit-note-apply.test.ts` | Apply to invoice (offset), apply with balance_credit method, apply with refund method, idempotency conflict, amount > remaining, amount > invoice due, status transitions |
| `credit-note-cancel-void.test.ts` | Cancel draft, cancel finalized, void sent, cancel already applied (error), void draft (error) |
| `credit-note-events.test.ts` | All events logged with correct metadata, actor attribution, timestamp ordering |
| `credit-note-pdf.test.ts` | PDF includes invoice link, application methods shown, reason callout present, credit amounts in red |

### 8.2 Frontend Tests (vitest + React Testing Library)

**File:** `webapp/src/__tests__/credit-note-*.test.tsx`

| Test File | Scenarios |
|---|---|
| `credit-note-list.test.tsx` | KPI bars show correct counts and amounts, search filters work, status filters toggle, table columns display correct data, empty state renders, error state shows retry |
| `credit-note-detail.test.tsx` | Provenance card shows linked invoice, totals summary with progress bar, applications table shows method badges, timeline events render, cancel/void buttons show confirmation dialog |
| `credit-note-form.test.tsx` | Source invoice pre-fills customer+currency, reason validation, line item add/remove, fee add/remove, real-time totals calculation, save draft, finalize → redirect |
| `apply-credit-note-dialog.test.tsx` | Method radio group selection, invoice dropdown filters by customer, amount defaults to min(remaining, due), validation prevents amount > remaining |
| `credit-note-totals-summary.test.tsx` | Total credit shown red with `−` prefix, applied amount green, remaining shows green(0)/amber(>0), progress bar width correct |

### 8.3 Test Commands

```bash
# Backend
cd /project/root
npm run test              # vitest
npm run test:watch        # watch mode
npm run typecheck         # tsc --noEmit

# Frontend
cd webapp
npm run test              # vitest
npm run test:watch        # watch mode
npm run typecheck         # tsc --noEmit
npm run lint            # eslint
```

### 8.4 Database Test Setup

The test database uses `tests/helpers/db.ts` which provides:
- `setupTestDb()` — creates fresh test database with all migrations
- `teardownTestDb()` — drops test database
- `seedTestData()` — creates business, customer, invoices with known data

### 8.5 Coverage Targets

- Backend: ≥80% on all new service methods and API routes
- Frontend: ≥80% on all new components

---

## 9. File-Level Implementation Plan

### 9.1 New Files

| File | Purpose |
|---|---|
| `src/db/migrations/061_credit_note_events.sql` | Audit events table |
| `src/db/migrations/062_credit_note_application_method_index.sql` | Index on metadata method |
| `webapp/src/components/CreditNoteInvoiceLink.tsx` | Provenance header card |
| `webapp/src/components/CreditNoteTotalsSummary.tsx` | Totals + progress bar |
| `webapp/src/components/CreditNoteApplicationStatus.tsx` | Method badge per application |
| `webapp/src/components/CreditNoteAppliedSummary.tsx` | Sidebar application summary |
| `webapp/src/components/CreditNoteListKPIBar.tsx` | KPI cards for list page |
| `webapp/src/components/ApplyCreditNoteDialog.tsx` | Modal with method selector |
| `webapp/src/components/CreditNoteActivityTimeline.tsx` | Audit trail timeline |
| `webapp/src/pages/CreditNoteEdit.tsx` | Edit existing draft page |
| `tests/credit-note-create.test.ts` | Backend: creation + finalize |
| `tests/credit-note-list.test.ts` | Backend: listing + filtering |
| `tests/credit-note-apply.test.ts` | Backend: application + methods |
| `tests/credit-note-cancel-void.test.ts` | Backend: cancel + void |
| `tests/credit-note-events.test.ts` | Backend: audit trail |
| `tests/credit-note-pdf.test.ts` | Backend: PDF generation |
| `webapp/src/__tests__/credit-note-list.test.tsx` | Frontend: list page |
| `webapp/src/__tests__/credit-note-detail.test.tsx` | Frontend: detail page |
| `webapp/src/__tests__/credit-note-form.test.tsx` | Frontend: editor form |

### 9.2 Modified Files

| File | Changes |
|---|---|
| `src/services/invoice-service.ts` | Add `createCreditNoteDraft`, `finalizeCreditNote`, `cancelCreditNote`, `voidCreditNote`, `getCreditNoteEvents`; enhance `applyCreditNote` with method; enhance `listCreditNotes` with search/filters; log events at transitions |
| `src/index.ts` | Add routes: `PATCH /finalize`, `POST /cancel`, `POST /void`, `GET /:id/events`; enhance `POST /apply` body; enhance `GET /` query params |
| `webapp/src/types/api.ts` | Add `application_method` to `ApiCreditNoteApplication`, add `ApiCreditNoteEvent`, add `ApiCreditNoteDraft` |
| `webapp/src/api/client.ts` | Add `createCreditNoteDraft`, `finalizeCreditNote`, `cancelCreditNote`, `voidCreditNote`, `getCreditNoteEvents`; enhance `applyCreditNote` payload; enhance `getCreditNotes` params |
| `webapp/src/components/ui/StatusBadge.tsx` | Add application method badge configs |
| `webapp/src/components/ui/index.ts` | Export new components |
| `webapp/src/pages/CreditNotes.tsx` | Add KPI bar, enhanced filters, Reference Invoice column, action menu |
| `webapp/src/pages/CreditNoteDetail.tsx` | Restructure to two-column, integrate provenance card, totals summary, application status, timeline, cancel/void |
| `webapp/src/pages/CreditNoteForm.tsx` | Add Save Draft + Finalize mode, enhance source invoice selector |
| `webapp/src/App.tsx` | Add route for `credit-notes/:id/edit` |
| `webapp/src/components/ui/CreditNoteLifecycle.tsx` | Add "Refunded" step (if exists) |
| `src/services/templates/template-renderer.ts` | Enhance DEFAULT_CREDIT_NOTE_TEMPLATE with invoice banner, method labels, reason callout; add `method` to application data |

---

## 10. Deployment & Migration Strategy

### 10.1 Migration Order (via `npm run migrate`)

1. `061_credit_note_events.sql` — creates events table + indexes
2. `062_credit_note_application_method_index.sql` — GIN index on metadata method

Both are additive — existing credit notes continue to work (no data migration needed).

### 10.2 Docker Deployment

```bash
# Build and deploy
docker compose stop
docker compose pull
docker compose up --build -d

# Run migrations
docker compose exec web npm run migrate

# Verify
docker compose ps
docker compose logs web --tail 50
```

### 10.3 Rollback Plan

If issues are found:
```bash
# Roll back to previous image (pre-baked in CI)
docker compose down
docker compose up -d --image-tag <previous>

# Revert migration (manual, since node-pg-migrate doesn't auto-revert)
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "DROP TABLE credit_note_events;"
```

### 10.4 Smoke Testing After Deploy

1. `POST /api/credit-notes` — create draft with invoiceId
2. `PATCH /api/credit-notes/:id/finalize` — finalize
3. `GET /api/credit-notes/:id` — verify finalized state
4. `GET /api/credit-notes/:id/pdf` — verify PDF renders
5. `POST /api/credit-notes/:id/apply` — apply with method
6. `GET /api/credit-notes/:id/events` — verify audit trail

---

## 11. Risk Assessment & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Draft mode requires backend transaction changes | Medium | Implement `createCreditNoteDraft` as minimal variation of existing `createCreditNote` — same validation, just `status='draft'` + `is_finalized=FALSE` |
| Cancel/void could break immutability guarantees | High | Only allow cancel when `status IN ('draft', 'finalized', 'sent')`; void only when `status IN ('sent', 'partially_applied', 'applied')`. Never modify snapshotted data. |
| Application methods add complexity to apply flow | Medium | Store method in `metadata JSONB` (no schema change); default to `invoice_offset` for backward compat |
| Audit events table could grow large | Low | Index on `credit_note_id` + `created_at DESC`; archive policy configurable later |
| Frontend CalculationEngine may diverge from backend | Medium | Backend is authoritative — frontend values are display-only. API response updates state after submit. |
| List page performance with joins | Medium | Existing `listCreditNotes` already joins customers; add invoice number subquery for reference. Consider materialized view if >10k rows. |
| Mobile layout regressions | Low | Test on device toolbar; use Tailwind responsive prefixes consistently |
| PDF template changes could break print rendering | Medium | Test PDF in Chrome headless; use high-contrast colors that survive export |

---

## 12. Out of Scope (Future Enhancements)

1. **Recurring credit notes** — automated periodic credit issuance
2. **Credit note from scratch** — currently always created against an invoice
3. **Batch credit notes** — creating CNs for multiple invoices at once
4. **Customer self-serve portal** — public view for customers to see their credit notes
5. **AI-assisted credit note generation** — from uploaded documents or invoice discrepancies
6. **Credit note aging report** — track how long CNs sit unapplied
7. **Webhook notifications** — on credit note state transitions