# Technical Implementation Plan: Comprehensive Invoice Creation Feature

## 0. Codebase Context & Existing Architecture

The repository is a **Universal Invoice Generator** — a monorepo containing a backend
(Express + TypeScript + PostgreSQL) at `src/` and a frontend (React + Vite + TS + Tailwind)
at `webapp/src/`.

### Stack Summary
| Layer     | Tech                                                                                                 |
|-----------|------------------------------------------------------------------------------------------------------|
| Backend   | Express 4.x, TypeScript, PostgreSQL, `pg`, `decimal.js`, `zod`, `handlebars`, `nodemailer`          |
| Frontend  | React 18, TypeScript, Vite, Tailwind CSS v4, React Router v6, Axios, `decimal.js`, `zod`            |
| Tests     | Vitest (unit), Supertest (integration), `@testing-library/react` (frontend unit)                     |
| Auth      | JWT bearer tokens, dev stub mode (trusted headers), 2FA, Google OAuth                               |
| Key dirs  | `src/domain/` (models, value-objects, calculation, errors), `src/services/`, `src/repositories/`     |

### Existing Invoice-Related Files (already implemented)
```
src/schemas/invoice-dto.ts          — Zod DTOs for draft create/update
src/domain/models/index.ts          — Invoice, InvoiceLineItem, InvoiceFee, InvoiceEvent, InvoiceSnapshot
src/domain/calculation.ts           — CalculationEngine (decimal.js, multi-currency, tax-inclusive)
src/services/invoice-service.ts     — InvoiceService (createDraft, getInvoice, updateDraft, setItems, setFees, finalize, send, cancel, void, recordPayment, etc.)
src/services/state-machine/invoice-state-machine.ts — ALLOWED_TRANSITIONS, terminal/cancellable/voidable, overdue detection
src/services/numbering/service.ts   — Atomic invoice number generation via DB row lock
src/services/snapshot/snapshot-service.ts — Immutable snapshot of finalized invoice (business, customer, items, fees, totals, template, rendered HTML)
src/services/templates/template-renderer.ts — Handlebars-based rendering with default template
src/services/templates/structured-renderer.ts — Structured document-model renderer
src/services/pdf/pdf-service.ts     — PDF generation from HTML (Puppeteer-based)
src/services/email/email-service.ts — Email sending (stub provider by default)
src/services/validation/invoice-validation.ts — Server-side validation (errors + warnings with fix suggestions)
src/repositories/invoice.repo.ts    — InvoiceRepository (CRUD, items, fees, snapshots, events, payments, pagination)
src/services/tax/tax-service.ts     — Tax calculation with manual provider default
src/domain/errors.ts                — AppError, NotFoundError, ConflictError, BusinessLogicError, etc.
src/index.ts                        — All REST API routes (~lines 783-896 for invoices)
webapp/src/components/InvoiceEditor.tsx — Full-featured React editor component
webapp/src/components/InvoicePreview.tsx — Preview component
webapp/src/pages/InvoiceEditorPage.tsx  — Page wrapper
webapp/src/pages/Invoices.tsx      — Invoice list with filters, sorting, pagination
webapp/src/pages/InvoiceDetail.tsx  — Detail view
webapp/src/api/client.ts            — Axios-based API client (all invoice fetchers)
webapp/src/types/api.ts            — Typed response interfaces (ApiInvoice, ApiInvoiceItem, etc.)
webapp/src/hooks/useInvoiceValidation.ts — Frontend validation hook (mirrors backend)
webapp/src/utils/calculation.ts     — Frontend copy of CalculationEngine (for real-time totals)
webapp/src/document-model/          — Structured document model (components, renderer, converter)
```

