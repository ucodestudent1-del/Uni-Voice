# Credit Notes UI Restructuring Plan — Auditability & Invoice Linkage

## 1. Audit of the Current State

Before proposing new designs, here is what exists today in the codebase.

### 1.1 Data Model (verified against `migrations/013_invoice_lifecycle.sql`)

The `credit_notes` table already has the structural foundation:

| Field | Type | Audit relevance |
|---|---|---|
| `id` | UUID | Internal PK |
| `credit_note_number` | VARCHAR(100) | Human-readable identifier (auto-assigned on finalize) |
| `reference_invoice_id` | UUID → invoices | **Foreign key to source invoice** |
| `customer_id` | UUID → customers | |
| `status` | ENUM (draft, finalized, cancelled, void, **applied**) | Lifecycle state |
| `applied_total` / `amount_due` | NUMERIC | Running totals after application |
| `internal_notes` | TEXT | Team-only audit trail |
| `reason` | TEXT | Mandatory audit field |
| `cancelled_reason` / `void_reason` | TEXT | Cancellation/void audit trail |

The `credit_note_applications` table links credit notes to the invoices they were applied to:

| Field | Purpose |
|---|---|
| `invoice_id` | Which invoice received the credit |
| `amount` | How much was applied |
| `applied_at` | Timestamp |
| `metadata` | JSONB — extensible for application method |
| `idempotency_key` | Prevents duplicate applications |

**Gap identified:** The `applications` table has no dedicated `application_method` or `application_type` column. The `metadata` JSONB field is the natural place to store this, but the UI currently has no concept of "how" the credit was consumed (refund vs. future balance vs. invoice offset).

### 1.2 Status Enum

```
draft → finalized → applied
              ↘ cancelled
              ↘ void
```

The `creditNoteStatusConfig` (in `webapp/src/components/ui/StatusBadge.tsx:77`) already defines:
- **Draft** → warning
- **Finalized** → info  
- **Applied** → success
- **Cancelled** → tertiary
- **Void** → tertiary

### 1.3 Application State Today

| Layer | What it does |
|---|---|
| **List view** (`webapp/src/pages/CreditNotes.tsx`) | Shows credit #, customer, issue date, total, remaining, status badge, and inline action buttons (Finalize / Apply / Cancel / Edit / PDF). The "Apply" action uses `prompt()` dialogs — poor UX. |
| **Detail view** (`webapp/src/pages/CreditNoteDetail.tsx`) | Shows a 2-column layout: main content (line items, totals, notes, applications table) + right sidebar (status, credit note details, lifecycle). The invoice link is a plain text `InfoRow` — not clickable, not prominent. |
| **Editor** (`webapp/src/components/CreditNoteWorkspace.tsx`) | Full-screen edit mode with live preview. The reference invoice is a text input with no lookup. |
| **PDF template** (`src/services/templates/credit-note-template-renderer.ts`) | Handlebars HTML template. Shows "Related Invoice: {{referenceInvoiceNumber}}" in muted text — buried in the right rail. |

### 1.4 Design System Tokens (verified against `webapp/src/index.css`)

The design system uses CSS custom properties exclusively:
- **Surfaces:** `--color-surface`, `--color-surface-alt`, `--color-surface-elevation`
- **Borders:** `--color-border`, `--color-border-strong`, `--color-border-subtle`
- **Text:** `--color-text` (primary), `--color-text-secondary`, `--color-text-tertiary`
- **Status:** `--color-success-*`, `--color-warning-*`, `--color-error-*`, `--color-info-*`
- **Brand:** `--color-primary` (blue-600 light / blue-400 dark)
- **Typography utilities:** `.invoice-title`, `.invoice-section-title`, `.invoice-section-heading`, `.invoice-body-text`, `.invoice-caption`, `.invoice-amount-*`
- **Form controls:** `.form-control`, `.form-control-sm`, `.form-select`, `.form-select-sm`
- **Font:** `font-tabular-nums` for all monetary values

Shared components available:
- `StatusBadge` + `createStatusBadgeConfig` (used by invoices, payments, customers, projects, credit notes)
- `CreditNoteLifecycle` (step indicator: Draft → Finalized → Applied)
- `DataTable` (with sorting, pagination, row selection)
- `PageHeader` (with breadcrumbs + primary/secondary actions)
- `InvoiceCard` (generic card container)
- `KPICard` (key metric cards with trend indicators)
- `EmptyState` (polished empty states with icon + action)
- `Button` (variants: primary, secondary, ghost, warning, danger)
- `ConfirmationDialog` (destructive action confirmation with optional input)

---

## 2. Information Architecture & Hierarchy

### 2.1 Primary User Personas

