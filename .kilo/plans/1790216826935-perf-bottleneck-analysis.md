# Performance Bottleneck Analysis — Invoice, Reports, Receipts, and Quotes

## Executive Summary

Two prior optimization plans exist in the repo root (`OPTIMIZATION_PLAN.md` targeting the backend computation layer, and `INVOICE_LOAD_PERF_PLAN.md` targeting the invoice editor/frontend load path). Both are **largely implemented** — `tsc` typecheck passes, `tsc` typecheck passes for frontend, and the identified fixes (cached `Intl.NumberFormat`, single-query `findById` with JSON subqueries, synchronous `buildCalculationInput`, reduced customer fetch from 500→100, lazy `CustomerSelector`, template-cache in Handlebars, batch INSERTs, SQL-based dashboard aggregation) are confirmed present in the working tree.

However, the user reports high latency persists across **invoice, reports, receipts, and quotes** sections. This analysis identifies the **remaining root causes** not yet addressed by the two existing plans, organized by user-visible surface area. Each finding is backed by concrete code evidence.

---

## Verified Status of Prior Plans

| Prior-plan item | Status in code | Evidence |
|---|---|---|
| Intl.NumberFormat cache (F3) | ✅ Implemented | `webapp/src/utils/format.ts:5-20`, `webapp/src/lib/utils.ts:23-48` |
| Double calc in editor (F4) | ✅ Implemented | `InvoiceWorkspace.tsx:317-347` (memoized) + `useInvoiceValidation.ts:284-304` (accepts `predefinedCalc`) |
| `findById` 3→1 round-trip (B1) | ✅ Implemented | `invoice.repo.ts:287-312` (single query w/ JSON subqueries) |
| `buildCalculationInput` async→sync (B2) | ✅ Implemented | `invoice-service.ts:92` (no `async`) |
| Customer fetch 500→100 (F1) | ✅ Implemented | `InvoiceWorkspace.tsx:362` (`{limit:100}`) |
| CustomerSelector lazy-load (F2) | ✅ Implemented | `CustomerSelector.tsx` loads on open |
| Keystroke debounce (F5) | ✅ Implemented | `useDebouncedCallback.ts` (300ms) |
| Dead `findForDashboard` removed (B5) | ✅ Implemented | No references found |
| Draft recalculation guard (B3) | 🟡 **NOT implemented** | `getInvoice` still calls `recalculate` on every draft GET (see R5) |
| List endpoint payload trim (B4) | 🟡 **NOT implemented** | `/api/invoices` still returns 40 fields (see R2) |

---

## Findings — Remaining Bottlenecks

### Reports Section (highest new-found impact)

