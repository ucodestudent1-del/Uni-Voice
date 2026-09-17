# Fix: Duplicate Method Definitions in CustomerRepository (Build-breaking)

## Problem
Commit `9592d1f` ("fix: resolve TypeScript compilation errors") added **duplicate**
`findByEmail` and `findByNameAndCompany` methods to `src/repositories/customer.repo.ts`.

This causes `TS2393: Duplicate function implementation` errors when `tsc -p tsconfig.json`
runs during the Docker build (`npm run build`), failing all Railway deployments.

## Root Cause
The commit diff added **two copies** of each method:

| Method | Lines (in file) | Description |
|---|---|---|
| `findByEmail` (enhanced) | 233-242 | With `status != 'archived'` filter + tax identifier enrichment |
| `findByNameAndCompany` (enhanced) | 244-253 | With `status != 'archived'` filter + tax identifier enrichment |
| `findByEmail` (legacy) | 255-262 | WITHOUT archived filter, no enrichment — **duplicate** |
| `findByNameAndCompany` (legacy) | 264-271 | WITHOUT archived filter, no enrichment — **duplicate** |

## Fix

### Step 1: Remove the duplicate (legacy) methods
In `src/repositories/customer.repo.ts`, remove lines 255-271 (the second copies of both methods).

**Keep** lines 233-253 (the enhanced versions), since `CustomerService.create` uses
these for duplicate detection and the archived filter correctly excludes soft-deleted
customers from duplicate checks.

### Step 2: Stage and commit
```bash
git add src/repositories/customer.repo.ts
git commit -m "fix: remove duplicate findByEmail and findByNameAndCompany methods

Commit 9592d1f accidentally added both enhanced and legacy versions of these
methods, causing TS2393 Duplicate function implementation errors. Keeping the
enhanced versions (with archived filter and tax identifier enrichment) which
are correct for duplicate detection in CustomerService.create."
```

### Step 3: Push to GitHub
```bash
git push origin main
```

### Step 4: Push to Railway
```bash
git push railway main
```

### Step 5: Verify Railway build succeeds
- Monitor [Railway dashboard](https://railway.app) for deployment status
- Expected: build succeeds, deployment completes

## Affected Files
- `src/repositories/customer.repo.ts` — remove duplicate methods (lines 255-271)

## Verification
- [x] Confirmed duplicates exist via `git show 9592d1f -- src/repositories/customer.repo.ts`
- [x] Confirmed pre-commit file had NO `findByEmail`/`findByNameAndCompany` methods
- [x] Confirmed `CustomerService.create` (customer-service.ts:54,61) calls both methods for duplicate detection
- [x] Confirmed enhanced versions are functionally correct for the use case
- [ ] After fix: `tsc -p tsconfig.json` passes (no TS2393 errors)
- [ ] After fix: Railway deployment succeeds
