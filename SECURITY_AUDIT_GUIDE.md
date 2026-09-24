# Security Audit Checklist & Implementation Guide
## Universal Invoice Generator — TypeScript/Express/PostgreSQL

**Purpose:** A defense-in-depth audit checklist and implementation guide for this multi-tenant
invoice-generation SaaS. Every item references actual code locations so auditors and engineers
can jump directly to the code. The document is organized into seven technical domains. Each
domain contains: (A) a checklist of findings, (B) recommended remediation steps, and (C) code
examples or file paths for the current pattern.

**Legend:**
- [CRITICAL] Immediate fix required before any production deploy.
- [HIGH] Must fix in current release cycle.
- [MEDIUM] Should fix in next planning cycle.
- [LOW] Hardening / best-practice improvement.
- [N/A] Not applicable or already satisfied.

---

## 1. Authentication & Session Management

### 1.1 Current State in Codebase

| Artifact | Location | Status |
|---|---|---|
| Password hashing | `src/index.ts:157` — `bcrypt.hash(password, 10)` | [MEDIUM] bcrypt with cost factor 10 |
| JWT secret | `.env.example:6` — `AUTH_JWT_SECRET=dev-secret-change-me` | [CRITICAL] Hardcoded default |
| JWT expiry | `src/middleware/auth.ts:56` — `expiresIn: "30d"` | [HIGH] 30 days is too long |
| Token transport | Bearer header (JWT in localStorage/fronted) | [HIGH] No HttpOnly cookie |
| 2FA (TOTP) | `src/services/auth/two-factor.service.ts` + `src/services/auth/totp.ts` | [LOW] Uses SHA-1 HMAC, acceptable for TOTP |
| 2FA recovery codes | `two-factor.service.ts:47` — SHA-256 hashed, single-use | [N/A] Good |
| 2FA lockout | `two-factor.service.ts:33-34` — 5 attempts / 15 min window | [N/A] Good |
| OAuth (Google) | `src/services/auth/oauth.service.ts` | [N/A] Good — state param, PKCE missing |
| Auth modes | `src/config/index.ts:61` — `AUTH_MODE` enum: `dev | jwt | stub` | [CRITICAL] Dev stub mode |

### 1.2 Checklist

#### 1.2.1 Password Hashing
- [CRITICAL] Replace bcrypt with **Argon2id** (RFC 9106) as the primary KDF. If bcrypt must be
  retained, increase cost factor to **12**. Current code uses cost factor 10 (see
  `src/index.ts:157` and `tests/helpers/db.ts:79`).
- [MEDIUM] Enforce a minimum password policy: at least 12 characters, must contain uppercase,
  lowercase, digit, and special character. Currently no password policy is enforced
  (`src/index.ts:147-149` accepts any non-empty password).
- [HIGH] Add a **password breach check** (k-anonymity HaveIBeenPwned API or local leak db) on
  registration and password change.

**Remediation example (Argon2id):**
```typescript
// src/services/auth/password.ts
import argon2 from "argon2";

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    timeCost: 3,    // OWASP minimum
    memoryCost: 64 * 1024, // 64 MB
    parallelism: 2,
  });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
```

#### 1.2.2 JWT & Token Management
- [CRITICAL] Rotate `AUTH_JWT_SECRET` from environment; reject the default `"dev-secret-change-me"`
  in production (`src/config/index.ts:62`).
- [HIGH] Reduce JWT expiry from 30 days to **15 minutes** and implement a **refresh-token**
  rotation flow. Currently `src/middleware/auth.ts:54-56` signs tokens with `expiresIn: "30d"`
  and there is no refresh mechanism.
- [HIGH] Implement **JWT revocation** via a denylist (Redis or DB-backed). Currently tokens are
  stateless with no revocation path. Session records exist (`src/db/migrations/012_user_sessions.sql`)
  but are not used by `requireAuth`.
- [HIGH] Store the JWT in an **HttpOnly, Secure, SameSite=Strict** cookie instead of
  localStorage. The current implementation returns the token in the JSON body
  (`src/index.ts:180-181`) and the frontend stores it in memory or localStorage.
- [MEDIUM] Add `issuer`, `audience`, and `not-before` (nbf) claims to the JWT payload.

**Secure cookie example:**
```typescript
// src/middleware/auth.ts — setCookie helper
function setTokenCookie(res: Response, token: string) {
  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: true,       // HTTPS only
    sameSite: "strict",
    maxAge: 15 * 60 * 1000, // 15 min
    path: "/",
  });
}
```

#### 1.2.3 2FA / MFA
- [N/A] TOTP implementation in `src/services/auth/totp.ts` uses HMAC-SHA1, which is the
  standard algorithm for TOTP (RFC 6238). No change required.
