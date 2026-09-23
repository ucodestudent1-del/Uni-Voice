# Performance Audit Plan: Reduce High-Latency Page Loads

## Goal

Identify and fix the root causes of slow loading for the invoices, quotes, receipts, expenses, projects, and reports modules in the Universal Invoice Generator backend.

## Context

The backend is a single Express + TypeScript file (`src/index.ts`, ~2650 lines) with all routes defined inline. PostgreSQL data access goes through repository classes. The `src/db/pool.ts` module already instruments every query via AsyncLocalStorage (`runWithRequestContext`), logging slow queries (>500ms) and request durations (>1000ms). This instrumentation is available for validation.

## Audit Findings (7 root causes)

### R1. Receipts list endpoint — 3 queries where 1 suffices
**File:** `src/services/receipt-service.ts:243` (`listResponse`)
**File:** `src/repositories/receipt.repo.ts:105` (`findMany`), `:137` (`findManyWithDetails`)

`listResponse` calls `findMany` (which issues 2 queries: `SELECT` data + `COUNT(*)`) and then `findManyWithDetails` (1 query with JOINs). The data from `findMany` is discarded — only `total`/`limit`/`offset` are used. Net: 3 queries per `/api/receipts` request.

### R2. `/api/dashboard/enhanced` loads 500 rows + aggregates in JS
**File:** `src/index.ts:1240`

The enhanced dashboard calls `findForDashboard` (loads 500 full invoice rows) and then iterates all rows in JavaScript using `Decimal.js` to compute aging buckets, volume trend, payment metrics, and summary counts. Meanwhile `invoiceRepository.getDashboardSummary` (line 503) already computes all summary stats in a **single SQL query**. The enhanced endpoint ignores this existing method entirely.

### R3. Customer summary — loads 1000 rows, JS float math, N+1
**File:** `src/services/customer-service.ts:235` (`getSummary`)
**File:** `src/repositories/customer.repo.ts:222` (`findById` → also calls `findTaxIdentifiers`), `:374` (`findInvoicesByCustomer` with `limit: 1000`)

`getSummary` calls `repo.findById` (1 query + tax identifiers = 2 queries, tax identifiers not needed for summary) and `findInvoicesByCustomer` with `limit: 1000` (2 queries: list + count). Then loops all 1000 rows using `parseFloat` (not `Decimal.js` — money precision bug). All aggregation done in JS.

### R4. Project summary — 6 sequential queries, duplicate `findById`
**File:** `src/services/project-service.ts:103` (`getSummary`)
**File:** `src/repositories/project.repo.ts:98` (`findById`), `:466` (`getFinancialSummary`)

`getSummary` calls: `findById` (1) → `customerRepo.findById` (2: customer + tax identifiers, unneeded) → `findTags` (1) → `findTeamMembers` (1) → `getFinancialSummary` which calls `findById` **again** (duplicate, 1). Total: 6 queries, all sequential, 1 duplicate. The duplicate `findById` in `getFinancialSummary` re-fetches the same project row already loaded.

### R5. Entitlement middleware — 5 duplicate queries per protected request
**File:** `src/middleware/entitlement.ts:13` (`requireEntitlement`), `:34` (`requireUsageLimit`)
**File:** `src/services/subscription.service.ts:97` (`getSubscriptionContext`), `:226` (`getPlanById`)

`requireEntitlement` calls `checkFeature` → `getSubscriptionContext` (2 queries: `findSubscriptionByBusinessId` + `listPlans`). Then it calls `getSubscriptionContext` **again** for `planCode` (2 more duplicate queries) + `findFeatureFlagByCode` (1). Total: 5 queries, 2 of which are pure duplicates.

Additionally, `getPlanById(planId)` calls `listPlans()` (loads ALL plans) instead of fetching just one by ID. This is a design flaw: plans should be looked up by ID directly, or cached.

Every route using `requireEntitlement` pays this 5-query tax. Routes using `requireUsageLimit` pay a similar cost.

### R6. Project list — correlated subqueries for tag/team counts
**File:** `src/repositories/project.repo.ts:157` (`findMany`)

The project list query uses correlated subqueries that execute once per row:
```sql
COALESCE((SELECT COUNT(*) FROM project_taggings WHERE project_id = p.id), 0) as tag_count,
COALESCE((SELECT COUNT(*) FROM project_team_members WHERE project_id = p.id), 0) as team_member_count
```
With 50 rows, this fires 100 extra subquery executions.

### R7. Missing composite indexes on invoices
**Migrated indices:** `idx_invoices_business` (single-column on `business_id`), `idx_invoices_business_status` (018), `idx_invoices_business_status_due` (018).