### Existing API Endpoints (Invoices — src/index.ts)
| Method | Route                              | Description                    |
|--------|------------------------------------|--------------------------------|
| GET    | `/api/invoices`                    | List + filter/paginate         |
| POST   | `/api/invoices`                    | Create draft                   |
| GET    | `/api/invoices/:id`                | Get invoice summary            |
| PATCH  | `/api/invoices/:id`                | Update draft                   |
| PUT    | `/api/invoices/:id/items`          | Replace line items             |
| PUT    | `/api/invoices/:id/fees`           | Replace fees                   |
| POST   | `/api/invoices/:id/finalize`       | Finalize + assign number       |
| POST   | `/api/invoices/:id/send`           | Send via email                 |
| POST   | `/api/invoices/:id/send-reminder`  | Send payment reminder          |
| POST   | `/api/invoices/:id/cancel`         | Cancel                         |
| POST   | `/api/invoices/:id/void`            | Void                           |
| POST   | `/api/invoices/:id/payment-intent` | Create payment intent          |
| POST   | `/api/invoices/:id/pdf`            | Download PDF                   |
| GET    | `/api/invoices/:id/events`         | Audit trail                    |
| DELETE | `/api/invoices/:id`                | Delete draft                   |
| POST   | `/api/invoices/:id/duplicate`      | Duplicate                      |
| GET    | `/api/invoices/:id/payments`       | List payments                  |
| POST   | `/api/invoices/:id/payments`       | Record payment                 |
| GET    | `/api/dashboard`                   | Dashboard summary              |

### Existing DB Migrations
- `001_initial_schema.sql` — businesses, customers, products, invoices, invoice_items, invoice_fees, templates, invoice_number_sequences, invoice_snapshots, invoice_events, payments, email_log
- `011_invoice_reminders_and_payments.sql` — payment intents, payment providers
- `012_projects.sql` — project integration
- `013_invoice_lifecycle.sql` — deposits, credit_applied, credit_notes, recurring invoices, scheduled_emails, receipts, stripe_webhook_events

### Existing Tests
- `tests/calculation.test.ts` — 50+ test cases for CalculationEngine
- `tests/invoice-validation.test.ts` — 30+ test cases for validation service
- `tests/state-machine.test.ts` — transition matrix tests
- `tests/numbering.test.ts` — atomic numbering tests
- `tests/invoice-product-snapshot.test.ts` — product snapshot on invoice creation
- Frontend: `webapp/src/__tests__/` — document model, editor operations, template render, validation hook

---

## 1. Frontend Requirements

### 1.1 UI Components

The existing `webapp/src/components/InvoiceEditor.tsx` provides a sophisticated document-model-based editor.
For a comprehensive invoice creation feature, the following UI components are required:

#### Core Editor Components (already present, may need enhancement)
| Component                          | Location                                        | Responsibility                                      |
|------------------------------------|-------------------------------------------------|----------------------------------------------------|
| `InvoiceEditor`                    | `webapp/src/components/InvoiceEditor.tsx:952`   | Main editor container wrapping `EditorProvider`     |
| `DocumentEditor`                   | `webapp/src/document-model/editor/DocumentEditor.tsx` | Drag-drop canvas for structured document layout    |
| `PropertyInspector`                | `webapp/src/document-model/editor/PropertyInspector.tsx` | Right sidebar — edit selected component props   |
| `DocumentPreview`                  | `webapp/src/document-model/DocumentPreview.tsx` | Live HTML/Markdown preview of the invoice          |
| `OutlineEditor`                    | `webapp/src/components/OutlineEditor.tsx`       | Tree view for component hierarchy                   |
| `CustomerSelector`                 | `webapp/src/components/CustomerSelector.tsx`    | Searchable dropdown for customer selection          |
| `TaxSelector`                      | `webapp/src/components/TaxSelector.tsx`          | Tax rate picker with preset values                  |
| `TemplateSelector` / `TemplateGallery` | `webapp/src/components/TemplateSelector.tsx` | Template switching                                |

#### Line Item Management
The line item editor is embedded in the `DocumentEditor` as a structured component.
Key fields per line item (from `EditorLineItem` interface at `webapp/src/components/InvoiceEditor.tsx:59`):
- `description` (required, min 1 char)
- `quantity` (positive number, supports decimals)
- `unit` (default "each"; options: each, hour, day, week, month)
- `unitPrice` (non-negative decimal)
- `discount` (optional; fixed or percentage)
- `discountType` (enum: "fixed" | "percentage")
- `taxRate` (percentage, default 0)
- `isTaxInclusive` (boolean)
- `productId` (optional link to product catalog)

The existing editor uses a structured document model where line items are rendered
as components with draggable reordering via `@dnd-kit`.

#### Totals Display
The editor computes totals client-side using `calculationEngine` from
`webapp/src/utils/calculation.ts` (mirrors backend engine). Totals are displayed
in the `PropertyInspector` or a dedicated summary panel:
- Subtotal, Discount Total, Tax Total, Fee Total, Total, Amount Due, Amount Paid