| # | Where | Evidence | Impact |
|---|---|---|---|
| R1 | **`ReportSection.tsx:37-42`** | Loads 4 API calls in parallel on mount: `getVolumeTrendReport`, `getPaymentMetricsReport`, `getEnhancedDashboard`, `getInvoices({limit:50})`. Then `MonthlyTrendChart.tsx:43` **re-fetches** `getVolumeTrendReport` again (duplicate of call #1 from ReportSection). | Wasted duplicate network request + server-side recomputation; the dashboard endpoint already returns `volumeTrend` but the chart ignores it. |
| R2 | **`getAgingReport` / `getPaymentMetricsReport` client fns** (`client.ts:1113,1118`) | These hit `/api/reports/aging` and `/api/reports/payment-metrics` — **endpoints do not exist** in `src/index.ts` (grep confirms no route handlers). The `.catch(() => ({ paymentMetrics: null }))` at `ReportSection.tsx:39` swallows 404s silently, but the UI then has **no aging/payment-metrics data** and falls back to incomplete state. | Hidden failures, wasted round-trips, and `ReportSection` can't compute KPIs like avg payment days / collection rate. |
| R3 | **`/api/reports/revenue` route** (`src/index.ts:1201-1214`) | Returns raw DB rows (`result.rows`) without transformation. `Reports.tsx:137` then calls `formatCurrency(r.total_amount, "USD")` per row — `formatCurrency` in `webapp/src/utils/format.ts:22-27` constructs a **new `Decimal` and calls `.toNumber()`** on every invocation, even though the backend already returns numeric sums. Also **hardcodes "USD"** instead of using the business's default currency. | Per-row Decimal allocation on the client; wrong currency for multi-currency businesses. |
| R4 | **`/api/dashboard/enhanced` route** (`src/index.ts:1260-1301`) | Calls 4 repository methods in `Promise.all` (`getDashboardSummary`, `getAgingBuckets`, `getVolumeTrend`, `getPaymentMetrics`). Each does a **full-table scan** of invoices (`FROM invoices WHERE business_id = $1` with no status filter), and `findRecentlyPaid`/`findRequiringAttention` use `SELECT i.*` (over-fetching all 40+ columns). The `/api/reports/volume-trend` endpoint (`src/index.ts:1231-1255`) also does a full scan with `COALESCE(issue_date, created_at)` in the GROUP BY, which **prevents index usage**. | Full-table scans on every dashboard/revenue-tab load; `SELECT *` bloats payload. |
| R5 | **ReportSection KPI computation** (`ReportSection.tsx:62-83`) | `kpis` `useMemo` computes `totalRevenue` by **re-summing** `volumeTrend` with `new Decimal()` per entry — but the backend `/api/dashboard/enhanced` already returns `summary.totalRevenue`. The `computeChurnRate` function (`ReportSection.tsx:217-230`) uses `customer_email` as a proxy for customer identity — semantically incorrect and produces wrong churn numbers when customers share an email domain. | Redundant client-side decimal math; incorrect business metric. |

### Receipts Section

| # | Where | Evidence | Impact |
|---|---|---|---|
| RC1 | **`/api/receipts/:id/pdf` route** (`src/index.ts:1147-1154`) | On every PDF request: calls `receiptService.getById` (1 query), then `receiptService.generatePdf(receipt.id)` which runs a **second full SQL query** joining receipts→invoices→businesses (see `receipt-service.ts:284-293`), then calls `receiptRepository.storePdf` (a third query) to persist the PDF back. PDF generation via Puppeteer is CPU-bound and blocks the request. | 3 DB round-trips + Puppeteer render on every PDF open; `getById` is redundant since `generatePdf` re-fetches the same receipt. |
| RC2 | **`ReceiptService.renderReceipt`** (`receipt-service.ts:325-328`) | Calls `Handlebars.compile(RECEIPT_TEMPLATE, ...)` on **every** render — the template is a `const` string, so it's recompiled every time. Contrast: `template-renderer.ts:126-133` has a `templateCache` Map for the main invoice template but the receipt template bypasses it. | Unnecessary template compilation on every receipt PDF / email. |
| RC3 | **`/api/receipts` list route** (`src/index.ts:1125-1139`) | Calls `receiptService.listResponse` → `receiptRepository.findManyWithDetailsAndCount` which does `SELECT r.*, i.invoice_number, i.currency, i.customer_id, c.name, c.email, b.name, COUNT(*) OVER()`. The `SELECT r.*` includes the `pdf` **Buffer column** (see `receipt.repo.ts:122`), which is fetched even though the `Receipts.tsx` list view never displays PDF content. | Every list page fetches potentially large PDF BLOBs from the DB over the wire, deserialized on the server, then re-serialized as JSON — massive payload bloat. |
| RC4 | **`Receipts.tsx` export handlers** (`Receipts.tsx:229-272`) | `handleExportCsv` and `handleExportJson` iterate over the **client-side `receipts` state** (already limited to current page) rather than hitting a dedicated export endpoint. Exporting only gives the user the current page's 50 rows, not all receipts. | Incorrect export behavior; not a perf issue per se but a latent bug. |

### Quotes Section

| # | Where | Evidence |
|---|---|---|
| Q1 | **`QuoteService.findById`** (`quote-service.ts:330-342`) | 3 sequential DB round-trips: 1 for the quote+customer JOIN, then `getItems` (1 query), then `getFees` (1 query). These are **not parallelized** — unlike the invoice `findById` which was fixed to use a single JSON-subquery. `getQuoteById` (`client.ts:1392-1394`) calls this on every quote detail load. |
| Q2 | **`QuoteService.send`** (`quote-service.ts:471-500`) | Calls `findById` (3 queries) to load the full quote, then `businessRepository.findById` (1 query), then `customerRepository.findById` (1 query) — **5 sequential DB round-trips** just to gather data for sending. Then calls `findById` again inside `generatePdf` (line 503) — **another 3 queries**. Total: 8+ sequential DB calls for a single "Send" action. |
| Q3 | **`QuoteService.convertToInvoice`** (`quote-service.ts:430-469`) | Calls `findById` (3 queries), then `finalize` which calls `findById` **again** (3 more queries), then `createDraft` (invoice service does its own `findById` for products), then the `UPDATE` to set `converted_invoice_id`. | **9+ sequential DB round-trips**; `findById` called twice for the same quote with 6 redundant queries. |
| Q4 | **`QuoteService.generatePdf`** (`quote-service.ts:502-508`) | Calls `findById` (3 queries), `businessRepository.findById` (1 query), `customerRepository.findById` (1 query) — all sequential. Then `renderQuoteHtml` calls `calculationEngine.calculate()` on the server even though the quote already has persisted totals (line 512-513: `const calc = calculationEngine.calculate(calcInput); ... void calc;` — the result is **discarded**). | 5 sequential queries + wasted CPU on throwaway calculation for every PDF generation. |
| Q5 | **`useQuoteBuilder` context loads** (`useQuoteBuilder.ts:81-113`) | On quote editor mount: `Promise.allSettled([getBusiness, getCustomers({limit:500}), getProducts({limit:200})])`. Loads 500 customers — **same pattern the invoice editor was fixed for** (reduced to 100). Customers are only needed for the customer selector dropdown, not for the editor itself. | 500-customer fetch on every quote editor open, duplicating the exact issue already fixed in `InvoiceWorkspace`. |
| Q6 | **`QuoteBuilder.tsx:68`** | `handleSend` does `await finalizeQuote(quoteId)` then `await sendQuote(quoteId)` — **2 sequential API calls**, each hitting the backend `finalize` (which does its own `findById`) and `send` (which does its own `findById` + `generatePdf`). That's 2+8 = 10+ DB round-trips for a single send flow. | Sequential API calls that could be parallelized or consolidated. |

### Invoice Detail Section (residual, not previously addressed)

| # | Where | Evidence |
|---|---|---|
| I1 | **`InvoiceDetail.tsx:58-62`** | On invoice detail load, fires 3 parallel calls: `getInvoice(id)`, `getInvoicePayments(id)`, `getInvoiceEvents(id)`. The `getInvoice` backend handler (`src/index.ts:928-931`) calls `invoiceService.getInvoice` which, for **draft** invoices, runs the full `calculationEngine.calculate()` server-side on every GET (see `invoice-service.ts:235`). The invoice snapshot is already stored for finalized invoices, but drafts are recalculated eagerly. | Latency on every draft detail view; calculation runs server-side even though the client has its own `calculationEngine`. |
| I2 | **`/api/invoices/:id/events` route** (`src/index.ts:1001-1004`) | Calls `invoiceRepository.getEvents` with a **default limit of 100** (`invoice.repo.ts:916` — need to verify). If the event table has no index on `(invoice_id, created_at)`, this is a scan + sort. |
| I3 | **`InvoiceWorkspace.tsx:546-555`** (`doSave`) | Autosave makes **3 sequential API calls** (`updateInvoice` → `setInvoiceItems` → `setInvoiceFees`) even when only metadata changed. The items/fees calls are guarded by `JSON.stringify` comparison, but the `updateInvoice` call always fires. Could be batched into a single transactional endpoint. | Latency spike on every autosave; multiple round-trips compound during rapid editing. |

### Cross-cutting Backend Patterns

| # | Where | Evidence |
|---|---|---|
| X1 | **No `SELECT *` projection anywhere** | `invoice.repo.ts:807-817` (`findRecentlyPaid`: `SELECT i.*`), `invoice.repo.ts:820-833` (`findRequiringAttention`: `SELECT i.*`), `invoice.repo.ts:372-378` (`list`: `SELECT q.*, c.name...`), `receipt.repo.ts:122` (`SELECT *, COUNT(*) OVER()`), `receipt.repo.ts:52-56` (`SELECT * FROM receipts ... RETURNING *`). Every list/detail query over-fetches columns the frontend doesn't render. |
| X2 | **No HTTP response caching** | The `reportsCache` (TtlCache, 5-min) only covers `/api/reports/revenue`, `/api/reports/tax-summary`, `/api/reports/volume-trend`, and `/api/dashboard/enhanced`. List endpoints (`/api/invoices`, `/api/receipts`, `/api/quotes`) and detail endpoints have **no cache**, so navigating back to a list re-fetches everything. |
| X3 | **No database index on `(business_id, status, due_date)`** for invoice list | The `findRequiringAttention` query (`invoice.repo.ts:821-833`) filters on `status IN (...)` + `due_date < $2` + `business_id`, ordered by `due_date`. The migration `018_invoice_perf_indexes.sql` adds `(business_id, status)` but **not** `(business_id, status, due_date)` needed for this ordering pattern. |

---

## Recommended Fixes (priority order)

### P0 — Reports section

1. **Remove duplicate volume-trend fetch (R1)**: `ReportSection.tsx` already fetches `getVolumeTrendReport` at line 38. Remove the duplicate fetch inside `MonthlyTrendChart.tsx:43-56`; accept `volumeTrend` as a prop from the parent instead. Eliminates 1 redundant API + DB round-trip.

2. **Implement missing `/api/reports/aging` and `/api/reports/payment-metrics` endpoints (R2)**: Either add the route handlers to `src/index.ts` (mirroring `getAgingBuckets` and `getPaymentMetrics` from the invoice repo) or remove the client calls from `ReportSection.tsx:38-39` and derive those KPIs from the data already fetched via `/api/dashboard/enhanced` (which returns `agingBuckets` and `paymentMetrics` in the `EnhancedDashboard` response).

3. **Use business currency in Reports.tsx (R3)**: Replace hardcoded `"USD"` in `formatCurrency(r.total_amount, "USD")` with the business's default currency from context.

### P0 — Receipts section

4. **Exclude `pdf` column from list query (RC3)**: In `receipt.repo.ts:findManyWithDetailsAndCount` and `findMany`, replace `SELECT r.*` with an explicit column list that excludes `pdf`. The list view never needs the PDF buffer.

5. **Cache compiled receipt Handlebars template (RC2)**: Add `RECEIPT_TEMPLATE` to the existing `templateCache` in `template-renderer.ts`, or cache it as a module-level `HandlebarsTemplateDelegate` in `receipt-service.ts` (mirroring the `compileTemplate` pattern at `template-renderer.ts:126-133`).

6. **Eliminate redundant `getById` before `generatePdf` (RC1)**: In the `/api/receipts/:id/pdf` route (`src/index.ts:1147-1154`), call `receiptService.generatePdf(receiptId)` directly — `generatePdf` already fetches the receipt from the DB. Use `receiptStorage` or `storePdf` return path for the number.

### P0 — Quotes section

7. **Consolidate `QuoteService.findById` to single query (Q1)**: Apply the same JSON-subquery pattern used in `invoice.repo.ts:287-312` (single query returning quote + items_json + fees_json) to the quote repository.

8. **Eliminate redundant `findById` calls in `send`/`convertToInvoice`/`generatePdf` (Q2, Q3, Q4)**: These methods chain multiple `findById` + `generatePdf` + `finalize` calls that each re-fetch the full quote. Introduce an internal `findByIdInternal` (no re-fetch) or pass the already-loaded quote object through the call chain. Remove the throwaway `calculationEngine.calculate()` in `renderQuoteHtml` (line 512-522).

9. **Reduce customer fetch in `useQuoteBuilder` (Q5)**: Change `getCustomers({ limit: 500 })` to `{ limit: 100, includeArchived: false }` (matching the invoice editor fix at `InvoiceWorkspace.tsx:362`), with lazy load-on-open fallback like `CustomerSelector`.

10. **Parallelize `handleSend` in QuoteBuilder (Q6)**: `finalizeQuote` and `sendQuote` can't run in parallel (send requires finalized state), but the backend `send` method should accept pre-finalized quote data to avoid the double `findById`. At minimum, the backend `send` should reuse the quote loaded by `finalize` rather than calling `findById` again at line 472.

### P1 — Invoice detail / residual

11. **Guard draft recalculation (I1)**: Add a dirty-flag check in `InvoiceService.getInvoice` — only call `recalculate` for drafts when line items or fees have changed since persisted totals. Use the existing `updated_at` timestamp compared to the last calculation timestamp, or a hash of the items/fees.

12. **Batch autosave into single endpoint (I3)**: Consolidate `updateInvoice` + `setInvoiceItems` + `setInvoiceFees` into a single `PATCH /api/invoices/:id` that accepts all three payloads and applies them in a single transaction (the backend `updateDraft` already supports this but the frontend splits them).

### P2 — Cross-cutting

13. **Project explicit column lists** (X1): Replace all `SELECT *` / `SELECT i.*` / `SELECT r.*` with explicit column projections matched to what each endpoint actually returns. This reduces payload size, avoids transferring large BLOBs (PDFs), and eliminates `instanceof Date` / `String()` coercion overhead on the backend transform layer.

14. **Add composite index `(business_id, status, due_date)`** (X3): Create a migration to add this index, which covers the `findRequiringAttention` query pattern (filter by business+status, order by due_date).

15. **Add short-TTL cache for detail endpoints** (X2): Apply a 1-minute TTL cache (reusing the existing `TtlCache` pattern in `reports-cache.ts`) to `/api/invoices/:id`, `/api/quotes/:id`, and `/api/receipts/:id` detail endpoints. This helps with back-navigation from detail pages.

---

## Verification Plan

```bash
# Backend
npm run typecheck      # tsc -p tsconfig.typecheck.json
npm run lint           # eslint src --ext .ts
npm run test           # vitest run

# Frontend
cd webapp && npm run typecheck
cd webapp && npm run lint
cd webapp && npx vitest
```

**Manual verification:**
- Open Reports page — volume-trend fetched once (not twice); KPIs populate without 404 errors.
- Open Receipts page — list loads without PDF buffer in payload; PDF download opens from single DB fetch.
- Open Quotes list → detail → send — all backend calls succeed; no redundant `findById`.
- Open Quote editor — 100 customers fetched (not 500); lazy-load on dropdown open.

## Non-goals

- The large uncommitted frontend redesign (DocumentEditor, ComponentPalette, etc.) is treated as out of scope for this perf plan.
- Payment/Recurring/Automation sections are not analyzed in depth (Phase 3/4 stubs).
