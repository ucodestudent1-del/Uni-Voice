# Anchored Summary: Codebase Exploration

## Project: Universal Invoice Generator

A full-stack SaaS invoice generator (Express + TypeScript + PostgreSQL backend; React + Vite + TypeScript + Tailwind frontend).

### 1. Stack & Tooling
- **Backend**: Express + TypeScript, `decimal.js` for money, `zod` for validation, `handlebars` templates, `nodemailer` (stub), pluggable PDF service, JWT auth (dev stub via trusted headers), `vitest` tests.
- **Frontend**: React 18 + Vite + TypeScript + Tailwind + `dnd-kit` (drag-drop editor) + `zod`.
- **Monorepo-ish layout**: backend at repo root (`src/`) served on `:4000`; frontend in `webapp/` served on `:5173`. `npm run dev:all` runs both concurrently.

### 2. Backend Layout (`src/`)
- `index.ts` — single entry: Express app. All routes defined inline (850+ lines). Runs migrations at startup; serves frontend static in prod.
- `config.ts` — env config (DB URL, Stripe keys, JWT secret, feature flags, dev stub mode).
- `db/` — `pool.ts` (pg Pool), `migrate.ts` (migration runner), `migrations/001–008.sql`.
- `domain/` — value-objects (`Decimal`, `Email`, `Money`, `Percentage`, `InvoiceNumber`), models, errors, calculation engine, schemas, onboarding, subscription.
- `repositories/` — invoice, business, customer, product, template, subscription, onboarding, document-template, helpers.
- `services/` — invoice-service, state-machine, numbering, snapshot, templates (template-renderer), tax, email, pdf, payments (stripe), auth (totp, two-factor, oauth), subscription, onboarding.
- `middleware/` — `auth.ts` (requireAuth, optionalAuth, dev stub), `entitlement.ts` (requireEntitlement, requireUsageLimit).
- `schemas/` — invoice-dto (zod), subscription.
- `utils/logger.ts`, `utils/crypto.ts`.

### 3. Database — 8 Migrations
- **001**: core tenant model — `businesses`, `users`, `business_members`, `business_subscriptions` (Stripe), `subscription_plan_limits`.
- **002**: `customers`, `products` (tenant-isolated).
- **003**: `invoices`, `invoice_items`, `invoice_fees`, `tax_lines`, `invoice_events`.
- **004**: `invoice_number_sequences` + `invoice_audit_log`.
- **005**: `payments` (idempotent), `payment_transactions`.
- **006**: `quotes`, `recurring_invoices` (+ `recurring_invoice_items`), `subscription_events`.
- **007**: `business_tax_rates`, `business_email_templates`, `business_settings`.
- **008**: `feature_flags` + `premium_feature_flags` (entitlement gating for plans).

### 4. Backend API Routes (`src/index.ts`) — by section
- **HEALTH** `/api/health`
- **AUTH**: register, login, logout, `/api/auth/session`, 2FA enable/disable/recovery-codes, Google OAuth (`/oauth/google`, `/oauth/google/callback`). Dev stub uses trusted headers.
- **ONBOARDING**: `GET /progress`, `POST step/:step/{complete,start,skip}`, `POST /complete`.
- **PLANS/SUB**: `GET /plans`, `GET /subscription/current`, `POST /upgrade`, `POST /downgrade`, `GET /stripe/config`, Stripe webhook `/webhooks/stripe`, `GET /subscription/events`.
- **BUSINESSES**: `GET/PATCH /businesses/current`, number-sequence GET/PATCH.
- **CUSTOMERS**: list/create/get/update/delete (tenant-scoped; create gated by `customers.unlimited` usage limit).
- **PRODUCTS**: list/create/get/update/delete (tenant-scoped).
- **INVOICES**: list (filter by status/customerId), create draft, get, patch, PUT items, PUT fees, POST finalize, POST send (gated `reminders.automated`), POST pdf, GET events, POST duplicate (gated `invoices.duplicate`).
- **QUOTES**: list/create (`quotes.create` entitlement), convert to invoice (`quotes.convert`).
- **RECURRING**: list/create (`invoices.recurring`).
- **REPORTS**: `reports.revenue`, `reports.tax_summary` (both finalized invoices).
- **EXPORTS**: `export.csv` (gated).
- **FEATURES**: `GET /api/features` (plan + feature flags).
- **TEMPLATES**: list/create/get/default/update/delete.
- **PAYMENTS**: list/create (idempotent key, default `stub` provider).
- **TAX RATES**: `GET /api/tax-rates`.
- **PUBLIC**: `GET public/invoices/:token`, `GET .../pdf`, `POST .../view` (optional auth).
- All `requireAuth` routes enforce `req.user.businessId` for tenant isolation. Errors funneled through final async handler.

### 5. Frontend Layout (`webapp/src/`)
- `App.tsx` — router: Landing → Login/Register/AuthCallback → OnboardingWizard → (Protected) Dashboard → Invoices (list, editor/:id, public/:id), Customers, Products, Templates, Plans, Settings, Reports, Expenses.
- `components/` — UpgradePrompt, Layout, TemplateGallery, Section, PricingTable, icons, FeaturesSection, FaqSection, TwoFactorManager, TemplateSelector, TaxSelector, SubscriptionCard, OnboardingProgress, InvoiceEditor, InvoicePreview, CustomerSelector, FeatureGate.
- `document-model/` — the structured document engine: `types.ts`, `schemas.ts` (zod), `document-operations.ts`, `converter.ts`, `DocumentPreview.tsx`, `editor/DocumentEditor.tsx`, `editor/ComponentPalette.tsx`, `editor/EditorContext.tsx`, `editor/PropertyInspector.tsx`, `registry/index.ts`, `registry/components.tsx` (1300+ line custom component library).
- `lib/api.ts` — thin HTTP client wrapper hitting backend `:4000`.
- `vitest.config.ts` — unit test config.

### 6. Key Invariants Observed
1. Finalized invoices are **immutable** — snapshotted (snapshot service).
2. Invoice numbers are **atomic** (DB-level) and unique per business.
3. **Backend is authoritative** for all calculations (Decimal-based engine).
4. **Tenant isolation** enforced at every DB query (businessId passed through).

### 7. Phases Implemented (per AGENTS.md)
- Phase 1 (Core): full ✓
- Phase 2 (Documents): full ✓
- Phase 3 (Payments): abstraction + idempotent records ✓ (stub provider)
- Phase 4 (Automation): recurring invoices + quotes ✓ (stub scheduler)
- Phase 5 (Intelligence): AI abstraction ✓ (stub provider)

### 8. Next Steps (from conversation — pending clarification)
- (none yet — awaiting user direction)