#### Action Buttons (existing pattern at `webapp/src/components/InvoiceEditor.tsx:666`)
- **Save Draft** — calls `updateInvoice` or `createInvoice` API
- **Finalize & Send** — triggers `finalizeInvoice` then `sendInvoice`
- **Download PDF** — calls `getInvoicePdf`
- **Send** (for already-finalized invoices) — triggers `sendInvoice`
- **Duplicate** — calls `duplicateInvoice`
- **Delete** — calls `deleteInvoice` (drafts only)

### 1.2 Form Validation Logic

Validation mirrors the backend service at `src/services/validation/invoice-validation.ts`.
Two layers of validation:

#### Client-Side (pre-save, real-time)
Implemented in `webapp/src/hooks/useInvoiceValidation.ts`:
- `validateInvoice(data: ValidationInput): ValidationIssue[]`
- Returns issues with `severity: "error" | "warning"`, `code`, `message`, `field`, `fix`
- Error codes: `MISSING_CUSTOMER`, `UNSUPPORTED_CURRENCY`, `MISSING_ISSUE_DATE`,
  `INVALID_DUE_DATE`, `EMPTY_LINE_ITEMS`, `INVALID_QUANTITY`, `NEGATIVE_UNIT_PRICE`,
  `MISSING_ITEM_DESCRIPTION`, `NEGATIVE_TOTAL`, `CALCULATION_ERROR`
- Warning codes: `MISSING_PAYMENT_INSTRUCTIONS`, `MISSING_NOTES`,
  `MISSING_CUSTOMER_EMAIL`, `CALCULATION_DISCREPANCY`
- Uses `useMemo` for memoization (line 278-294 of `useInvoiceValidation.ts`)

#### Server-Side (on finalize)
Implemented in `src/services/validation/invoice-validation.ts`:
- `InvoiceValidationService.validate(input: InvoiceValidationInput): ValidationResult`
- Enforced in `InvoiceService.finalize()` at `src/services/invoice-service.ts:244`
- Returns `ValidationResult` with `valid`, `issues`, `hasErrors`, `hasWarnings`
- If validation fails, throws `BusinessLogicError` with code `VALIDATION_FAILED` and
  the issues array in the error context (line 254-261 of `invoice-service.ts`)

#### Data Flow for Validation Errors
1. Frontend calls `finalizeInvoice(id)` → API
2. If backend returns `422` with `code: "VALIDATION_FAILED"` and `context.issues`:
3. Frontend maps API issues to `ValidationIssue[]` via `setApiValidationIssues`
4. `ValidationPanel` component displays merged client + server issues

### 1.3 State Management

The frontend uses a combination of React built-in state and custom hooks:

#### Document Model State
- `EditorProvider` wraps the editor (from `webapp/src/document-model/editor/EditorContext.tsx`)
- Provides: `document`, `setDocument`, `selectedComponentId`, `onSelect`, `insertComponent`,
  `updateComponent`, `moveComponent`, `removeComponent`, `undo`, `redo`, `dirty`,
  `markSaved`, `saveDocument`, `enableAutosave`
- `createEmptyDocument(businessId, name)` initializes a blank structured document

#### Invoice Editor State
In `InvoiceEditor.tsx`, `useState` hooks manage:
- `editorData: EditorInvoiceData | null` — the invoice form state (customer, dates, items, fees, notes, terms, payment instructions, currency, template)
- `business: ApiBusiness | null` — loaded business settings (default currency, tax rate, terms, notes)
- `customers: ApiCustomer[]` — cached customer list
- `products: ApiProduct[]` — cached product catalog
- `saveState: "saved" | "saving" | "unsaved" | "error"` — save status indicator
- `previewMode: "edit" | "preview"` — toggle between edit canvas and live preview
- `showValidation`, `showTemplateGallery`, `outlineMode` — UI toggles
- `apiValidationIssues: ValidationIssue[]` — server-side validation issues

#### Autosave
- `enableAutosave(true, 2000)` — 2-second debounce after enabling
- Triggers `saveDocument` from the editor context, which calls `handleSave`
- `handleSave` writes to backend via `createInvoice`/`updateInvoice` + `setInvoiceItems`/`setInvoiceFees`

#### Document ↔ Invoice Conversion
- `invoiceToDocument(inv, business, customer)` — converts API invoice to structured document model
- `documentToInvoice(doc)` — converts structured document back to invoice data
- `getDefaultDocument(businessId)` — creates a default document from preset templates
- Located in `webapp/src/document-model/converter.ts`

