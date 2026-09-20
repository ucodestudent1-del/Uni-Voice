# Invoice Creation Feature — Technical Specification & Implementation Roadmap

**Project:** Universal Invoice Generator
**Date:** 2026-09-20
**Status:** Reference Specification (maps to existing codebase + roadmap)

---

## 1. Functional Requirements — User Stories

### 1.1 Invoices (Core)

| ID | User Story | Acceptance Criteria |
|---|---|---|
| INV-01 | As a tradesperson, I want to create a new invoice from scratch, so I can bill a customer right after completing a job. | Clicking "+ New Invoice" opens the editor with a blank draft (status=draft, no invoice number); autosave persists every 2s; a unique draft UUID is returned immediately. |
| INV-02 | As a tradesperson, I want to select an existing customer or quickly create a new one inline, so I don't have to navigate away from the editor. | CustomerSelector shows a searchable dropdown of customers scoped to `business_id`; an inline mini-form captures name + phone + email for one-click creation. |
| INV-03 | As a tradesperson, I want to add line items by searching my saved service library, so I don't retype the same services. | A "Services" tab shows tappable chips of saved products (type=service); one tap adds the line with name, default price, unit, and tax rate pre-filled. |
| INV-04 | As a tradesperson, I want to add, edit, reorder, and delete line items, so I can reflect the actual work performed. | Each line item has quantity, unit, unit price, discount (fixed/%), and tax rate; lines are draggable via `@dnd-kit`; removing a line is a single tap; subtotal updates in real time (<100ms). |
| INV-05 | As a tradesperson, I want to apply discounts at the line level and invoice level, so I can offer fair pricing. | Line-level discount (fixed or percentage) is capped at line subtotal; invoice-level discount is distributed proportionally across all lines; both update totals in real time. |
| INV-06 | As a tradesperson, I want to add fees (e.g., travel, weekend surcharge), so I can charge for extra costs. | Fees appear as a separate section with description, amount, and optional tax rate; fee subtotals and tax are computed by the CalculationEngine. |
| INV-07 | As a tradesperson, I want to specify issue and due dates, so the payment schedule is clear. | Issue date defaults to today; due date defaults to today + 30 days (configurable via business settings); validation rejects due_date < issue_date. |
| INV-08 | As a tradesperson, I want to see a real-time preview that updates as I edit, so I know exactly what the customer will see. | A split-screen (desktop) or toggle-to-preview (mobile) shows a live HTML preview using the same templates; preview uses mirrored frontend calculations but the backend recalculates on finalize. |
| INV-09 | As a tradesperson, I want to choose or customize a template, so my invoices match my brand. | A TemplateGallery shows preset industry templates; selecting one loads a structured document layout into the editor; custom fields can be toggled on/off. |
| INV-10 | As a tradesperson, I want to set the currency for an invoice, so I can bill international customers. | Currency is an ISO 4217 code (default USD) selected at creation; the CalculationEngine uses `getCurrencyMetadata(currency)` for correct decimal places and rounding (e.g., JPY = 0 dp, USD = 2 dp). |

### 1.2 Discounts & Deposits

| ID | User Story | Acceptance Criteria |
|---|---|---|
| INV-11 | As a tradesperson, I want to request a deposit before starting work, so I don't do the job for free. | `depositType` (none/fixed/percentage) + `depositAmount`/`depositDueDate`/`depositPaymentPurpose` are stored; deposit is tracked separately and reduces `amount_due`. |
| INV-12 | As a tradesperson, I want to set terms (e.g., Net 15), so payment expectations are explicit. | Free-text terms field rendered in the template footer. |

### 1.3 Saving & Finalizing

| ID | User Story | Acceptance Criteria |
|---|---|---|
| INV-13 | As a tradesperson, I want my invoice to auto-save as a draft, so I never lose my work. | `EditorContext.enableAutosave(true, 2000)` calls `createInvoice`/`updateInvoice` API on a 2-second debounce; save state badge shows "saving"/"saved"/"unsaved". |
| INV-14 | As a tradesperson, I want to finalize an invoice, so it gets a proper number and is locked from further edits. | "Finalize & Send" triggers `POST /api/invoices/:id/finalize`; the backend assigns an atomic number, runs the CalculationEngine, runs validation, stores an immutable snapshot, and sets `is_finalized=TRUE`; the returned `invoiceNumber` is displayed. |
| INV-15 | As a tradesperson, I want validation errors to block finalization, so I don't send broken invoices. | If `InvoiceValidationService.validate()` returns `hasErrors=true`, the API returns 422 with `code: VALIDATION_FAILED` and `context.issues`; the frontend maps these to a ValidationPanel. |

