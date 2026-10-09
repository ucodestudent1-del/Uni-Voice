# Plan: Polish Quote/Credit-Note Detail UI + Invoice Action Consistency

## Context

Three design plans exist (`REDESIGN_PLAN.md`, `QUOTE_REDESIGN_PLAN.md`,
`credit-notes-ui-restructuring-plan.md`) plus `PRD_Invoice_Interface.md`.
A re-audit of the working tree shows the bulk of the redesign is **already
implemented**. This plan scopes the remaining work precisely.

## Verified: Already Done

| Item | Evidence |
|---|---|
| `InvoiceLifecycle` + `InvoiceDisplay` + `InvoiceDetailView` | `webapp/src/components/ui/InvoiceLifecycle.tsx`, `InvoiceDisplay.tsx` |
| Dashboard redesign (3 KPIs, Needs Attention, lifecycle) | `webapp/src/pages/Dashboard.tsx:204-279` |
| CustomerDetail financial summary + Create Invoice | `webapp/src/pages/CustomerDetail.tsx:252` |
| InvoiceDetail: CustomerBilling, lifecycle, payment history, activity timeline, contextual action panel, dialogs | `webapp/src/pages/InvoiceDetail.tsx:234-499` |
| InvoiceWorkspace: memoized calc, optimistic finalize/send, single PATCH autosave, empty-state, AI input | `InvoiceWorkspace.tsx:368-411, 1147-1177` |
| CreditNoteLifecycle + CreditNoteInvoiceLink + CreditNoteApplicationStatus + ApplyCreditNoteDialog | `webapp/src/pages/CreditNoteDetail.tsx:22-32` |
| `QuotePreviewV2` component (1049 lines) | `webapp/src/components/QuotePreviewV2.tsx` |
| `DEFAULT_QUOTE_TEMPLATE` (dedicated quote layout) | `src/services/templates/template-renderer.ts:268-597` |
| Backend report endpoints (single definitions) | `src/index.ts:1737-1763` |

## Remaining Gaps (verified in code)

### G1 — QuoteDetail renders a crude inline layout instead of QuotePreviewV2
`webapp/src/pages/QuoteDetail.tsx:169-199` builds the quote body with plain
`<div className="flex justify-between">` rows and a basic totals card. It does
not use the existing `QuotePreviewV2` component, so the quote detail page looks
unpolished and inconsistent with invoice/credit-note detail pages.

### G2 — NOT a defect (path-alias is codebase-wide convention)
`@/` is used pervasively across the codebase (contexts, pages, `ui/`,
`components/`, utils — 100+ usages). It is the dominant convention. The only
internal inconsistency is `useQuoteBuilder.ts:15` mixing `../../` (for api,
utils, hooks, types) with `@/components/ui/PaymentTermsField`. Not worth
converting — would be churn, not an improvement. **Dropped from plan.**

### G3 — Quote PDF template missing deposit callout and acceptance block
`template-renderer.ts:501-587` (Financial Summary + Terms sections) has no
"Deposit Required" row and no signature/acceptance block, despite
`QUOTE_REDESIGN_PLAN.md` calling both out as primary.

### G4 — CreditNotePreview missing prominent audit fields
`webapp/src/components/CreditNotePreview.tsx` has a `PreviewApplication`
interface and a metadata panel, but the reference invoice link, reason, and
application method are not surfaced prominently — the audit trail the
credit-note plan prioritizes.

### G5 — InvoiceDetail action buttons use raw `<button>` instead of `Button`
`webapp/src/pages/InvoiceDetail.tsx:311-369` renders Edit / Duplicate / Download
PDF / Generate Receipt / Send Reminder / Cancel / Void / Record Deposit as bare
`<button>` elements with hand-written classes, while the rest of the app uses the
shared `Button` component. Inconsistent styling and no `min-h-[44px]` on mobile.

## Plan

### Phase 1 — Wire QuoteDetail to QuotePreviewV2 (G1)
1. In `QuoteDetail.tsx`, replace the inline layout at `:169-247` with
   `<QuotePreviewV2 quote={previewQuote} />` (built by `buildPreviewQuote`).
2. In `loadQuote`, fetch `getBusiness` + `getCustomer` in parallel with
   `getQuoteById` / `getQuoteEvents`.
3. Memoize the `PreviewQuote` via `useMemo` over `[quote, business, customer]`.

### Phase 2 — Extend quote PDF template (G3)
1. Add a "Deposit Required" row to the Financial Summary table in
   `template-renderer.ts` when `depositValue > 0` (rendered before the
   Estimated Total row).
2. Add an Acceptance section (signature line + electronic accept/reject note)
   before the footer, gated on `isFinalized`.

### Phase 3 — Strengthen CreditNotePreview (G4)
1. Prominently render `referenceInvoiceNumber` as a linked card at the top of
   the metadata panel.
2. Render `reason` as a labeled audit field.
3. Render `applications` with method labels (reuse `getApplicationMethod` from
   `CreditNoteApplicationStatus`).

### Phase 4 — Standardize InvoiceDetail action buttons (G5)
1. Replace the bare `<button>` elements at `InvoiceDetail.tsx:311-369` with the
   shared `Button` component, preserving existing visibility conditions.
2. Keep the orange "Record Deposit" button as a `Button` variant.

### Phase 5 — Validation
- `cd webapp && npm run typecheck`
- `cd webapp && npm run lint`
- Manual: open `/app/quotes/:id`, `/app/credit-notes/:id`, `/app/invoices/:id`,
  download quote PDF, test each empty/zero/loading state.

## Out of Scope
- Backend changes (all endpoints exist).
- Performance refactors (separate plan).
- Re-redesigning already-completed pages.