#### API Client
All API calls go through `webapp/src/api/client.ts` which uses Axios with:
- JWT bearer token from `localStorage` injected via request interceptor
- 401 response interceptor redirects to `/login`
- Functions: `createInvoice`, `getInvoice`, `updateInvoice`, `setInvoiceItems`,
  `setInvoiceFees`, `finalizeInvoice`, `sendInvoice`, `getInvoicePdf`, etc.

---

## 2. Backend Requirements

### 2.1 API Endpoints

The existing backend already implements all required invoice endpoints.
Here is the complete set with request/response contracts:

#### Create Draft Invoice
```
POST /api/invoices
Auth: requireAuth, requireUsageLimit("invoices.unlimited", true)

Request body (validated by CreateInvoiceDraftSchema at src/schemas/invoice-dto.ts):
{
  "customerId": "uuid|null",
  "currency": "string (ISO 4217, default USD)",
  "issueDate": "ISO date string|null",
  "dueDate": "ISO date string|null",
  "projectId": "uuid|null",
  "notes": "string|null",
  "terms": "string|null",
  "templateId": "uuid|null",
  "paymentInstructions": "string|null",
  "depositAmount": "number|string",
  "depositType": "none|fixed|percentage",
  "depositDueDate": "ISO date string|null",
  "depositPaymentPurpose": "string|null",
  "items": [{ "productId": "uuid|null", "description": "string", "quantity": "number", ... }],
  "fees": [{ "description": "string", "amount": "number", ... }]
}

Response: { "invoiceId": "uuid" }
```

#### Update Draft Invoice
```
PATCH /api/invoices/:id
Auth: requireAuth

Response: { "invoiceId": "uuid" }
```

#### Replace Line Items
```
PUT /api/invoices/:id/items
Auth: requireAuth

Request body: array of line item objects
Response: { "ok": true }
```

#### Replace Fees
```
PUT /api/invoices/:id/fees
Auth: requireAuth

Request body: array of fee objects
Response: { "ok": true }
```

#### Finalize Invoice
```
POST /api/invoices/:id/finalize
Auth: requireAuth

Response: { "invoiceNumber": "INV-2026-000001" }
```

#### Get Invoice Summary
```
GET /api/invoices/:id
Auth: requireAuth

Response:
{
  "invoice": { id, business_id, customer_id, ..., status, subtotal, total, ... },
  "items": [{ id, description, quantity, unit_price, tax_rate, line_total, ... }],
  "fees": [{ id, description, amount, tax_rate, tax_amount, ... }],
  "totals": { subtotal, discount_total, tax_total, fee_total, total, amount_paid, amount_due }
}
```

#### List Invoices (with filtering)
```
GET /api/invoices?status=&customerId=&search=&limit=&offset=
Auth: requireAuth

Response: { "invoices": [...], "limit": 50, "offset": 0 }
```

#### Delete Draft
```
DELETE /api/invoices/:id
Auth: requireAuth
Returns 204 on success, 400 if finalized
```

#### Duplicate
```
POST /api/invoices/:id/duplicate
Auth: requireAuth, requireEntitlement("invoices.duplicate")
```

#### Dashboard
```
GET /api/dashboard
Auth: requireAuth
Returns summary metrics + recently paid + requiring attention
```

### 2.2 Database Schema

The schema is defined across migrations in `src/db/migrations/`. Key tables:

#### `invoices` (migration 001)
```sql
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id),
  project_id      UUID REFERENCES projects(id),
  invoice_number  VARCHAR(100),
  status          invoice_status NOT NULL DEFAULT 'draft',
  issue_date      DATE,
  due_date        DATE,
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  exchange_rate   NUMERIC(18,6),
  subtotal        NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_total  NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(18,6) NOT NULL DEFAULT 0,
  fee_total       NUMERIC(18,6) NOT NULL DEFAULT 0,
  total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_paid     NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_due      NUMERIC(18,6) NOT NULL DEFAULT 0,
  credit_applied  NUMERIC(18,6) NOT NULL DEFAULT 0,
  deposit_amount  NUMERIC(18,6) NOT NULL DEFAULT 0,
  deposit_type    VARCHAR(30) NOT NULL DEFAULT 'none',
  deposit_due_date DATE,
  deposit_payment_purpose VARCHAR(255),
  notes           TEXT,
  terms           TEXT,
  template_id     UUID REFERENCES templates(id),
  public_token    VARCHAR(64) UNIQUE,
  public_token_expires_at TIMESTAMPTZ,
  payment_instructions TEXT,
  is_finalized    BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancelled_reason TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  updated_by      UUID,
  CONSTRAINT uq_invoice_number_business UNIQUE (business_id, invoice_number),
  CONSTRAINT chk_invoice_total CHECK (total >= 0),
  CONSTRAINT chk_invoice_deposit_type CHECK (deposit_type IN ('none', 'fixed', 'percentage'))
);
```