| Persona | Primary Goal | Audit Concern |
|---|---|---|
| **Accountant** | Verify credit note legality and traceability | Needs to see the invoice link, audit trail, and reason immediately |
| **Customer Support** | Resolve billing disputes | Needs context on how credit was consumed |
| **Finance Manager** | Track credit exposure and aging | Needs to see remaining balances and application status |

### 2.2 Visual Hierarchy (most critical → least critical)

The redesign follows the F-pattern + Z-pattern for document scanning, prioritizing audit traceability.

**Tier 1 — Identity & Provenance (above the fold, always visible)**
1. Credit note number + status badge (top-left header)
2. Reference to original invoice (prominent linked card)
3. Reason for credit (audit-critical, always visible)

**Tier 2 — Financial Summary (immediately visible)**
4. Total credit amount + remaining balance + applied amount
5. Line item breakdown (standard business document pattern)

**Tier 3 — Supporting Metadata**
6. Business details (From)
7. Customer details (Credit To / Bill To)
8. Issue date, currency, terms

**Tier 4 — Audit Trail**
9. Application history (how credit was consumed)
10. Activity timeline (all lifecycle events)
11. Internal notes (team-only)

### 2.3 Data Grouping Rationale

The grouping follows accounting document conventions (similar to InvoiceDisplay.tsx pattern) while prioritizing the **credit note ↔ invoice linkage** at every level:

1. **Provenance Cluster** — Credit note number, status, reference invoice. This group answers: "Where did this come from?"
2. **Party Cluster** — Business (From) and Customer (Bill To) details, side by side.
3. **Line Items Cluster** — The granular breakdown of what is being credited.
4. **Totals Cluster** — Financial summary, with credit-note-specific totals (Total Credit, Amount Applied, Amount Remaining).
5. **Audit Cluster** — Reason, notes, applications, timeline.

---

## 3. UI Component Design

### 3.1 Credit Note ↔ Invoice Linkage Components

#### 3.1.1 `CreditNoteInvoiceLink` Card (NEW component)

A prominent, card-style visual connection between the credit note and its source invoice. This is the single most important audit element.

```tsx
// webapp/src/components/CreditNoteInvoiceLink.tsx
interface CreditNoteInvoiceLinkProps {
  creditNote: ApiCreditNote;
  referenceInvoice?: ApiInvoiceListItem | null;  // fetched from reference_invoice_id
  onNavigateToInvoice: (invoiceId: string) => void;
}
```

**Visual treatment:**
- **Container:** `rounded-xl border-2 border-info-border bg-info-bg` (uses info tint to draw attention)
- **Layout:** Grid with icon, invoice number (large, clickable link), dates, and a visual connector arrow
- **Key elements:**
  - Left side: `FileText` icon with a subtle pulsing animation (only when linked)
  - Center: "Credit Note CN-2024-000345 → Invoice INV-2024-00123" in a connected label row
  - Right side: Issue dates for both documents
  - Bottom: A subtle `→` connector line with text "This credit note was issued against Invoice INV-2024-00123 dated Jan 15, 2024"
- **States:**
  - Linked: Full-color card with clickable invoice link
  - Not linked: Muted card with "No reference invoice" + a "Link invoice" button
  - Broken link (invoice deleted): Warning-colored card with icon and "Reference invoice not found"
- **PDF consideration:** Renders cleanly in both web and print contexts; uses high-contrast colors that survive PDF export

#### 3.1.2 `CreditNoteStatusBadge` (existing, minor enhancement)

Current: Simple colored badge.
Enhancement: Add an optional `applicationStatus` indicator dot when the credit note has been partially or fully applied:
- Fully applied → green dot + "Fully Applied" text
- Partially applied → amber dot + "Partially Applied" text
- Not applied → no dot + status label

#### 3.1.3 Linked Breadcrumb Trail (top of detail page)

```
Home > Invoices > INV-2024-00123 > Credit Notes > CN-2024-000345
```

Each breadcrumb is a real link except the final one (current page). The "INV-2024-00123" breadcrumb is the direct link to the source invoice — this is the **secondary audit path** after the primary link card.

### 3.2 Application Method Visualization

#### 3.2.1 `CreditNoteApplicationStatus` Component

A dedicated component that shows *how* each credit application was consumed. This addresses the edge case requirement.

```tsx
// webapp/src/components/CreditNoteApplicationStatus.tsx
interface CreditNoteApplicationStatusProps {
  application: ApiCreditNoteApplication;
  invoice?: ApiInvoiceListItem | null;  // for context
  currency: string;
}
```

**Visual treatment per application method:**

