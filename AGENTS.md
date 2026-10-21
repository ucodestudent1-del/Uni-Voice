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

## Deployment

### Docker (recommended)

```bash
# 1. Copy .env.example and configure for your environment
cp .env.example .env
# Edit .env — set real values for DB, Redis, JWT secret, etc.

# 2. Run all services (postgres, redis, api)
docker compose up --build

# The API starts on http://localhost:4000, frontend build is served by the API.
```

### Docker Compose services
| Service | Port | Notes |
|---|---|---|
| `db` | 5432 | PostgreSQL 16-alpine with healthcheck |
| `redis` | 6379 | Redis 7-alpine with healthcheck |
| `api` | 4000 | Express + compiled frontend; depends on db+redis |

### Required environment variables (production)
At minimum set these in `.env` before deploying:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_JWT_SECRET` — secure random string (for `AUTH_MODE=jwt`)
- `APP_PUBLIC_BASE_URL` — public URL of the backend (for OAuth/webhooks)
- `APP_FRONTEND_URL` — URL where the frontend is served
- `REDIS_URL` — required for rate-limiting, token revocation, job queue, report cache

### CI
`.github/workflows/ci.yml` runs typecheck, lint (with `--max-warnings 0` for backend), tests, and build on every push/PR.

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
