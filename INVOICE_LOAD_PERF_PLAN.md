# Invoice Section Load Performance — Investigation & Fix Plan

## Executive Summary

Users report the **invoice section of the website is struggling to load**.
Root-cause analysis (backend `tsc` typecheck + frontend `tsc` typecheck both
**pass**; `customer.repo.ts` no longer has the duplicate-method build break from
the prior plan) confirms the problem is **runtime/perf on the load path, not a
compile error**.

The existing `OPTIMIZATION_PLAN.md` already optimized the *computation* layer
(`calculation.ts`, `currency.ts`, `template-renderer.ts`, `snapshot-service.ts`,
dashboard SQL aggregation, batch repo inserts, migration 018 indexes). Those are
verified in place. The remaining gaps that actually dominate **perceived load
time** of the invoice section are on the **frontend data-fetching / re-render
path** and a few **leftover backend round-trips on single-invoice fetch**.

---

## Findings — Root Causes

### Frontend (highest user-visible impact)

| # | Where | Evidence | Impact |
|---|-------|----------|--------|
| F1 | `webapp/src/components/InvoiceWorkspace.tsx:347-352` | Mount loads `getBusiness()`, `getBusinessSettings()`, `getCustomers({limit:500})`, `getProducts({limit:200})` in parallel — all fired on every invoice editor open, but most are only needed for selectors/preview | Large JSON transfer + parse on every open; 500 customers parsed even when the dropdown is never opened |
| F2 | `webapp/src/components/CustomerSelector.tsx:28` | `loadCustomers({})` on mount with no `limit` (repo default 50); the editor *also* has its own `customers` state from F1 → **customers fetched twice**, once per editor open and once per CustomerSelector mount | Duplicate network round-trips + double parse |
| F3 | `webapp/src/utils/format.ts:6-11` and `webapp/src/lib/utils.ts:29-34` | `formatCurrency` / `formatCurrencyValue` create a **new `Intl.NumberFormat`** instance on every call (no cache). Called per cell in the invoices table, line-item table, detail totals, dashboard KPIs | Heavy GC / main-thread churn on every render of any invoice list/detail/dashboard |
| F4 | `webapp/src/components/InvoiceWorkspace.tsx:304-332` + `webapp/src/hooks/useInvoiceValidation.ts:278-294` | An **inline object literal** (`invoice.items.map(...)`) is passed as `data` to `useInvoiceValidation`, so its `useMemo([data])` **never memoizes** (new ref every render). `validateInvoice` → `checkCalculations` → `calculationEngine.calculate()` therefore runs on **every render**, in addition to the `calc` `useMemo` (`InvoiceWorkspace.tsx:334-341`) which also runs calc. | Calculation engine effectively runs **twice per render**; blocks main thread on large invoices |
| F5 | `webapp/src/pages/Invoices.tsx:89-125` | `currentParams` is a `useMemo` keyed on every individual filter string state; typing in Search / changing a filter recreates it and the `useEffect([currentParams, loadInvoices])` fires an **immediate refetch per keystroke** (no debounce) | Janky list re-fetch; each keystroke → request |
| F6 | `webapp/src/components/InvoiceWorkspace.tsx:504-543` (doSave) and `:816-853` (handleFinalizeAndSend) | Autosave issues 3 sequential calls (`updateInvoice` + `setInvoiceItems` + `setInvoiceFees`); the finalize+send flow does `finalizeInvoice` → `getInvoice` → `sendInvoice` → `getInvoice` (two refreshes) | Extra round-trips during save/send, compounding load perception |

### Backend (single-invoice fetch path)

