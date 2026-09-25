# Receipts — UI & Functional Specification

> **Project**: Universal Invoice Generator  
> **Scope**: Receipts section of the web application  
> **Audience**: Design, Frontend, Backend, Product  

---

## 1. Overview

The **Receipts** section provides businesses with a complete record of all payment receipts issued to customers. Receipts are generated automatically when a payment is recorded against a paid invoice (see `src/services/receipt-service.ts:160` — `ReceiptService.issueReceipt`). The section supports searching, filtering, viewing, downloading, emailing, and (where applicable) refunding receipts.

Receipts are immutable once issued — they are snapshotted at generation time and served from a cached PDF (see `src/repositories/receipt.repo.ts:249` — `getPdfCache`). This mirrors the same immutability invariant enforced for finalized invoices.

### 1.1 Data Model

The `ApiReceipt` type (defined in `webapp/src/api/client.ts:1245`) is the canonical shape:

```typescript
interface ApiReceipt {
  id: string;                         // UUID pk
  invoice_id: string;                 // FK to invoice
  business_id: string;                // tenant isolation
  payment_id?: string | null;         // FK to payment
  receipt_number?: string | null;     // e.g. "RCPT-2026-000123"
  amount: string;                     // decimal string (minor-unit safe)
  currency: string;                   // ISO 4217, e.g. "USD"
  status: string;                     // "issued" | "sent" | "failed"
  provider: string;                   // "stripe" | "stub" | ...
  provider_receipt_url?: string | null; // external provider link
  sent_to?: string | null;            // email address if emailed
  issued_at?: string | null;          // ISO timestamp
  created_at: string;
  updated_at: string;
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
}
```

The domain model `Receipt` (`src/domain/models/index.ts:337`) extends this with `paymentMethod`, `paymentPurpose`, `emailLogId`, and `idempotencyKey`.

### 1.2 Feature Gate

Receipts require the **Business** plan (`requireEntitlement("receipts.create")`, see `src/services/subscription.service.ts:66`). The nav item in `Layout.tsx:35` is gated to `requiredPlan: "business"`. Non-eligible users see an upgrade prompt.

### 1.3 Available Backend API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/receipts` | List receipts (paginated, filtered) |
| `GET` | `/api/receipts/:id` | Fetch single receipt detail |
| `GET` | `/api/receipts/:id/pdf` | Download PDF (blob) |
| `POST` | `/api/receipts/:id/email` | Email receipt to customer |
| `POST` | `/api/invoices/:id/receipts` | Generate a receipt for an invoice |

**Note**: The backend does **not** currently expose a `/api/receipts/:id/refund` endpoint. A refund action would require backend work (the `InvoiceService.refundPayment` method exists at `src/services/invoice-service.ts:634` but is not wired to a receipt-specific route). The "Request Refund" action in the UI should trigger a modal that calls a new endpoint, or redirect to the invoice's payment flow.

---

## 2. Route Navigation

| Route | Component | Description |
|-------|-----------|-------------|
| `/app/receipts` | `pages/Receipts.tsx` | Dashboard listing all receipts |
| `/app/receipts/:id` | **New**: `pages/ReceiptDetail.tsx` | Individual receipt view (to be created) |

The route is registered in `App.tsx:98` as `<Route path="receipts" element={<Receipts />} />`.

---

## 3. Receipts Dashboard (`Receipts.tsx`)

### 3.1 Current State (Existing Code)

The existing `Receipts.tsx` page (`webapp/src/pages/Receipts.tsx`) implements a basic list with:
- Search input (debounced, 300ms)
- Status filter dropdown (All/Paid/Pending/Failed/Refunded)
- Provider filter dropdown (All/Stripe/Stub)
- Date range picker (from/to)
- DataTable with columns: Receipt #, Invoice, Amount, Provider, Status, Actions
- CSV and JSON export
- Row-level action buttons: Eye (view), ExternalLink (provider), Download (PDF)

### 3.2 Enhanced Dashboard — Specification

#### 3.2.1 Layout Structure (Desktop)

