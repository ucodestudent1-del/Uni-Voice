# Performance Analysis: Invoice/Receipt/Quote/Reports Sections

## Goal
Identify and document performance bottlenecks across the fullstack Universal Invoice Generator (invoice editor, quote builder, receipts, and reports) and provide a prioritized optimization plan.

## Scope
- Frontend: `webapp/src/` (React + Vite + decimal.js + document-model)
- Backend: `src/` (Express + PostgreSQL + node-pg-migrate style)

## Findings

### 1. Un-memoized Calculation Engine (CRITICAL)
The `calculationEngine.calculate()` (Decimal.js-based) runs synchronously on the main thread.

**InvoiceWorkspace.tsx:260-296** — `calcResult` is computed via an IIFE on every render with NO `useMemo` wrapper. Any `setInvoice` call triggers recalculation + full preview re-render. This is the primary UI-blocking bottleneck for invoices with many line items.

**InvoiceEditor.tsx:260-296** — Same pattern: `calcResult` is a bare IIFE, re-computing on every render. The DocumentEditor subtree (drag-drop overlay, recursive render) is expensive and re-renders alongside each keystroke.

**QuoteBuilder/useQuoteBuilder.ts:315** — Correctly wraps `calcResult` in `useMemo`, but the dependency array `[data.items, data.fees, data.discount, data.currency]` changes on every keystroke since `items`/`fees` are always new array references when mapped. The memo effectively never hits.

**useInvoiceValidation.ts:288** — Uses `useMemo` correctly, but `validationInput` objects (in both InvoiceWorkspace and InvoiceEditor) contain nested arrays of line items that are re-created as new references each render. While `useMemo` checks the top-level `data` reference, the inner `items` array is a new object every time, so `validateInvoice` runs on every render including `checkCalculations` which calls `calculationEngine.calculate()` a SECOND time.

**Impact**: Double calculation per keystroke; UI jank on invoices/quotes with 50+ line items.

### 2. Non-Memoized Document Tree Renderer (CRITICAL)
**renderer.tsx:18-91** — `renderComponent` is a recursive function with NO memoization. Any single component change in the document model triggers a full tree re-render. The `DocumentEditor` uses DnD state that updates on `PointerMoveEvent`, causing `renderContext` (InvoiceEditor.tsx:343-364) to be a new object reference every render → entire document tree re-renders on every mousemove during drag.

**DocumentPreview.tsx:26** — Creates a new `RenderContext` via `createRenderContext` on every render with no memoization.

**OutlineEditor.tsx** — `buildNodeTree(doc, null)` runs synchronously on every render (line 115), traversing the entire document tree recursively.

**Impact**: Dragging a single component or resizing triggers full re-render of document tree; O(n) traversal + re-render on every state mutation.

### 3. N+1 API Calls + No Request Deduplication (HIGH)
**InvoiceWorkspace.tsx:819-873** — `handleFinalizeAndSend` calls `finalizeInvoice(curId)`, then `getInvoice(curId)` TWICE in sequence (lines 841 and 854), each re-fetching the full invoice with items, fees, attachments. No batching or single "refresh after mutation" endpoint.

**InvoiceEditor.tsx:166-170** — On mount, fires 3 parallel requests (`getBusiness`, `getCustomers`, `getProducts`) with no Promise cancellation cleanup if the component unmounts.

**CustomerSelector.tsx** — Has proper debounce (300ms) for search, but `loadCustomers` fires on every debounce tick with `Promise.allSettled` but no AbortController cancellation. Rapid typing can queue stale requests.

**QuoteBuilder/useQuoteBuilder.ts:81-87** — `loadContext` uses `Promise.allSettled` for business, customers (500 per page), and products (200 per page). No pagination for large customer sets. No cancellation on re-mount.

**Impact**: Network waterfall on invoice open; stale data races on rapid navigation.

### 4. Backend N+1 DB Updates Without Batching (HIGH)
**invoice-service.ts** — `persistCalculationResults` (referenced in `finalize` at line 314) does per-line-item DB updates. With 100 line items, this is 100+ individual UPDATE statements. The code uses `getClient()` for transaction management (InvoiceWorkspace correctly uses transactions at backend), but the per-item writes are likely not batched.

