# Commercial Launch Readiness — Problem Checklist

## Status Summary

**Current score: ~6.5/10** (moderate-to-high confidence for a private beta, **not ready for public commercial launch**)

The codebase has a mature architecture with strong foundations, but critical production-enforcement gaps remain in configuration validation, provider implementation, and tooling.

---

## Critical Issues (Must fix before launch)

### C1. `.env.example` ships insecure production defaults
- `AUTH_MODE=dev` — the config schema blocks this at startup if `APP_ENV=production`, but the example file should default to `jwt`
- `AUTH_JWT_SECRET=dev-secret-change-me` — blocked at startup in production, but the example communicates the wrong default
- `EMAIL_PROVIDER=stub` — emails silently never send
- `PAYMENT_PROVIDER=stub` — payment links silently fail at checkout
- `GOOGLE_CALLBACK_URL` uses `http://localhost:4000` — invalid in production
- No `.env.production.example` template that documents required production values

**Fix:** Update `.env.example` defaults; add validation that enforces Stripe/Email config in production.

### C2. `AUTH_MODE=stub` bypasses production validation
- The validation in `src/config/index.ts:105` only blocks `AUTH_MODE=dev` in production
- `AUTH_MODE=stub` is accepted and provides no real authentication (trusts headers)
- The `stub` mode should be blocked in production, or require explicit opt-in with a warning

**Fix:** Add validation: `if (isProduction && parsed.AUTH_MODE === "stub")` → exit with error.

### C3. `PAYMENT_PROVIDER=paypal` is advertised but unimplemented
- `src/config/index.ts:72` declares `z.enum(["stub", "stripe", "paypal"])`
- There is **no PayPal payment service** implementation anywhere in `src/services/payments/`
- Selecting `paypal` loads `stripeService` which throws `STRIPE_NOT_CONFIGURED`
- The `PAYMENT_PROVIDER` env var is declared but never read — Stripe service is instantiated directly in `index.ts`

**Fix:** Either implement PayPal or remove it from the schema enum. Add a provider factory that reads `PAYMENT_PROVIDER`.

### C4. Stripe credentials not enforced in production
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` are all `z.string().optional()`
- The app starts without them, but `/api/webhooks/stripe` and payment sessions will fail at runtime
- No startup validation that Stripe is configured when `PAYMENT_PROVIDER=stripe`

**Fix:** Add production validation: if `PAYMENT_PROVIDER=stripe`, require `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`.

### C5. Healthcheck script (`healthcheck.js`) is broken
- Expects `registerData.token` from `/api/auth/register`, but the endpoint returns **cookies only** (access + refresh tokens set via `setAccessTokenCookie`/`setRefreshTokenCookie`)
- References `/api/expenses` endpoint which **does not exist** in the backend
- Uses `localStorage.setItem('token', token)` but the frontend reads from cookies, not localStorage
- Tests stale routes: `/app/expenses`, `/app/quotes/new`, `/app/quotes/:id` — verify these exist in the frontend router

**Fix:** Rewrite `healthcheck.js` to use cookie-based auth and remove `/api/expenses` references.

---

## High Priority Issues (Should fix before launch)

### H1. Redis is "optional" but silently disables rate limiting
- `REDIS_URL` is optional in the schema
- Without Redis, `rate-limit-redis` falls back to `undefined` store → **in-memory rate limiting**
- In a multi-process/container environment, in-memory rate limiting is ineffective
- The `generalRateLimiter` has `skip: isDev ? () => true : undefined` — in non-dev without Redis, it uses in-memory store which doesn't share state across processes

**Fix:** Enforce `REDIS_URL` as required in production, or document that rate limiting is per-process only.

### H2. Email provider not enforced in production
- `EMAIL_PROVIDER=stub` is a valid production configuration
- All invoice emails, reminders, and receipt emails go to the stub (logged, never sent)
- No startup validation that a real email provider is configured

**Fix:** Add validation: if `EMAIL_PROVIDER=stub` in production, log a warning or fail startup.

### H3. Database connection pool process exit on idle error
- `src/db/pool.ts:28`: `pool.on("error", ...)` calls `process.exit(-1)` in non-test mode
- An idle client error (e.g., network blip) will **crash the entire server**
- Should log the error and attempt reconnection, not hard-exit

**Fix:** Replace `process.exit(-1)` with error logging and connection reinitialization.

### H4. Frontend build artifacts must exist in production
- `src/index.ts:5359`: `start()` checks `existsSync(FRONTEND_DIST)` and exits if missing
- This is correct, but the Docker build process must be verified to always produce `/app/webapp/dist`
- If the frontend build fails in Docker, the backend won't start with a clear error

**Verification needed:** Confirm Docker multi-stage build produces the frontend dist.

---

## Medium Priority Issues (Should fix for polish)

### M1. Duplicate API client functions
- `client.ts` has `getInvoiceTemplates`/`getInvoiceTemplate`/`createInvoiceTemplate`/`updateInvoiceTemplate`/`deleteInvoiceTemplate` that are duplicates of `getDocumentTemplates`/`getDocumentTemplate`/`createDocumentTemplate`/etc. (lines 608–661)
- Same data is fetched via different endpoints — could cause confusion

### M2. Inconsistent line item field names between frontend and backend
- Backend uses `line_items` (snake_case in some DB queries, `items` in API input)
- Frontend `CreateInvoiceInput` uses `items`, but the API input schema may expect `lineItems`
- The `calculateInvoice` function in `webapp/src/utils/calculation.ts` may use different field names than the backend engine

**Fix:** Ensure `buildCalculationInput` in `invoice-service.ts` maps frontend fields to backend correctly.

### M3. PDF caching has no invalidation strategy
- `index.ts:1846`: PDFs are cached by `pdf:invoice:{id}` key with no TTL
- If an invoice is updated (before finalization), the cached PDF is stale
- Finalized invoices are immutable, so the cache is valid for finalized state
- But draft invoice PDFs could be cached and served stale

### M4. Stripe webhook idempotency
- `index.ts:4833`: Webhook processing uses `stripe_webhook:${eventId}` idempotency key
- This prevents duplicate processing, but if the webhook handler throws mid-processing (after partial DB changes), the idempotency key prevents retry
- The handler should use a DB transaction that rolls back on error

### M5. CSP allows `'unsafe-inline'` for scripts
- `index.ts:156`: `scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", ...]`
- This weakens XSS protection. `'unsafe-inline'` is needed for Stripe.js but could be tightened with nonces

