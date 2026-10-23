# Commercial Launch To-10/10 Plan

## Goal
Take the Universal Invoice Generator from its current ~8.5/10 commercial-readiness state to 10/10 by addressing all remaining critical, high, and medium-priority gaps identified in the updated assessment.

## Current State (verified from code)
- Argon2id password hashing with policy enforcement + breach checking
- JWT auth: 15-min access token + refresh-token rotation via HttpOnly SameSite=Lax cookies
- 2FA with TOTP, recovery codes, lockout after 5 attempts
- Google OAuth with state param
- Rate limiting on all sensitive endpoints (auth: 20/15min, general API: 300/15min)
- Tenant isolation via `businessId` on every DB query
- Zod validation on most DTOs, but some routes still pass raw `req.body`
- 8 GitHub Actions CI jobs (security, typecheck, lint, tests, build, docker)
- Docker multi-stage build, non-root user, nginx reverse proxy
- Graceful shutdown, healthcheck.js (puppeteer smoke tests)
- Helmetsecurity headers (CSP, HSTS partial, etc.)

## Remaining Gaps to Address

### CRITICAL — Must fix before launch

#### C1: Harden config validation — fail fast on unsafe production configs
**File:** `src/config/index.ts:117-165`

Currently uses `console.warn` for unsafe production configs. Should hard-fail instead.

**Changes:**
1. `AUTH_MODE=stub` in production → `throw new Error(...)` (currently only warns at line 124)
2. `AUTH_MODE=dev` in production → `throw new Error(...)` (currently only warns at line 117)
3. `AUTH_JWT_SECRET === "dev-secret-change-me"` in production → `throw new Error(...)` (currently warns at line 131)
4. `PAYMENT_PROVIDER=stub` in production → `throw new Error(...)` (currently warns at line 160)
5. `EMAIL_PROVIDER=stub` in production → `throw new Error(...)` (currently warns at line 146)
6. Add `.refine()` to the Zod schema for `AUTH_JWT_SECRET` requiring min 32 chars in production

**Validation:** Start server with each unsafe config in `APP_ENV=production` — should exit with code 1 and clear error message.

#### C2: Remove `'unsafe-inline'` from CSP script-src
**File:** `src/index.ts:406-408`