### 5. Missing Request Caching on Frontend (MEDIUM)
**api/client.ts** — Axios instance with response interceptor for content-type validation, but NO request/response caching. Common data like `business`, `customers`, `products` is re-fetched on every editor mount.

No SWR (stale-while-revalidate) or React Query pattern in use. No `useRef`-based cache for customer lookups.

### 6. Reports: Stale Closure Bug + No Pagination (MEDIUM)
**Reports.tsx:24** — `loadRevenue` is wrapped in `useCallback` with dependency `[revenueLoaded]`. After first load, `revenueLoaded` is `true`, so subsequent tab switches never re-fetch even if data is stale. The `loadTaxSummary` has the same issue with `[taxLoaded]`.

**Reports.tsx:41-47** — The `useEffect` depends on `[activeTab, loadRevenue, loadTaxSummary]` but these callbacks change identity when their respective `loaded` flags flip, causing the effect to re-run unnecessarily.

**Backend: index.ts:1308** — `GET /api/invoices` returns `LIMIT 1000` with no pagination support. For businesses with 1000+ invoices, the full list is fetched and held in memory.

**Backend: index.ts:1201-1229** — Revenue and tax summary reports use TTL cache (5 min) but cache invalidation only happens on `invalidateReportsCache` called during finalize/send/convert. If a draft invoice is created (not finalized), the cache stays stale until expiry.

### 7. Receipts: On-Demand PDF Generation Without Caching (MEDIUM)
**receipt-service.ts:201** — `getResponse` fetches receipt, then at route level (index.ts:1150), if `pdf` is null, calls `receiptService.generatePdf(receipt.id)` synchronously. PDF generation is HTML-based (Handlebars + wkhtmltopdf or similar) and blocks the request thread.

No background job queueing for PDF generation. No stored PDF caching after first generation.

**Backend: index.ts:1147-1154** — Receipt PDF route fetches the receipt, checks for cached PDF, generates if missing — all in-request.

### 8. Large Dataset Rendering Without Virtualization (MEDIUM)
**InvoiceWorkspace LineItemsTable** — Line items are rendered in a plain `<tbody>` with no windowing/virtualization. For invoices with 100+ line items, all DOM nodes are created synchronously.

**CustomerSelector.tsx:175** — Renders ALL loaded customers (up to 100) in a list with no virtualization. With 100 customers, each with 3-4 text fields, this is ~400 DOM nodes created on dropdown open.

### 9. Auto-Save Race Conditions (LOW-MEDIUM)
**InvoiceWorkspace.tsx:496-568** — `doSave` uses `latestRef.current` to read state, but `updateData` and `markDirtyAndSchedule` call `setInvoice` and set a 2000ms timer. If the user makes rapid changes, the debounce timer is reset, but the `setInvoice` calls accumulate. React batches these, but `doSave` reads from `latestRef.current.invoice` which is updated synchronously (line 302), so it reads the latest. This is actually correct, but the `JSON.stringify` comparison for items/fees diff (lines 548, 552) is O(n) per save.