```
+----------------------------------------------------------+
| PageHeader: "Receipts"           [Export CSV] [Export JSON] |
|  Breadcrumb: Home > Receipts      "128 receipts total"    |
+----------------------------------------------------------+
| FILTER BAR                                               |
|  [Search box..............]  [Status ▼] [Provider ▼]     |
|  [Date From] [Date To]  [Clear All]                      |
+----------------------------------------------------------+
| SORT BAR                                                 |
|  Sort by: [Date ↓]  [Page size: 50 ▼]                     |
+----------------------------------------------------------+
| TRANSACTION TABLE                                        |
| ┌──────────────────────────────────────────────────────┐ |
| │ Receipt #  │ Invoice │ Customer │ Amount │ Date │ Status │ Actions │ |
| ├──────────────────────────────────────────────────────┤ |
| │ RCPT-...   │ INV-123 │ Acme Inc │ $150.00 │ Sep │ Paid   │ ↗ 📄 📧 │ |
| │ ...        │ ...     │ ...      │ ...    │ ... │ ...    │ ...     │ |
| └──────────────────────────────────────────────────────┘ |
|  [First] [Prev] Page 1 of 3 [Next] [Last]  [25 ▼ per page] |
+----------------------------------------------------------+
```

#### 3.2.2 Layout Structure (Mobile — < 768px)

```
+-------------------------------------------+
| PageHeader: "Receipts"   ⋮ (overflow menu) |
|  "128 receipts total"                      |
+-------------------------------------------+
| FILTER BAR (collapsible)                   |
|  Search expands full-width                 |
|  Status | Provider | Date (stacked)        |
+-------------------------------------------+
| TRANSACTION TABLE (card-list layout)      |
| ┌───────────────────────────────────────┐ |
| │ RCPT-2026-000123               $150 │ |
| │ Invoice INV-0123                Status: │ |
| │ Acme Corp, Paid on Sep 24     [Paid]  │ |
| │ Sep 24, 2026                  │ ↗ 📄 │ |
| └───────────────────────────────────────┘ |
+-------------------------------------------+
| Pagination: [Prev] 1 of 3 [Next]          |
+-------------------------------------------+
```

#### 3.2.3 Search Filters — Component Specification

**Search Box**
- Placeholder: `Search receipt #, invoice #, customer name...`
- Debounced: 300ms delay (via `useDebouncedCallback` hook, `webapp/src/hooks/useDebouncedCallback.ts`)
- Clears page number to 1 on each keystroke
- Icon: `Search` from lucide-react (`webapp/src/pages/Receipts.tsx:13`)

**Status Filter**
- Dropdown select with options:
  - `all` — All Statuses (default)
  - `paid` — Paid
  - `pending` — Pending
  - `failed` — Failed
  - `refunded` — Refunded
- Resets to page 1 on change
- Styled with Tailwind classes: `rounded-lg border border-input-border bg-surface-alt`

**Provider Filter**
- Dropdown select with options:
  - `all` — All Providers (default)
  - `stripe` — Stripe
  - `stub` — Stub (dev/test mode)
- Resets to page 1 on change

**Date Range Selector**
- Two `<input type="date">` fields: `dateFrom` and `dateTo`
- Filters by `issued_at` column (see `src/repositories/receipt.repo.ts:115-116`)
- Resets to page 1 on change
- Mobile: Full-width stacked; Desktop: Side-by-side in a 2-column grid

**Clear All Button**
- Appears only when `hasActiveFilters` is true (i.e., any filter is non-default)
- Resets all filter states to defaults and sets page to 1

**Advanced Filters Toggle** (New — Enhancement)
- Collapsible section toggled by a "Show/Hide Advanced" button
- Contains: Sort-by dropdown, customer filter, currency filter
- Persists state during the session

#### 3.2.4 Sort Controls

| Option | Value (sortBy) | Description |
|--------|---------------|-------------|
| Date (newest first) | `created_at` desc | Default |
| Date (oldest first) | `created_at` asc | — |
| Amount (high to low) | `amount` desc | — |
| Amount (low to high) | `amount` asc | — |
| Receipt # | `receipt_number` asc/desc | A-Z / Z-A |
| Invoice # | `invoice_number` asc/desc | — |
| Customer | `customer_name` asc/desc | — |

**Note**: The current backend (`src/services/receipt-service.ts:245-266`) does not support `sortBy`/`sortOrder` — it always sorts by `created_at DESC`. The API endpoint at `src/index.ts:1167` passes through `req.query` params directly, so adding sort support would require backend changes to `ReceiptFilter` and the SQL query. The UI should implement the dropdown but gracefully degrade to the default ordering if the backend doesn't support it.

#### 3.2.5 Table Columns

