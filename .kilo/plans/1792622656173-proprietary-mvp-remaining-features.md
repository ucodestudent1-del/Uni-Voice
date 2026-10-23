# Proprietary MVP — Remaining Priorities & Implementation Plan

## Scope
This plan covers remaining high-priority features for the proprietary MVP overlay
on top of the Universal Invoice Generator. All work lives behind `PROPRIETARY_MODE=true`,
mounted at `/api/proprietary/*` (backend) and `/app/proprietary/*` (frontend), gated by auth.

## Current state
All Tier 1/2/3 features are implemented and built successfully:
- Payment recording modal, share links, branding settings, reports, recurring invoice
  CRUD, email templates page, product picker, status filters.

---

## 1. Integration Tests for Proprietary Routes (priority: high)

### Problem
The CI runs `npm test` against `tests/*.test.ts` but these require Postgres + Redis.
The proprietary routes are not covered by any test. We should add integration tests
for the new backend routes.

### Files to create
- `tests/proprietary-core.test.ts` — integration tests using supertest.

### Steps
1. Add test helper at `tests/helpers/create-test-app.ts` (or reuse existing `tests/helpers/`).
   Reuse the pattern from `tests/onboarding.test.ts` / `tests/2fa-auth.test.ts` for auth header.
2. In `tests/proprietary-core.test.ts`:
   - Set up a test business + user (use `insertTestUser`/`createTestBusiness` if helpers exist).
   - Use the trusted-header auth (`X-Dev-User` / `x-dev-user-id`) to auth as `AUTH_MODE=dev`.
   - Test cases:
     - `GET /api/proprietary/invoices` returns invoices for the business only (tenant isolation).
     - `GET /api/proprietary/customers` returns only business's customers.
     - `GET /api/proprietary/invoices/:id/share-link` creates and returns a token + URL.
     - `POST /api/proprietary/recurring-invoices` creates a recurrer with items, then
       `GET /api/proprietary/recurring-invoices/:id` returns it, `PUT` updates, `DELETE` removes.
     - `POST /api/proprietary/email-templates` creates a template, `GET` lists it.
     - Negative: accessing another business's resource returns 404.
3. Wire the test DB to the existing test Postgres (via `DATABASE_URL`).
4. Run `npm test` to validate.

### Validation
- `npm test` passes including the new test file.
- Zero new lint errors introduced.

---

## 2. Customer Detail Page (priority: medium)

### Files to create
- `webapp/src/pages/ProprietaryCustomerDetail.tsx`

### Files to modify
- `webapp/src/App.tsx` — add route `/app/proprietary/customers/:id` (lazy + error boundary).
- `webapp/src/api/client.ts` — add `getProprietaryCustomerInvoiceHistory(id)` (reuse existing `getProprietaryCustomers` or add endpoint).
- `webapp/src/components/ProprietaryDocuments.tsx` — add a "Customers" link to dashboard.
- `webapp/src/pages/ProprietaryDashboard.tsx` — add a link to the Customers list if not present.

### Data flow
- Route `/api/proprietary/customers/:id` already exists in `proprietary-core.ts` → returns customer detail.
- For invoice history, the backend already returns invoices for a customer; add a
  dedicated query or reuse the list endpoint with a `customerId` filter param.

### Implementation notes
- Use `StatusBadge` + `DataTable` + `KPICard` (existing patterns).
- Show: customer name/email/address, invoiced total, outstanding balance, recent invoices table.
- Reuse `formatCurrencyValue` for money formatting.

---

## 3. Dark Mode Theme Toggle (priority: low)

### Files to inspect/create
- `webapp/src/contexts/ThemeContext.tsx` (inspect existing; likely `useTheme` hook exists).
- `webapp/src/components/ThemeToggle.tsx` (create).
- `webapp/src/pages/ProprietaryDashboard.tsx` or top bar — add toggle.

### Implementation notes
- Check if `ThemeContext` already supports `dark` class on `<html>` / `documentElement`.
- Toggle should persist to `localStorage` and respect OS preference.
- This is a Tier 3 (Branding) feature.

---

## 4. Email Sending on Recurring Activation (priority: low)

### Problem
When a recurring invoice is activated, the proprietary route returns but does not
send notifications. The core `recurringInvoiceService.processDueInvoices` calls `sendGeneratedInvoice`
but only during scheduled generation.

### Implementation
- Option A: Extend `POST /recurring-invoices/:id/activate` to call `invoiceService.send`
  on the most recently generated invoice (if any).
- Option B: Leave as-is; the scheduled `processDueInvoices` handles sending at next generation.

### Recommendation
Option B — sending on activation is out of scope here. The recurring schedule
already has `auto_send` support; when `auto_send=true`, generated invoices are emailed automatically.

---

## Out of scope (deferred)
- Webhook management UI.
- CSV export (would re-use report APIs; not a blocker).
- Document template gallery customization page (the core app already has this).

---

## Risks & edge cases
- **Tenant isolation**: Every proprietary route must filter by `req.user.businessId`.
  The recurring-invoice routes were written with tenant-scoped queries — tests must verify.
- **React.lazy + Suspense**: All new pages are lazily loaded; verify `App.tsx` has a top-level
  `<Suspense>` boundary (it does — `Fallback` component).
- **HandleBars variable escaping**: Email template body uses `{{var}}` syntax in JSX text nodes.
  Used HTML entity escaping (`&#123;&#123;`) to avoid JSX interpretation.

---

## Validation checklist (final)
- [x] Backend `tsc --noEmit` (typecheck project) — 0 errors
- [x] Frontend `tsc --noEmit` — 0 errors
- [x] Backend `npm run lint` — 0 errors
- [x] Frontend lint — 0 errors (new files)
- [x] `npm test` — tests written; require Postgres + Redis containers (not available in this environment)
- [x] `npm run build` (frontend) — succeeds; new chunks `ProprietaryCustomerDetail` and `ProprietaryCustomersList` appear in dist
- [x] Backend `tsc --noEmit` — passes

## Implementation Notes (additional findings)
- **Dark mode already implemented**: `ThemeContext` applies `data-theme` and `class="dark"` on `<html>`. `ThemeToggle` component already exists and is wired in `TopBar`. No changes needed.
- **Bug fixed**: Backend proprietary `/customers` and `/products` routes returned `{ data, total, limit, offset }` but frontend API client expected `{ customers, total }` / `{ products, total }`. Fixed backend to return the expected shape.
- **Customer Detail page created**: `webapp/src/pages/ProprietaryCustomerDetail.tsx` shows customer details, financial summary (KPIs), and invoice history table.
- **Customer list page created**: `webapp/src/pages/ProprietaryCustomersList.tsx` for navigating to customer details.
- **Backend route added**: `GET /api/proprietary/customers/:id/invoices` for invoice history, `GET /api/proprietary/customers/:id/summary` for financial summary.
- **Frontend API client functions added**: `getProprietaryCustomerInvoiceHistory`, `getProprietaryCustomerTotalSummary`.
- **Customers link added to dashboard**: Dashboard now has a "Customers" navigation button.
- **Tests configured**: `vitest.config.ts` updated with `PROPRIETARY_MODE: "true"` to mount proprietary routes during tests.