**QuoteBuilder/useQuoteBuilder.ts** — `AUTOSAVE_DELAY = 500ms` (faster than InvoiceWorkspace's 2000ms). With 500ms debounce, rapid typing can trigger saves mid-type.

## Prioritized Optimization Plan

### Priority 1: Fix Double Calculation in Editors (Invoice + Quote)
**Problem**: `calculationEngine.calculate()` runs 2x per render (once in component, once in `useInvoiceValidation`).
**Fix**:
1. In `InvoiceWorkspace.tsx:304` and `InvoiceEditor.tsx:260` — wrap `calcResult` in `useMemo` with proper dependencies.
2. In both editors — pass the memoized `calcResult` as `predefinedCalc` to `useInvoiceValidation` to prevent the duplicate `calculationEngine.calculate()` call inside `validateInvoice`.
3. Extract the calculation input building into a shared `useMemo` so both `calcResult` and `validationInput` share the same dependency array.

**Risk**: Low. Pure refactoring of existing memo pattern.

### Priority 2: Offload Calculation Engine to Web Worker
**Problem**: `decimal.js` calculations block the main thread on large invoices.
**Fix**:
- Create a `calc-worker.ts` Web Worker wrapper that posts `InvoiceCalculationInput` and receives `CalculationResult`.
- Use `useMemo` + `useEffect` pattern: post message on dependency change, store result in state, return memoized result.
- Fallback to synchronous calculation in the worker if Web Workers are unavailable.

**Risk**: Medium. Decimal.js objects cannot be directly transferred across worker boundary — serialize to strings.

### Priority 3: Memoize Document Tree Renderer
**Problem**: Full document tree re-renders on every state change.
**Fix**:
1. In `renderer.tsx` — wrap `renderComponent` in `React.memo` for leaf components, or memoize the structural `div` wrapper.
2. In `DocumentPreview.tsx` — memoize `renderContext` creation with `useMemo`.
3. In `InvoiceEditor.tsx:343-364` — memoize `renderContext` object creation; only rebuild when `doc`, `editorData`, `calcResult`, or `business` changes.
4. In `OutlineEditor.tsx:115` — memoize `buildNodeTree` result with `useMemo` depending on `document`.

**Risk**: Low-Medium. Need to ensure memoized wrappers don't break DnD drag state propagation.

### Priority 4: Deduplication Cache for API Requests
**Problem**: Same customer/product/business data re-fetched across multiple components.
**Fix**:
- Implement a simple in-memory request cache in `api/client.ts` keyed by endpoint + params.
- Cache `getBusiness()`, `getCustomers()`, `getProducts()` with short TTL (30s).
- Invalidate cache on mutations (customer created, product updated).

**Risk**: Low. Client-side only; can be cleared on tab refresh.

### Priority 5: Batch Backend Persist Operations
**Problem**: `persistCalculationResults` does N+1 updates.
**Fix**:
- Review `invoice-service.ts` `persistCalculationResults` method.
- Batch line item updates into a single SQL `UPDATE ... WHERE id = ANY($1)` or use `CASE` expressions.
- Alternatively, store the entire calculation result as a single JSON blob column on the invoice row.

**Risk**: Medium. Requires DB schema awareness and transaction safety verification.

### Priority 6: Fix Stale Closure in Reports + Add Pagination
**Problem**: `useCallback` with `loaded` flag prevents re-fetch; no pagination on invoices list.
**Fix**:
1. Remove the `if (revenueLoaded) return` guard from `loadRevenue` and `loadTaxSummary`. Instead use the loaded flag only for UI state.
2. Add a refresh mechanism (e.g., `refreshReports` function) that clears loaded state and re-fetches.
3. Add `limit` and `offset` query params to `GET /api/invoices` backend route (index.ts:1308).
4. In frontend, add pagination state to Reports tables if invoice-level detail is shown.

**Risk**: Low. UI-only changes for stale closure; backend query param addition is additive.

### Priority 7: Cache Generated PDFs
**Problem**: PDF generated on every download request.
**Fix**:
- In `receipt-service.ts`, after first `generatePdf` call, store the PDF bytes in the `receipt` table (there's already a `pdf` column based on index.ts:1150).
- For invoices, add a similar caching pattern: `GET /api/invoices/:id/pdf` checks for cached PDF, generates if null, stores result.

**Risk**: Low. Storage cost; PDFs are small.

### Priority 8: Virtualize Large Lists
**Problem**: No virtualization for line items or customer dropdown.
**Fix**:
- Add `react-window` or `react-virtualized` to `package.json`.
- Wrap `LineItemsTable` tbody in a `FixedSizeList` or `VariableSizeList`.
- Wrap `CustomerSelector` customer list in a virtualized list.

**Risk**: Low. Well-established library integration.

### 9: Fix Auto-Save Timer Leaks
- Ensure all `setTimeout` timers are cleared in component unmount cleanup (already done in both editors, but `useQuoteBuilder.ts:75-79` should be verified).

## Validation Plan
1. Performance profiling: Record timeline in Chrome DevTools on invoice editor with 50+ line items before and after changes.
2. Calculation engine: Time `calculationEngine.calculate()` for 100 items with and without Web Worker.
3. Network tab: Verify duplicate requests eliminated by request cache.
4. React DevTools: Confirm `useMemo`/`React.memo` are preventing re-renders (check component render counts).
5. Backend query log: Confirm batched updates reduce query count in `persistCalculationResults`.

## Out of Scope
- Migrating to React Query (would be a large architecture change)
- Server-side rendering of PDF (staying with current html-to-pdf approach)
- Real-time collaboration features