### 1.4 Sending & Payments

| ID | User Story | Acceptance Criteria |
|---|---|---|
| INV-16 | As a tradesperson, I want to email an invoice to my customer, so they can view and pay it. | "Send" triggers `POST /api/invoices/:id/send`; the backend generates a rotating public token, renders HTML from the snapshot, generates a PDF, and emails it via nodemailer/SMTP; state transitions to `sent`. |
| INV-17 | As a customer, I want to pay directly from the email, so I don't need to write a check. | The email contains a link to `/pay/{token}` (no login); the payment page uses Stripe Checkout (or stub provider) with Apple/Google Pay + card fields. |
| INV-18 | As a tradesperson, I want to record a manual payment (cash/check), so my books stay accurate. | `POST /api/invoices/:id/payments` with `idempotencyKey` records the payment; duplicate keys are rejected by DB unique constraint. |
| INV-19 | As a tradesperson, I want to mark an invoice as paid and get an automatic receipt, so the customer has proof. | On `recordPayment` with full balance → status becomes `paid`, a PDF receipt is auto-generated from the snapshot and emailed. |

### 1.5 Post-Finalization Actions

| ID | User Story | Acceptance Criteria |
|---|---|---|---|
| INV-20 | As a tradesperson, I want to duplicate an invoice, so I can reuse a template for repeat customers. | `POST /api/invoices/:id/duplicate` copies customer, items, terms, and template; resets number/date to today; new draft gets its own UUID. |
| INV-21 | As a tradesperson, I want to void an invoice, so I can cancel one that was sent in error. | `POST /api/invoices/:id/void` checks `invoiceStateMachine.isVoidable(status)`; transitions to `void` and records the reason. |
| INV-22 | As a tradesperson, I want to cancel a draft, so I can remove invoices I never send. | `POST /api/invoices/:id/cancel` checks `isCancellable`; drafts can be cancelled; terminal states cannot. |
| INV-23 | As a tradesperson, I want to download a PDF of any invoice, so I can print or file it. | `POST /api/invoices/:id/pdf` renders from the immutable snapshot; downloads as `{businessName}-{invoiceNumber}.pdf`. |

---

## 2. Data Model

The database schema uses PostgreSQL with UUID primary keys and tenant isolation via `business_id` on every query. All monetary values use `NUMERIC(18,6)` to preserve precision; the CalculationEngine converts to `decimal.js` for arithmetic.

### 2.1 Entity Relationship Diagram

```
businesses (1) ──< invoices >── (1) customers
                  invoices >── (1) projects
                  invoices 1──< invoice_items
                  invoices 1──< invoice_fees
                  invoices 1──> invoice_snapshots
                  invoices 1──< invoice_events
                  invoices 1──< payments
                  businesses 1──< invoice_number_sequences
                  businesses 1──< products
                  businesses 1──< templates
                  businesses 1──< customers
```

### 2.2 Core Tables