#### `invoice_items`
```sql
CREATE TABLE invoice_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id),
  description     VARCHAR(500) NOT NULL,
  quantity        NUMERIC(18,6) NOT NULL,
  unit            VARCHAR(50) NOT NULL DEFAULT 'each',
  unit_price      NUMERIC(18,6) NOT NULL,
  discount        NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_type   VARCHAR(20) NOT NULL DEFAULT 'fixed',
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  line_subtotal   NUMERIC(18,6) NOT NULL,
  line_total      NUMERIC(18,6) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `invoice_fees`, `invoice_snapshots`, `invoice_events`, `invoice_number_sequences`
All defined in migrations. See `src/db/migrations/001_initial_schema.sql` and
`013_invoice_lifecycle.sql` for full DDL with constraints and indexes.

### 2.3 Server-Side Logic

#### InvoiceService (`src/services/invoice-service.ts:84`)
Orchestrates the complete invoice lifecycle:

1. **`createDraft(input, businessId, userId)`**
   - Validates customer exists (`customerRepository.findById`)
   - Applies product snapshots (snapshots catalog price/name/tax at creation time)
   - Validates `issueDate <= dueDate`
   - Calls `invoiceRepository.createDraft()` in a DB transaction
   - Records "created" event

2. **`getInvoice(businessId, id)`**
   - Loads invoice + items + fees via `invoiceRepository.findById`
   - Recalculates totals using `calculationEngine.calculate()`
   - Returns `InvoiceSummary` with formatted totals

3. **`updateDraft(businessId, id, input, userId)`**
   - Checks `isFinalized` — throws `BusinessLogicError` if true
   - Updates editable fields via `invoiceRepository.update`
   - Records "updated" event

4. **`setItems(businessId, id, items, userId)`**
   - Checks `isFinalized`
   - Applies product snapshots
   - Calls `invoiceRepository.setItems` (delete + insert in transaction)
   - Records "line_item_updated" event

5. **`finalize(businessId, id, userId)`**
   - Checks `isFinalized` — returns early if already finalized
   - Checks customer exists
   - Recalculates totals via `calculationEngine`
   - Checks total is not negative
   - Runs `invoiceValidationService.validate()` — throws `BusinessLogicError("VALIDATION_FAILED")` if errors
   - Generates unique invoice number atomically via `invoiceNumberService.generate()`
   - **Transaction**: assigns number, persists calculated line-item totals + invoice totals,
     builds and stores immutable snapshot, sets `is_finalized = TRUE`
   - Records "finalized" event
   - Updates project financial summary if `projectId` is set

6. **`send(businessId, id, userId)`**
   - Checks `isFinalized`
   - Generates/rotates public token (30-day expiry)
   - Renders HTML from snapshot + generates PDF
   - Transitions state: `sent` via state machine
   - Sends email via `emailService`

7. **`cancel(businessId, id, userId, reason)`**
   - Checks `invoiceStateMachine.isCancellable(status)`
   - Transitions to `cancelled`
   - Records event with reason

8. **`void(businessId, id, userId, reason)`**
   - Checks `invoiceStateMachine.isVoidable(status)`
   - Transitions to `void`
   - Records event with reason

9. **`recordPayment(businessId, id, amount, provider, providerPaymentId, idempotencyKey)`**
   - Checks idempotency key to prevent duplicate payments
   - Inserts payment record
   - Updates `amount_paid` and `amount_due` on invoice
   - Determines new status via `invoiceStateMachine.statusAfterPayment()`
   - Updates project financial summary
   - Transaction-wrapped

#### CalculationEngine (`src/domain/calculation.ts:95`)
- Uses `decimal.js` for all arithmetic (never floating-point)
- Currency-aware rounding via `getCurrencyMetadata(currency)` — supports variable decimal places (e.g., JPY = 0, USD = 2)
- Two-pass calculation: (1) line subtotals + discounts, (2) tax extraction (inclusive/exclusive)
- Invoice-level discount distributed proportionally across line items
- Fees with optional tax
- Returns `CalculationResult` with per-line: `taxableAmount`, `taxAmount`, `lineTotal`, `lineSubtotal`, `discountAmount`

#### InvoiceStateMachine (`src/services/state-machine/invoice-state-machine.ts:45`)
```
draft → [sent, cancelled, void]
sent → [viewed, partially_paid, paid, overdue, cancelled, void]
viewed → [partially_paid, paid, overdue, cancelled, void]
partially_paid → [paid, overdue, void]
overdue → [paid, void]
paid, cancelled, void → (terminal, no outgoing)
```

#### NumberingService (`src/services/numbering/service.ts:43`)
- `ensureSequence(businessId)` — INSERT IF NOT EXISTS for sequence row
- `generate(businessId)` — acquires DB row lock, atomically increments `next_number`, COMMIT
- Format: `{prefix}-{year}-{padded_number}` (e.g., `INV-2026-000001`)
- Configurable: prefix, padding, includes_year

#### SnapshotService (`src/services/snapshot/snapshot-service.ts:36`)
- Captures: business info, customer info, all line items, all fees, totals, currency,
  template HTML, template schema version/revision, rendered HTML
- SHA-256 hash of JSON-serialized payload
- Stored in `invoice_snapshots` table with revision number
- `verify()` method recomputes hash to detect tampering

### 2.4 Security & Data Integrity

- **Tenant isolation**: Every query includes `business_id` filter
- **Immutability after finalization**: `is_finalized` flag checked before every mutation
- **Optimistic locking**: `version` column incremented on update (see `updateOptimistic` at `src/repositories/invoice.repo.ts:194`)
- **Atomic numbering**: DB row lock via `UPDATE ... WHERE business_id` ensures no duplicate numbers
- **Idempotent payments**: `idempotency_key` column with unique constraint
- **Input validation**: Zod schemas parse all request bodies; invalid input returns 400

---

## 3. Testing Strategy

### 3.1 Backend Unit Tests (vitest)

Run with: `npm run test` (vitest) or `npm run test:watch`

#### Calculation Engine Tests
**File**: `tests/calculation.test.ts`
**Coverage**: `src/domain/calculation.ts`

Test cases already include:
- Basic line item (tax-exclusive): subtotal, tax, total, line breakdown
- Decimal quantities
- Percentage and fixed discounts (line-level and invoice-level with proportional distribution)
- Discount capping at line subtotal
- Tax-inclusive pricing (tax extraction)
- Multiple line items with different tax rates
- Fees with tax
- Currency precision (JPY = 0 decimals, USD = 2)
- Rounding before summing
- Large amounts (precision)
- Zero and invalid values (rejection of zero/negative quantity, negative price, negative tax, negative payment)
- Payment scenarios (partial, overpayment)
- Empty invoice (zero totals)

To add new tests, follow the pattern:
```typescript
import { describe, it, expect } from "vitest";
import { Decimal } from "decimal.js";
import { CalculationEngine, discountAmount } from "../src/domain/calculation.js";