- [LOW] Add support for **WebAuthn / passkeys** (FIDO2) as a second factor alongside TOTP.
- [N/A] Recovery codes are hashed with SHA-256 and stored as hashes
  (`two-factor.service.ts:47-48`). Good.
- [N/A] Lockout after 5 failed attempts in 15-min window
  (`two-factor.service.ts:33-34`). Good. Consider exponential backoff.
- [MEDIUM] Audit: 2FA **should be mandatory** for all users in production, not optional.
  Currently `two_factor_enabled` defaults to `FALSE` (see `005_users_2fa.sql:20`).

#### 1.2.4 OAuth (Google)
- [LOW] Add **PKCE** (Proof Key for Code Exchange) to the authorization code flow. Currently
  uses plain `state` param (`src/index.ts:386-394`). PKCE protects against authorization-code
  interception even for server-side apps.
- [N/A] The `state` parameter is stored in an HttpOnly cookie and validated on callback
  (`src/index.ts:382-431`). Good.
- [HIGH] The OAuth callback redirects the JWT token in the URL **hash fragment**
  (`src/index.ts:422`), which is accessible to JavaScript on the frontend. Use a cookie or
  POST redirect instead.

#### 1.2.5 Rate Limiting
- [CRITICAL] No rate limiting on auth endpoints (`/api/auth/login`, `/api/auth/register`,
  `/api/auth/2fa/verify`). Implement per-IP and per-user rate limiting (e.g.,
  `express-rate-limit` with a Redis store). Currently no rate limiter is configured anywhere
  in `src/index.ts`.
- [MEDIUM] Implement account lockout after N failed password attempts (separate from 2FA
  lockout, which already exists).

**Remediation example:**
```typescript
// src/middleware/rate-limit.ts
import rateLimit from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5, // 5 attempts per window
  keyGenerator: (req) => `${req.ip}:${req.body.email ?? "unknown"}`,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many attempts. Try again later." });
  },
  standardHeaders: true,
  legacyHeaders: false,
});
```

#### 1.2.6 Dev Auth Stub Mode
- [CRITICAL] `AUTH_MODE=dev` in `.env.example:5` allows trusted-header authentication
  (`src/config/index.ts:61`). Must be disabled in production. Add a startup guard:
  ```typescript
  // src/config/index.ts
  if (env.AUTH_MODE === "dev" && isProduction) {
    throw new Error("AUTH_MODE=dev is not permitted in production");
  }
  ```

---

## 2. Authorization & Tenant Isolation

### 2.1 Current State in Codebase

| Mechanism | Location | Status |
|---|---|---|
| JWT-based auth middleware | `src/middleware/auth.ts:15-37` | [N/A] Good — decodes JWT, sets `req.user` |
| Tenant ID in JWT | `src/middleware/auth.ts:31-35` — `businessId` | [N/A] Good |
| Entitlement checks | `src/middleware/entitlement.ts:13-33` | [MEDIUM] Only on gated endpoints |
| Repository-level tenant scoping | All repos use `businessId` in WHERE clauses | [N/A] Good pattern |
| IDOR protection | Enforced via `business_id` in queries | [N/A] Good, but see gaps below |
| RBAC / roles | Single `owner_id` per business | [HIGH] No granular roles |

### 2.2 Checklist

#### 2.2.1 Backend Authorization (Every Endpoint)
- [HIGH] Audit every route to verify that **tenant-scoped authorization is enforced independently
  of the frontend**. The current pattern at `src/index.ts` consistently checks
  `if (!req.user?.businessId) return res.status(400)` and then passes `req.user.businessId`
  to service/repository calls. This is correct but repetitive.

**Audit methodology:** For every route handler, verify:
1. `requireAuth` middleware is present.
2. `req.user.businessId` is checked before any DB operation.
3. The `businessId` from the JWT is passed to every repository call that queries tenant-scoped
   tables.
4. No DB query uses a user-supplied ID without scoping by `business_id`.

#### 2.2.2 IDOR Prevention
- [N/A] Good pattern: Repository methods always accept `businessId` and include it in the
  WHERE clause. For example:
  - `InvoiceRepository.findById(businessId, id)` — `src/repositories/invoice.repo.ts:287`
  - `CustomerRepository.findById(businessId, id)` — `src/repositories/customer.repo.ts:216`
  - `ReceiptRepository.findById(businessId, id)` — `src/repositories/receipt.repo.ts:66`
  - `QuoteService.findById(businessId, id)` — `src/services/quote-service.ts:330`