| Method | Icon | Label | Color | Description |
|---|---|---|---|---|
| **Direct Refund** | `ReceiptRefund` | "Refunded to customer" | `status-success` | Money returned to original payment method |
| **Future Balance** | `Wallet` | "Credit applied to customer balance" | `status-info` | Held on account for future invoices |
| **Invoice Offset** | `FileText` | "Applied to Invoice #INV-XXXX" | `status-success` | Reduced the outstanding amount of a specific invoice |

**Layout:** Each application row shows:
1. Method badge (colored icon + label)
2. The amount (negative, with `-` prefix and tabular nums)
3. Date applied
4. Link to the invoice (if invoice offset)
5. Metadata details (e.g., "Refunded via Stripe • Ref #ref_abc123")

#### 3.2.2 `CreditNoteAppliedSummary` Badge (sidebar)

A compact summary in the right sidebar showing:
- "Applied to: Invoice #INV-2024-00123" (if single invoice)
- "Partially applied" with breakdown (if multiple)
- Color-coded based on the dominant application method

### 3.3 Status Visualization: Lifecycle + Badge

The existing `CreditNoteLifecycle` component (in `webapp/src/components/ui/CreditNoteLifecycle.tsx`) shows a step indicator: **Draft → Finalized → Applied**.

**Enhancement for auditability:** Add a 4th milestone for **Refunded** when the application method is "direct refund":
- Draft → Finalized → Applied → Refunded
- This visually shows that the final state was a refund, not just an application

### 3.4 Audit Trail Timeline Enhancement

Building on the existing timeline pattern in `CreditNoteDetail.tsx`, add:
- **Color coding** by event category (creation = neutral, finalize = info, apply = success, cancel = warning, refund = success)
- **Metadata display** — each event shows a small metadata block (e.g., "Applied $150.00 to INV-2024-00123" rather than generic "credit_note_applied")
- **Actor column** — shows who performed the action (user name, system, or customer)
- **IP address / source** for external applications (when available from metadata)

### 3.5 Totals Summary Card