| Column | Data Source | Width | Mobile |
|--------|------------|-------|--------|
| Receipt # | `receipt_number` | 160px | Shown (abbreviated) |
| Date | `issued_at` / `created_at` | 110px | Shown |
| Invoice | `invoice_number` | 120px | Shown |
| Customer | `customer_name` | 140px | Shown |
| Amount | `amount` + `currency` | 100px | Shown (right-aligned) |
| Provider | `provider` | 90px | Hidden |
| Status | `status` | 100px | Shown |
| Actions | — | 120px | Icon-only (dropdown) |

**Status Badges** (using `PaymentStatus` component, `webapp/src/components/ui/PaymentStatus.tsx`):
- `paid`/`issued` → Green (CheckCircle icon)
- `sent` → Green (CheckCircle icon)
- `pending` → Blue (Clock icon)
- `failed` → Red (XCircle icon)
- `refunded` → Muted (RefreshCw icon)

**Row Actions** (per row, right-aligned):
1. **View** (Eye icon) — Navigate to `/app/receipts/:id`
2. **Download PDF** (Download icon) — Trigger `getReceiptPdf(receipt.id)` and force download
3. **Email Receipt** (Mail icon) — Opens email modal with pre-filled customer email
4. **More Actions** (ellipsis `⋯`) — Dropdown menu:
   - Copy receipt number
   - Open in provider (if `provider_receipt_url` exists)
   - View invoice (navigates to `/app/invoices/:invoice_id`)
   - Request refund (if payment supports refunds — see Section 5)

#### 3.2.6 Pagination

- Uses `DataTable` component (`webapp/src/components/ui/DataTable.tsx:51`)
- Controls: First `⟨⟨` / Prev `⟨` / Page indicator / Next `⟩` / Last `⟩⟩`
- Page size options: 25, 50, 100 (default 50)
- Shows: `Page {n} of {total} • {totalRows} rows`
- Responsive: On mobile, pagination collapses to Prev/Next only with page indicator centered

#### 3.2.7 Empty States

Two distinct empty states:

| Condition | Message | Action |
|-----------|---------|--------|
| No receipts at all | `No receipts found yet. Receipts are generated automatically when payments are recorded.` | None |
| Filters applied, no matches | `No receipts match your current filters.` | `Clear All` button |

---

## 4. Individual Receipt View (`ReceiptDetail.tsx`)

### 4.1 Route

```
/app/receipts/:id
```

### 4.2 Layout Structure

```
+----------------------------------------------------------+
| <← Back to Receipts    Receipt #RCPT-2026-000123  [Paid] |
|                    [Download PDF] [Email] [⋯]          |
+----------------------------------------------------------+
| STATUS BANNER                                           |
|  "Receipt issued on Sep 24, 2026 to customer@example.com"  |
+----------------------------------------------------------+
| 2-column grid (lg breakpoint)                            |
| ┌──────────────────────┬──────────────────────┐          |
| │ RECEIPT DETAILS      │  PAYMENT DETAILS     │          |
| │                      │                      │          |
| │ Order ID: INV-0123   │  Payment ID: pay_..  │          |
| │ Receipt #: RCPT-...  │  Provider: Stripe     │          |
| │ Date Issued: Sep 24  │  Method: Card ••••4242│          |
| │ Due Date: —          │  Paid on: Sep 24       │          |
| │ Status: Paid         │  Transaction ID: ...  │          |
| │ Currency: USD        │                      │          |
| │                      │                      │          |
| │ Customer:            │  Refund Status:       │          |
| │  Acme Corp           │  None                 │          |
| │  customer@email.com  │  [Request Refund]     │          |
| │  (555) 123-4567      │                      │          |
| └──────────────────────┴──────────────────────┘          |
|                                                          |
| ITEMIZED LIST                                            |
| ┌──────────────────────────────────────────────────────┐ |
| │ Description              Qty   Unit  Tax  Total    │ |
| │ ───────────────────────────────────────────────── │ |
| │ Consulting services      1     $100  8.5% $108.50 │ |
| │ Premium plan (monthly)   1     $50   8.5% $54.25  │ |
| │ ───────────────────────────────────────────────── │ |
| │ Subtotal                             $150.00    │ |
| │ Tax (8.5%)                            $14.83    │ |
| │ Total                                 $150.00   │ |
| │ Paid                                  $150.00   │ |
| │ Balance Due                           $0.00     │ |
| └──────────────────────────────────────────────────┘ |
|                                                          |
| DOCUMENT FOOTER                                          |
|  Invoice #INV-0123 • Generated by InvoiceFlow            |
|  This receipt is issued by Acme Corp.                   |
+----------------------------------------------------------+
```