- [HIGH] **One exception** in `receipt.repo.ts`: `findByIdRaw(id)` at line 75-79 does **NOT**
  filter by `businessId`. This is used by `ReceiptService.sendReceiptEmail` (line 378).
  If the `receiptId` is passed from user input without tenant verification upstream, this
  is an IDOR vector. Verify the calling route at `src/index.ts:1156-1164` always resolves
  the ID through `receiptService.getById(businessId, id)` first — it does, so the risk is
  contained but the method should still be audited.

- [HIGH] `setPublicToken(id)` in `src/services/quote-service.ts:404` does **NOT** scope by
  `businessId`. While only called internally after tenant-check (e.g., `send()` at line 495
  calls `findById(businessId, id)` first), this breaks the repository-layer invariant.
  Fix: add `businessId` parameter to the UPDATE query.

- [MEDIUM] `findByPublicToken(undefined, token)` in `src/repositories/invoice.repo.ts:336`
  accepts an optional `businessId`. When called without `businessId`, it queries by
  `public_token` alone. This is used for **public invoice views** (customer-facing, no auth).
  This is intentional — public tokens are random 48-character hex strings
  (`src/utils/crypto.ts:7-8`). However, ensure public tokens **expire** and are rotated.
  Currently `setPublicToken` sets a 30-day expiry
  (`src/services/invoice-service.ts:417`) and the token is used for public view + payment.

#### 2.2.3 Entitlement / Authorization Gaps
- [MEDIUM] Many endpoints use `requireAuth` only, without `requireEntitlement`. For example:
  - `GET /api/invoices` (`src/index.ts:846`) — should require `invoices.history`
  - `GET /api/customers` (`src/index.ts:628`) — no entitlement check, but customer listing
    is gated by subscription limits at create time
  - `GET /api/reports/volume-trend` (`src/index.ts:1231`) — missing `requireEntitlement`
    while `revenue` and `tax-summary` have it
- [MEDIUM] `requireEntitlement` at `src/middleware/entitlement.ts:13` throws synchronously if
  `req.user?.businessId` is missing, but the error is not caught by Express async handler.
  The middleware is declared `async` but throws inside a non-async path at line 15-16. This
  could cause unhandled promise rejections. Verify the error handler catches this.

#### 2.2.4 RBAC / Team Access
- [HIGH] The application has a `business_users` table with roles
  (`src/db/migrations/020_team_access.sql`) and `requireEntitlement("business.multiple")`, but
  there is **no per-resource access control**. Any team member with a valid JWT can access
  all resources of the business. Implement role-based access control at the service layer:
  - `owner` — full access
  - `admin` — can manage team, billing, all CRUD
  - `member` — can create/edit invoices, customers, projects
  - `viewer` — read-only access

#### 2.2.5 Public Token Security
- [MEDIUM] Public tokens (`public_token` column) allow unauthenticated access to invoice PDFs
  and payment forms. Ensure:
  - Tokens expire (`public_token_expires_at` column) — **enforced** in the public routes?
    Check `src/index.ts:2396-2429` — token is looked up via `findByPublicToken(undefined,
    token)` which does **not** check expiration. Add an expiry check.
  - Tokens are long and random (48 hex chars = 192 bits). Good
    (`src/utils/crypto.ts:7-8`).
  - Log access to public tokens for audit. Currently no logging on public invoice views.

---

## 3. Input Validation & Data Integrity

### 3.1 Current State in Codebase

| Pattern | Location | Status |
|---|---|---|
| Zod schema validation | `src/domain/schemas/*.ts` | [N/A] Good |
| Request body parsing | `express.json({ limit: "10mb" })` | [MEDIUM] 10mb limit is generous |
| Query param validation | Selective — e.g., `CustomerSearchQuerySchema` | [HIGH] Inconsistent |
| Raw `req.body` usage | Several routes pass `req.body` directly | [HIGH] Missing schemas |
| SQL parameterization | All queries use `$1, $2` placeholders | [N/A] Good — no string concatenation |

### 3.2 Checklist

#### 3.2.1 Request Body Validation
- [HIGH] Several route handlers pass `req.body` directly to services without Zod validation:
  - `src/index.ts:733` — `productRepository.create(req.user!.businessId, req.body)` — no schema
  - `src/index.ts:920` — `invoiceService.createDraft(req.body, ...)` — no schema (CreateInvoiceDraftInput)
  - `src/index.ts:1188-1195` — recurring invoice creation — no schema
  - `src/index.ts:1344-1349` — template creation — uses `req.body.name`, `req.body.htmlTemplate` directly
  - `src/index.ts:1591` — `req.body.targetVersion as string` — no schema

  **Fix:** Apply Zod schemas to all request bodies. Create DTO schemas in
  `src/domain/schemas/` or `src/schemas/`.

