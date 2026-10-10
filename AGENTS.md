# AGENTS.md — Universal Invoice Generator

Commands to run during this session:

| Command | What it does |
|---|---|
| `npm install` | Install backend dependencies |
| `npm run migrate` | Run DB migrations (creates all tables) |
| `npm run migrate:reset` | Drop & re-run all migrations (dev only) |
| `npm run dev` | Run backend in watch mode (tsx) |
| `npm run dev:frontend` | Run frontend dev server (Vite, localhost:5173) |
| `npm run dev:all` | Run backend + frontend together (concurrently) |
| `npm run typecheck` | Type-check the backend |
| `npm run lint` | Lint the backend |
| `npm run test` | Run all unit/integration tests (vitest) |
| `npm run test:watch` | Watch mode |
| `npm run build` | Compile to `dist/` |

## Frontend (webapp/)
| Command | What it does |
|---|---|
| `cd webapp && npm install` | Install frontend deps |
| `cd webapp && npm run dev` | Vite dev server (localhost:5173) |
| `cd webapp && npm run typecheck` | Type-check frontend |
| `cd webapp && npm run build` | Production build |

> **Tip:** Use `npm run dev:all` from the project root to start both the
> backend (`localhost:4000`) and frontend (`localhost:5173`) together.

## Remaining Work (post-recent changes)

1. **InvoiceWorkspace `handleFinalizeAndSend`** — Uses optimistic updates from `finalizeInvoice` + `sendInvoice` responses (lines 1162-1174). No redundant `getInvoice` fetches. Consider enriching `FinalizeInvoiceResult` type to include `status` for more robust optimistic updates.
2. **InvoiceWorkspace autosave batching** — `doSave` (line 631) uses a single `createInvoice`/`updateInvoice` call with items and fees in the payload. Already resolved.
3. **`/api/reports/aging` and `/api/reports/payment-metrics` endpoints** — Both exist in `src/index.ts` (lines 1750, 1763). `getPaymentMetricsReport` has graceful 404 handling; `getAgingReport` now has consistent error handling returning `null` on failure.
4. **`computeChurnRate` uses `customer_email`** — Already fixed; uses `inv.customer_id` (line 274).
5. **List endpoints fetch 500 customers** — Already fixed; `Invoices.tsx` uses `limit: 100`, `CreditNotes.tsx` doesn't fetch customers.

### Commands for the upcoming work
| Command | What it does |
|---|---|
| `npm run typecheck` | Backend type-check |
| `npm run lint` | Backend lint |
| `npm run test` | Backend tests |
| `cd webapp && npm run typecheck` | Frontend type-check |
| `cd webapp && npm run lint` | Frontend lint |

## Stack
- **Backend**: Express + TypeScript + PostgreSQL (`node-pg-migrate`-style SQL migrations)
- **Money**: `decimal.js` (integer minor-unit math, never float)
- **Validation**: `zod` (DTOs + params)
- **Templates**: `handlebars`
- **Email**: `nodemailer` (stub provider by default)
- **PDF**: pluggable service abstraction (`html`-based by default)
- **Auth**: JWT (dev stub mode uses trusted headers)
- **Tests**: `vitest`

## Architecture
```
Frontend  →  API Layer  →  Invoice Service  →  Calculation Engine
                                 ├── Tax Service
                                 ├── Numbering Service
                                 ├── State Machine
                                 ├── Snapshot Service
                                 ├── PDF Service
                                 ├── Email Service
                                 ├── Payment Service  (future)
                                 ├── Recurring Service (future)
                                 └── AI Service        (future)
```

## Phases implemented
- Phase 1 (Core): full ✓
- Phase 2 (Documents): full ✓
- Phase 3 (Payments): abstraction + idempotent records ✓ (stub provider)
- Phase 4 (Automation): recurring invoices + quotes ✓ (stub scheduler)
- Phase 5 (Intelligence): AI abstraction ✓ (stub provider)

## Key invariants
1. Finalized invoices are **immutable** — snapshotted.
2. Invoice numbers are **atomic** (DB-level) and unique per business.
3. **Backend is authoritative** for all calculations.
4. **Tenant isolation** enforced at every DB query.

# UI Quality Standards

The application must have a consistent, polished, production-quality UI.

Before creating a new UI pattern, look for an existing shared component or design token.

Avoid one-off styling when a shared component/token can solve the problem.

All pages must handle:
- normal data
- empty data
- zero values
- loading
- errors
- long text
- missing/null values
- mobile layouts

Empty states must look intentional and polished rather than appearing broken or unfinished.

Maintain consistent:
- typography
- spacing
- colors
- borders
- radii
- shadows
- button styles
- form controls
- tables
- badges
- page headers
- cards

Fix problems at the shared-component/design-system level whenever possible.

Do not introduce unnecessary visual effects or redesign the product without a clear reason.

Preserve business logic and existing functionality while improving the UI.

Before considering a UI task complete, inspect related screens for the same underlying problem and fix them consistently.