### 4.3 Detailed Field Specification

#### 4.3.1 Header Bar

| Element | Source | Behavior |
|---------|--------|----------|
| Back arrow + link | — | `<Link to="/app/receipts">` |
| Receipt number | `receipt.receipt_number` | Large title, truncated if long |
| Status badge | `receipt.status` | `PaymentStatus` component with icon + label |

#### 4.3.2 Action Bar (Primary Actions)

| Button | Icon | Behavior |
|--------|------|----------|
| Download PDF | `Download` | Calls `getReceiptPdf(id)`, triggers file download as `receipt-{number}.pdf` |
| Email Receipt | `Mail` | Opens email modal (Section 5.1) |
| More Actions | `MoreVertical` (ellipsis) | Dropdown: Copy details, View in provider, View invoice, Delete (admin only) |

#### 4.3.3 Status Banner

A colored banner below the header indicating the receipt lifecycle state:

| Status | Banner Text | Color |
|--------|------------|-------|
| `issued` | `Receipt issued on {date}.` | Blue/info |
| `sent` | `Receipt emailed to {email} on {date}.` | Green/success |
| `failed` | `Receipt generation failed. Retry or contact support.` | Red/error |

#### 4.3.4 Receipt Details Section (Left Column)

| Field | Label | Source | Format |
|-------|-------|--------|--------|
| Order ID | Invoice | `invoice_id` → link to `/app/invoices/:invoice_id` | Link with invoice number |
| Receipt Number | Receipt # | `receipt_number` | Copyable (click to copy) |
| Issue Date | Date Issued | `issued_at` | `Sep 24, 2026` |
| Due Date | Due Date | `invoice.due_date` | `Sep 24, 2026` or `—` |
| Status | Status | `status` | Badge |
| Currency | Currency | `currency` | ISO code (e.g. `USD`) |
| Notes | Notes | `invoice.notes` | Multi-line text |

#### 4.3.5 Payment Details Section (Right Column)

| Field | Label | Source | Format |
|-------|-------|--------|--------|
| Payment ID | Payment ID | `payment_id` | Truncated UUID |
| Provider | Provider | `provider` | Capitalized (e.g. "Stripe") |
| Method | Payment Method | `payment_method` | e.g. "Card •••• 4242" |
| Amount | Amount Paid | `amount` + `currency` | `$150.00` |
| Paid At | Payment Date | `payment.paid_at` | `Sep 24, 2026, 10:30 AM` |
| Transaction Ref | Provider Ref | `metadata.providerPaymentId` | Monospace font |
| Email Sent To | Sent To | `sent_to` | Email address or `—` |

#### 4.3.6 Itemized List Section

Rendered from the parent invoice's line items (fetched via `getInvoice(invoice_id)`):

```typescript
interface LineItem {
  description: string;
  quantity: string;      // "1"
  unit: string;          // "hour" | "month" | ""
  unit_price: string;    // "100.00"
  tax_rate: string;      // "0.085"
  tax_amount: string;    // "8.50"
  line_total: string;    // "108.50"
  is_tax_inclusive: boolean;
}
```

| Column | Label | Data | Alignment |
|--------|-------|------|-----------|
| Description | — | `item.description` | Left |
| Quantity | Qty | `{quantity} {unit}` | Right |
| Unit Price | Unit | `formatCurrency(unit_price, currency)` | Right |
| Tax | Tax | `formatCurrency(tax_amount, currency)` + rate | Right |
| Line Total | Total | `formatCurrency(line_total, currency)` | Right |

**Totals Table** (right-aligned, below items):

| Row | Label | Source |
|-----|-------|--------|
| Subtotal | Subtotal | `invoice.subtotal` |
| Discount | Discount | `-{invoice.discount_total}` (hidden if 0) |
| Tax | Tax | `invoice.tax_total` |
| Fees | Fees | `invoice.fee_total` (hidden if 0) |
| **Total** | **Total** | `invoice.total` (bold) |
| Paid | Amount Paid | `invoice.amount_paid` |
| **Balance Due** | **Balance Due** | `invoice.amount_due` |

#### 4.3.7 Document Footer