const engine = new CalculationEngine();

describe("CalculationEngine", () => {
  it("should ...", () => {
    const res = engine.calculate({ currency: "USD", lineItems: [...] });
    expect(res.total.toFixed(2)).toBe("...");
  });
});
```

#### Invoice Validation Tests
**File**: `tests/invoice-validation.test.ts`
**Coverage**: `src/services/validation/invoice-validation.ts`

Test cases:
- Valid complete invoice passes
- Missing customer → error
- Missing issue date → error
- Due date before issue date → error
- Empty line items → error
- Zero/negative quantity → error
- Negative unit price → error
- Missing item description → error
- Unsupported currency → error
- Missing payment instructions → warning (not error)
- Calculation discrepancy (mismatched totals) → error
- Fix suggestions included on issues
- Result structure (valid/hasErrors/hasWarnings)

#### State Machine Tests
**File**: `tests/state-machine.test.ts`
**Coverage**: `src/services/state-machine/invoice-state-machine.ts`

Test cases:
- `canTransition`: all valid + invalid transitions
- `transition`: throws `BusinessLogicError` on invalid
- `determineOverdue`: past-due unpaid → overdue; paid/not-due/no-date → null
- `statusAfterPayment`: full → paid, partial → partially_paid, overpayment
- Completeness: every status has entry in transition map

#### Numbering Service Tests
**File**: `tests/numbering.test.ts`
**Coverage**: `src/services/numbering/service.ts`

Test cases:
- Sequence creation (INSERT IF NOT EXISTS)
- Atomic increment under concurrent calls
- Format with/without year, custom prefix, padding
- Idempotency of `ensureSequence`

#### Invoice Product Snapshot Tests
**File**: `tests/invoice-product-snapshot.test.ts`
**Coverage**: `src/services/invoice-service.ts` product snapshot logic

Test cases:
- Product catalog data (name, SKU, tax category, unit price, tax rate) snapshotted at invoice creation
- Modifications to product after invoice creation don't affect the invoice

#### Integration Tests with DB
**Files**: `tests/customer-api.test.ts`, `tests/customer-e2e.test.ts`
**Pattern**: Uses `supertest` to test API endpoints against a real PostgreSQL test database.

Test infrastructure:
- `tests/global-setup.ts` — calls `resetTestDb()` which runs `rollbackAll()` + `runMigrations()`
- `tests/helpers/db.ts` — helper functions: `resetTestDb`, `createTestBusiness`, `createTestUser`, `createTestCustomer`
- DB connection via `src/db/pool.ts` with `APP_ENV=test`

Pattern for API integration test:
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { resetTestDb, createTestBusiness, createTestUser, createTestCustomer } from "./helpers/db.js";

describe("Invoice API", () => {
  let businessId: string;
  let userId: string;
  let token: string;
  let customerId: string;

  beforeAll(async () => {
    await resetTestDb();
    ({ id: businessId, ownerId: userId } = await createTestBusiness());
    await createTestUser({ businessId });
    // Generate JWT token
    token = generateToken(userId, businessId, "test@example.com");
    customerId = await createTestCustomer(businessId);
  });

  it("POST /api/invoices creates a draft", async () => {
    const res = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerId, currency: "USD", items: [...] });
    expect(res.status).toBe(201);
    expect(res.body.invoiceId).toBeDefined();
  });
});
```

