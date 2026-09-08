# AGENTS.md — Universal Invoice Generator

Commands to run during this session:

| Command | What it does |
|---|---|
| `npm install` | Install backend dependencies |
| `npm run migrate` | Run DB migrations (creates all tables) |
| `npm run migrate:reset` | Drop & re-run all migrations (dev only) |
| `npm run dev` | Run backend in watch mode (tsx) |
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