- Text: `Invoice #{invoice_number} • {business_name}`
- `receipt.id` for internal reference
- Generated timestamp

### 4.4 Loading & Error States

| State | UI |
|-------|-----|
| Loading | Centered spinner: `Loading receipt…` |
| 404 / Not Found | `Receipt not found` with back link |
| API Error | Error banner with message and retry button |

### 4.5 Mobile Responsiveness (ReceiptDetail)

- **Breakpoint `lg` (1024px)**: Left/right column grid splits into stacked blocks
- **Action bar**: Buttons collapse to icon-only with tooltips; "More Actions" becomes a bottom sheet on mobile
- **Itemized table**: Becomes a card list where each line item is a card with description on top, totals below
- **Totals table**: Stays right-aligned, font size drops to `text-sm`

---

## 5. User Actions

### 5.1 Email Receipt

**Trigger**: Primary action button in header or action bar

**Modal Flow**:
```
[ Email Receipt ]
──────────────────────────────
Receipt: RCPT-2026-000123
──────────────────────────────
To: [customer@email.com]   (pre-filled from customer_email)
From: [business@email.com]  (pre-filled from business settings, editable)
CC: [                ]    (optional)
Subject: Receipt #RCPT-2026-000123 from {business_name}  (editable)
Message: [Dear {customer_name},  This is your receipt...]  (editable, textarea)

[Cancel] [Send Email]
```

**API Call**: `POST /api/receipts/:id/email` with body `{ email, name?, subject?, message? }`

**Success**: Toast notification `Receipt emailed to {email}` + status updates to "sent"

**Error**: Inline validation errors, e.g., "Invalid email address"

### 5.2 Download PDF

**Trigger**: Download button (header or row action)

**Flow**:
1. Call `getReceiptPdf(receiptId)` → returns Blob
2. `window.URL.createObjectURL(blob)` → `<a download>` click → revoke URL
3. Filename: `receipt-{receipt_number}.pdf` (sanitized)

**Note**: The current implementation (`Receipts.tsx:90-102`) downloads the receipt PDF. If the receipt has a cached PDF, the backend serves it directly from the `pdf_cache` column (`src/index.ts:1191-1202`).

### 5.3 Request Refund

**Trigger**: "Request Refund" button in Payment Details section (right column of detail view) — only visible when:
- Payment status is `paid`/`succeeded` (not `refunded`, `failed`, `partial`)
- Provider supports refunds (currently only Stripe has webhook handling at `src/services/payments/invoice-payment-service.ts:210`)

**Modal Flow**:
```
[ Request Refund ]
──────────────────────────────
Receipt: RCPT-2026-000123
Amount Paid: $150.00
──────────────────────────────
Refund Amount: [$150.00]  [Refund Full Amount]
Reason (optional):
[_____________________________________]
[text area, 3 lines]

[ Cancel ] [ Request Refund ]
```

**Validation Rules**:
- Refund amount ≤ original payment amount
- Must not exceed available balance
- If full amount → payment status becomes `refunded`; if partial → `partially_refunded`
- Triggers backend `POST /api/invoices/:invoice_id/refunds` (not currently implemented — **backend task required**)

**Backend Context**: The `InvoiceService.refundPayment` method (`src/services/invoice-service.ts:634`) handles the core refund logic including idempotency, payment status updates, invoice status transitions, and event recording. However, there is **no existing HTTP route** for this endpoint. The frontend should call a to-be-implemented `POST /api/invoices/:id/refund` endpoint.

### 5.4 Copy Receipt Details

**Trigger**: Dropdown action in detail view header

**Options**:
- Copy receipt number to clipboard
- Copy receipt details as formatted text (for pasting into support tickets)
- Copy receipt data as JSON (developers)

### 5.5 View in Provider

**Trigger**: Dropdown action or row action in dashboard

**Condition**: Only shown if `provider_receipt_url` is present

**Behavior**: Opens `provider_receipt_url` in a new tab (`target="_blank" rel="noopener noreferrer"`)

### 5.6 View Associated Invoice

**Trigger**: Dropdown action or link in detail view

**Behavior**: Navigate to `/app/invoices/:invoice_id` in the same tab

### 5.7 Generate Receipt for Invoice

**Trigger**: Button in Invoice Detail page (already exists in `InvoiceDetail.tsx:261-268`)