| # | Where | Evidence | Impact |
|---|-------|----------|--------|
| B1 | `src/repositories/invoice.repo.ts:286-295` (`findById`) | 3 separate queries: `SELECT * FROM invoices`, then `invoice_items`, then `invoice_fees` (parallelized with `Promise.all`, but still 3 round-trips + `SELECT *`) | 3 DB round-trips per `GET /api/invoices/:id`; `SELECT *` over-fetches |
| B2 | `src/services/invoice-service.ts:90` (`buildCalculationInput`) | Marked `async` but contains no `await`/async work; called from `recalculate` (`InvoiceService.ts:222-225`) | Unnecessary Promise allocation on every draft recalculation |
| B3 | `src/services/invoice-service.ts:199-220` (`getInvoice`) | For non-finalized (draft) invoices, the **full calculation engine** runs server-side on every GET; no cached totals for drafts | Latency on every draft load in the editor |
| B4 | `src/index.ts:861-904` (`/api/invoices` list) | Per-row 40-field `.map()` with `instanceof Date` checks + `String()` coercions (the response is also re-shapes all columns) | CPU per row; widens the wire payload with fields the UI doesn't need |
| B5 | `src/index.ts:1004` + `src/repositories/invoice.repo.ts:485-496` (`findForDashboard`) | `/api/dashboard/enhanced` loads **500 full rows (`SELECT *`)** then 4 JS passes with Decimal math — **already optimized away** for `/api/dashboard` (used by the active Dashboard page) but **left as dead/latent code** | Latent landmine: anyone hits `/api/dashboard/enhanced` → very slow |
| B6 | `src/db/migrations/018_invoice_perf_indexes.sql` | Adds `(business_id,status)`, `(business_id,status,due_date)`, event/snapshot/payment indexes, but the `invoice_items`/`invoice_fees` indexes are single-column `(invoice_id)` — the `ORDER BY sort_order` in `findById` has no supporting index | Sort per invoice fetch; minor but trivially fixable |

### Environment / process state

- **Large uncommitted redesign** in the working tree (~97 files, ~3100 insertions): a frontend-wide refactor touching `DocumentEditor.tsx`, `ComponentPalette.tsx`, `registry/components.tsx` (388-line diff), new `webapp/src/components/primitives/`, new `webapp/src/lib/utils.ts`, new `webapp/src/pages/Payments.tsx`, and a redesigned `Dashboard.tsx`/`InvoiceWorkspace.tsx`. Both `tsc` checks pass, so it isn't a compile failure — but it confirms the codebase is mid-flight, which is why perf regressions surface at runtime rather than through type/lint.

---

## Fix Plan (priority order)

### P0 — Stop the double calculation on every editor render (F4)
1. In `InvoiceWorkspace.tsx`, memoize the `data` passed to `useInvoiceValidation`
   behind its own stable reference (e.g. `useMemo` over `[invoice]`) instead of
   an inline object literal, OR have `useInvoiceValidation` accept the raw
   `invoice` + a selector. Goal: `validateInvoice`/`calculationEngine` should
   run at most once per `invoice` change, not once per render.
2. **Dedupe** the two calculation runs: reuse the `calc` result inside validation
   instead of re-invoking `calculationEngine.calculate` in `checkCalculations`,
   passing the already-computed `CalculationResult`.

### P0 — Cache `Intl.NumberFormat` on the frontend (F3)
1. Port the backend's caching pattern (`currency.ts`: `numberFormatters` Map +
   `metadataCache`) to the frontend. Replace the inline `new Intl.NumberFormat`
   in `format.ts:6` and `lib/utils.ts:29` with a cached factory keyed by
   `locale:currency:dp`.
2. Make `formatCurrencyValue` (new `lib/utils.ts`) and `formatCurrency`
   (`utils/format.ts`) share one cached factory so both code paths benefit.

### P1 — Reduce editor mount fetches (F1, F2)
1. Make customer/product loading **lazy**: load the customer list only when the
   selector is opened, and cap it (e.g. `limit: 100`); load products the same way.
   Replace the "load 500 customers on editor mount" in `InvoiceWorkspace.tsx:347`
   with an on-demand search.
2. Have `CustomerSelector` accept an externally-loaded list (injected from the
   workspace) instead of each instance fetching its own, removing the
   double-fetch (F2).
3. Keep the selected customer lookup (`getCustomer(id)`) — that one is needed.

### P1 — Fix list refetch-on-keystroke (F5)
1. Debounce the invoice-list search/filter params (300ms) before updating
   `currentParams`, so typing no longer fires a request per keystroke.