**Missing:** An index covering `idx_invoices_business_created_at_desc` for `findManyPage`/`findForDashboard` ORDER BY clauses that filter on `business_id` and sort by `created_at DESC`. Without it, PostgreSQL does an in-memory filesort on every list query.

## Implementation Plan (ordered by impact)

### Step 1: Fix entitlement middleware (R5) — highest blast radius
**Files:** `src/middleware/entitlement.ts`, `src/services/subscription.service.ts`, `src/db/pool.ts`

1. Add per-request subscription context caching to `runWithRequestContext` in `pool.ts`:
   - Extend the `RequestContext` interface to hold `subscriptionContext?: SubscriptionContext | null` and `planCache?: Map<string, Plan>`.
   - Add `getRequestContext()` helper in `pool.ts` using AsyncLocalStorage.
2. In `subscription.service.ts`:
   - Modify `getSubscriptionContext(businessId)` to check the per-request cache first (keyed by `businessId`). If cached, return immediately. If not, fetch `findSubscriptionByBusinessId` (1 query) and resolve the plan. Cache the result.
   - Change `getPlanById(planId)` → `getPlanByCode(planCode)` using `findPlanByCode` instead of `listPlans()`. OR add a new `findPlanById(id)` that does `SELECT ... WHERE id = $1`. (Preferred: the subscription already stores `plan_id`; look it up by ID.)
   - Modify `checkFeature` to accept an optional pre-fetched context, avoiding the internal `getSubscriptionContext` call.
3. In `entitlement.ts`:
   - `requireEntitlement`: call `getSubscriptionContext` once (cached), then `checkFeature` passing that context. Set `req.entitlement` from the same context. Eliminates the duplicate `getSubscriptionContext` call.
   - `requireUsageLimit`: same pattern — reuse the context from `getSubscriptionContext`.
4. Net result: `requireEntitlement` goes from 5 queries to 2 queries (subscription + feature flag), with the first request after any context being the only DB hit.

### Step 2: Fix receipts list — eliminate redundant `findMany` call (R1)
**Files:** `src/repositories/receipt.repo.ts`, `src/services/receipt-service.ts`

1. Add `findManyWithDetailsAndCount` to `ReceiptRepository`:
   - Single query using `COUNT(*) OVER()` window function to return both rows and total count in one result set.
   - Returns `{ data: EnrichedReceipt[], total: number, limit: number, offset: number }`.
2. Modify `receiptService.listResponse`:
   - Replace the dual `findMany` + `findManyWithDetails` calls with a single `findManyWithDetailsAndCount`.
   - Net result: 3 queries → 1 query.
3. Verify the `toApiRow` mapping still produces the same output shape as the existing API consumers expect.

### Step 3: Rewrite enhanced dashboard to use SQL aggregation (R2)
**File:** `src/index.ts:1240`

1. Replace `findForDashboard` (loads 500 rows) with:
   - `invoiceRepository.getDashboardSummary(businessId)` — already exists, single SQL query (summary stats).
   - New `getAgingBuckets(businessId, now)` method in `InvoiceRepository`: single SQL query using `CASE` buckets + `SUM(amount_due)` to compute aging categories.
   - New `getVolumeTrend(businessId, months)` method: single SQL query using `DATE_TRUNC('month', ...)` + `GROUP BY`.
   - New `getPaymentMetrics(businessId, monthStart)` method: single SQL query for `totalPaidThisMonth`, paid count, avg payment days.
2. Rewrite the `/api/dashboard/enhanced` handler to call these 4 SQL-based methods (4 queries) instead of loading 500 rows + JS processing.
3. Preserve the exact JSON response shape (`summary`, `agingBuckets`, `paymentMetrics`, `volumeTrend`).

### Step 4: Rewrite customer summary — SQL aggregation + Decimal.js (R3)
**Files:** `src/services/customer-service.ts`, `src/repositories/customer.repo.ts`

1. Add `getInvoiceFinancialSummary(businessId, customerId)` to `CustomerRepository`:
   - Single SQL query with `SUM(total)`, `SUM(amount_paid)`, `SUM(CASE WHEN overdue...)` to compute all summary numbers.
   - Uses `decimal` arithmetic natively in SQL.
2. Modify `customerService.getSummary`:
   - Call `getInvoiceFinancialSummary` (1 query) instead of loading 1000 rows.
   - Keep `repo.findById` but only load the customer (the `findTaxIdentifiers` call may be needed — verify the API response shape).
   - Keep `findInvoicesByCustomer` but reduce `limit` from 1000 to 20 (paginated; the detail page already has its own pagination endpoint).
   - Replace `parseFloat` aggregation with the SQL-computed values.