**Flow**:
1. Call `POST /api/invoices/:id/receipts`
2. If no payment found → error: "No payment found for this invoice"
3. On success → redirect to `/app/receipts/:receiptId`

---

## 6. Component Reference

All components follow existing patterns from the codebase:

| Component | Location | Used By |
|-----------|----------|---------|
| `DataTable` | `webapp/src/components/ui/DataTable.tsx` | Dashboard list |
| `PaymentStatus` | `webapp/src/components/ui/PaymentStatus.tsx` | Status badges |
| `PageHeader` | `webapp/src/components/ui/PageHeader.tsx` | Page header |
| `Button` | `webapp/src/components/ui/Button.tsx` | All buttons |
| `EmptyState` | `webapp/src/components/ui/EmptyState.tsx` | Empty states |
| `ConfirmationDialog` | `webapp/src/components/ui/ConfirmationDialog.tsx` | Destructive actions |
| `Toast` / `useToast` | `webapp/src/components/ui/Toast.tsx` | Notifications |
| `useDebouncedCallback` | `webapp/src/hooks/useDebouncedCallback.ts` | Search input |
| `formatCurrency` | `webapp/src/utils/format.ts` | Currency display |
| `formatCurrencyValue` | `webapp/src/lib/utils.ts` | Currency display (cached Intl) |
| `Layout` | `webapp/src/components/Layout.tsx` | App layout + nav |

### 6.1 Theme Tokens

All components use CSS variables for theming (dark/light mode):

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `text-primary` | `#1a1a1a` | `#f8fafc` |
| `text-secondary` | `#64748b` | `#94a3b8` |
| `text-tertiary` | `#94a3b8` | `#64748b` |
| `bg-surface` | `#ffffff` | `#0f172a` |
| `bg-surface-alt` | `#f8fafc` | `#1e293b` |
| `border-color` | `#e2e8f0` | `#334155` |
| `bg-primary-action` | `#3b82f6` | `#3b82f6` |
| `text-on-primary` | `#ffffff` | `#ffffff` |
| `status-success-bg` | `#dcfce7` | `#145b2f` |
| `status-success-text` | `#15803d` | `#86efac` |
| `status-error-bg` | `#fee2e2` | `#7f1d1d` |
| `status-error-text` | `#b91c1c` | `#fca5a5` |
| `status-info-bg` | `#dbeafe` | `#1e3a8a` |
| `status-info-text` | `#2563eb` | `#93c5fd` |
| `status-warning-bg` | `#fef3c7` | `#78350f` |
| `status-warning-text` | `#d97706` | `#fbbf24` |

---

## 7. Mobile Responsiveness

### 7.1 Breakpoints

| Name | Min Width | Usage |
|------|-----------|-------|
| (mobile default) | — | `< 768px` |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Wide desktop |

### 7.2 Mobile-Specific Adaptations

#### Dashboard Page
- **Filter bar**: Becomes a single-column stack. Search input takes full width. Status/provider/date collapse into a compact 2-column grid.
- **Table**: Hidden on mobile below `md`. Replaced with a **card-list layout** where each receipt is a touch-friendly card:
  - Top row: Receipt number (bold) + Amount (right-aligned)
  - Middle: Invoice number + Customer name
  - Bottom row: Status badge + Action buttons (View, Download, More)
- **Pagination**: Compact Prev/Next with page indicator only (no First/Last buttons, no page-size dropdown)
- **Action buttons**: Row actions use larger tap targets (44×44px minimum per WCAG)

#### Detail Page
- **Two-column grid**: Stacks into single column
- **Action bar**: Primary actions (Download, Email) remain visible. "More Actions" (ellipsis) moves to a bottom-anchored sheet that slides up from the bottom
- **Itemized table**: Converts to stacked cards per line item:
  ```
  ┌─────────────────────────────┐
  │ Description: Consulting...  │
  │ Qty: 1    Unit: $100.00     │
  │ Tax: 8.5% ($8.50)           │
  │ Total: $108.50              │
  └─────────────────────────────┘
  ```
- **Totals table**: Remains as a table but with smaller font (`text-sm`)

