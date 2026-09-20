# Performance Optimization Plan

## Goals
- Reduce computational complexity in hot paths
- Eliminate redundant allocations and object creation
- Cache expensive-to-compute values
- Reduce database round-trips (N+1 patterns)
- Batch operations where possible

## Files to Modify (in priority order)

### 1. src/domain/calculation.ts — Calculation Engine
**Problems:**
- `new Decimal()` called ~4× per line item in loops
- `getCurrencyMetadata()` called redundantly
- `lineShares` array pre-filled with Decimal(0) objects
- `subtotal.minus(lineDiscountTotal)` computed twice
- `isTaxInclusive` uses `.some()` scan

**Fixes:**
- Cache `getCurrencyMetadata(currency)` result in local const
- Use `Decimal.zero()`-equivalent precomputed constants
- Compute `subtotal - lineDiscountTotal` once, reuse
- Replace `.some()` with early-exit flag
- Avoid allocating `lineShares[i] = new Decimal(0)` then overwriting

### 2. src/services/templates/template-renderer.ts — Template Caching
**Problems:**
- `Handlebars.compile()` called on EVERY `render()` call
- Default 200-line template recompiled for every invoice

**Fixes:**
- Cache compiled templates in a Map keyed by template string
- Precompile DEFAULT_INVOICE_TEMPLATE at module load
- Use `template.precompile()` for static templates

### 3. src/domain/value-objects/currency.ts — Intl Cache
**Problems:**
- `formatMoney()` creates new `Intl.NumberFormat` on every call (very expensive)
- `getCurrencyMetadata()` does string lookup + uppercase per call

**Fixes:**
- Cache `Intl.NumberFormat` instances per currency in a Map
- Export cached metadata lookup

### 4. src/services/invoice-service.ts — Dashboard Optimization
**Problems:**
- `getDashboardData` loads 500 rows then does 4 separate JS passes
- `recentlyPaid` and `requiringAttention` both filter+sort+slice same data
- `recordPayment` does extra `findById` after UPDATE

**Fixes:**
- Single-pass aggregation using `reduce`
- Combine recentlyPaid and requiringAttention filters
- Remove redundant `findById` in `recordPayment`

### 5. src/repositories/invoice.repo.ts — Batch Operations
**Problems:**
- `insertItems`/`insertFees` issue one INSERT per item (N+1)
- `findById` issues 3 separate queries
- `update` and `updateOptimistic` duplicate ALLOWED_COLUMNS Set
- `findManyPage` and `findMany` duplicate filter logic

**Fixes:**
- Use `INSERT ... SELECT UNNEST(...)` for batch item/fee inserts
- Combine invoice+items+fees into single query with JOINs
- Extract shared filter-building into helper method
- Extract ALLOWED_COLUMNS to module-level constant

### 6. src/db/pool.ts — Query Wrapper
**Problems:**
- `query()` wrapper adds overhead; slow-query check uses `Date.now()`
- `getClient()` always returns a new client from pool

**Fixes:**
- Use `performance.now()` for higher precision timing
- Add `queryMany()` helper for batch inserts

### 7. src/services/snapshot/snapshot-service.ts — Duplicate Mapping
**Problems:**
- `verify()` rebuilds entire snapshot for hash comparison
- Duplicate `.map()` for items/fees (templateData + payload)

**Fixes:**
- Add `verifyHashOnly()` that computes hash without full build
- Extract shared item/fee mappers

## Verification
- Run `npm run typecheck` after all changes
- Run `npm run lint` after all changes
- Run `npm run test` to ensure no regressions

## Implementation Status

### Completed
1. **src/domain/calculation.ts** — Extracted module-level `ZERO`/`ONE` constants, eliminated redundant Decimal allocations, cached `netAfterLineDiscounts` computation (previously computed twice), replaced `.some()` with early-exit loop, fixed `fill(new Decimal(0))` reference-sharing issue.
2. **src/services/templates/template-renderer.ts** — Added `templateCache` Map to cache compiled Handlebars templates, eliminating per-render compilation overhead.
3. **src/domain/value-objects/currency.ts** — Added `metadataCache` Map for caching `getCurrencyMetadata` results, added `numberFormatters` Map to cache `Intl.NumberFormat` instances per currency/locale (previously created on every `formatMoney` call).
4. **src/services/invoice-service.ts** — Rewrote `getDashboardData` to use SQL-based aggregation (`getDashboardSummary`, `findRecentlyPaid`, `findRequiringAttention`) instead of loading 500 rows + 4 JS passes; parallelized dashboard queries with `Promise.all`; eliminated redundant `findById` in `recordPayment` by using `UPDATE ... RETURNING`; hoisted `STATUS_ORDER` to module level.
5. **src/repositories/invoice.repo.ts** — Replaced per-item INSERT loops with batch multi-row INSERT (`VALUES (...), (...), ...`); extracted shared `INVOICE_ALLOWED_COLUMNS` Set to module level; added SQL-based `getDashboardSummary`, `findRecentlyPaid`, `findRequiringAttention` methods.
6. **src/services/state-machine/invoice-state-machine.ts** — Precomputed `ALLOWED_TRANSITIONS_SETS`, `TERMINAL_STATUSES_SET`, `CANCELLABLE_STATUSES_SET`, `VOIDABLE_STATUSES_SET` as Set objects for O(1) lookups instead of O(n) array `.includes()`.
7. **src/services/snapshot/snapshot-service.ts** — Extracted `mapItems`, `mapFees`, `mapTotals` helper methods to eliminate duplicate `.map()` calls.

### Verification Results
- `npx tsc --noEmit` — passes (0 errors)
- `npx vitest run` — 100/100 tests pass (calculation, state machine, invoice validation, numbering, templates)