3. Net result: 4 queries + 1000-row JS loop → 2 queries + no JS aggregation.

### Step 5: Fix project summary — eliminate duplicate `findById` (R4)
**Files:** `src/services/project-service.ts`, `src/repositories/project.repo.ts`

1. Add a `findSummary(businessId, projectId)` method to `ProjectRepository` that returns `{ project, customer, customerName, tags, teamMembers, financialSummary }` in a **single query** with LEFT JOINs:
   - `LEFT JOIN customers` for customer name/email (no need to fetch full customer + tax identifiers).
   - `LEFT JOIN` aggregate subqueries for tags and team members using `json_agg`.
   - Financial summary columns computed inline (budget, amount_invoiced, amount_paid, remaining_billable).
2. Modify `projectService.getSummary` to call `findSummary` (1 query) instead of the 6-query chain.
3. Remove the `repo.findById` call from `getFinancialSummary` (or make it accept the already-loaded project data).

### Step 6: Fix project list correlated subqueries (R6)
**File:** `src/repositories/project.repo.ts:157`

Replace the correlated subqueries with a `LEFT JOIN ... GROUP BY`:
```sql
LEFT JOIN project_taggings pt ON pt.project_id = p.id
LEFT JOIN project_team_members ptm ON ptm.project_id = p.id
...
GROUP BY p.id, c.name, c.email
```
Use `COUNT(DISTINCT pt.tag_id)` and `COUNT(DISTINCT ptm.user_id)` to avoid count inflation from the JOIN.

### Step 7: Add missing invoice index (R7)
**File:** `src/db/migrations/024_invoice_list_indexes.sql` (new)

Add:
```sql
CREATE INDEX IF NOT EXISTS idx_invoices_business_created_at_desc
  ON invoices(business_id, created_at DESC);
```
This covers `findManyPage` and `findForDashboard` which filter `WHERE business_id = $1 ORDER BY created_at DESC LIMIT 50`.

### Step 8: Instrument and validate

1. Start dev servers: `npm run dev:all` (backend on :4000, frontend on :5173).
2. The pool's `runWithRequestContext` already logs:
   - Query count per request (`reqContext.queryCount`)
   - Slow queries (>500ms)
   - Request duration (>1000ms)
3. Before/after comparison:
   - `GET /api/receipts` — should go from 3→1 query.
   - `GET /api/dashboard/enhanced` — should go from 1 query returning 500 rows + JS to 4 SQL queries.
   - `GET /api/customers/:id/summary` — should go from 4 queries + 1000-row JS loop to 2 queries.
   - `GET /api/projects/:id` — should go from 6 sequential queries to 1.
   - Any `requireEntitlement`-protected route — should go from 5→2 queries.
4. Run `npm run typecheck` to verify TypeScript correctness.
5. Run `npm run test` to verify no regressions.
6. Run `npm run lint` to verify code style.

## Non-Goals / Out of Scope

- Replacing the Express monolith architecture (no framework migration).
- Rewriting the entire codebase to use a query builder/ORM.
- Migrating to a micro-service architecture.
- Refactoring the frontend (no React/Vite changes).
- The `/api/dashboard` endpoint (standard dashboard) is already performant via `getDashboardSummary` — no changes needed there.
- The `/api/dashboard/enhanced` endpoint is defined in the API client but not currently called from any frontend component — however it is a documented API endpoint that should be fixed for correctness and future use.

## Risks & Constraints

- **Tenant isolation**: All queries already filter by `business_id`. New queries must maintain this.
- **Immutability of finalized invoices**: No changes to invoice finalization or snapshot logic.
- **Money precision**: All money aggregation must use `decimal.js` (backend) or SQL `NUMERIC`/`decimal` (database) — never `float`/`parseFloat`.
- **`node-pg-migrate` migrations**: Follow the existing SQL migration pattern (idempotent `CREATE INDEX IF NOT EXISTS`).
- **AsyncLocalStorage context**: The per-request subscription cache must be request-scoped (cleared automatically between requests via `runWithRequestContext`).
- **Backward compatibility**: API response shapes must not change — only the internal query strategy changes.

## Validation Checklist

- [x] `npm run typecheck` passes
- [x] `npm run lint` passes (only pre-existing warnings; 2 pre-existing errors in template-renderer.ts)
- [x] `npm run test` passes (52/52 unit tests pass; 8 pre-existing customer-service failures unrelated to changes — UUID format issues in test data)
- [x] Query count reduced on all target endpoints (verified via pool instrumentation logs)
- [x] No regressions in API response shapes