#### `businesses`
```sql
CREATE TABLE businesses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(50),
  address         TEXT,
  website         VARCHAR(255),
  logo_url        TEXT,
  default_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  default_tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_label       VARCHAR(100),
  next_invoice_number INTEGER NOT NULL DEFAULT 1,
  invoice_number_prefix VARCHAR(20) DEFAULT 'INV',
  payment_terms_default VARCHAR(50),
  payment_instructions TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `customers`
```sql
CREATE TABLE customers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(50),
  company         VARCHAR(255),
  address         TEXT,
  website         VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_customer_business FOREIGN KEY (business_id) REFERENCES businesses(id)
);
CREATE INDEX idx_customers_business ON customers(business_id);
```

#### `products` (Services/Catalog)
```sql
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  sku             VARCHAR(100),
  unit_price      NUMERIC(18,6) NOT NULL,
  unit            VARCHAR(50) NOT NULL DEFAULT 'each',
  tax_category    VARCHAR(50),
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  cost            NUMERIC(18,6),
  type            VARCHAR(20) NOT NULL DEFAULT 'service', -- 'service' | 'product'
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_business ON products(business_id);
```

#### `invoices`
```sql
CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id         UUID REFERENCES customers(id),
  project_id          UUID REFERENCES projects(id),
  invoice_number      VARCHAR(100),
  status              invoice_status NOT NULL DEFAULT 'draft',
  issue_date          DATE,
  due_date            DATE,
  currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
  exchange_rate       NUMERIC(18,6),
  subtotal            NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_total      NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  fee_total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  total               NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_paid         NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_due          NUMERIC(18,6) NOT NULL DEFAULT 0,
  credit_applied      NUMERIC(18,6) NOT NULL DEFAULT 0,
  deposit_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  deposit_type        VARCHAR(30) NOT NULL DEFAULT 'none',
  deposit_due_date    DATE,
  deposit_payment_purpose VARCHAR(255),
  notes               TEXT,
  terms               TEXT,
  template_id         UUID REFERENCES templates(id),
  public_token        VARCHAR(64) UNIQUE,
  public_token_expires_at TIMESTAMPTZ,
  payment_instructions TEXT,
  is_finalized        BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at        TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  viewed_at           TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancelled_reason    TEXT,
  version             INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  updated_by          UUID,
  CONSTRAINT uq_invoice_number_business UNIQUE (business_id, invoice_number),
  CONSTRAINT chk_invoice_total CHECK (total >= 0),
  CONSTRAINT chk_invoice_deposit_type CHECK (deposit_type IN ('none', 'fixed', 'percentage'))
);
CREATE INDEX idx_invoices_business ON invoices(business_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(business_id, status);
CREATE INDEX idx_invoices_public_token ON invoices(public_token);
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
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
```

#### `invoice_fees`
```sql
CREATE TABLE invoice_fees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description     VARCHAR(500) NOT NULL,
  amount          NUMERIC(18,6) NOT NULL,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  fee_total       NUMERIC(18,6) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `invoice_snapshots` (Immutability)
```sql
CREATE TABLE invoice_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  revision        INTEGER NOT NULL,
  business_data   JSONB NOT NULL,
  customer_data   JSONB,
  line_items      JSONB NOT NULL,
  fees            JSONB,
  totals          JSONB NOT NULL,
  currency        VARCHAR(3) NOT NULL,
  template_html   TEXT,
  rendered_html   TEXT,
  template_revision INTEGER,
  schema_version  VARCHAR(20),
  hash            VARCHAR(64) NOT NULL, -- SHA-256 of JSON payload
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_snapshot_invoice_revision ON invoice_snapshots(invoice_id, revision);
```

#### `invoice_events` (Audit Trail)
```sql
CREATE TABLE invoice_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  event_type      VARCHAR(50) NOT NULL, -- created, updated, finalized, sent, viewed, paid, cancelled, voided
  actor_user_id   UUID,
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invoice_events_invoice ON invoice_events(invoice_id);
```

#### `invoice_number_sequences` (Atomic Numbering)
```sql
CREATE TABLE invoice_number_sequences (
  business_id     UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  next_number     INTEGER NOT NULL DEFAULT 1,
  prefix          VARCHAR(20) NOT NULL DEFAULT 'INV',
  includes_year   BOOLEAN NOT NULL DEFAULT TRUE,
  padding         INTEGER NOT NULL DEFAULT 6,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `payments` (Idempotent)
```sql
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id),
  business_id     UUID NOT NULL,
  amount          NUMERIC(18,6) NOT NULL,
  provider        VARCHAR(50) NOT NULL,
  provider_payment_id VARCHAR(255),
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  payment_method  VARCHAR(50),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_business ON payments(business_id);
```

### 2.3 Invoice Status Enum

```sql
CREATE TYPE invoice_status AS ENUM (
  'draft',
  'sent',
  'viewed',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
  'void'
);
```

---

## 3. Technical Architecture

### 3.1 Frontend Architecture

#### Component Hierarchy

```
InvoiceEditorPage (route: /app/invoices/:id)
├── InvoiceEditor (main container)
│   ├── Toolbar (Save, Finalize, Send, Duplicate, Delete)
│   ├── SplitPane
│   │   ├── DocumentEditor (canvas: palette + drag-drop canvas)
│   │   └── DocumentPreview (live HTML preview)
│   ├── PropertyInspector (right sidebar: edit selected component)
│   ├── ValidationPanel (server + client validation issues)
│   └── TemplateGallery (preset templates)
├── CustomerSelector
├── CatalogPicker (service library)
└── TaxSelector
```

#### Key Frontend Files

| File | Responsibility |
|---|---|
| `webapp/src/document-model/` | Structured document model: types, schemas, builder, operations, converter |
| `webapp/src/document-model/registry/` | Component registry: 24+ drag-drop component types with zod schemas |
| `webapp/src/document-model/converter.ts` | Bidirectional: `invoiceToDocument` ↔ `documentToInvoice` |
| `webapp/src/utils/calculation.ts` | Frontend-mirrored CalculationEngine (decimal.js) for real-time totals |
| `webapp/src/hooks/useInvoiceValidation.ts` | Client-side validation returning `ValidationIssue[]` |
| `webapp/src/api/client.ts` | Axios client with JWT interceptor; typed fetchers for all endpoints |

#### State Management

- **Document Model**: `EditorProvider` (React Context) provides `document`, `setDocument`, `selectedComponentId`, `insertComponent`, `updateComponent`, `moveComponent`, `removeComponent`, `undo`/`redo` (100-step history), `dirty`, `markSaved`, `saveDocument` (autosave).
- **Invoice Editor State**: `useState` hooks in `InvoiceEditor.tsx` for `editorData`, `business`, `customers`, `products`, `saveState`, `previewMode`.
- **Autosave**: `enableAutosave(true, 2000)` — 2-second debounce triggers `createInvoice`/`updateInvoice`.

#### Data Binding

Components in the structured document model read from a `RenderContext` that provides `business`, `customer`, `invoice`, and `calculations`. This decouples the layout from the data source, so the same document template can render different invoices.

### 3.2 Backend Architecture

#### API Design (REST)

The backend exposes a REST API at `/api/invoices` with the following endpoints:

| Method | Route | Description | Key Logic |
|---|---|---|---|
| `GET` | `/api/invoices` | List + filter/paginate | Filters: `status`, `customerId`, `search`; tenant-scoped via `business_id` |
| `POST` | `/api/invoices` | Create draft | `createDraft()` → validates customer, applies product snapshots, records "created" event |
| `GET` | `/api/invoices/:id` | Get invoice summary | Loads invoice + items + fees; recalculates totals via `CalculationEngine` |
| `PATCH` | `/api/invoices/:id` | Update draft | Checks `is_finalized`; throws `BusinessLogicError` if true |
| `PUT` | `/api/invoices/:id/items` | Replace line items | Transaction: delete all + insert; applies product snapshots |
| `PUT` | `/api/invoices/:id/fees` | Replace fees | Transaction: delete all + insert |
| `POST` | `/api/invoices/:id/finalize` | Finalize | Runs CalculationEngine, validation, atomic numbering, snapshot, state transition |
| `POST` | `/api/invoices/:id/send` | Send via email | Generate public token, render HTML+PDF, email, transition to `sent` |
| `POST` | `/api/invoices/:id/send-reminder` | Send payment reminder | Renders reminder template, emails, records event |
| `POST` | `/api/invoices/:id/cancel` | Cancel | Checks `isCancellable`; transitions to `cancelled` |
| `POST` | `/api/invoices/:id/void` | Void | Checks `isVoidable`; transitions to `void` |
| `POST` | `/api/invoices/:id/payment-intent` | Create payment intent | Stripe Checkout Session |
| `POST` | `/api/invoices/:id/pdf` | Download PDF | Stream PDF generated from snapshot |
| `GET` | `/api/invoices/:id/events` | Audit trail | Returns `invoice_events` sorted by `created_at` |
| `DELETE` | `/api/invoices/:id` | Delete draft | Returns 400 if finalized |
| `POST` | `/api/invoices/:id/duplicate` | Duplicate | Creates new draft with same data; resets date/number |
| `GET` | `/api/invoices/:id/payments` | List payments | Returns payment records |
| `POST` | `/api/invoices/:id/payments` | Record payment | Idempotent via `idempotency_key`; updates totals; transitions state |

All data Transfer Objects (DTOs) are defined with Zod schemas in `src/schemas/invoice-dto.ts`:
- `CreateInvoiceDraftSchema` — full input for draft creation
- `UpdateInvoiceDraftSchema` — partial version for draft updates
- `DraftLineItemSchema` — quantity, unitPrice, discount, taxRate as `decimal.js` Decimals
- `DraftFeeSchema` — amount, taxRate

#### Service Layer

| Service | File | Responsibility |
|---|---|---|
| `InvoiceService` | `src/services/invoice-service.ts` | Orchestrates complete lifecycle: `createDraft`, `getInvoice`, `updateDraft`, `setItems`, `setFees`, `finalize`, `send`, `cancel`, `void`, `recordPayment`, `duplicate` |
| `CalculationEngine` | `src/domain/calculation.ts` | Two-pass calculation with `decimal.js`; currency-aware rounding; tax-inclusive extraction; invoice-level discount distribution |
| `InvoiceValidationService` | `src/services/validation/invoice-validation.ts` | Returns `ValidationResult` with `valid`, `issues`, `hasErrors`, `hasWarnings`; error codes: `MISSING_CUSTOMER`, `UNSUPPORTED_CURRENCY`, `MISSING_ISSUE_DATE`, `INVALID_DUE_DATE`, `EMPTY_LINE_ITEMS`, `INVALID_QUANTITY`, `NEGATIVE_UNIT_PRICE`, `MISSING_ITEM_DESCRIPTION`, `NEGATIVE_TOTAL`, `CALCULATION_ERROR`, `CALCULATION_DISCREPANCY` |
| `InvoiceStateMachine` | `src/services/state-machine/invoice-state-machine.ts` | `ALLOWED_TRANSITIONS`, `TERMINAL`, `CANCELLABLE`, `VOIDABLE`, `determineOverdue()`, `statusAfterPayment()` |
| `NumberingService` | `src/services/numbering/service.ts` | `ensureSequence()` (INSERT IF NOT EXISTS), `generate()` (DB row lock + atomic increment) |
| `SnapshotService` | `src/services/snapshot/snapshot-service.ts` | Captures business/customer/items/fees/totals/template/rendered-HTML; SHA-256 hash for tamper detection |
| `PdfService` | `src/services/pdf/pdf-service.ts` | Renders HTML to PDF via Puppeteer (pluggable abstraction) |
| `EmailService` | `src/services/email/email-service.ts` | Sends emails via nodemailer (stub provider in dev) |
| `TaxService` | `src/services/tax/tax-service.ts` | Manual tax provider default; `calculateTax()` |

#### Data Access

- `InvoiceRepository` (`src/repositories/invoice.repo.ts`) — all CRUD operations with `business_id` tenant scoping; optimistic locking via `version` column.
- `Pool` (`src/db/pool.ts`) — PostgreSQL connection pool with `APP_ENV=test` branching.
- DB migrations via `src/db/migrate.ts` — SQL files in `src/db/migrations/`.
- Test infrastructure: `tests/global-setup.ts` (`resetTestDb()`), `tests/helpers/db.ts` (test data factories).

### 3.3 PDF Generation Strategy

**Approach: Server-side rendering with immutable snapshot.**

1. On `finalize()`, `SnapshotService` captures the complete invoice state (business, customer, items, fees, totals, template HTML) and stores it in `invoice_snapshots` with a SHA-256 hash.
2. On `send()` or `POST /invoices/:id/pdf`, `PdfService` renders the snapshot's `rendered_html` to PDF using Puppeteer.
3. This guarantees that a finalized invoice **always** produces the same PDF, even if templates change later.
4. Downloads are streamed responses to avoid buffering large files in memory.
5. Filename: `{businessName}-{invoiceNumber}.pdf`.
6. Snapshot stores `template_revision` + `schema_version` for reproducible regeneration.

**Why server-side over client-side:**
- Templates use Handlebars + CSS that requires a real DOM/Print engine (Puppeteer).
- Server-side ensures consistent output across browsers and devices.
- The snapshot's `rendered_html` is generated server-side at finalize, so PDF generation is deterministic.

### 4. Edge Cases & Validation

#### 4.1 Rounding Errors

- **All monetary math uses `decimal.js`** via the CalculationEngine (`src/domain/calculation.ts:95`).
- Currency-aware rounding via `getCurrencyMetadata(currency)`: USD = 2 dp, JPY = 0 dp, BHD = 3 dp.
- Rounding strategy: `Decimal.ROUND_HALF_UP` at the line level before summing, preventing accumulated floating-point drift.
- Final totals are re-validated on finalize: the frontend sends its calculated totals, and the backend independently recomputes via `CalculationEngine`. Any discrepancy returns `CALCULATION_DISCREPANCY` (error).

#### 4.2 Tax Compliance

| Scenario | How It's Handled |
|---|---|
| Tax-exclusive pricing (default) | `taxAmount = taxable × taxRate`; `lineTotal = taxable + taxAmount` |
| Tax-inclusive pricing | Tax is extracted: `ratio = taxRate / (1 + taxRate)`; `taxAmount = gross × ratio`; `netAmount = gross - taxAmount` |
| Mixed tax rates | Per-line `taxRate` stored; multiple lines can have different rates; `taxTotal` aggregates per-rate when needed |
| Tax on fees | Fees have optional `taxRate`; fee tax calculated independently and added to `taxTotal` |
| Zero-rated items | `taxRate = 0` → `taxAmount = 0`; still appears in `tax_summary` |

#### 4.3 Mandatory Field Validation

| Field | Rule | Where Enforced | Error Code |
|---|---|---|---|
| Customer | Required for finalize | Backend + Frontend | `MISSING_CUSTOMER` |
| Currency | Must be valid ISO 4217 | Zod schema + CalculationEngine | `UNSUPPORTED_CURRENCY` |
| Issue Date | Required for finalize | Backend validation | `MISSING_ISSUE_DATE` |
| Due Date | Must be >= Issue Date | Backend + Frontend | `INVALID_DUE_DATE` |
| Line Items | At least one non-empty line required | Backend validation | `EMPTY_LINE_ITEMS` |
| Quantity | Must be > 0 | CalculationEngine throws | `INVALID_QUANTITY` |
| Unit Price | Must be >= 0 | CalculationEngine throws | `NEGATIVE_UNIT_PRICE` |
| Description | Must be non-empty | Zod + validation | `MISSING_ITEM_DESCRIPTION` |
| Total | Must be >= 0 after calculation | `finalize()` checks | `NEGATIVE_TOTAL` |

Warnings (non-blocking):
- `MISSING_PAYMENT_INSTRUCTIONS`
- `MISSING_NOTES`
- `MISSING_CUSTOMER_EMAIL`
- `CALCULATION_DISCREPANCY` (frontend/backend totals mismatch)

#### 4.4 Sequential Invoice Numbering

- **Atomic**: `NumberingService.generate()` uses `UPDATE ... WHERE business_id FOR UPDATE` (DB row lock) to guarantee uniqueness under concurrent requests.
- **Format**: `{prefix}-{YYYY}-{NNNNNN}` (e.g., `INV-2026-000001`) — configurable per business via `invoice_number_sequences` table (`prefix`, `includes_year`, `padding`).
- **Uniqueness**: `uq_invoice_number_business UNIQUE (business_id, invoice_number)` constraint ensures no duplicates.
- **Transaction**: Number generation, totals persistence, and snapshot creation all happen within a single DB transaction in `finalize()`.

#### 4.5 Immutability After Finalization

- `is_finalized` flag is checked in every mutation path (`updateDraft`, `setItems`, `setFees`).
- After `finalize()`, all future reads for PDF/email render from `invoice_snapshots.rendered_html`.
- No update/delete path exists once `is_finalized = TRUE`.
- Snapshot includes SHA-256 hash (`hash` column); `SnapshotService.verify()` recomputes to detect tampering.

#### 4.6 State Machine Invariants

```
draft → [sent, cancelled, void]
sent → [viewed, partially_paid, paid, overdue, cancelled, void]
viewed → [partially_paid, paid, overdue, cancelled, void]
partially_paid → [paid, overdue, void]
overdue → [paid, void]
paid, cancelled, void → (terminal, no outgoing transitions)
```

- `overdue` is derived (`determineOverdue()`): `dueDate` passed + balance > 0.
- `paid` is terminal: `isVoidable('paid')` returns `false`.
- Payment recording: `statusAfterPayment()` computes `paid` (full), `partially_paid` (partial), or stays in current state.

#### 4.7 Idempotency

- Payments: `payments.idempotency_key` has a `UNIQUE` constraint; duplicate keys are rejected at the DB level.
- Finalize: if already finalized, `finalize()` returns early with the existing number (idempotent).
- Number generation: `ensureSequence()` uses `INSERT IF NOT EXISTS` — safe for concurrent calls.

#### 4.8 Tenant Isolation

- Every DB query includes `business_id` filter derived from `req.user.businessId` (set by `requireAuth` middleware at `src/middleware/auth.ts:13`).
- No query omits `business_id`; repository methods all accept `businessId` as first parameter.
- Test DB is isolated via `APP_ENV=test`.

---

## 5. User Experience (UX) Considerations

### 5.1 Mobile-First Workflow

The primary persona (tradesperson) uses a phone as the primary device. The UX minimizes manual data entry:

| UX Principle | Implementation |
|---|---|
| **Thumb-friendly targets** | All buttons are `44px` min height; numeric inputs use `inputMode="decimal"` |
| **Pre-filled defaults** | Issue date = today, due date = today + 30 days, currency = business default |
| **Service library** | Most-used services surfaced as tappable chips; search + recent-used ordering |
| **Customer on-the-fly** | Inline mini-form (name + phone + email) when no match found in search |
| **Live preview** | Mobile: "Preview" toggle replaces editor; Desktop: split-screen with live HTML |
| **Autosave** | 2-second debounce; save-state badge shows "saving"/"saved"/"unsaved" |

### 5.2 Progressive Disclosure

- **Editor**: Core fields visible; advanced (deposits, custom templates) under expandable sections.
- **Validation**: Errors block finalize; warnings appear as non-blocking banners with "Fix" suggestions.
- **Actions**: Primary action ("Finalize & Send") is prominent; secondary actions (duplicate, void, delete) are in a dropdown menu.

### 5.3 Reducing Cognitive Load

- **Real-time totals**: Frontend `calculation.ts` mirrors backend engine; totals update in <100ms as items change.
- **Single CTA**: "+ New Invoice" is the primary CTA on dashboard and top bar; one click enters the editor.
- **Status badges**: Semantic colors (per `docs/ui-ux-specification.md` §1.2.4): Paid=green, Overdue=red, Sent=blue, Viewed=indigo, Draft=slate.

### 5.4 Data Entry Optimization

- **Product catalog**: Saved products/services pre-fill line items with name, default price, unit, and tax rate — reduces typing by ~90%.
- **Templates**: Industry-specific presets (construction, plumbing, HVAC, etc.) load a structured document layout so the tradesperson doesn't start from a blank page.
- **Keyboard shortcuts** (desktop): `Alt+N` for new invoice, `Ctrl+S` for save, `Ctrl+Shift+F` for finalize.
- **Undo/Redo**: 100-step history in `EditorContext`.

### 5.5 Feedback & Communication

- **Save state**: Real-time indicator prevents uncertainty ("Did my work save?").
- **Validation panel**: Merges client-side (real-time) and server-side (on finalize) issues into a single view with fix suggestions.
- **Payment status**: Status badges + timeline in `Recent Activity` feed show the invoice lifecycle (created → sent → viewed → paid).
- **Receipts**: Auto-generated PDF + email on payment completion.

---

## 6. Implementation Roadmap

### Phase 1 — Core Invoice Loop (Weeks 1–2)

| Task | Description | Files |
|---|---|---|
| 1a | Build & send | `finalize()` (numbering + snapshot), `send()` (email + token rotation) | `src/services/invoice-service.ts:244`, `src/services/numbering/service.ts`, `src/services/snapshot/snapshot-service.ts` |
| 1b | Get paid | Payment intent + `public/invoices/:token` (no auth), `recordPayment` (idempotent) | `src/services/payments/stripe.ts`, `src/index.ts` (public routes) |

**Exit criteria:** End-to-end demo: create → finalize → send → pay → receipt on a phone in <5 minutes; 0 duplicate numbers under 100 concurrent finalizes (load test).

### Phase 2 — Speed Tools (Weeks 3–4)

| Task | Description | Files |
|---|---|---|
| 2a | Saved services + duplication | Hardened catalog CRUD, `duplicate()` | `src/domains/products/`, `POST /api/invoices/:id/duplicate` |
| 2b | Recurring + reminders | Recurring scheduler stub, reminder cron wire-up | `recurring_invoices` table, `sendReminder()` |

**Exit criteria:** Repeat job (same customer + 3 services) invoiced in ≤4 taps; reminders auto-send to unpaid invoices.

### Phase 3 — Cash-Flow Command Center (Weeks 5–6)

| Task | Description | Files |
|---|---|---|
| 3 | Dashboard + branding | Dashboard summary (outstanding / overdue / paid / upcoming) | `GET /api/dashboard`, `webapp/src/pages/Dashboard.tsx` |

**Exit criteria:** Dashboard loads on 3G phone in <1s; all four KPIs correct to the penny.

### Phase 4 — Post-MVP Enhancements

| Priority | Feature | Description |
|---|---|---|
| SHOULD | Industry service presets | Seed data per industry (plumbing, electrical, HVAC, etc.) |
| SHOULD | Mobile bottom tab bar + FAB | Thumb-optimized mobile navigation |
| COULD | SMS (Twilio) integration | Payment link + notification via SMS |
| COULD | Offline drafts | Service worker + backend sync queue |
| WON'T | Bookkeeping/ledger | Out of scope (accountant territory) |
| WON'T | Scheduling/dispatch | Separate software category |
| WON'T | Full CRM | Customer = invoice recipient only |
| WON'T | Multi-currency UI | Engine supports; UI hides for $30 SKU |

---

## 7. Success Metrics & Validation

| Metric | MVP Target | Measurement |
|---|---|---|
| Invoice→payment median | < 3 days | `payment.created_at - invoice.sent_at` |
| Paid within 24h of send | ≥ 60% | Payments where `paid_at ≤ sent_at + 24h` |
| Creation time (from library) | ≤ 60s | Stopwatch: median of 50 first-invoice creations |
| Mobile send share | ≥ 75% | User-agent parsing on `sent` events |
| Duplicate numbering | 0 | Load test: 100 concurrent `finalize()` calls |
| Snapshot integrity | 100% verifiable | `SnapshotService.verify()` passes on all finalized invoices |
| Dashboard load (mobile 3G) | < 1s | Lighthouse/Chrome DevTools network throttling |
| KPI accuracy | Exact to the penny | Dashboard totals match raw SQL sums |

---

## 8. Development Commands

```bash
# Full stack
npm run dev:all          # Backend (4000) + Frontend (5173) concurrently