### P1 — Collapse single-invoice fetch to one query (B1)
1. Rewrite `InvoiceRepository.findById` to use a single `SELECT ... FROM invoices
   i LEFT JOIN invoice_items ... LEFT JOIN invoice_fees ...` (or a CTE) returning
   invoice + items + fees in one round-trip. Keep the 3-way shape on the model,
   but eliminate the 2 extra queries. Add `(invoice_id, sort_order)` indexes on
   `invoice_items`/`invoice_fees` (B6).

### P1 — Remove the `async` wrapper (B2) and avoid draft recalculation cost (B3)
1. De-`async` `buildCalculationInput` (remove the pointless Promise).
2. Guard `recalculate` for drafts: only recompute when line items/fees have
   changed since the last computed totals (store a lightweight dirty flag on the
   draft row); otherwise reuse persisted totals. (Lightweight — don't over-engineer.)

### P2 — Trim the list endpoint payload (B4)
1. Stop returning the full 40-field shape from `/api/invoices`; project only the
   columns the UI actually uses (the page references `invoice_number, customer_id,
   customer_name, customer_email, status, total, amount_due, amount_paid,
   issue_date, due_date, currency, deposit_amount, deposit_due_date, paid_at,
   sent_at, invoice_id`). A narrower explicit column list + one pass removes the
   `instanceof Date`/coercion churn.
2. Reuse the `rowToModel`-to-API transform for `findManyPage` and `findMany`
   (currently duplicated filter logic, per OPTIMIZATION_PLAN).

### P2 — Kill the latent 500-row dashboard path (B5)
1. Delete `findForDashboard` and `/api/dashboard/enhanced`, or migrate them to
   the already-optimized `getDashboardSummary` + `findRecentlyPaid` +
   `findRequiringAttention` SQL aggregation. The active Dashboard page already
   uses the optimized `/api/dashboard`, so this is cleanup/removal.

### P3 — Consolidate write-path round-trips (F6)
1. Autosave: batch `updateInvoice` + `setInvoiceItems` + `setInvoiceFees` into a
   single transactional endpoint (`PUT /api/invoices/:id` with items+fees), or at
   minimum issue them concurrently where safe.
2. `handleFinalizeAndSend`: drop the redundant second `getInvoice()` after send —
   the invoice is already finalized+sent; the single post-send refresh is
   sufficient. (The pre-send refresh after finalize is arguably still needed for
   the number/public token, so keep one.)

---

## Verification

Per `AGENTS.md`, run after each change set:

```bash
# Backend
npm run typecheck      # tsc -p tsconfig.typecheck.json  (already passing)
npm run lint           # eslint src --ext .ts
npm run test           # vitest run  (needs DB — see tests/global-setup.ts)

# Frontend
cd webapp && npm run typecheck
cd webapp && npm run lint
cd webapp && npx vitest
```

**Manual regression checks:**
- Open `/app/invoices` — list loads; type in Search, confirm no request per keystroke.
- Open `/app/invoices/:id/edit` (existing draft) — editor renders; open customer
  selector — single customer fetch; confirm `useInvoiceValidation`/calc no longer
  double-runs (DevTools Profiler: `InvoiceWorkspace` render time drops;
  `calculationEngine.calculate` call count halves in the validation slice).
- Open `/app/invoices/:id` — detail loads; confirm network tab shows 1 request to
  `/api/invoices/:id` (was effectively 3 DB queries, now 1).
- Render an invoice with ~50 line items in the detail view — confirm frame timing
  improves after the `Intl.NumberFormat` cache lands.

---

## Non-goals (out of scope for this plan)

- The three-panel structured **document-model editor** (`DocumentEditor.tsx`,
  `InvoiceEditor.tsx`) is a separate feature surface from the legacy
  `InvoiceWorkspace` editor; its perf (e.g. `querySelectorAll` on drag in
  `DocumentEditor.tsx`) is not the focus here unless profiling points at it.
- The large uncommitted frontend redesign should be committed/reviewed as a
  separate concern; this plan assumes the working-tree code as the current
  baseline.