**Example pattern (already used in the codebase):**
```typescript
// src/index.ts:646
const parsed = CustomerCreateSchema.parse(req.body);
// src/index.ts:760
const params = CatalogSearchSchema.parse(req.query);
```

#### 3.2.2 Query Parameter Validation
- [HIGH] Many endpoints parse query params manually with `Number()` / `String()` instead of
  Zod schemas. For example:
  - `src/index.ts:846-867` — `InvoiceListOptions` parsed manually from `req.query`
  - `src/index.ts:692-694` — `limit`, `offset`, `status` parsed manually
  - `src/index.ts:725-726` — `limit`/`offset` parsed manually

  **Fix:** Create Zod schemas for all query parameter objects (like
  `CustomerSearchQuerySchema` at `src/domain/schemas/customer.ts:103`) and apply consistently.

#### 3.2.3 SQL Injection Prevention
- [N/A] Good: All queries in repository files use parameterized queries with `$1, $2, ...`
  placeholders. Example: `src/repositories/invoice.repo.ts:287`:
  ```typescript
  const res = await query(
    `SELECT i.* FROM invoices i WHERE i.id = $1 AND i.business_id = $2`,
    [id, businessId]
  );
  ```
- [N/A] The dynamic query builders (e.g., `findManyPage` at `src/repositories/invoice.repo.ts:509`)
  use parameterized conditions and an allowlist for sort columns
  (`INVOICE_SORT_COLUMNS` at line 92). Column names are never interpolated from user input.

- [MEDIUM] `src/index.ts:254` — `req.params.sessionId` is passed to a parameterized query. Good.
  But audit any string interpolation in SQL: there are dynamic SQL fragments like
  `` `UPDATE invoices SET ${set.join(", ")}` `` at `src/repositories/invoice.repo.ts:247`. The
  column names come from an allowlist (`INVOICE_ALLOWED_COLUMNS`), so this is safe.

#### 3.2.4 File Upload Validation
- [CRITICAL] No file upload endpoints exist in the current route set. If file uploads are
  added (e.g., for customer attachments or business logos), enforce:
  - MIME type allowlist (not just extension)
  - File size limits
  - Virus scanning
  - Store uploaded files outside the web root or in object storage (S3/GCS)
  - Generate random filenames

#### 3.2.5 JSON / Nested Object Validation
- [MEDIUM] Several endpoints accept arbitrary JSON objects (e.g., `config: z.record(z.string(), z.unknown())`
  in `DocumentTemplateInputSchema` at `src/domain/schemas/document-template.ts:23`). While not
  directly exploitable, deeply nested or very large JSON payloads can cause DoS. Add a
  `express.json({ limit: "1mb" })` or per-endpoint size limits for nested objects.

---

## 4. Application Security & Headers

### 4.1 Current State in Codebase

| Header / Protection | Location | Status |
|---|---|---|
| Helmet | `src/index.ts:86` — `app.use(helmet())` | [N/A] Good — applies defaults |
| Compression | `src/index.ts:87` | [N/A] Good |
| CORS | `src/index.ts:88` — `cors({ origin: isDev ? true : frontendBaseUrl, credentials: true })` | [HIGH] Too permissive in dev |
| Body parser limit | `src/index.ts:89` — `express.json({ limit: "10mb" })` | [MEDIUM] 10mb is generous |
| Error handling | `src/index.ts:2555-2562` — generic error handler | [N/A] Good — no stack traces leaked |

### 4.2 Checklist

#### 4.2.1 Security Headers (Helmet)
- [N/A] Helmet is applied globally (`src/index.ts:86`). Default Helmet config includes:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security` (only in production via Helmet)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-XSS-Protection: 0` (disabled in favor of CSP)

- [MEDIUM] **HSTS is not configured for production.** Helmet only sets HSTS when
  `app.set('trust proxy')` is configured and the request is over HTTPS. Add explicit HSTS:
  ```typescript
  app.use(helmet({
    hsts: {
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: true,
    },
  }));
  ```

- [MEDIUM] **Content-Security-Policy** is not explicitly configured. Helmet sets a default CSP,
  but it may be too permissive. Configure a strict CSP:
  ```typescript
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: isDev ? ["'self'", "'unsafe-eval'"] : ["'self'"],
        styleSrc: ["'self'", "unsafe-inline"], // needed for inline styles
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  }));
  ```

- [N/A] `X-Content-Type-Options: nosniff` — set by Helmet. Good.
- [N/A] `Referrer-Policy` — set by Helmet to `strict-origin-when-cross-origin`. Good.
- [N/A] `Permissions-Policy` — can be explicitly configured:
  ```typescript
  app.use(helmet({
    permissionsPolicy: {
      directives: {
        camera: ["'none'"],
        microphone: ["'none'"],
        geolocation: ["'none'"],
      },
    },
  }));
  ```