---

## Low Priority Issues (Tech debt / polish)

### L1. Custom migration runner instead of `node-pg-migrate`
- AGENTS.md describes `node-pg-migrate`-style migrations, but actual implementation uses custom `src/db/migrate.ts`
- Works fine, but deviates from documentation

### L2. Missing `.env.production.example`
- Only `.env.example` exists, which defaults to development values
- Production deployers have no template showing required production-only variables

### L3. Frontend has ~520 lint warnings (272 `no-explicit-any`, 201 `no-unused-vars`)
- All warnings, 0 errors — acceptable for now but represents technical debt

### L4. `camelToSnake` called twice for plans endpoint
- `index.ts:1039`: `res.json(camelToSnake({ plans }))` — the plans object is already snake_case from the DB
- This is a no-op but indicates potential confusion

### L5. Healthcheck references routes that may not exist
- `/app/expenses` — verify if an Expenses page exists in the frontend router
- `/app/quotes/new` and `/app/quotes/:id` — these exist in the router but were added recently

---

## What's Already Solid

### ✅ Core Invoice Functionality
- Full invoice lifecycle: draft → finalize → send → paid/cancelled/void
- Credit notes with application to invoices
- Quotes with accept/reject/expire/convert-to-invoice
- Payment vouchers and debit notes
- Customer management with CSV import/export
- Product/service catalog with bulk operations
- Project management with time tracking

### ✅ Security & Auth
- JWT with refresh token rotation
- 2FA with TOTP + recovery codes
- OAuth 2.0 (Google)
- Password policy + breach checking
- Rate limiting on auth, documents, email, AI endpoints
- Tenant isolation at DB level on every query
- Immutable snapshots on invoice finalization

### ✅ Infrastructure
- CI/CD with 8 GitHub Actions jobs
- Docker multi-stage build with non-root user
- nginx config for production serving
- Graceful shutdown (SIGTERM/SIGINT)
- Health check endpoint (`/api/health`)
- Sentry error tracking (optional)

### ✅ Frontend UX
- Error boundaries (chunk + page level)
- Loading, empty, and error states
- SPA fallback for deep links
- Token refresh with queued requests
- Responsive design (healthcheck tests mobile/tablet/desktop)