**Changes:**
1. Replace `'unsafe-inline'` in `scriptSrc` with nonce-based approach
2. Inject nonce into HTML served to frontend (or use helmet's nonce support)
3. Update frontend to use nonce for any inline scripts

**Note:** Stripe.js `'unsafe-inline'` is required for the Stripe Elements script. Use helmet's `useDefaults: false` + explicit nonce for app scripts, keep `'unsafe-inline'` only for Stripe domains via separate directive.

**Alternative (recommended):** Use `scriptSrc` with `'self'` + Stripe domains, and move Stripe.js initialization to a separate script file (no inline). This eliminates the need for `'unsafe-inline'` entirely.

**Validation:** Verify Stripe checkout still works in dev; verify no CSP violations in browser console.

#### C3: Fix duplicate `camelToSnake` on plans endpoint
**File:** `src/index.ts:1339`

**Changes:**
1. The plans are already snake_case from the DB. Remove the redundant `camelToSnake()` wrapper.
2. Verify the output shape matches what the frontend expects (check `webapp/src/api/client.ts:getPlans()` return type).

**Validation:** Call `/api/plans` and verify JSON is still correctly shaped.

---

### HIGH — Must fix in current cycle

#### H1: Add RBAC per-resource access control
**Files:** `src/middleware/rbac.ts`, `src/services/*`, `src/repositories/*`

Currently any team member with a valid JWT can access all resources of the business. Need role-based resource access.

**Changes:**
1. Read role from JWT (`req.user.role` or look up from `business_users` table)
2. Create RBAC middleware that checks role vs. resource/action:
   - `owner` — full access
   - `admin` — CRUD on all resources, manage team
   - `member` — create/edit invoices, customers, projects; read-only on settings
   - `viewer` — read-only across all resources
3. Apply RBAC middleware to relevant routes (especially settings, team management, subscription changes)

**Validation:** Create tests that verify `viewer` role cannot POST/PUT/DELETE resources.

#### H2: Add login/logout audit logging
**Files:** `src/index.ts` (login handlers at ~line 184, logout handler), `src/utils/logger.ts`

**Changes:**
1. Add structured logging to login success/failure events (user ID/email, IP, user agent, event type)
2. Add logging to logout events
3. Add logging to role changes (team member patch at `src/index.ts:2232-2251`)
4. Add logging to subscription plan changes
5. Ensure PII (passwords, tokens) is never logged

**Validation:** Trigger login/logout in dev, verify structured log lines appear in stdout.

#### H3: Reduce body parser limit from 10MB
**File:** `src/index.ts:89`

**Changes:**
1. Reduce global `express.json({ limit: "10mb" })` to `express.json({ limit: "1mb" })`
2. Add per-route override for CSV import endpoint (`/api/customers/import`) using `express.json({ limit: "5mb" })`

**Validation:** Verify normal API requests still work; verify CSV import with large file works.

#### H4: Enforce public token expiry checks
**Files:** `src/services/invoice-service.ts`, `src/repositories/invoice.repo.ts:336`

**Changes:**
1. In `findByPublicToken` and public invoice view routes, verify `public_token_expires_at` is not null and not in the past
2. Return 404 for expired tokens

**Validation:** Test with expired token → 404; test with valid token → works.

#### H5: Fix `withBusinessId` synchronous throw in async middleware
**File:** `src/middleware/entitlement.ts:61-65`

**Changes:**
1. Change `throw new ForbiddenError(...)` to `return next(new ForbiddenError(...))`

**Validation:** Call endpoint without business context → returns 403 instead of unhandled rejection.

---

### MEDIUM — Should fix for polish

#### M1: Add Zod schemas to remaining raw `req.body` routes
**File:** `src/index.ts`

Routes that pass raw `req.body`:
- Products: `src/index.ts:733` — `productRepository.create(req.user!.businessId, req.body)`
- Templates: `src/index.ts:1344-1349` — uses `req.body.name`, `req.body.htmlTemplate` directly
- Recurring invoices: `src/index.ts:1188-1195`

**Changes:**
1. Create Zod DTOs in `src/domain/schemas/` for each
2. Apply `.parse()` at the start of each handler

**Validation:** Send malformed payload → 400 with Zod validation error.

#### M2: Add PostgreSQL Row-Level Security (RLS) as defense-in-depth
**Files:** New migration file, `src/db/pool.ts`

**Changes:**
1. Create migration to enable RLS on tenant-scoped tables (invoices, customers, products, quotes, etc.)
2. Create RLS policies: `USING (business_id = current_setting('app.current_business_id')::uuid)`
3. Set `app.current_business_id` at the start of each authenticated request via middleware

**Validation:** Attempt tenant-scoped query without setting the GUC → returns no rows.

#### M3: Add HSTS with production-only enforcement
**File:** `src/index.ts:401-440`

**Changes:**
1. Add explicit `hsts` config to Helmet:
   ```typescript
   hsts: {
     maxAge: 63072000, // 2 years
     includeSubDomains: true,
     preload: true,
   }
   ```

**Validation:** Verify `Strict-Transport-Security` header present in production responses.

#### M4: Remove bcrypt dependency (refresh token hashing)
**File:** `src/middleware/auth.ts:6,183,228`

**Changes:**
1. bcrypt is currently used only for hashing refresh tokens (not passwords)
2. This is acceptable, but for consistency and to reduce attack surface, either:
   - Option A: Keep bcrypt for refresh token hashing (it's not a security issue — refresh tokens are random, not user-chosen)
   - Option B: Replace with `argon2.hash()` for consistency

**Recommendation:** Option A — this is not a security issue. Refresh token hashes are random strings; bcrypt cost 12 is already set (`hashSync(refreshToken, 12)`).

**Validation:** Verify refresh token flow still works after any change.

#### M5: Add `npm audit` to CI as a hard gate
**File:** `.github/workflows/ci.yml`

**Changes:**
1. The security job already runs `npm audit --audit-level=moderate` — verify it fails CI on moderate+ vulnerabilities
2. Add `npm audit` for frontend as well (`cd webapp && npm audit --audit-level=moderate`)

**Validation:** CI fails when a moderate vulnerability is introduced.

#### M6: Add auth event logging — audit 2FA events
**File:** `src/services/auth/two-factor.service.ts`

**Changes:**
1. Verify 2FA enable/disable/verify events are logged with structured fields (user ID, IP, event type)
2. If missing, add logging

**Validation:** Trigger 2FA flow, verify log output.

---

### LOW — Tech debt / polish

#### L1: Clean up duplicate API client functions
**File:** `webapp/src/api/client.ts:652-707`

**Changes:**
1. `getInvoiceTemplates`/`getInvoiceTemplate`/etc. (lines 652-690) are duplicates of `getDocumentTemplates`/`getDocumentTemplate`/etc.
2. Remove the duplicate functions or alias them to the canonical ones.

**Validation:** Frontend typecheck passes.

#### L2: Add `--max-warnings 0` to backend lint in CI
**File:** `.github/workflows/ci.yml:71`

**Changes:**
1. Change `npm run lint` to `npm run lint -- --max-warnings 0`

**Validation:** CI fails on lint warnings.

#### L3: Add frontend lint job to CI
**File:** `.github/workflows/ci.yml`

**Changes:**
1. A `frontend-lint` job already exists (lines 217-238) — verify it's wired into the `build` job's `needs` list
2. Currently `build` job `needs: [typecheck, lint, frontend-typecheck, frontend-lint, test, frontend-test, security]` — this is correct.

---

## Files Requiring Changes (Summary)

| Priority | File | Change |
|---|---|---|
| CRITICAL | `src/config/index.ts:117-165` | Hard-fail on unsafe production configs |
| CRITICAL | `src/index.ts:406-408` | Remove `'unsafe-inline'` from CSP |
| CRITICAL | `src/index.ts:1339` | Remove redundant `camelToSnake()` on plans |
| HIGH | `src/middleware/rbac.ts` | Add RBAC per-resource access control |
| HIGH | `src/index.ts` (auth routes) | Add login/logout audit logging |
| HIGH | `src/index.ts:89` | Reduce body parser limit to 1MB |
| HIGH | `src/index.ts` (public routes) | Enforce public token expiry |
| HIGH | `src/middleware/entitlement.ts:61-65` | Fix synchronous throw in async middleware |
| MEDIUM | `src/index.ts` (raw body routes) | Add Zod DTOs to product/template/recurring routes |
| MEDIUM | New migration | Add PostgreSQL RLS policies |
| MEDIUM | `src/index.ts:401` | Add explicit HSTS config to Helmet |
| LOW | `webapp/src/api/client.ts:652-707` | Remove duplicate API client functions |
| LOW | `.github/workflows/ci.yml` | Frontend `npm audit` gate |

## Execution Order

1. **CRITICAL items** (C1-C3) — must be done first; they block launch
2. **HIGH items** (H1-H5) — should be done before launch
3. **MEDIUM items** (M1-M6) — polish for production readiness
4. **LOW items** (L1-L3) — tech debt cleanup, can be deferred

## Risks & Edge Cases

- **C1 (config hardening):** If staging uses `APP_ENV=production` but with dev-like settings, the hard-fail could prevent startup. Ensure staging uses `APP_ENV=development` or has proper production values.
- **C2 (CSP):** Removing `'unsafe-inline'` may break existing inline scripts in the frontend build. Need to verify no inline scripts are used in the built frontend.
- **H1 (RBAC):** Adding RBAC middleware could break existing team member workflows if existing users have different roles than expected. Need a migration to set default roles.
- **M2 (RLS):** Enabling RLS on all tables is a significant change; if any query misses the tenant filter at the app layer, RLS would silently return no results (data loss from user perspective). Thorough testing required.
- **H4 (token expiry):** Public invoice links shared via email will stop working after expiry. Consider configurable expiry duration and clear UX for expired links.

## Validation Plan

1. Run `npm run typecheck` — 0 errors
2. Run `npm run lint` — 0 errors (and 0 warnings if `--max-warnings 0` is added)
3. Run `npm run build` — succeeds
4. Run `npm test` — all tests pass
5. Start server in `APP_ENV=production` with each unsafe config — should exit with error
6. Start server in `APP_ENV=production` with valid config — should start successfully
7. Verify CSP header in dev tools — no `'unsafe-inline'` in script-src
8. Verify HSTS header present in production
9. Verify RBAC: viewer role cannot POST/PUT/DELETE
10. Verify public token expiry: expired token returns 404