Building on existing patterns, add a `CreditNoteTotalsSummary` component that:
- Shows total credit, applied amount, remaining balance
- Shows a **progress bar** visualizing applied vs. remaining (like an invoice's paid status bar)
- Uses color coding: remaining = warning when > 0, success when 0

### 3.6 Application Method Selection UI (Editor)

In the workspace editor, add an `ApplicationMethodSelector` that appears after finalizing:
- Radio group: "Apply to invoice" | "Credit to customer balance" | "Issue refund"
- The "Apply to invoice" option opens an invoice picker (existing customer invoices)
- The "Issue refund" option requires a payment to have been made on the original invoice

---

## 4. Functional Layout Approaches

### 4.1 Dashboard/List View (`CreditNotes.tsx` — Restructured)

**Goal:** At-a-glance management of credit notes with immediate visibility into the invoice linkage and remaining balance.

#### 4.1.1 Page Header (using existing `PageHeader` component)
- Title: "Credit Notes"
- Description: "Manage credit notes, refunds, and adjustments"
- Primary action: "New Credit Note" button
- Secondary actions: Export (CSV/JSON)

#### 4.1.2 Summary KPI Cards (NEW — above the table)

Four cards using the existing `KPICard` component:

| Card | Metric | Variant | State |
|---|---|---|---|
| Total Credit Notes | Count of all CNs | `stat` | `info` |
| Outstanding Balance | Sum of `amount_due` across all non-zero | `stat` | `warning` |
| Fully Applied | Count of CNs with `amount_due = 0` | `stat` | `success` |
| Draft Credit Notes | Count of CNs with status = draft | `stat` | `warning` |

These use the existing `KPICard` design system component with `state="warning"` for outstanding balances.

#### 4.1.3 Filter Bar (enhanced from existing)

**Primary filters (always visible):**
- Search: Search by credit note number, customer name, or reference invoice number
- Status filter: Draft, Finalized, Applied, Cancelled, Void (using existing `STATUS_FILTERS` — but add "Applied")
- Currency filter

**Advanced filters (toggle):**
- Customer (select)
- Issue date range (from/to)
- Remaining balance toggle (show only credit notes with remaining balance > 0)
- Reference invoice (search by invoice number)

#### 4.1.4 Data Table (using existing `DataTable` component)

Columns (order by audit priority):

| Column | Content | Sortable | Width |
|---|---|---|---|
| **Credit Note** | Credit note number + issue date | ✓ | 180px |
| **Reference Invoice** | Linked invoice number (linked, with status badge) | ✓ | 160px |
| **Customer** | Customer name + email | ✓ | 200px |
| **Total Credit** | `-$1,250.00` | ✓ | 120px |
| **Applied** | Applied total + method hint icon | ✓ | 120px |
| **Remaining** | Remaining amount (green=0, amber=>0) | ✓ | 120px |
| **Status** | `CreditNoteStatusBadge` | — | 110px |
| **Actions** | View / Edit / PDF / Apply | — | 120px |

**Row-level design:**
- The "Reference Invoice" column shows a **linked** invoice number (clickable → navigate to invoice detail) with a small `link` icon (🔗)
- The "Remaining" column uses color coding:
  - `0.00` → green text "Fully Applied"
  - `> 0` → amber text with the amount
- Rows with a reference invoice get a subtle left border accent in `info` color (visual scan aid)
- Hover state shows a tooltip: "View credit note #CN-2024-000345"

**Mobile considerations:**
- Table collapses: Credit Note + Status on row 1, Customer on row 2, Reference Invoice on row 3, Totals on row 4
- Action buttons move to a kebab menu on mobile
- The reference invoice link is always visible as a small secondary row

#### 4.1.5 Action Menu Improvements

Replace the current inline buttons with a cleaner action set per row:
- **View** (detail page) — primary action for finalized CNs
- **Edit** — only for draft CNs
- **Apply to Invoice** — for finalized CNs with remaining balance (replaces the `prompt()` approach with a proper modal)
- **PDF** — download (always available)
- **Cancel** — for finalized/applied CNs (destructive, requires confirmation)
- **More actions (kebab)** on mobile: Duplicate, Send, etc.

#### 4.1.6 Apply-to-Invoice Modal (replaces `prompt()`)

A proper modal component using existing `ConfirmationDialog` patterns:
- Invoice selector (searchable dropdown of the customer's open invoices)
- Amount selector (full remaining / partial)
- Application method radio: "Reduce invoice balance" | "Issue full refund" (shown conditionally)

---

### 4.2 Detailed Document View (`CreditNoteDetail.tsx` — Restructured)

**Goal:** A polished, audit-ready document view that makes the invoice linkage "extremely obvious" for users and auditors, while remaining printable to PDF.

#### 4.2.1 Top Bar (header actions)

Using the existing pattern from `InvoiceDetail.tsx`:
- Back link: `← Credit Notes`
- Title: `Credit Note #CN-2024-000345` (or "Draft #abc123" if not finalized)
- Status badge: `CreditNoteStatusBadge` inline with the title
- Action buttons: Edit | Download PDF | Send | Apply to Invoice | Cancel

#### 4.2.2 Two-Column Layout (existing pattern: `lg:grid-cols-3`)

**Left column (`lg:col-span-2`):**
The full document rendering (print-ready).

**Right column (`lg:col-span-1`):**
Sidebar with contextual actions and metadata.

#### 4.2.3 Left Column — Document Body

##### A. Provenance Header (NEW — top of document)

A banner-style card that immediately establishes the link:

```tsx
// Visual: full-width card, subtle info-tinted background
<div className="rounded-xl border-2 border-info-border bg-info-bg px-6 py-4 mb-6">
  <div className="flex items-start gap-4">
    <FileText className="h-5 w-5 text-info-text mt-0.5 flex-shrink-0" />
    <div>
      <p className="text-sm font-medium text-info-text">Credit against Invoice</p>
      <div className="mt-1 flex items-baseline gap-3 flex-wrap">
        {referenceInvoice ? (
          <>
            <Link to={`/app/invoices/${referenceInvoice.id}`} className="text-xl font-bold text-primary hover:underline">
              {referenceInvoice.invoice_number}
            </Link>
            <span className="text-sm text-tertiary">
              Issued: {formatDateLong(creditNote.issue_date)}  ·  Invoice date: {formatDateLong(referenceInvoice.issue_date)}
            </span>
            <StatusBadge status={referenceInvoice.status} config={invoiceStatusConfig} size="sm" />
          </>
        ) : (
          <span className="text-sm text-tertiary">No reference invoice linked</span>
        )}
      </div>
      {referenceInvoice && (
        <p className="mt-2 text-sm text-secondary">
          Original total: {formatCurrency(referenceInvoice.total, referenceInvoice.currency)}
          · Amount credited: {formatCurrency(creditNote.total, creditNote.currency)}
          · Remaining on invoice: {formatCurrency(remainingOnInvoice, creditNote.currency)}
        </p>
      )}
    </div>
  </div>
</div>
```

**Key audit features:**
- The card uses `border-2` + `border-info-border` to make it visually prominent
- The invoice number is a **clickable link** (not just text)
- The status badge of the source invoice is visible
- The amounts show the relationship: original total → credited amount → remaining
- This card appears at the very top of the document — the first thing an auditor sees

##### B. Credit Note Identity + Lifecycle

```tsx
<div className="flex items-start justify-between mb-6">
  <div>
    <h1 className="invoice-title">
      Credit Note {creditNote.credit_note_number || "Draft"}
    </h1>
    <p className="mt-2 text-sm text-tertiary">
      Issue date: {formatDateLong(creditNote.issue_date)}
      {creditNote.finalized_at && ` · Finalized: ${formatDateLong(creditNote.finalized_at)}`}
    </p>
  </div>
  <div className="flex items-center gap-3">
    <CreditNoteLifecycle status={creditNote.status} />
    <CreditNoteStatusBadge status={creditNote.status} showIcon />
  </div>
</div>
```

##### C. Party Information (From / Bill To)

Uses the existing `InvoiceDisplay.tsx` pattern with `InvoiceCard`:
- **From** (Business): Name, address, tax ID, contact info
- **Bill To** (Customer): Name, company, address, tax ID, email, phone

##### D. Reason for Credit (audit-critical — always visible)

```tsx
{creditNote.reason && (
  <div className="mt-6 rounded-lg bg-warning-bg border border-warning-border p-4">
    <h4 className="invoice-section-title mb-1 flex items-center gap-2">
      <AlertCircle className="h-4 w-4 text-warning-text" />
      Reason for Credit
    </h4>
    <p className="text-sm text-warning-text">{creditNote.reason}</p>
    {creditNote.reference_invoice_id && (
      <p className="mt-2 text-xs text-tertiary">
        Linked to Invoice #{creditNote.reference_invoice_number}
      </p>
    )}
  </div>
)}
```

This uses the existing `status-warning-bg` / `status-warning-text` tokens for visibility.

##### E. Line Items Table

Same structure as current `CreditNoteDetailView`, but with improved column headers and the `InvoiceDisplay.tsx` pattern (catalog SKU, tax name, tax-inclusive indicator).

##### F. Totals Summary

Enhanced from current implementation:
```tsx
<div className="mt-6 flex justify-end">
  <div className="w-72 space-y-1 font-tabular-nums">
    <div className="flex justify-between py-2 text-sm">
      <span className="text-tertiary">Subtotal</span>
      <span className="text-primary">{formatCurrency(creditNote.subtotal, currency)}</span>
    </div>
    {hasDiscount && (
      <div className="flex justify-between py-2 text-sm">
        <span className="text-tertiary">Discount</span>
        <span className="text-success-text">−{formatCurrency(creditNote.discount_total, currency)}</span>
      </div>
    )}
    <div className="flex justify-between py-2 text-sm">
      <span className="text-tertiary">Tax</span>
      <span className="text-primary">{formatCurrency(creditNote.tax_total, currency)}</span>
    </div>
    {hasFees && (
      <div className="flex justify-between py-2 text-sm">
        <span className="text-tertiary">Fees</span>
        <span className="text-primary">{formatCurrency(creditNote.fee_total, currency)}</span>
      </div>
    )}
    <div className="border-t-2 border-color pt-3">
      <div className="flex justify-between">
        <span className="text-base font-semibold text-secondary">Total Credit</span>
        <span className="text-2xl font-bold text-error-text">
          −{formatCurrency(creditNote.total, currency)}
        </span>
      </div>
    </div>
    {hasApplications && (
      <>
        <div className="flex justify-between py-2 text-sm">
          <span className="text-tertiary">Amount Applied</span>
          <span className="text-success-text">−{formatCurrency(creditNote.applied_total, currency)}</span>
        </div>
        <div className="border-t-2 border-color pt-3">
          <div className="flex justify-between">
            <span className="text-lg font-semibold text-secondary">Amount Remaining</span>
            <span className={cn(
              "text-xl font-bold",
              Number(creditNote.amount_due) === 0
                ? "text-success-text"
                : "text-warning-text"
            )}>
              −{formatCurrency(creditNote.amount_due, currency)}
            </span>
          </div>
        </div>
      </>
    )}
  </div>
</div>
```

Key change: "Total Credit" uses `text-error-text` (red) and the `−` prefix in a larger weight to distinguish credits from regular invoice amounts. "Amount Remaining" uses green when zero, amber when > 0.

##### F.2. Application History (enhanced)

The existing "Applied To Invoices" table is reworked to show **application methods**:

```tsx
{(creditNote.applications ?? []).length > 0 && (
  <div className="mt-6">
    <h3 className="invoice-section-title mb-3">Where This Credit Was Applied</h3>
    <div className="space-y-3">
      {creditNote.applications.map((app) => (
        <CreditNoteApplicationRow
          key={app.id}
          application={app}
          currency={creditNote.currency}
          referenceInvoice={app.invoice_id === creditNote.reference_invoice_id ? referenceInvoice : null}
        />
      ))}
    </div>
  </div>
)}
```

Each `CreditNoteApplicationRow`:
- **Method badge** (colored icon + label per §3.2.1)
- **Amount applied** (negative value)
- **Date applied**
- **Linked invoice number** (if invoice offset method)
- **Metadata details** (refund provider, transaction ID, etc.)

If no applications yet but status is "finalized" with remaining balance:
```tsx
<div className="mt-6 rounded-lg border border-color bg-surface-alt p-4 text-center">
  <ClipboardMinus className="mx-auto h-8 w-8 text-tertiary mb-2" />
  <p className="text-sm text-secondary">This credit note has not yet been applied.</p>
  {Number(creditNote.amount_due) > 0 && (
    <p className="mt-1 text-sm text-tertiary">
      {formatCurrency(creditNote.amount_due, creditNote.currency)} remaining — apply to an invoice or issue a refund.
    </p>
  )}
</div>
```

##### G. Notes, Internal Notes, Terms

Same as current but with clearer section labels and the audit icon for internal notes:
- **Notes** (customer-facing) — standard text
- **Internal Notes** — labeled with a "lock" / team-only icon, using `bg-surface-alt`
- **Terms & Conditions** — standard text

#### 4.2.4 Right Column — Sidebar

```tsx
<div className="space-y-6">
  {/* Action Card */}
  <div className="rounded-xl border border-color bg-surface p-5 text-center shadow-sm">
    {/* Contextual action based on status:
         draft → "Finalize Credit Note" button
         finalized → "Finalized" badge + Send/PDF/Apply buttons
         applied → "Applied" badge + PDF button
         cancelled → "Cancelled" badge
    */}
  </div>

  {/* Credit Note Details Card */}
  <div className="rounded-xl border border-color bg-surface p-5 shadow-sm">
    <h3 className="invoice-section-title mb-3">Credit Note Details</h3>
    <div className="space-y-2">
      <InfoRow label="Credit Note #" value={creditNote.credit_note_number ?? "—"} />
      <InfoRow label="Issue date" value={formatDateLong(creditNote.issue_date)} />
      <InfoRow label="Currency" value={creditNote.currency} />
      {creditNote.reference_invoice_number && (
        <InfoRow
          label="Reference Invoice"
          value={
            <Link to={`/app/invoices/${creditNote.reference_invoice_id}`} className="text-primary-brand hover:underline">
              {creditNote.reference_invoice_number}
            </Link>
          }
        />
      )}
      {creditNote.finalized_at && <InfoRow label="Finalized" value={formatDateLong(creditNote.finalized_at)} />}
      {creditNote.sent_at && <InfoRow label="Sent" value={formatDateLong(creditNote.sent_at)} />}
    </div>
  </div>

  {/* Application Status Card (NEW) */}
  {creditNote.applications?.length > 0 && (
    <div className="rounded-xl border border-color bg-surface p-5 shadow-sm">
      <h3 className="invoice-section-title mb-3">Application Summary</h3>
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-tertiary">Method</span>
          <span className="text-primary font-medium">
            {deduceDominantMethod(creditNote.applications)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-tertiary">Total Applied</span>
          <span className="text-success-text font-medium">
            −{formatCurrency(creditNote.applied_total, creditNote.currency)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-tertiary">Remaining</span>
          <span className={cn(
            "font-medium",
            Number(creditNote.amount_due) === 0 ? "text-success-text" : "text-warning-text"
          )}>
            −{formatCurrency(creditNote.amount_due, creditNote.currency)}
          </span>
        </div>
        {creditNote.applications.map((app) => (
          <ApplicationMethodBadge key={app.id} application={app} />
        ))}
      </div>
    </div>
  )}
</div>
```

#### 4.2.5 Activity Timeline (enhanced)

Uses the existing timeline pattern but with:
- **Event categorization** (color-coded dots)
- **Metadata detail lines** (shows what changed)
- **Actor attribution** (user / system / customer / payment)

---

### 4.3 PDF Template Enhancement (`credit-note-template-renderer.ts`)

The current Handlebars template needs enhancements to match the web UI:

1. **Add a prominent invoice link card** at the top (matching §4.2.3-A):
   ```html
   {{#if creditNote.referenceInvoiceNumber}}
   <div class="invoice-link-banner">
     <div class="invoice-link-icon">📄</div>
     <div class="invoice-link-content">
       <div class="invoice-link-label">Credit against Invoice</div>
       <div class="invoice-link-number">{{creditNote.referenceInvoiceNumber}}</div>
       <div class="invoice-link-meta">
         Issue date: {{cnFormatDate creditNote.issueDate}}
         · Total: {{cnFormatMoney totals.total}}
       </div>
     </div>
   </div>
   {{/if}}
   ```

2. **Add application method labels** in the "Applied To Invoices" section:
   ```html
   {{#each applications}}
   <tr>
     <td>
       {{applicationMethodLabel metadata.method}}  {{-- e.g. "Refund", "Balance Credit", "Invoice Offset" --}}
       {{#if invoiceNumber}}<a href="#">{{invoiceNumber}}</a>{{else}}{{invoiceId}}{{/if}}
     </td>
     ...
   </tr>
   {{/each}}
   ```

3. **Add "Reason for Credit" callout box** directly under the header (before line items):
   Already partially implemented — enhance with the invoice reference inside the callout.

4. **Color treatment** for credit amounts: Use `-{{cnFormatMoney lineTotal}}` with a red color class to distinguish credits from debits.

---

## 5. Edge Case Handling: Application Methods

Three distinct application methods must be visually differentiated. Since the current `credit_note_applications` table stores a `metadata` JSONB field, the UI should read `metadata.method` to determine the display:

### 5.1 Edge Case Matrix

| Scenario | CN Status | `amount_due` | Applications | Application Method | UI Treatment |
|---|---|---|---|---|---|
| **New, not finalized** | draft | = total | [] | — | Draft watermark, "Not yet finalized" banner |
| **Finalized, never applied** | finalized | = total | [] | — | "Not yet applied" card with apply/refund buttons |
| **Applied to invoice** | applied | 0 | [{invoiceId, amount}] | `invoice_offset` | Green badge: "Fully applied to INV-XXXX" |
| **Partially applied to invoice** | finalized | > 0 | [{invoiceId, partial}] | `invoice_offset` | Amber badge: "Partially applied to INV-XXXX" |
| **Direct refund** | applied | 0 | [{amount, metadata.method="refund"}] | `refund` | Purple badge: "Refunded" + refund provider reference |
| **Credit to future balance** | applied | 0 | [{metadata.method="balance"}] | `balance_credit` | Blue badge: "Credit held on account" |
| **Multiple applications** | applied | 0 | [{...}, {...}] | mixed | Split badge: "Applied to 2 invoices" + per-row method |
| **Cancelled** | cancelled | = total | [] | — | Tertiary badge + "Cancelled on {date} — {reason}" |
| **Void** | void | = total | [] | — | Tertiary badge + "Voided on {date} — {reason}" |
| **Reference invoice deleted** | finalized/applied | varies | [] or [...] | invoice_offset | Warning card: "Reference invoice not found" with invoice ID shown |
| **No customer** | draft | = total | [] | — | Warning: "No customer assigned" in header |

### 5.2 Visual Distinction Principles

1. **Color coding** by method type (not just status):
   - Refund → purple (`status-info` tint, distinct from success)
   - Invoice offset → green (`status-success`)
   - Balance credit → blue (primary tint)

2. **Icon differentiation** in the applications table:
   - `ReceiptRefund` for refunds
   - `FileText` for invoice offsets
   - `Wallet` for balance credits

3. **Status badge enhancement** when a CN has been refunded entirely (method = refund, amount_due = 0):
   - Shows "Refunded" instead of "Applied"
   - Updates the lifecycle: Draft → Finalized → Applied → Refunded

4. **Empty state handling** for applications:
   - If `status === "finalized"` and no applications: Show "This credit note has not been applied yet" with action buttons
   - If `status === "applied"` and no applications record (edge case): Show error/warning that application is missing

### 5.3 Application Method Capture UX

When applying a credit note, the UI should present a choice:

```
Apply Credit Note

○ Apply to an existing invoice
  Reduce the outstanding balance of a specific invoice.
  [Select invoice dropdown]  [Amount field — full by default]

○ Credit to customer's balance
  Hold the credit on the customer's account for future invoices.

○ Issue a refund
  Return the money to the customer's original payment method.
  [Available: $X.XX previously paid on INV-XXXX]
```

The selected method is stored in `metadata.method` on the `credit_note_applications` record.

---

## 6. Component Inventory & Implementation Plan

### 6.1 New Components to Create

| Component | File | Purpose |
|---|---|---|
| `CreditNoteInvoiceLink` | `webapp/src/components/CreditNoteInvoiceLink.tsx` | Prominent linked card between CN and source invoice |
| `CreditNoteApplicationStatus` | `webapp/src/components/CreditNoteApplicationStatus.tsx` | Visual representation of how each credit was applied |
| `CreditNoteAppliedSummary` | `webapp/src/components/CreditNoteAppliedSummary.tsx` | Sidebar summary of applications |
| `CreditNoteTotalsSummary` | `webapp/src/components/CreditNoteTotalsSummary.tsx` | Enhanced totals with progress bar |
| `ApplyCreditNoteDialog` | `webapp/src/components/ApplyCreditNoteDialog.tsx` | Modal replacing `prompt()` for applying credits |
| `CreditNoteListKPIBar` | `webapp/src/components/CreditNoteListKPIBar.tsx` | KPI cards for the list page |

### 6.2 Files to Modify

| File | Changes |
|---|---|
| `webapp/src/pages/CreditNotes.tsx` | Add KPI cards, enhance table columns (add Reference Invoice column, use DataTable), replace Apply `prompt()` with modal, add PageHeader component |
| `webapp/src/pages/CreditNoteDetail.tsx` | Restructure layout: add Provenance Header card, integrate InvoiceLink, use ApplicationStatus component, move invoice link to sidebar with clickable link, add AppliedSummary card |
| `webapp/src/components/CreditNoteWorkspace.tsx` | Add ApplicationMethodSelector after finalize, link reference invoice via lookup |
| `src/services/templates/credit-note-template-renderer.ts` | Add invoice link banner, application method labels, enhance reason callout |
| `webapp/src/components/ui/StatusBadge.tsx` | Add refunded state to `creditNoteStatusConfig` |
| `webapp/src/components/ui/CreditNoteLifecycle.tsx` | Add "Refunded" step to lifecycle |
| `webapp/src/types/api.ts` | Add `sent_at` field to `ApiCreditNote` (used in detail but not in type), add application metadata method field |

### 6.3 Backend Changes (minimal — metadata-driven)

| Change | File |
|---|---|
| The `metadata` field on `credit_note_applications` already exists — store `application_method` there. No schema migration needed. | `src/repositories/credit-note.repo.ts` |
| Expose `reference_invoice_number` in the list API response (already in `ApiCreditNote` type, query already joins customers — add invoice number join). | `src/repositories/credit-note.repo.ts:findManyPage` |
| Add `sent_at` column usage (already exists in `credit_notes` table per schema). | `src/repositories/credit-note.repo.ts:rowToModel` |

### 6.4 Design System Consistency Checklist

| Element | Existing Pattern | Proposed Usage |
|---|---|---|
| Status badges | `StatusBadge` + config objects | Reuse for all method badges |
| Card containers | `InvoiceCard` | Use for provenance header and sidebar cards |
| Page headers | `PageHeader` | Replace custom header in CreditNotes.tsx |
| Tables | `DataTable` | Replace raw `<table>` in list view |
| Form controls | `.form-control`, `.form-select` | Use in ApplyCreditNoteDialog |
| Totals layout | Right-aligned summary grid | Use in CreditNoteTotalsSummary |
| Breadcrumbs | `ChevronRight` separator | Add invoice link breadcrumb |
| Empty states | `EmptyState` component | Use for no-applications, no-invoice cases |
| Dialog/Modal | `ConfirmationDialog` pattern | Base ApplyCreditNoteDialog on this |
| Icons | `lucide-react` | `FileText`, `ReceiptRefund`, `Wallet`, `Link`, `AlertCircle` |

### 6.5 Accessibility Considerations

- All clickable invoice links include `aria-label` with full context (e.g., "View invoice INV-2024-00123")
- Status badges include `aria-label` with status + description
- The provenance card has `role="region" aria-label="Credit note source invoice reference"`
- Color is never the sole indicator — all method badges include icon + text label
- The timeline uses `aria-label` per event with actor and timestamp

### 6.6 Mobile Responsiveness

| Breakpoint | Layout Changes |
|---|---|
| `lg` (1024px) and up | Two-column layout: document body (2/3) + sidebar (1/3) |
| `md` (768px) to `lg` | Sidebar moves below document; provenance card full-width |
| `sm` (640px) to `md` | Table becomes horizontal-scroll; action buttons collapse to kebab |
| Below `sm` | Party info stacks vertically; totals summary is vertical scroll; table is horizontally scrollable |

---

## 7. Summary of Key Improvements

1. **Invoice linkage is the primary visual element** — the `CreditNoteInvoiceLink` card appears at the very top of the document view with a prominent border and clickable link, not buried in an InfoRow.

2. **Application methods are explicitly visualized** — each application shows a method badge with icon, color, and label (refund / balance / invoice offset), stored in the existing `metadata` JSONB field.

3. **List view gains audit context** — new "Reference Invoice" column shows linked invoice numbers (clickable), and KPI cards provide at-a-glance financial exposure.

4. **Apply-to-invoice UX is fixed** — replaces `window.prompt()` with a proper modal that captures the application method and amount.

5. **Consistent with existing design system** — all new components use existing tokens, the `StatusBadge` system, `InvoiceCard`, `DataTable`, and the established color palette.

6. **PDF parity** — the Handlebars template is enhanced to match the web UI's invoice linkage visibility, ensuring auditors see the same connection in print.

7. **Edge cases are explicitly handled** — the 10-row matrix in §5.1 covers draft, finalized, applied, refunded, balance-credited, cancelled, voided, and broken-reference states.
