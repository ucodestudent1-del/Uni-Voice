# Invoice Lifecycle Redesign Plan

## Summary
Redesign the UI to center on the invoice lifecycle (Draft → Sent → Viewed → Paid / Overdue) rather than database objects, per the user's vision.

## Phase 1: Fix Technical Debt (AGENTS.md remaining work)

### 1. Remove duplicate `/api/reports/aging` route
- Backend `src/index.ts` has two `/api/reports/aging` routes (lines 1676 and 1785). Express uses the first match. The second (line 1785) is dead code that requires `reports.aging` entitlement.
- **Action**: Remove the duplicate at line 1785, keep the one at 1676.

### 2. Remove unused API client functions
- `setInvoiceItems` (client.ts:263) and `setInvoiceFees` (client.ts:269) are defined but never imported/used anywhere.
- **Action**: Delete both functions.

## Phase 2: New Shared Components

### 3. `InvoiceLifecycle` component (`components/ui/InvoiceLifecycle.tsx`)
- Visual pipeline: Draft → Sent → Viewed → Paid, with alternate states (Overdue, Cancelled, Void)
- Shows current status as filled dot, others as hollow, with connecting line
- Contextual color per status (success/info/warning/error)
- Shows status description on hover
- **File**: `webapp/src/components/ui/InvoiceLifecycle.tsx`

### 4. Export from `ui/index.ts`
- Add `InvoiceLifecycle` to the shared UI barrel export

## Phase 3: Dashboard Redesign (User vision §2, §14)

### 5. Redesign `Dashboard.tsx`
- **Top**: "Good morning" greeting + prominent `+ Create invoice` button
- **KPI cards row** (3 cards, not 5): Outstanding | Overdue | Paid this month — with invoice counts
- **"Needs attention" section** (prominent, near top):
  - Overdue invoices with `⚠` + "Send reminder →" action
  - Draft invoices with `○` + "Continue →" action
  - Each item is a link to the invoice
- **Recent invoices table** (simplified, no giant chart)
- Remove the dominant RevenueChart — move it to be a secondary small element, not the centerpiece
- Use `<Link>` to `/app/invoices/new` for the primary action

## Phase 4: Invoice Detail Redesign (User vision §7, §8)

### 6. Redesign `InvoiceDetail.tsx`
- **Invoice first**: Large invoice display at top (InvoiceDetailView)
- **Lifecycle pipeline** below the invoice header showing Draft → Sent → Viewed → Paid
- **Contextual actions** that change by state:
  - Draft: `[Edit] [Send invoice →]`
  - Sent: `[Send reminder] [Record payment] [⋯]`
  - Overdue: `⚠ $X is N days overdue` + `[Send reminder] [Record payment]`
  - Paid: `✓ Paid` with date and amount
- Move the 6 summary cards from the right sidebar into the main invoice view as a clean totals table
- Activity timeline stays at the bottom
- Payment history below activity

## Phase 5: Customer Detail Redesign (User vision §9)

### 7. Redesign `CustomerDetail.tsx`
- **Money first**: Put financial summary (Outstanding, Paid lifetime, Average payment days) at the very top, above contact info
- Add `+ Create Invoice` as primary action in header
- Show invoice list directly below the financial summary
- Keep contact info as a secondary section

## Phase 6: Wire Up

### 8. Update Dashboard to use InvoiceLifecycle
- Replace `InvoiceStatus` badge with `InvoiceLifecycle` in dashboard tables where appropriate

### 9. Update InvoiceDetail to use InvoiceLifecycle
- Replace status badges with lifecycle visualization

## Out of Scope (for now)
- Split-screen Create Invoice with live preview (InvoiceWorkspace already has preview)
- Keyboard-first line items (already supported in InvoiceWorkspace)
- Send-as-checkout modal (would require backend email service changes)
- Three-layer architecture (navigation already has this structure)
- PDF template redesign (separate concern)