### 3.2 Frontend Unit Tests (vitest + @testing-library/react)

Run with: `cd webapp && npm run test`

#### Test Files
- `webapp/src/__tests__/use-invoice-validation.test.ts` — tests the `validateInvoice` function
- `webapp/src/__tests__/document-model.test.ts` — tests document model operations
- `webapp/src/__tests__/editor-operations.test.ts` — tests insert/update/remove component operations
- `webapp/src/__tests__/template-render.test.tsx` — tests React template rendering
- `webapp/src/__tests__/customer-validation.test.ts` — tests customer form validation
- `webapp/src/__tests__/preset-templates.test.ts` — tests preset template loading

Setup: `webapp/src/__tests__/setup.ts` — imports `@testing-library/jest-dom`

#### Frontend Calculation Tests
The frontend has its own copy of the calculation engine at `webapp/src/utils/calculation.ts`.
A frontend test file `webapp/src/__tests__/calculation.test.ts` would mirror the backend tests.

Pattern for frontend test:
```typescript
import { describe, it, expect } from "vitest";
import { calculateInvoice } from "../utils/calculation";

describe("calculateInvoice", () => {
  it("calculates subtotal and tax correctly", () => {
    const result = calculateInvoice({
      items: [{ description: "Test", quantity: 1, unitPrice: 100, taxRate: 0.1 }],
    });
    expect(result.subtotal).toBe(100);
    expect(result.taxTotal).toBe(10);
    expect(result.total).toBe(110);
  });
});
```

### 3.3 Testing Strategy Summary

| Test Type       | Tool           | Command                    | Coverage Target               |
|-----------------|----------------|----------------------------|-------------------------------|
| Backend unit    | Vitest         | `npm run test`             | calculation, validation, state machine, numbering |
| Backend integ   | Vitest+Supertest | `npm run test`            | API endpoints, DB integration |
| Frontend unit   | Vitest         | `cd webapp && npm test`    | hooks, components, utils      |
| Type checking   | tsc            | `npm run typecheck`        | Backend                       |
| Type checking   | tsc            | `cd webapp && npm run typecheck` | Frontend                |
| Linting         | ESLint         | `npm run lint`             | Backend                       |
| Coverage        | Vitest v8      | `npm run test:coverage`    | `src/domain/**`               |

### 3.4 Recommended Test Coverage Plan

For a new invoice creation feature implementation:

1. **Backend — Draft Lifecycle**
   - `POST /api/invoices` creates draft with items, fees, deposits
   - `PATCH /api/invoices/:id` updates draft fields
   - `PUT /api/invoices/:id/items` replaces items (with product catalog snapshot)
   - `PUT /api/invoices/:id/fees` replaces fees
   - Draft cannot be finalized without customer
   - Draft update after finalization returns 422

2. **Backend — Finalize Flow**
   - Successful finalize assigns number + creates snapshot + events
   - Failed validation blocks finalize with issue codes
   - Negative total blocks finalize
   - Duplicate finalize is idempotent

3. **Backend — State Transitions**
   - Draft → Sent (via finalize + send)
   - Sent → Viewed → Paid
   - Sent → Overdue (via cron job)
   - Draft → Cancelled → (terminal)
   - Paid → Void (blocked by state machine)

4. **Backend — Number Generation**
   - Atomic increment under concurrent requests
   - Uniqueness per business
   - Configurable format (prefix, padding, year)

5. **Frontend — Editor**
   - Line item add/remove/reorder
   - Real-time total recalculation matches backend
   - Validation errors display correctly
   - Save draft persists to API
   - Finalize workflow triggers API + shows result

6. **Frontend — Validation Hook**
   - `useInvoiceValidation` returns correct `valid`/`hasErrors`/`hasWarnings`
   - All error codes from backend are mappable

---

## 4. Deployment Workflow

### 4.1 Prerequisites
- Git configured with `user.name` and `user.email`
- SSH key or GitHub credentials set up
- Remote: `origin` → `https://github.com/ucodestudent1-del/Uni-Voice.git` (branch: `main`)

### 4.2 Pre-Deployment Checklist

```bash
# 1. Install dependencies (both workspaces)
npm install
cd webapp && npm install

# 2. Run database migrations (local/dev)
npm run migrate

# 3. Run typecheck
npm run typecheck
cd webapp && npm run typecheck

# 4. Run linter
npm run lint
cd webapp && npm run lint && cd ../

# 5. Run all tests
npm run test          # Backend tests
cd webapp && npm run test   # Frontend tests
```

### 4.3 Git Deployment Commands

```bash
# 1. Check current branch and status
git status
git branch --show-current

# 2. Stage all changes (adjust file list as needed)
git add src/
git add webapp/src/
git add tests/
git add webapp/src/__tests__/
git add package.json package-lock.json
git add webapp/package.json webapp/package-lock.json

# 3. Review staged changes
git diff --cached

# 4. Commit with a descriptive message
git commit -m "feat: comprehensive invoice creation feature

- Add invoice draft CRUD (create, update, items, fees, deposits)
- Add finalization with atomic numbering + immutable snapshots
- Add state machine: draft→sent→viewed→paid/overdue→cancelled/void
- Add calculation engine with decimal.js (tax-inclusive, discounts, fees)
- Add client-side + server-side validation with error/warning issues
- Add document-model editor with template gallery and live preview
- Add invoice send/email with PDF attachment and public viewing token
- Add payment recording with idempotency
- Add dashboard summary, list with filters/sort/pagination
- Add duplicate, cancel, void, PDF download actions
- Add tests: calculation, validation, state machine, numbering, API integration"

# 5. Push to GitHub
git push origin main
```

### 4.4 Production Build & Deploy

```bash
# Backend build
npm run build
# → Outputs to dist/, copies migrations via scripts/copy-migrations.js

# Frontend build
cd webapp && npm run build
# → Outputs to webapp/dist/

# Start (production)
npm start
# → Runs migrations, then node dist/index.js
# → Serves frontend from webapp/dist/ (static) in production
```

### 4.5 Environment Variables (required)
```bash
# Backend (.env)
PORT=4000
APP_ENV=production
APP_FRONTEND_URL=https://your-app.vercel.app
APP_PUBLIC_BASE_URL=https://api.your-app.com
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-strong-secret
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
PAYMENT_PROVIDER=stripe
```

### 4.6 Post-Deploy Verification
```bash
# 1. Verify server health
curl https://api.your-app.com/api/health

# 2. Verify migrations ran
# Check database tables exist (invoices, invoice_items, invoice_fees, etc.)

# 3. Run integration tests against production-like environment
npm run test
```

### 4.7 Rollback Procedure
```bash
# 1. Revert the commit
git revert <commit-hash>
git push origin main

# 2. If migrations need rollback (dev only)
npm run migrate:reset
```