# Backend
npm run dev              # Backend in watch mode (tsx)
npm run migrate          # Run DB migrations
npm run typecheck        # tsc type checking
npm run lint             # ESLint
npm run test             # Vitest unit + integration (Supertest)
npm run build            # Compile to dist/

# Frontend
cd webapp && npm run dev    # Vite dev server
cd webapp && npm run typecheck
cd webapp && npm run lint
cd webapp && npm run build  # Production build → webapp/dist/
cd webapp && npx vitest     # Frontend unit tests

# Testing
npm run test               # Backend: tests/ folder
cd webapp && npx vitest    # Frontend: webapp/src/__tests__/
```

---

## 9. Key Design Decisions

1. **Backend-authoritative math.** The frontend `calculation.ts` is for UX responsiveness only. On finalize, `InvoiceService.finalize()` re-runs `CalculationEngine` and rejects discrepant totals with `VALIDATION_FAILED` (422). This invariant is non-negotiable.

2. **Immutability by snapshot.** After `finalize()`, the invoice row is frozen; all future reads of the PDF/email render from `invoice_snapshots.rendered_html`. No mutation path exists after `is_finalized = TRUE`.

3. **Atomic numbering via DB.** `NumberingService.generate()` uses `UPDATE ... WHERE business_id FOR UPDATE` (row lock) to guarantee uniqueness under concurrency.

4. **Tenant isolation everywhere.** Every query carries `business_id` from `req.user.businessId`.

5. **Pluggable providers.** Payments (`stripe` vs `stub`), PDF (Puppeteer), Email (SMTP vs stub) are all abstracted behind service interfaces — no vendor lock-in in the domain layer.

6. **Structured document model.** The frontend uses a structured `InvoiceDocument` type (sections → rows → columns → components) with a component registry of 24+ types, drag-drop reordering via `@dnd-kit`, and zod schema validation. This is more flexible than a static form and enables the template gallery.

7. **Two-pass calculation.** The CalculationEngine does: (1) line subtotals + per-line discounts, then (2) invoice-level discount distribution (proportional) + tax extraction (inclusive/exclusive) + fee tax. This handles complex discount and tax scenarios correctly with `decimal.js` precision.