#### 4.2.2 CORS Configuration
- [HIGH] In development, CORS is set to `origin: true` which reflects any origin
  (`src/index.ts:88`). This is acceptable for dev but ensure production only allows the
  configured frontend URL. Already correct: `isDev ? true : frontendBaseUrl`.
- [MEDIUM] No CORS preflight caching configured. Add `maxAge` to reduce OPTIONS requests.

#### 4.2.3 XSS Prevention
- [N/A] The frontend is a separate SPA (`webapp/`). Server-rendered HTML uses Handlebars
  (`src/services/templates/template-renderer.ts`) with default escaping. Good.
- [HIGH] `src/services/receipt-service.ts:326` compiles Handlebars with `{ noEscape: true }`:
  ```typescript
  const compiled = Handlebars.compile(RECEIPT_TEMPLATE, { noEscape: true });
  ```
  This disables HTML escaping. While the receipt data is currently server-generated (not user
  input), if any user-supplied data (e.g., customer name, receipt number) flows into this
  template, it would be an XSS vector. Audit the template data sources.

#### 4.2.4 CSRF Protection
- [HIGH] The API uses Bearer token authentication (JWT in Authorization header), which is
  not vulnerable to CSRF in the traditional sense. However, the **OAuth flow** uses cookies:
  ```typescript
  res.cookie("oauth_state", state, { httpOnly: true, sameSite: "lax", ... });
  ```
  If the JWT is also moved to cookies (see 1.2.2), CSRF protection becomes critical. Implement
  CSRF tokens for cookie-based authentication:
  - Use `express-session` with `csrf` middleware, or
  - Require a custom header (e.g., `X-CSRF-Token`) on state-changing requests when cookies are used.

#### 4.2.5 Open Redirect Prevention
- [MEDIUM] Check all redirect URLs for whitelist enforcement:
  - `src/index.ts:404-410` — redirects to `env.APP_FRONTEND_URL` (trusted). Good.
  - `src/index.ts:421` — OAuth callback redirects to frontend with token in hash. The URL is
    constructed from `env.APP_FRONTEND_URL` (trusted). Good.
  - Search for any dynamic redirect based on user input throughout the codebase.

#### 4.2.6 Request Body Size Limits
- [MEDIUM] `express.json({ limit: "10mb" })` at `src/index.ts:89` allows 10MB bodies.
  Reduce to `1mb` for most endpoints. Add per-route overrides only where needed (e.g., CSV imports).

---

## 5. Secrets & Infrastructure Security

### 5.1 Current State in Codebase

| Secret | Location | Status |
|---|---|---|
| JWT secret | `.env`, `process.env.AUTH_JWT_SECRET` | [CRITICAL] Default hardcoded |
| DB URL | `.env`, `process.env.DATABASE_URL` | [N/A] Good — env var |
| Stripe keys | `.env`, `process.env.STRIPE_*` | [N/A] Good — env vars |
| Google OAuth | `.env`, `process.env.GOOGLE_*` | [N/A] Good — env vars |
| bcrypt in dev tests | `tests/helpers/db.ts:79` | [LOW] Uses cost 5 |

### 5.2 Checklist

#### 5.2.1 Secret Management
- [CRITICAL] The `.env.example` file at line 6 contains `AUTH_JWT_SECRET=dev-secret-change-me`.
  Enforce a minimum secret length and entropy in production config validation
  (`src/config/index.ts:56-81`):
  ```typescript
  AUTH_JWT_SECRET: z.string().min(32, "JWT secret must be at least 32 characters"),
  ```
  Additionally, fail fast if `AUTH_JWT_SECRET` equals `"dev-secret-change-me"` in production.

- [HIGH] No secrets manager integration (AWS Secrets Manager, HashiCorp Vault, GCP Secret
  Manager). For production, replace `.env` with secrets manager fetches. The current
  `src/config/index.ts` pattern (dotenv → Zod schema) can be extended to fetch from a secrets
  manager in production.