#### Touch Targets
All interactive elements meet minimum 44×44px on mobile:
- Buttons: `min-h-[44px]` (enforced via `Button` component's `sizeClasses`)
- Row action icons: Wrapped in 44×44px containers
- Filter dropdowns: Full-width on mobile

### 7.3 Bottom Tab Bar Integration

The `BottomTabBar` (`webapp/src/components/BottomTabBar.tsx`) currently has 4 items. Receipts is accessible via the hamburger menu. No change needed — Receipts is not a primary navigation item on mobile.

---

## 8. API Client Extensions Needed

The following API client functions need to be added to `webapp/src/api/client.ts`:

```typescript
// Email a receipt to a customer
export async function emailReceipt(
  receiptId: string,
  data: { email: string; name?: string; subject?: string; message?: string }
) {
  const res = await api.post(`/receipts/${receiptId}/email`, data);
  return res.data;
}

// Request a refund for a receipt's underlying payment
export async function requestReceiptRefund(
  receiptId: string,
  data: { amount: string; reason?: string }
) {
  const res = await api.post(`/receipts/${receiptId}/refund`, data);
  return res.data;
}

// Fetch invoice details associated with a receipt (for itemized list)
export interface ReceiptDetail {
  id: string;
  invoice_id: string;
  receipt_number: string;
  amount: string;
  currency: string;
  status: string;
  provider: string;
  payment_method: string | null;
  issued_at: string | null;
  sent_to: string | null;
  invoice_number: string | null;
  invoice_status: string;
  invoice_due_date: string | null;
  invoice_total: string;
  invoice_amount_paid: string;
  invoice_amount_due: string;
  invoice_subtotal: string;
  invoice_tax_total: string;
  invoice_discount_total: string;
  invoice_fee_total: string;
  customer_name: string | null;
  customer_email: string | null;
  business_name: string;
  business_email: string | null;
  business_phone: string | null;
  items: Array<{
    description: string;
    quantity: string;
    unit: string;
    unit_price: string;
    tax_rate: string;
    tax_amount: string;
    line_total: string;
  }>;
  provider_payment_id: string | null;
  payment_paid_at: string | null;
}

export async function getReceiptDetail(receiptId: string): Promise<ReceiptDetail> {
  const res = await api.get(`/receipts/${receiptId}/detail`);
  return res.data;
}
```

**Backend additions needed** (in `src/index.ts`):
1. `POST /api/receipts/:id/email` — already exists (line 1204) but needs to accept `subject`/`message` overrides
2. `POST /api/receipts/:id/refund` — new endpoint calling `InvoiceService.refundPayment`
3. `GET /api/receipts/:id/detail` — new endpoint returning enriched receipt + invoice + payment + items data

---

## 9. Testing Strategy

### 9.1 Frontend Tests (Vitest + React Testing Library)

File: `webapp/src/__tests__/receipts.test.tsx`

| Test | Description |
|------|-------------|
| `renders receipts list` | Mock API, verify table rows display receipt data |
| `filters by status` | Select "Paid" filter, verify API called with correct params |
| `searches with debounce` | Type in search, verify API not called until 300ms passes |
| `clears filters` | Apply filters, click "Clear All", verify state resets |
| `downloads PDF` | Click download button, verify `getReceiptPdf` called and blob URL created |
| `paginates correctly` | Click Next/Prev, verify page state changes |

### 9.2 Backend Tests (Vitest)

File: `tests/receipts.test.ts`

| Test | Description |
|------|-------------|
| `listResponse returns receipts` | Verify pagination, filtering, sorting |
| `getResponse returns receipt detail` | Verify joined data (invoice, customer, business) |
| `generatePdfWithMeta caches PDF` | Verify PDF cache hit/miss logic |
| `sendReceiptEmail sends with attachment` | Mock email service, verify call |
| `issueReceipt is idempotent` | Call twice with same payment, verify single receipt |

---

## 10. Implementation Roadmap

### Phase 1: Dashboard Enhancement
- Add sort controls (dropdown + sortable columns)
- Add customer filter (advanced)
- Add card-list view for mobile
- Improve row actions (email, more actions dropdown)
- Add toast notifications

### Phase 2: Receipt Detail View (New Page)
- Create `ReceiptDetail.tsx` page
- Add route `/app/receipts/:id`
- Implement two-column layout with itemized list
- Add email modal, refund modal, copy details

### Phase 3: Backend Extensions
- Add `POST /api/receipts/:id/refund` endpoint
- Add `GET /api/receipts/:id/detail` endpoint
- Extend `POST /api/receipts/:id/email` to accept custom subject/message

### Phase 4: Mobile Polish
- Card-list layout for dashboard
- Bottom sheet for detail page actions
- Touch target audit (44×44px minimum)