- [MEDIUM] Stripe publishable key is exposed via an endpoint:
  ```typescript
  // src/index.ts:584
  app.get("/api/stripe/config", async (_req, res) => {
    res.json({ publishableKey: env.STRIPE_PUBLISHABLE_KEY });
  });
  ```
  This is acceptable (publishable keys are meant to be public), but ensure this endpoint is
  not behind auth (correct — it's not) and that the secret key is never exposed. Verify no
  other endpoint leaks secret keys.

- [MEDIUM] The Stripe webhook secret verification:
  ```typescript
  // src/index.ts:588-601
  const event = await stripeService.constructWebhookEvent(req.body, signature);
  ```
  Verify that `STRIPE_WEBHOOK_SECRET` is validated and the raw body is not logged. Check
  `src/services/payments/stripe-service.ts`.

#### 5.2.2 Database Security
- [HIGH] Database connection string is in `.env`. For production:
  - Use TLS/SSL for all DB connections: `DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require`
  - Use a dedicated least-privilege DB user (not `postgres` as in `.env.example:3`)
  - Enable encryption at rest (PostgreSQL TDE or filesystem-level encryption)

- [MEDIUM] No row-level security (RLS) policies on PostgreSQL tables. The application
  enforces tenant isolation at the query layer (every repository method includes
  `business_id` in WHERE clauses). However, as defense-in-depth, enable RLS on all
  tenant-scoped tables and create policies:
  ```sql
  ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "tenant_isolation" ON invoices
    FOR ALL TO app_user
    USING (business_id = current_setting('app.current_business_id')::uuid);
  ```
  Set `app.current_business_id` at the start of each request session.

- [MEDIUM] The `migrations` table and all schema objects are accessible to the application DB
  user. Consider a separate migration runner role with DDL privileges, and an application
  role with only DML privileges (SELECT, INSERT, UPDATE, DELETE) on specific tables.

- [N/A] Connection pool is configured with reasonable defaults
  (`src/db/pool.ts:10-15`): max 20 connections, 30s idle timeout, 5s connection timeout.

#### 5.2.3 Frontend Secret Exposure
- [MEDIUM] Verify that no environment variable prefixed with `VITE_*` or accessible to the
  frontend bundle contains secrets. Check `webapp/vite.config.ts` and
  `webapp/src/` for any `.env` access patterns. The Vite dev server proxy
  (`webapp/vite.config.ts`) may expose backend endpoints — ensure proxy does not forward
  cookies or auth headers inappropriately.

#### 5.2.4 Email / PDF / AI Providers
- [MEDIUM] Provider abstractions use a provider pattern (stub, smtp, sendgrid, ses for email;
  html/stub for PDF; stub/openai/anthropic for AI). Ensure stub providers are **not** used
  in production — validate provider selection at startup:
  ```typescript
  if (isProduction && env.EMAIL_PROVIDER === "stub") {
    throw new Error("EMAIL_PROVIDER=stub is not allowed in production");
  }
  ```

---

## 6. Dependency & Operational Security

### 6.1 Current State in Codebase

| Aspect | Location | Status |
|---|---|---|
| Lockfile | `package-lock.json` | [N/A] Good — committed |
| Linting | `eslint.config.js` — ESLint 9 flat config | [N/A] Good |
| Type checking | `tsc -p tsconfig.typecheck.json` | [N/A] Good |
| Testing | `vitest.config.ts` | [N/A] Good — integration tests |
| No `npm audit` in CI | — | [HIGH] Missing |

### 6.2 Checklist

#### 6.2.1 Dependency Management
- [HIGH] Add `npm audit` to CI pipeline. Currently no security audit step in the test/lint
  workflow (see `package.json:21-22` for current scripts).
- [MEDIUM] Add `npm audit --audit-level=moderate` as a CI gate.
- [MEDIUM] Consider adding `npm-check-updates` or `renovate` for automated dependency updates
  with PR reviews.
- [LOW] Pin all dependencies to exact versions (no `^` ranges) in production. The current
  `package.json` uses `^` for most dependencies, which allows minor/patch updates that could
  introduce regressions. Use `npm ci` in CI/CD for deterministic installs.

#### 6.2.2 Rate Limiting (General)
- [CRITICAL] No general rate limiting is applied to the API. Implement a global rate limiter
  for all `/api/*` routes:
  ```typescript
  app.use("/api/", rateLimit({
    windowMs: 60 * 1000, // 1 min
    max: 120, // 120 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
  }));
  ```

#### 6.2.3 WAF / CDN Integration
- [HIGH] No WAF or CDN is configured. For production, deploy behind:
  - **Cloudflare** (free tier provides WAF, DDoS protection, CDN, and rate limiting)
  - **AWS WAF + CloudFront**, or **GCP Cloud Armor + Cloud CDN**
  - Configure WAF rules to block:
    - SQL injection patterns
    - XSS payloads
    - Path traversal attempts
    - Known bot traffic

#### 6.2.4 Abuse Detection
- [HIGH] No abuse detection or alerting. Implement:
  - Log-based anomaly detection (e.g., unusual request volume, failed auth spikes)
  - IP-based blocking for repeated violations
  - Alerting on security events (brute-force attempts, IDOR attempts, etc.)

#### 6.2.5 HTTP Security
- [MEDIUM] Set `X-Powered-By` header is not disabled. Express removes it by default, but
  verify: `app.disable("x-powered-by")` or ensure Helmet handles it.
- [MEDIUM] Set `Server` header obfuscation (Cloudflare/NGINX handles this in production).

---

## 7. Logging, Monitoring, & CI/CD

### 7.1 Current State in Codebase

| Aspect | Location | Status |
|---|---|---|
| Logger | `src/utils/logger.ts` — Pino | [N/A] Good |
| Request logging | `src/index.ts:96-118` — custom middleware | [MEDIUM] No structured logging |
| Error logging | `src/index.ts:2555-2556` — `logger.error({ err })` | [N/A] Good |
| Auth event logging | 2FA service logs enable/disable | [HIGH] No login/logout audit |
| CI/CD | Not defined | [CRITICAL] No CI/CD pipeline |

### 7.2 Checklist

#### 7.2.1 Security Logging
- [HIGH] Log all **authentication events**:
  - Successful logins (user ID, IP, user agent)
  - Failed login attempts (user ID/email, IP, user agent, failure reason)
  - 2FA verification success/failure
  - Password changes
  - Session revocation

  Currently, 2FA events are logged (`two-factor.service.ts:81, 112, 177, 195`) but general
  login/logout events are not. Add structured logging to auth endpoints:
  ```typescript
  // src/index.ts:184 (login handler)
  logger.info({ email, ip: req.ip, userAgent: req.headers["user-agent"], event: "login_success" }, "Login successful");
  logger.warn({ email, ip: req.ip, userAgent: req.headers["user-agent"], event: "login_failed" }, "Login failed");
  ```

- [HIGH] Log all **authorization / permission changes**:
  - Business role changes (`src/index.ts:2232-2251` — team member patch)
  - Subscription plan changes (`src/index.ts:505-509` — upgrade, `531-539` — downgrade)
  - Template permission changes (`src/index.ts:1616-1624`)

- [HIGH] Log all **suspicious access attempts**:
  - 404s on tenant-scoped resources (potential IDOR probing)
  - 403s (permission denied)
  - Repeated failed auth attempts (brute force)

- [MEDIUM] **Sanitize PII from logs**: Never log passwords, tokens, or full PII. The current
  logger logs user IDs and emails — ensure no password hashes or JWT tokens are ever logged.

#### 7.2.2 Centralized Logging
- [HIGH] Logs are currently written to stdout/stderr via Pino. In production, forward to a
  centralized log management system:
  - **Datadog**, **New Relic**, **Loki/Grafana**, or **ELK Stack**
  - Configure log rotation and retention (minimum 90 days for security events)
  - Set up alerting on security events

#### 7.2.3 Monitoring & Alerting
- [HIGH] No application metrics or health checks configured. Add:
  - **Health check endpoint** — exists at `src/index.ts:128` (`/api/health`). Good.
  - **Application metrics** (Prometheus/OpenTelemetry):
    - Request rate, latency, error rate
    - Database query latency
    - Authentication success/failure rates
  - **Uptime monitoring** (UptimeRobot, Datadog Synthetics)
  - **Error tracking** (Sentry, Rollbar) for unhandled exceptions

#### 7.2.4 CI/CD Security Gates
- [CRITICAL] No CI/CD pipeline is defined. Create a `.github/workflows/` or similar CI config
  with the following security gates:

| Gate | Command | Failure Threshold |
|---|---|---|
| Type checking | `npm run typecheck` | Any error |
| Linting | `npm run lint` | Any error |
| Unit tests | `npm run test` | Any failure |
| Dependency audit | `npm audit --audit-level=moderate` | Moderate+ vulnerabilities |
| Secrets scan | `gitleaks` or `trufflehog` | Any secrets in diff |
| Static analysis | `semgrep` or `sonarqube` | High-severity findings |
| Build | `npm run build` | Any failure |

**Example GitHub Actions workflow:**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
      - run: npm audit --audit-level=moderate
      - uses: gitleaks/gitleaks-action@v2
```

#### 7.2.5 Error Response Information Disclosure
- [N/A] The error handler at `src/index.ts:2555-2562` returns generic messages without stack
  traces in production. Good. The `AppError` class at `src/domain/errors.ts:1-16` includes
  `isOperational` flag for distinguishing expected vs unexpected errors.

#### 7.2.6 Transaction Safety
- [MEDIUM] Audit all write operations that span multiple queries for transaction safety.
  The invoice service uses explicit transactions with `BEGIN`/`COMMIT`/`ROLLBACK`
  (`src/services/invoice-service.ts:309-325`). Verify all multi-table writes follow this
  pattern.

---

## Appendix A: Summary Table — Risk Priorities

| Priority | Count | Key Items |
|---|---|---|
| CRITICAL | 4 | Hardcoded JWT secret, no rate limiting, dev auth stub in prod, no CI/CD |
| HIGH | 9 | JWT 30-day expiry, no HTTP-only cookie, IDOR in `findByIdRaw`, missing Zod schemas on many endpoints, no RBAC roles, no abuse detection, no centralized logging, secrets manager not integrated, no WAF/CDN |
| MEDIUM | 10 | bcrypt cost factor, no password policy, PKCE missing for OAuth, 2FA not mandatory, public token expiry not enforced, 10mb body limit, HSTS misconfiguration, missing query param schemas, dependency pinning, HTTP header hardening |
| LOW | 3 | No WebAuthn support, verbose logging in dev, no upc-check for passwords |

---

## Appendix B: Files Requiring Immediate Attention

| File | Issue | Priority |
|---|---|---|
| `src/config/index.ts` | Hardcoded default JWT secret, no production guards | CRITICAL |
| `src/middleware/auth.ts` | 30-day JWT expiry, no cookie-based auth, no revocation | HIGH |
| `src/middleware/entitlement.ts` | Synchronous throw in async middleware, potential unhandled rejection | MEDIUM |
| `src/index.ts` | No rate limiting, raw `req.body` on multiple routes, verbose dev logging | HIGH/MEDIUM |
| `src/repositories/receipt.repo.ts:75-79` | `findByIdRaw` does not scope by `businessId` | HIGH |
| `src/services/quote-service.ts:404` | `setPublicToken` does not scope by `businessId` | HIGH |
| `src/services/receipt-service.ts:326` | Handlebars `noEscape: true` — XSS risk | HIGH |
| `src/db/migrations/001_initial_schema.sql` | No RLS policies, DB user uses superuser | MEDIUM |
| `AGENTS.md` / `package.json` | No CI/CD security gates | CRITICAL |

---

## Appendix C: Security Testing Recommendations

### C.1 Unit / Integration Tests to Add

1. **IDOR tests**: For every tenant-scoped resource endpoint, create a second business,
   attempt to access resource from business A using business B's JWT, and assert 404.
   *Existing pattern* in `tests/customer-api.test.ts:128-135` (good, extend to all resources).

2. **Auth tests**:
   - 401 without token
   - 401 with expired token
   - 401 with tampered token
   - 429 after rate limit exceeded

3. **Input validation tests**:
   - Reject malformed JSON
   - Reject oversized payloads
   - Reject missing required fields
   - Reject invalid enum values

4. **Public token tests**:
   - 404 for expired public token
   - 404 for invalid public token

### C.2 Tools to Integrate

| Tool | Purpose | CI Step |
|---|---|---|
| `npm audit` | Dependency vulnerability scanning | Every build |
| `gitleaks` / `trufflehog` | Secrets in code | Pre-commit + CI |
| `semgrep` | Static analysis (SAST) | CI |
| `OWASP ZAP` | Dynamic scanning (DAST) | Pre-deploy |
| `snyk` / `dependabot` | Dependency monitoring | CI + PR comments |

---

## Appendix D: Implementation Roadmap (By Phase)

### Phase 1 — Critical (Deploy-blocking)
1. Enforce non-default JWT secret in production (`src/config/index.ts`)
2. Add rate limiting to auth endpoints (`express-rate-limit`)
3. Disable `AUTH_MODE=dev` in production
4. Move JWT to HttpOnly cookie with 15-minute expiry + refresh token flow

### Phase 2 — High (Current cycle)
1. Add Zod schemas to all remaining `req.body` and `req.query` handlers in `src/index.ts`
2. Fix `findByIdRaw` and `setPublicToken` to enforce tenant scoping
3. Add RBAC roles and per-resource access control
4. Fix Handlebars `noEscape: true` in receipt template
5. Enforce public token expiry checks

### Phase 3 — Medium (Next cycle)
1. Implement CSRF protection (if moving to cookie-based auth)
2. Increase bcrypt cost factor to 12 (or migrate to Argon2id)
3. Add HSTS, strict CSP, and Permissions-Policy headers
4. Enable PostgreSQL RLS as defense-in-depth
5. Integrate secrets manager

### Phase 4 — Ongoing
1. Deploy behind WAF/CDN (Cloudflare)
2. Set up centralized logging and monitoring
3. Create CI/CD pipeline with security gates
4. Implement abuse detection and alerting
5. Schedule regular penetration tests and dependency audits