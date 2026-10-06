# Universal Invoice Generator — Comprehensive System Design

**Version:** 1.0
**Date:** 2026-10-06
**Status:** Design Specification
**Aligned with:** existing codebase (`src/`, `webapp/src/`, `src/db/migrations/`)

This document is the authoritative design for the invoicing application. It covers:

1. **System Architecture & Data Modeling** (§1) — database schema, mandatory vs. optional fields
2. **UI/UX Design Specifications** (§2) — Invoice Creator + Customer Invoice View
3. **Logic & Calculation Engine** (§3) — subtotaling, discounts, tax, partial payments, late fees
4. **Feature Roadmap** (§4) — phased MVP → advanced implementation plan

---

## 0. Guiding Invariants

These non-negotiable rules shape every decision below (see `AGENTS.md`, `docs/MVP-PRD.md §5.3`):

| # | Invariant | Enforcement |
|---|---|---|
| 1 | Finalized invoices are **immutable** — snapshotted | `is_finalized` flag checked on every mutation; `invoice_snapshots` stores SHA-256-hashed payload |
| 2 | Invoice numbers are **atomic** (DB-level) and unique per business | `invoice_number_sequences` + `UPDATE ... FOR UPDATE` row lock (`src/services/numbering/service.ts`) |
| 3 | **Backend is authoritative** for all calculations | Frontend `webapp/src/utils/calculation.ts` mirrors `src/domain/calculation.ts` for UX only; backend recomputes on finalize and rejects discrepancies with `CALCULATION_DISCREPANCY` (422) |
| 4 | **Tenant isolation** enforced at every DB query | Every repository method takes `businessId` first; `requireAuth` middleware sets `req.user.businessId` |
| 5 | **Money uses `decimal.js`** — never float | All `NUMERIC(18,6)`; `Decimal.ROUND_HALF_UP`; currency-aware decimal places |
| 6 | **Pluggable providers** — no vendor lock-in | Payment (`stub`/`stripe`), PDF (`html`/`stub`), Email (`stub`/`smtp`), Tax (`manual`/`avalara`/`taxjar`), AI (`stub`/`openai`/`anthropic`) |

---

## 1. System Architecture & Data Modeling

### 1.1 Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React 18 + Vite + Tailwind v4)                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────┐ │
│  │ Invoice Creator  │  │ Customer Invoice │  │ Dashboard/Reports   │ │
│  │ (InvoiceWorkspace│  │ View (PublicInvoice│  │ (ReportSection)    │ │
│  │  + document-model│  │  /pay/:token)     │  │                     │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬──────────┘ │
│           │                     │                        │             │
│  ┌────────▼─────────┐  ┌───────▼──────────┐             │             │
│  │ calculation.ts   │  │ (read-only)      │             │             │
│  │ (mirror, UX-only)│  │                  │             │             │
│  └────────┬─────────┘  └──────────────────┘             │             │
└───────────┼──────────────────────────────────────────────┼─────────────┘
            │  HTTPS (Axios, JWT)                          │ (public token)
┌───────────▼──────────────────────────────────────────────▼─────────────┐
│  API LAYER (Express 4 + Zod validation)                               │
│  requireAuth → req.user.businessId (tenant scoping)                    │
└───────────┬────────────────────────────────────────────────────────────┘
            │
┌───────────▼────────────────────────────────────────────────────────────┐
│  SERVICE LAYER                                                        │
│  InvoiceService ──► CalculationEngine (decimal.js)                     │
│       │              InvoiceValidationService                          │
│       │              InvoiceStateMachine                               │
│       │              InvoiceNumberService (atomic)                     │
│       │              SnapshotService (SHA-256, immutable)              │
│       │              TemplateRenderer (Handlebars)                     │
│       │              PdfService / EmailService / TaxService            │
└───────────┬────────────────────────────────────────────────────────────┘
            │
┌───────────▼────────────────────────────────────────────────────────────┐
│  DATA LAYER (PostgreSQL + pg)                                         │
│  Repositories (all queries carry business_id)                          │
│  Migrations (src/db/migrations/*.sql, node-pg-migrate-style runner)   │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2 The Invoice Domain — Five Sections

Every invoice is composed of five sections. The schema distinguishes **mandatory** (required to finalize) from **optional** fields.

| Section | Mandatory Fields | Optional Fields |
|---|---|---|
| **Business Info** | `name` (business) | `legal_name`, `email`, `phone`, `website`, `tax_id`, `registration_number`, `address_*`, `logo_url` |
| **Customer Info** | `customer_id` → `customers.name` | `company_name`, `email`, `phone`, `tax_id`, `address_*`, `default_currency`, `notes` |
| **Line Items** | `description`, `quantity > 0`, `unit_price ≥ 0`, `line_total` | `product_id`, `unit`, `discount`, `discount_type`, `tax_rate`, `is_tax_inclusive`, catalog snapshots |
| **Financial Summaries** | `subtotal`, `total` (computed), `amount_due` (computed) | `discount_total`, `tax_total`, `fee_total`, `amount_paid`, `credit_applied` |
| **Payment Terms** | `due_date` (≥ `issue_date`) | `terms`, `payment_instructions`, `deposit_*`, `late_fee_*`, `notes` |

> **Mandatory set** (per task spec): Customer, Invoice ID (number), Dates (issue/due), Items (≥1), Payment Methods (payment instructions or a configured provider).
> **Optional set** (per task spec): Tax IDs, Discounts, Late Fees, Attachments.

### 1.3 Entity-Relationship Diagram

```
businesses (1) ──< business_settings (1:1)
    │
    ├──< invoice_number_sequences (1:1)        ── atomic numbering
    ├──< customers (1:N)
    │        └──< customers (self-referral via default_currency)
    ├──< products (1:N)                        ── service/material catalog
    ├──< business_tax_rates (1:N)              ── manual tax provider
    ├──< templates / document_templates (1:N)  ── Handlebars layouts
    │
    └──< invoices (1:N) ─────────────────────────────────────┐
             │                                               │
             ├──< invoice_items (1:N)                        │
             ├──< invoice_fees (1:N)                         │
             ├──< invoice_snapshots (1:1, immutable)         │
             ├──< invoice_events (1:N)   ── audit trail      │
             ├──< payments (1:N)         ── idempotent       │
             ├──< payment_intents (1:N)                       │
             ├──< invoice_reminders (1:N)                     │
             ├──< receipts (1:N)                              │
             └──< credit_note_applications (1:N)              │
                                                            │
    ├──< recurring_invoices (1:N) ──< recurring_invoice_items (1:N)
    ├──< recurring_invoice_fees (1:N)
    ├──< recurring_generation_runs (1:N)
    ├──< quotes (1:N) ──< quote_items (1:N)
    ├──< credit_notes (1:N) ──< credit_note_items (1:N)
    │        └──< credit_note_applications (1:N) ──► invoices
    ├──< projects (1:N) ──< invoice.project_id
    └──< email_log (1:N), scheduled_emails (1:N)
```

### 1.4 Core Schema (DDL)

> The following is the consolidated schema. In the running codebase these are split across `src/db/migrations/001…040*.sql`. `NUMERIC(18,6)` preserves precision; the `CalculationEngine` converts to `decimal.js`.

#### `businesses` — tenant boundary

```sql
CREATE TABLE businesses (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id            UUID NOT NULL,
  name                VARCHAR(255) NOT NULL,          -- MANDATORY
  legal_name          VARCHAR(255),
  email               VARCHAR(255),
  phone               VARCHAR(50),
  website             VARCHAR(255),
  tax_id              VARCHAR(100),                   -- optional
  registration_number VARCHAR(100),
  address_line_1      VARCHAR(255),
  address_line_2      VARCHAR(255),
  city                VARCHAR(100),
  state_or_region     VARCHAR(100),
  postal_code         VARCHAR(20),
  country_code        VARCHAR(3),
  default_currency    VARCHAR(3) NOT NULL DEFAULT 'USD',
  logo_url            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE business_settings (
  business_id       UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  default_currency  VARCHAR(3) NOT NULL DEFAULT 'USD',
  default_tax_rate  NUMERIC(5,4) DEFAULT 0,
  default_terms     TEXT,
  default_notes     TEXT,
  time_zone         VARCHAR(50) NOT NULL DEFAULT 'UTC',
  locale            VARCHAR(10) DEFAULT 'en-US',
  -- payment defaults (optional)
  payment_provider           VARCHAR(50) DEFAULT 'stub',
  payment_provider_config    JSONB DEFAULT '{}'::jsonb,
  reminders_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  overdue_reminder_days      INTEGER NOT NULL DEFAULT 7,
  reminders_before_due       JSONB DEFAULT '[]'::jsonb,
  reminders_after_due        JSONB DEFAULT '[]'::jsonb,
  late_fee_type              VARCHAR(30) NOT NULL DEFAULT 'none',
  late_fee_value             NUMERIC(18,6) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `customers` — mandatory `name`; optional contact/tax/address

```sql
CREATE TABLE customers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,              -- MANDATORY
  company_name    VARCHAR(255),
  email           VARCHAR(255),
  phone           VARCHAR(50),
  tax_id          VARCHAR(100),                       -- optional
  address_line_1  VARCHAR(255),
  address_line_2  VARCHAR(255),
  city            VARCHAR(100),
  state_or_region VARCHAR(100),
  postal_code     VARCHAR(20),
  country_code    VARCHAR(3),
  default_currency VARCHAR(3),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_customers_business ON customers(business_id);
```

#### `invoices` — the aggregate root

```sql
CREATE TYPE invoice_status AS ENUM (
  'draft','sent','viewed','partially_paid','paid','overdue','cancelled','void'
);

CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,  -- MANDATORY at finalize
  project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
  invoice_number      VARCHAR(100),                       -- MANDATORY at finalize (atomic)
  status              invoice_status NOT NULL DEFAULT 'draft',
  issue_date          DATE,                               -- MANDATORY at finalize
  due_date            DATE,                               -- MANDATORY, >= issue_date
  currency            VARCHAR(3) NOT NULL DEFAULT 'USD',  -- MANDATORY (ISO 4217)
  exchange_rate       NUMERIC(18,6),

  -- Financial summaries (all computed by CalculationEngine)
  subtotal            NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_total      NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  fee_total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  total               NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_paid         NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_due          NUMERIC(18,6) NOT NULL DEFAULT 0,
  credit_applied      NUMERIC(18,6) NOT NULL DEFAULT 0,

  -- Payment terms (optional)
  deposit_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  deposit_type        VARCHAR(30) NOT NULL DEFAULT 'none',  -- none|fixed|percentage
  deposit_due_date    DATE,
  deposit_payment_purpose VARCHAR(255),
  late_fee_type       VARCHAR(30) NOT NULL DEFAULT 'none',  -- none|fixed|percentage
  late_fee_value      NUMERIC(18,6) NOT NULL DEFAULT 0,
  late_fee_applied    BOOLEAN NOT NULL DEFAULT FALSE,
  late_fee_applied_amount NUMERIC(18,6) NOT NULL DEFAULT 0,

  notes               TEXT,
  terms               TEXT,
  payment_instructions TEXT,                            -- MANDATORY for customer pay view (warning if empty)
  template_id         UUID REFERENCES templates(id),
  public_token        VARCHAR(64) UNIQUE,
  public_token_expires_at TIMESTAMPTZ,

  is_finalized        BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at        TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  viewed_at           TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancelled_reason    TEXT,
  payment_risk_score  NUMERIC(5,2),
  payment_risk_factors JSONB,
  payment_risk_scored_at TIMESTAMPTZ,
  version             INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  updated_by          UUID,

  CONSTRAINT uq_invoice_number_business UNIQUE (business_id, invoice_number),
  CONSTRAINT chk_invoice_total_check CHECK (total >= 0),
  CONSTRAINT chk_invoice_due_after_issue CHECK (due_date >= issue_date),
  CONSTRAINT chk_invoices_deposit_type CHECK (deposit_type IN ('none','fixed','percentage')),
  CONSTRAINT chk_invoices_deposit_amount CHECK (deposit_amount >= 0),
  CONSTRAINT chk_invoices_late_fee_type CHECK (late_fee_type IN ('none','fixed','percentage')),
  CONSTRAINT chk_invoices_late_fee_value CHECK (late_fee_value >= 0)
);
CREATE INDEX idx_invoices_business ON invoices(business_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_public_token ON invoices(public_token);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
```

#### `invoice_items` — line items (mandatory ≥1)

```sql
CREATE TABLE invoice_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  description     VARCHAR(500) NOT NULL,                -- MANDATORY
  quantity        NUMERIC(18,6) NOT NULL,               -- MANDATORY > 0
  unit            VARCHAR(50) NOT NULL DEFAULT 'each',
  unit_price      NUMERIC(18,6) NOT NULL,               -- MANDATORY >= 0
  discount        NUMERIC(18,6) NOT NULL DEFAULT 0,     -- optional
  discount_type   VARCHAR(20) NOT NULL DEFAULT 'fixed', -- fixed|percentage
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,      -- optional, per-line
  tax_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  line_subtotal   NUMERIC(18,6) NOT NULL,
  line_total      NUMERIC(18,6) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
  -- catalog snapshot (price/name at creation time; product edits don't affect issued invoice)
  catalog_name          VARCHAR(255),
  catalog_sku           VARCHAR(100),
  catalog_tax_category  VARCHAR(100),
  catalog_unit_price    NUMERIC(18,6),
  catalog_tax_rate      NUMERIC(5,4),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product ON invoice_items(product_id);
```

#### `invoice_fees` — separate fee section (optional)

```sql
CREATE TABLE invoice_fees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description     VARCHAR(500) NOT NULL,
  amount          NUMERIC(18,6) NOT NULL,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,      -- optional
  tax_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invoice_fees_invoice ON invoice_fees(invoice_id);
```

#### `invoice_snapshots` — immutability (1:1 finalized invoice)

```sql
CREATE TABLE invoice_snapshots (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id          UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  snapshot            JSONB NOT NULL,                   -- business, customer, items, fees, totals, template
  snapshot_hash       VARCHAR(64) NOT NULL,             -- SHA-256 of JSON payload
  revision            INTEGER NOT NULL DEFAULT 1,
  template_id         UUID,
  template_schema_version VARCHAR(20),
  template_revision   INTEGER,
  rendered_html       TEXT,                             -- historical rendered HTML for deterministic PDF
  pdf_stored          BOOLEAN NOT NULL DEFAULT FALSE,
  pdf_hash            VARCHAR(64),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  CONSTRAINT uq_snapshot_invoice UNIQUE (invoice_id)
);
CREATE INDEX idx_invoice_snapshots_hash ON invoice_snapshots(snapshot_hash);
```

#### `invoice_events` — audit trail

```sql
CREATE TYPE invoice_event_type AS ENUM (
  'created','updated','line_item_added','line_item_updated','line_item_removed',
  'discount_applied','tax_calculated','draft_saved','finalized','number_assigned',
  'sent','email_sent','email_delivered','email_opened','viewed','paid','partially_paid',
  'overdue','cancelled','voided','payment_recorded','payment_refunded','fee_added',
  'memo_added','credit_note_applied','receipt_generated','receipt_sent','reminder_sent'
);

CREATE TABLE invoice_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  event_type      invoice_event_type NOT NULL,
  actor_id        UUID,
  actor_type      VARCHAR(20),                          -- user | customer | system | payment
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invoice_events_invoice ON invoice_events(invoice_id);
CREATE INDEX idx_invoice_events_type ON invoice_events(event_type);
CREATE INDEX idx_invoice_events_created ON invoice_events(created_at);
```

#### `invoice_number_sequences` — atomic numbering

```sql
CREATE TABLE invoice_number_sequences (
  business_id     UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix          VARCHAR(50) NOT NULL DEFAULT 'INV',
  next_number     BIGINT NOT NULL DEFAULT 1,
  padding         SMALLINT NOT NULL DEFAULT 6,
  includes_year   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Number format: {prefix}-{YYYY}-{NNNNNN}  e.g. INV-2026-000001
```

#### `payments` — idempotent payment records

```sql
CREATE TYPE payment_status AS ENUM ('pending','succeeded','failed','cancelled','refunded','partially_refunded');

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id          UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider            VARCHAR(50) NOT NULL,             -- stub | stripe | manual
  provider_payment_id VARCHAR(255),
  amount              NUMERIC(18,6) NOT NULL,
  currency            VARCHAR(3) NOT NULL,
  status              payment_status NOT NULL DEFAULT 'pending',
  paid_at             TIMESTAMPTZ,
  method              VARCHAR(50),                      -- card | bank_transfer | check | cash | paypal | ach
  payment_purpose     VARCHAR(255),                     -- full | deposit | partial
  idempotency_key     VARCHAR(255) UNIQUE,              -- idempotency guard
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_business ON payments(business_id);
CREATE INDEX idx_payments_provider_id ON payments(provider, provider_payment_id);
CREATE INDEX idx_payments_idempotency ON payments(idempotency_key);
```

### 1.5 Mandatory vs. Optional — Field Classification Summary

| Field | Section | Mandatory? | Where Enforced | Error Code |
|---|---|---|---|---|
| `customer_id` | Customer Info | **Yes** (finalize) | `InvoiceValidationService` + `finalize()` | `MISSING_CUSTOMER` |
| `invoice_number` | Invoice ID | **Yes** (finalize) | `InvoiceNumberService.generate()` atomic | `VALIDATION_FAILED` |
| `issue_date` | Dates | **Yes** (finalize) | `InvoiceValidationService` | `MISSING_ISSUE_DATE` |
| `due_date` | Dates | **Yes** (≥ issue_date) | DB constraint + validation | `INVALID_DUE_DATE` |
| `items` (≥1) | Line Items | **Yes** (finalize) | `InvoiceValidationService` | `EMPTY_LINE_ITEMS` |
| `quantity > 0` | Line Items | **Yes** | `CalculationEngine` throws | `INVALID_QUANTITY` |
| `unit_price ≥ 0` | Line Items | **Yes** | `CalculationEngine` throws | `NEGATIVE_UNIT_PRICE` |
| `description` | Line Items | **Yes** (non-empty) | Zod + validation | `MISSING_ITEM_DESCRIPTION` |
| `currency` | Financial | **Yes** (ISO 4217) | Zod + `getCurrencyMetadata` | `UNSUPPORTED_CURRENCY` |
| `payment_instructions` | Payment Terms | **Yes** (warning) | `InvoiceValidationService` | `MISSING_PAYMENT_INSTRUCTIONS` |
| `tax_id` | Business/Customer | No | — | — |
| `discount` / `discount_type` | Line Items | No | `discountAmount()` | — |
| `invoice_discount` | Financial | No | two-pass engine | — |
| `late_fee_type` / `late_fee_value` | Payment Terms | No | `applyLateFeeIfNeeded()` | — |
| `deposit_*` | Payment Terms | No | deposit validation | — |
| `attachments` | Line Items | No | client-side only (not persisted to snapshot payload) | — |

### 1.6 Supporting Tables (Automation & Intelligence)

| Table | Purpose | Key Columns |
|---|---|---|
| `invoice_reminder_rules` | Automated reminder cadence | `trigger_type` (before_due/after_due/manual), `offset_days`, `min_status`, `max_send_count`, `subject_template`, `message_template`, `repeat_every_days` |
| `invoice_reminders` | Reminder history + idempotency | `invoice_id`, `rule_id`, `send_count`, `idempotency_key` |
| `payment_intents` | Hosted payment session | `provider`, `provider_intent_id`, `amount`, `client_secret`, `status` |
| `receipts` | Auto-generated on payment | `receipt_number`, `amount`, `payment_method`, `payment_purpose`, `idempotency_key`, `pdf BYTEA` |
| `recurring_invoices` | Recurring billing schedules | `frequency`, `interval_count`, `next_generation_at`, `auto_send`, `issue_offset_days`, `due_offset_days`, `deposit_*` |
| `recurring_generation_runs` | Idempotent generation runs | `scheduled_for`, `idempotency_key`, `status`, `invoice_id` |
| `credit_notes` | Refunds/credits (Phase 4+) | `credit_note_number`, `status`, `applied_total`, `amount_due` |
| `credit_note_applications` | Apply credit to invoice | `credit_note_id`, `invoice_id`, `amount`, `idempotency_key` |
| `quotes` | Estimates (Phase 4) | `quote_number`, `status`, `is_accepted`, `converted_invoice_id` |
| `projects` | Job grouping | `name`, `status`, `budget`, `amount_invoiced`, `amount_paid`, `remaining_billable` |
| `email_log` / `scheduled_emails` | Delivery + queue | `status`, `idempotency_key`, `message_id`, `attempts`, `available_at` |
| `stripe_webhook_events` | Webhook dedup | `stripe_event_id` (PK), `event_type`, `processed_at` |

---

## 2. UI/UX Design Specifications

### 2.0 The "7 Questions" Framework

Before any invoice is created, the system must answer seven questions. These map to the Invoice Creator's sections and the Customer Invoice View's information hierarchy.

| # | Question | Invoice Creator (admin) | Customer Invoice View (payer) |
|---|---|---|---|
| 1 | **Who is billing?** | Business info panel (name, logo, contact, tax ID) | Header with business name, logo, contact |
| 2 | **Who is being billed?** | `CustomerSelector` (searchable dropdown + inline create) | "Bill To" block |
| 3 | **What was provided?** | Line-items table (description, qty, unit, price, discount, tax) | Line-items table (read-only) |
| 4 | **When is it due?** | Issue/due date pickers (default today / today+30) | Due date badge + "past due" warning |
| 5 | **How much is owed?** | `TotalsCard` (subtotal→discount→tax→fees→total→paid→**balance due**) | **"Balance Due" hero** (largest, highest-contrast) |
| 6 | **How do I pay?** | `NotesSection` payment-instructions + payment-provider settings | **"Pay Now" CTA** + payment-method choice + instructions |
| 7 | **What are the terms?** | Terms textarea + late-fee/deposit config | Terms & conditions footer + late-fee notice |

### 2.1 Invoice Creator (Administrative View)

**Component:** `InvoiceWorkspace` (`webapp/src/components/InvoiceWorkspace.tsx`, 2,306 lines).

#### 2.1.1 Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ WorkspaceHeader: ← Back | Invoice # | [Draft] badge | [● Saving…]    │
│                 [Preview] [Finalize & Send ▾]                          │
├──────────────────────────────────┬─────────────────────────────────────┤
│  Editor (left, flex-1)           │  Live Preview (right, resizable     │
│                                  │  320–640px, drag handle)            │
│  ┌ SavedServicesBar ──────────┐  │  ┌──────────────────────────────┐  │
│  │ [Service A] [Service B] …  │  │  │ InvoicePreview              │  │
│  └────────────────────────────┘  │  │  Header + BillTo + Table    │  │
│  ┌ CustomerSelector ──────────┐  │  │  + Totals + Payment CTA     │  │
│  │ [Search customer…] [+ New] │  │  └──────────────────────────────┘  │
│  └────────────────────────────┘  │                                     │
│  ┌ HeaderFields ──────────────┐  │  (mobile: toggle Edit/Preview)     │
│  │ IssueDate DueDate Currency │  │                                     │
│  │ PO# Template TaxRate       │  │                                     │
│  └────────────────────────────┘  │                                     │
│  ┌ LineItemsTable ────────────┐  │                                     │
│  │ # | Desc | Qty | Price |   │  │                                     │
│  │   Disc | Type | Tax | Tot | │  │                                     │
│  │   [+ Add another line]      │  │                                     │
│  └────────────────────────────┘  │                                     │
│  ┌ TotalsCard ────────────────┐  │                                     │
│  │ Subtotal        $X,XXX.XX  │  │                                     │
│  │ Discount       −$XXX.XX    │  │                                     │
│  │ Tax             $XX.XX     │  │                                     │
│  │ Fees            $XX.XX     │  │                                     │
│  │ ─────────────────────────  │  │                                     │
│  │ Total          $X,XXX.XX   │  │                                     │
│  │ Amount paid    [input    ] │  │                                     │
│  │ Balance due    $X,XXX.XX ◄─┼──┼── largest, boldest, brand color    │
│  └────────────────────────────┘  │                                     │
│  ┌ AdvancedDetailsAccordion ──┐  │                                     │
│  │ ▸ Deposit (type/amt/date)  │  │                                     │
│  │ ▸ Late fee (none/fixed/%)  │  │                                     │
│  └────────────────────────────┘  │                                     │
│  ┌ NotesSection ──────────────┐  │                                     │
│  │ Job notes [textarea]       │  │                                     │
│  │ Payment instr. [textarea]  │  │                                     │
│  │ Terms & cond.  [textarea]  │  │                                     │
│  │ Before/After/Attachments   │  │                                     │
│  └────────────────────────────┘  │                                     │
└──────────────────────────────────┴─────────────────────────────────────┘
```

#### 2.1.2 Component Specifications

**A. `TotalsCard`** (`InvoiceWorkspace.tsx:1396`) — the financial summary.

| Row | Type | Binding | Styling |
|---|---|---|---|
| Subtotal | read-only | `calc.subtotal` | `text-tertiary` / `text-right font-medium text-primary` |
| Discount | conditional | `calc.discountTotal` (shown only if > 0) | `text-success-text` (green, "−" prefix) |
| Tax | read-only | `calc.taxTotal` | `text-primary` |
| Fees | conditional | `calc.feeTotal` (shown only if > 0) | `text-primary` |
| **Total** | read-only | `calc.total` | `border-t-2 pt-3`, `text-xl font-bold text-primary` |
| Amount paid | **editable input** | `invoice.amountPaid` | `form-control-sm w-28 text-right font-tabular-nums` |
| **Balance due** | read-only, computed | `calc.amountDue` | `text-xl font-bold text-primary-brand` ← **highest visual priority** |

**B. `LineItemsTable`** (`InvoiceWorkspace.tsx:1487`) — columns: `#`, Description, Qty, Unit, Unit Price, Discount, Discount Type, Tax Rate %, Tax-Inclusive ✓, Line Total, Actions (duplicate/remove). Each numeric input uses `inputMode="decimal"`; `step` is `1` for 0-dp currencies (JPY/KRW/VND) else `0.01`.

**C. `NotesSection`** (`InvoiceWorkspace.tsx:1870`) — `Job notes`, `Payment instructions` (prefilled from `settings.default_payment_instructions`), `Terms & conditions` (default `"Net 30"`), and three upload zones: Before photos, After photos, Attachments.

**D. `AdvancedDetailsAccordion`** — collapsible panels for **Deposit** (`depositType` none/fixed/percentage, `depositValue`, `depositDueDate`, `depositPaymentPurpose`) and **Late Fee** (`lateFeeType` none/fixed/percentage, `lateFeeValue`). Late-fee hint: *"Applied automatically when the invoice becomes overdue and online payments are available."*

**E. `WorkspaceHeader`** (`InvoiceWorkspace.tsx:1234`) — back button, invoice number / "Create Invoice" title, Draft/Editing badge, save-state indicator (`Saving…`/`Saved`/`Save failed`/`Unsaved`), Preview toggle, Finalize & Send primary action.

#### 2.1.3 Design Tokens (from `docs/ui-ux-specification.md`)

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#2563eb` (blue-600) | Primary buttons, links, Balance-due emphasis |
| `--color-success-*` | green-50/800/200 | Paid badges, discounts |
| `--color-error-*` | red-50/800/200 | Overdue, validation errors |
| `--color-warning-*` | amber-50/800/200 | Draft, partially-paid, late-fee |
| `--color-info-*` | blue-50/800/200 | Sent/viewed |
| `--color-surface` | white / slate-800 | Card backgrounds |
| Radius `md` | 8px (`rounded-lg`) | Buttons, inputs, badges |
| Radius `lg` | 12px (`rounded-xl`) | Cards, panels |
| Typography | Page 24/700, Section 18/600, Card 14/600, Body 14/400, Caption 12/500 | Hierarchy |
| Spacing scale | 4/8/16/24/32/48/64 | `space-xs`…`space-3xl` |

**Status badge mapping** (`InvoicePreview.tsx:115`, `ui/InvoiceStatus.tsx`):

| Status | Classes | Dot |
|---|---|---|
| `paid` | `status-success-bg status-success-text` | green-500 |
| `overdue` | `status-error-bg status-error-text` | red-500 |
| `partially_paid` | `status-warning-bg status-warning-text` | amber-500 |
| `sent`/`viewed` | `status-info-bg status-info-text` | blue-500 |
| `draft` | `status-warning-bg status-warning-text` | slate-400 |
| `cancelled`/`void` | `status-tertiary-bg status-tertiary-text` | slate-400 |

### 2.2 Customer Invoice View (End-User View)

**Component:** `PublicInvoice` (`webapp/src/pages/PublicInvoice.tsx`, 502 lines) at route `/invoice/:token` — **unauthenticated, read-only, action-oriented**.

#### 2.2.1 Information Hierarchy (strict priority order)

```
┌─────────────────────────────────────────────────────────────┐
│  Priority 0: Deposit Required banner (if deposit due > 0)   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ⚠ Deposit Required                                   │ │
│  │ 25% deposit — due by Sep 20, 2026                    │ │
│  │ ┌──────────────┐ ┌──────────────┐                    │ │
│  │ │ Deposit Due  │ │ Deposit Paid │                    │ │
│  │ │   $300.00    │ │    $0.00     │                    │ │
│  │ └──────────────┘ └──────────────┘                    │ │
│  │            [ Pay Deposit Now ]                        │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Invoice #INV-2026-0042           [Unpaid] status badge   │
│  ── rendered invoice HTML (from immutable snapshot) ──      │
│     • Business header + logo                                │
│     • Bill To block                                         │
│     • Metadata panel (issue/due date, currency, terms)      │
│     • Line items table (read-only)                          │
│     • Fees table (if any)                                   │
│     • Totals block: Subtotal→Discount→Tax→Fees→Total→Paid   │
├─────────────────────────────────────────────────────────────┤
│  Priority 1-2: Balance Due hero  +  Pay Now CTA             │
│  ┌────────────────────────┐  ┌──────────────────────────┐  │
│  │  Amount Due            │  │  [ 💳 Pay $1,200.00 ]    │  │
│  │  $1,200.00  ◄── 3xl    │  │  (primary-action, w-full │  │
│  │  Due: Sep 26, 2026     │  │   on mobile)             │  │
│  │  [Unpaid] badge        │  │                          │  │
│  └────────────────────────┘  └──────────────────────────┘  │
│  Priority 3-4: Payment method choice (after clicking Pay)   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Secure Card Payment (USD)                            │   │
│  │ [ Stripe Payment Element / stub amount input ]       │   │
│  │ [ ● Card  ○ Bank  ○ PayPal ]                         │   │
│  │                        [ Confirm Pay $1,200.00 ]     │   │
│  └──────────────────────────────────────────────────────┘   │
│  Priority 5: Bank transfer / manual instructions            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Payment Instructions                                 │   │
│  │ Bank: 1234 5678 90   Account: 987654321            │   │
│  │ Reference: INV-2026-0042                             │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Priority 6: Terms & Conditions (collapsible footer)        │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2.2 "Balance Due" & "Pay Now" — Priority Design

The single most important UX goal is **clarity of Balance Due and the Pay Now CTA**:

| Element | Specification | Rationale |
|---|---|---|
| **Balance Due amount** | `text-3xl font-extrabold text-primary-brand` — largest text on the page | Immediate glanceability |
| **"Total amount due" caption** | `text-sm text-tertiary` directly beneath | Labels the hero number |
| **Pay Now button** | `bg-primary-action text-on-primary px-8 py-3.5 text-base font-semibold rounded-lg shadow-md hover:bg-primary-hover` | Highest-contrast interactive element |
| **Button label** | `Pay ${formatCurrency(amountDue)}` (e.g. "Pay $1,200.00") | Amount embedded in the CTA removes ambiguity |
| **Button width** | `w-full` on mobile, `sm:w-auto` on desktop | Thumb-friendly on phones |
| **Button icon** | `CreditCard` (lucide, 20px) left of text | Universal "pay" affordance |
| **Subtext** | `text-xs text-tertiary` "Secure online payment — no account required" | Reduces friction/ anxiety |
| **Overdue warning** | `text-xs status-error-text` "This invoice is past its due date. Late fees may apply." | Urgency + late-fee notice |

**Fully Paid state** (terminal): no CTA, no form, no instructions — replaced by a green `✓ Fully Paid` confirmation (`CheckCircle` 64px in a `rounded-full`), "Paid on {date}", `status-success-bg status-success-text` badge.

#### 2.2.3 Customer View States

| State | Status badge | Balance Due | Pay Now CTA | Notes |
|---|---|---|---|---|
| **Unpaid** | `status-info-bg` "Unpaid" | full total | `Pay {amountDue}` | Default primary state |
| **Partially Paid** | `status-warning-bg` "Partially Paid" | remaining balance | `Pay {amountDue}` | Custom-amount input + "Pay full amount" quick-fill |
| **Overdue** | `status-error-bg` "Overdue" | full balance | `Pay {amountDue}` | Red "past due" warning + late-fee notice |
| **Paid** | `status-success-bg` "Paid" | $0.00 | **none** | Green `✓ Fully Paid` confirmation |
| **Draft/Cancelled/Void** | `status-tertiary-bg` | — | **none** | Read-only, no payment path |

#### 2.2.4 Responsive Breakpoints

| Breakpoint | Customer View | Creator View |
|---|---|---|
| Mobile `< 640px` | Single column; Pay button `w-full`; payment form stacks | Editor/Preview toggle (no split) |
| Tablet `640–1024px` | 2-col amount/CTA; Pay auto-width | Split 50/50 preview |
| Desktop `≥ 1024px` | 2-col amount(left)+CTA(right), `max-w-4xl` | 3-panel editor / resizable preview (~480px default) |

#### 2.2.5 Accessibility (WCAG 2.1 AA)

- Pay Now button: `aria-label="Pay ${amount} now"`
- Status badges: `aria-label="Paid — Invoice has been fully paid."`
- Payment form errors: `aria-live="polite"` in `status-error-text`
- Amount inputs: `inputMode="decimal"` (mobile numeric keyboard)
- All interactive elements: `focus:ring-2 focus:ring-primary`
- Loading: skeleton screens with `animate-pulse` (never spinners for content areas)

---

## 3. Logic & Calculation Engine

### 3.1 Calculation Engine (`src/domain/calculation.ts`)

All monetary math uses **`decimal.js`** with **`Decimal.ROUND_HALF_UP`** and **currency-aware decimal places** (`getCurrencyMetadata`). The engine performs a **two-pass calculation**.

#### 3.1.1 Currency-Aware Rounding

```typescript
// src/domain/value-objects/currency.ts
export function getCurrencyMetadata(code: string): CurrencyMetadata {
  // USD/EUR/GBP = 2dp, JPY/KRW/VND = 0dp, BHD = 3dp, etc.
}
```

| Currency | Decimal Places | Minor Unit |
|---|---|---|
| USD, EUR, GBP, CAD, AUD… | 2 | cent |
| JPY, KRW, VND | 0 | yen / jeon / hào |
| BHD (if added) | 3 | fils |

#### 3.1.2 Two-Pass Algorithm

**Pass 1 — Line subtotals + per-line discounts:**

```
For each line item:
  lineSubtotal = round(qty × unitPrice)                          // currency dp
  lineDiscount = discountAmount(discount, lineSubtotal, currency) // capped at lineSubtotal, ≥ 0
  totalNet    += lineSubtotal − lineDiscount
subtotal       = Σ lineSubtotal
lineDiscountTotal = Σ lineDiscount
```

**Invoice-level discount** (applied to net subtotal after line discounts, **distributed proportionally**):

```
netAfterLineDiscounts = subtotal − lineDiscountTotal
invoiceDiscount       = discountAmount(invoiceDiscount, netAfterLineDiscounts, currency)
discountTotal         = round(lineDiscountTotal + invoiceDiscount)

// Distribute invoiceDiscount across lines by each line's net contribution:
For each line i:
  net_i = lineSubtotal_i − lineDiscount_i
  lineShare_i = round(invoiceDiscount × (net_i / totalNet))
```

**Pass 2 — Tax extraction (inclusive/exclusive) + line totals:**

```
For each line i:
  effectiveTaxable = round(lineSubtotal_i − lineDiscount_i − lineShare_i)

  if isTaxInclusive:   // unit price already includes tax
    ratio      = taxRate / (1 + taxRate)
    taxAmount  = round(effectiveTaxable × ratio)
    netAmount  = round(effectiveTaxable − taxAmount)
    lineTotal  = effectiveTaxable            // gross already includes tax
  else:                // tax-exclusive (default)
    taxAmount  = round(effectiveTaxable × taxRate)
    netAmount  = effectiveTaxable
    lineTotal  = round(effectiveTaxable + taxAmount)

  taxTotal += taxAmount
  total    += lineTotal
```

**Fees (independent tax):**

```
For each fee:
  feeBase    = round(fee.amount)
  feeTax     = round(feeBase × fee.taxRate)
  feeTotal   = round(feeBase + feeTax)
  taxTotal  += feeTax
  total     += feeTotal
  feeTotalSum += feeBase
```

**Final totals:**

```
amountPaid = round(input.amountPaid ?? 0)          // ≥ 0 enforced
amountDue  = round(total − amountPaid)
```

#### 3.1.3 `discountAmount()` — the discount primitive

```typescript
export function discountAmount(
  discount: DiscountDefinition | undefined,
  base: Decimal,
  currency: CurrencyCode
): Decimal {
  if (!discount) return ZERO;
  const d = discount.value instanceof Decimal ? discount.value : new Decimal(discount.value);
  const meta = getCurrencyMetadata(currency);
  let amount: Decimal;
  if (discount.type === "percentage") {
    amount = base.mul(d.div(100));
  } else {
    amount = d;                                     // fixed
  }
  if (amount.gt(base)) amount = base;               // CAP at base (prevent negative)
  if (amount.isNegative()) return ZERO;             // floor at 0
  return amount.toDecimalPlaces(meta.decimalPlaces, Decimal.ROUND_HALF_UP);
}
```

**Key behaviors:**
- Percentage discount: `base × (value/100)`
- Fixed discount: literal `value`
- **Capped at line subtotal** — a $50 discount on a $10 line yields $10, total $0
- **Never negative** — discount can't make a line negative
- Rounded to currency decimal places with `ROUND_HALF_UP`

#### 3.1.4 Tax Scenarios

| Scenario | Formula | Result |
|---|---|---|
| **Tax-exclusive** (default) | `taxAmount = taxable × taxRate`; `lineTotal = taxable + taxAmount` | $100 @ 10% → tax $10, total $110 |
| **Tax-inclusive** | `ratio = taxRate/(1+taxRate)`; `taxAmount = gross × ratio`; `net = gross − taxAmount` | $110 incl. 10% → tax $10, net $100 |
| **Mixed rates** | per-line `tax_rate`; `tax_total` aggregates per rate | lines can have different rates |
| **Tax on fees** | `feeTax = feeBase × fee.taxRate` (independent) | fee tax added to `tax_total` |
| **Zero-rated** | `taxRate = 0` → `taxAmount = 0`; still in `tax_summary` | appears as 0.00% |

#### 3.1.5 Calculation Result Contract

```typescript
interface CalculationResult {
  currency: CurrencyCode;
  decimalPlaces: number;
  lineItems: CalculatedLineItem[];   // { lineSubtotal, discountAmount, taxableAmount, taxAmount, lineTotal }
  fees: CalculatedFee[];             // { amount, taxRate, taxAmount, feeTotal }
  subtotal: Decimal;
  discountTotal: Decimal;
  taxableTotal: Decimal;
  taxTotal: Decimal;
  feeTotal: Decimal;
  total: Decimal;
  amountDue: Decimal;
  amountPaid: Decimal;
  isTaxInclusive: boolean;
}
```

### 3.2 Amount Paid vs. Balance Due — Partial Payments

#### 3.2.1 Balance Computation

```
amount_due = GREATEST(total − amount_paid, 0)     // never negative
```

The backend is **authoritative**: `recordPayment()` runs in a transaction:

```sql
UPDATE invoices
   SET amount_paid = amount_paid + $1,
       amount_due  = GREATEST(amount_due - $1, 0),
       updated_at  = NOW()
 WHERE id = $2 AND business_id = $3
RETURNING amount_due, amount_paid;
```

#### 3.2.2 Status After Payment (`invoice-state-machine.ts:105`)

```typescript
statusAfterPayment(current, amountDue, amountPaid): InvoiceStatus {
  if (Number(amountDue) <= Number(amountPaid)) return "paid";        // full
  if (Number(amountDue) > 0) {
    if (["draft","sent","viewed"].includes(current)) return "partially_paid";  // partial
    return current;                                                  // stay
  }
  return current;
}
```

| Scenario | amountDue vs amountPaid | New Status |
|---|---|---|
| Full payment | `amountDue ≤ amountPaid` | `paid` (terminal, sets `paid_at`) |
| Partial (from sent/viewed) | `amountDue > 0` | `partially_paid` |
| Partial (from partially_paid/overdue) | `amountDue > 0` | stays `partially_paid`/`overdue` |
| Overpayment | `amountDue ≤ 0` | `paid` (excess not refunded automatically — out of MVP scope) |

#### 3.2.3 Idempotency

Every payment carries an `idempotency_key` with a `UNIQUE` constraint:

```typescript
async recordPayment(businessId, id, amount, provider, providerPaymentId, idempotencyKey) {
  // ...
  if (idempotencyKey) {
    const existing = await client.query(`SELECT id FROM payments WHERE idempotency_key = $1`, [idempotencyKey]);
    if (existing.rows.length) { await client.query("ROLLBACK"); return; }  // silently deduped
  }
  // INSERT payment + UPDATE invoice in one transaction
}
```

Duplicate submissions (e.g. double-click, Stripe retry) are **silently rejected** at the DB level.

### 3.3 Late-Payment Fee Application

Late fees are **configurable** per invoice (or per-business default) and **applied automatically** when the invoice becomes overdue.

#### 3.3.1 Configuration

```sql
-- on invoices (migration 033_invoice_late_fee.sql)
late_fee_type  VARCHAR(30) NOT NULL DEFAULT 'none',   -- none | fixed | percentage
late_fee_value NUMERIC(18,6) NOT NULL DEFAULT 0,
late_fee_applied BOOLEAN NOT NULL DEFAULT FALSE,
late_fee_applied_amount NUMERIC(18,6) NOT NULL DEFAULT 0;

-- on business_settings (default for new invoices)
late_fee_type  VARCHAR(30) NOT NULL DEFAULT 'none',
late_fee_value NUMERIC(18,6) NOT NULL DEFAULT 0;
```

#### 3.3.2 Application Logic (`invoice-service.ts:1136`)

```typescript
private async applyLateFeeIfNeeded(invoice: RepoInvoice, amountDue: Decimal): Promise<Decimal> {
  if (invoice.lateFeeType === "none" || invoice.lateFeeApplied) return amountDue;  // idempotent
  if (invoice.dueDate && new Date() > new Date(invoice.dueDate)) {                 // only when overdue
    const feeValue = new Decimal(invoice.lateFeeValue ?? 0);
    let lateFee: Decimal;
    if (invoice.lateFeeType === "percentage") {
      lateFee = new Decimal(invoice.total ?? 0).mul(feeValue).div(100);            // % of total
    } else {
      lateFee = feeValue;                                                           // fixed
    }
    if (lateFee.gt(0)) {
      const rounded = lateFee.toFixed(2, Decimal.ROUND_HALF_UP);
      await invoiceRepository.applyLateFee(invoice.id, invoice.businessId, rounded); // persists + adds to amount_due
      return amountDue.plus(rounded);
    }
  }
  return amountDue;
}
```

**Trigger:** applied lazily when a **payment intent is created** (`createPaymentIntent`) — i.e., when the customer attempts to pay an overdue invoice. This ensures the late fee is included in the payable amount and only applied once (`lateFeeApplied` guard).

**Persistence:**

```sql
UPDATE invoices
   SET late_fee_applied = TRUE,
       late_fee_applied_amount = $1,
       amount_due = amount_due + $1,
       updated_at = NOW()
 WHERE id = $2 AND business_id = $3;
```

#### 3.3.3 Late Fee Rules

| Rule | Behavior |
|---|---|
| **Type** | `none` (no fee), `fixed` (flat currency amount), `percentage` (% of invoice total) |
| **Trigger** | Only when `due_date < now` AND `amount_due > 0` |
| **Idempotency** | `late_fee_applied` boolean — applied at most once per invoice |
| **Rounding** | `ROUND_HALF_UP` to 2 dp |
| **Visibility** | Customer sees "Late fees may apply" warning when overdue; applied amount shown in totals after application |

### 3.4 Invoice Lifecycle & State Machine

#### 3.4.1 State Transition Map (`invoice-state-machine.ts:16`)

```
draft ──────────► [sent, cancelled, void]
sent ───────────► [viewed, partially_paid, paid, overdue, cancelled, void]
viewed ─────────► [partially_paid, paid, overdue, cancelled, void]
partially_paid ─► [paid, overdue, void]
overdue ────────► [paid, void]
paid ───────────► (terminal)
cancelled ──────► (terminal)
void ───────────► (terminal)
```

- **`overdue` is derived**, not manual: `determineOverdue()` returns `overdue` when `dueDate` passed + `amountDue > 0` + not terminal.
- **`paid` is terminal**: `isVoidable('paid') === false`.
- **Cancellable**: `draft`, `sent`, `viewed`. **Voidable**: `draft`, `sent`, `viewed`, `partially_paid`, `overdue`.
- Every transition is validated server-side by `transition()` (throws `BusinessLogicError` on invalid).

#### 3.4.2 Finalization Flow (`invoice-service.ts:441`)

```
finalize(businessId, id, userId):
  1. Load invoice; if already finalized → return existing number (idempotent)
  2. Require customer_id (throw if missing)
  3. Recalculate via CalculationEngine; reject if total < 0
  4. Run InvoiceValidationService.validate() → throw VALIDATION_FAILED (422) if errors
  5. Generate atomic invoice number via InvoiceNumberService.generate()
  6. TRANSACTION:
       a. assignNumber
       b. persistCalculationResults (line totals + invoice totals)
       c. snapshotService.build() → store immutable snapshot (SHA-256)
       d. set is_finalized = TRUE, finalized_at = NOW()
  7. Record "finalized" event
  8. Update project financials (if projectId)
  9. Score payment risk (async, best-effort)
```

#### 3.4.3 Atomic Numbering (`numbering/service.ts:75`)

```sql
-- inside a transaction:
INSERT INTO invoice_number_sequences (business_id, prefix, next_number, padding, includes_year)
VALUES ($1, 'INV', 1, 6, true)
ON CONFLICT (business_id) DO NOTHING;

UPDATE invoice_number_sequences
   SET next_number = next_number + 1
 WHERE business_id = $1
 RETURNING prefix, next_number - 1 AS assigned_number, padding, includes_year;
-- The UPDATE acquires a row lock → concurrent finalizes serialize → no duplicates.
```

Format: `{prefix}-{YYYY}-{NNNNNN}` (e.g. `INV-2026-000001`). Configurable per business (`prefix`, `padding`, `includes_year`).

### 3.5 Validation Service (`invoice-validation.ts`)

Returns `{ valid, issues[], hasErrors, hasWarnings }`. Errors block finalization (422); warnings surface as non-blocking banners.

**Errors (blocking):** `MISSING_CUSTOMER`, `UNSUPPORTED_CURRENCY`, `MISSING_ISSUE_DATE`, `INVALID_DUE_DATE`, `EMPTY_LINE_ITEMS`, `INVALID_QUANTITY`, `NEGATIVE_UNIT_PRICE`, `MISSING_ITEM_DESCRIPTION`, `NEGATIVE_TOTAL`, `CALCULATION_ERROR`, `CALCULATION_DISCREPANCY`.

**Warnings (non-blocking):** `MISSING_PAYMENT_INSTRUCTIONS`, `MISSING_NOTES`, `MISSING_CUSTOMER_EMAIL`.

Each issue carries a `fix` suggestion rendered in the `ValidationPanel`.

### 3.6 Immutability & Snapshots

- After `finalize()`, `is_finalized = TRUE` — every mutation path (`updateDraft`, `setItems`, `setFees`, `DELETE`) rejects with `BusinessLogicError`.
- `SnapshotService.build()` captures business, customer, items, fees, totals, currency, template config, and **rendered HTML** into `invoice_snapshots` with a SHA-256 hash.
- All future PDF/email/public renders use the **historical snapshot**, so a finalized invoice always reproduces byte-identically even if templates change.
- `SnapshotService.verify()` recomputes the hash to detect tampering.

### 3.7 Backend-Authoritative Recalculation

The frontend mirrors the engine for instant feedback, but on `finalize()` the backend independently recomputes. `InvoiceValidationService.compareTotals()` compares stored vs. computed for `subtotal`, `discountTotal`, `taxTotal`, `feeTotal`, `total`, `amountDue`, `amountPaid`. Any mismatch → `CALCULATION_DISCREPANCY` (error, 422). This is the non-negotiable anti-tampering invariant.

---

## 4. Feature Roadmap

### 4.0 MoSCoW Prioritization

| Priority | Feature | Rationale | Existing Code |
|---|---|---|---|
| **MUST** | Real-time invoice builder (subtotals/tax/discount/deposit) | Core value — can't bill without it | `calculation.ts` + `webapp/utils/calculation.ts` |
| **MUST** | Send via email + payment link with one-tap pay | "Getting paid faster" — the whole point | `email-service.ts`, `public/invoices/:token`, `stripe.ts` |
| **MUST** | State machine draft→sent→viewed→paid/overdue | Trustworthy status = no chasing | `invoice-state-machine.ts` |
| **MUST** | Atomic invoice numbering (no duplicates) | Professional correctness | `numbering/service.ts` |
| **MUST** | Immutable snapshot on finalize | Integrity / dispute defense | `snapshot-service.ts` |
| **MUST** | Lightweight customer record | Can't invoice nobody | `customers` table, `CustomerSelector.tsx` |
| **MUST** | Saved service library (line-item catalog) | Cuts 90% of typing | `products` table, `CatalogPicker.tsx` |
| **MUST** | Cash-flow dashboard (outstanding/overdue/paid/upcoming) | "How much is coming in" | `GET /api/dashboard` |
| **SHOULD** | One-click duplication | Repeat jobs | `POST /invoices/:id/duplicate` |
| **SHOULD** | Recurring invoices | Subscription-style trades | `recurring_invoices` table |
| **SHOULD** | Automated payment reminders (cadence) | Cuts manual chasing | `sendReminder()` + `reminders.automated` flag |
| **SHOULD** | Late fees (configurable) | Incentivize on-time payment | migration `033` + `applyLateFeeIfNeeded` |
| **SHOULD** | Branding (logo, colors, fonts) | "Looks like my business" | template `document.settings` |
| **COULD** | Industry service presets (seeded) | Faster first invoice | NEW: preset seed data |
| **COULD** | Mobile bottom tab bar + FAB | Field-optimized nav | `BottomTabBar.tsx` |
| **COULD** | SMS (Twilio) integration | Faster reminders | NEW provider |
| **COULD** | Attachments (photos/docs) | Proof of work | client-side `WorkspaceAttachment` |
| **WON'T (this SKU)** | Payroll, bookkeeping, scheduling, CRM, quotes, multi-currency UI, multi-tax-rate, P&L | Out of scope for $30 tradesperson SKU | — |

### 4.1 Phase 1 — Core Invoice Loop (MVP, Weeks 1–2) — MUST

**Goal:** A tradesperson can create, send, and get a customer to pay an invoice using a phone.

| Sprint | Deliverable | Backend | Frontend | QA / Exit Criteria |
|---|---|---|---|---|
| **1a** | Build & send | `finalize()` (numbering + snapshot), `send()` (email + token rotation) | Invoice editor (mobile-stacked), live preview, `CustomerSelector`, `CatalogPicker` | State-machine transitions; snapshot immutability; **0 duplicate numbers under 100 concurrent finalizes** (load test) |
| **1b** | Get paid | Payment intent + `public/invoices/:token` (no auth), `recordPayment` (idempotent) | Payment page (Apple/Google Pay + card), receipt email | End-to-end: create → finalize → send → pay → receipt on a phone in < 5 min |

**Mandatory fields enforced at finalize:** Customer, Invoice number, Issue date, Due date (≥ issue), ≥1 line item, payment instructions (warning). Currency validated as ISO 4217.

**Exit criteria:** Demo a complete paid invoice on a phone in < 5 min; no duplicate numbers under load test; totals correct to the penny.

### 4.2 Phase 2 — Speed Tools (Weeks 3–4) — SHOULD

**Goal:** Cut invoice creation to < 60 seconds using saved data; automate chasing.

| Sprint | Deliverable | Backend | Frontend | QA / Exit Criteria |
|---|---|---|---|---|
| **2a** | Saved services + duplication | Catalog CRUD hardened, `duplicate()` | Industry service presets (seeds), quick-add chip list, "duplicate" action | Preset import; duplicate fidelity; tax/discount edge cases |
| **2b** | Recurring + reminders + late fees | Recurring scheduler stub, reminder cron wire-up, `applyLateFeeIfNeeded` | Recurring schedule UI, reminder-settings panel, late-fee config in `AdvancedDetailsAccordion` | Recurring generates correct draft; reminder cadence sends correct message; late fee applied once when overdue |

**Exit criteria:** A repeat job (same customer + same 3 services) is invoiced in ≤ 4 taps. Reminders auto-send to an unpaid invoice. Late fee applied exactly once on overdue payment attempt.

### 4.3 Phase 3 — Cash-Flow Command Center (Weeks 5–6) — WILL

**Goal:** One dashboard screen shows everything about money in/out, mobile-first.

| Sprint | Deliverable | Backend | Frontend | QA / Exit Criteria |
|---|---|---|---|---|
| **3** | Dashboard + branding | Dashboard summary (outstanding / overdue / paid / upcoming), aging buckets, payment metrics | Mobile dashboard (KPI hero + feed + upcoming), bottom tab bar, FAB, branding panel | Dashboard numbers match raw queries; mobile layout < 640px; loads on 3G in < 1s |

**Exit criteria:** Dashboard loads on a 3G phone in < 1s; all four KPIs correct to the penny.

### 4.4 Phase 4 — Post-MVP Advanced Features (Weeks 7+) — COULD / Future Tiers

| Priority | Feature | Description | Home |
|---|---|---|---|
| **COULD** | Attachments (photos/docs) | Persist before/after photos + generic attachments to the snapshot payload; render in customer view | `invoice_attachments` table + snapshot payload |
| **COULD** | SMS (Twilio) integration | Payment link + notification via SMS; SMS reminder variant | `sms-service.ts` provider |
| **COULD** | Diverse payment methods | PayPal, ACH, bank-transfer beyond Stripe card; per-method config in `PaymentsSettings` | `payment_provider_config.accepted_methods` |
| **COULD** | Offline drafts | Service worker + backend sync queue for intermittent job-site signal | PWA + sync queue |
| **COULD** | Credit notes / refunds | Apply credit to an invoice; refund a payment | `credit_notes` + `credit_note_applications` (schema ready) |
| **COULD** | Quotes / estimates | Convert accepted quote → invoice | `quotes` + `quote_items` (schema ready) |
| **COULD** | Automated overdue → late fee | Cron that marks overdue + applies late fee + sends reminder | `processOverdueInvoices()` + `applyLateFeeIfNeeded` |
| **WON'T** | Bookkeeping/ledger, payroll, scheduling/dispatch, full CRM, multi-currency UI, P&L | Out of scope for tradesperson SKU | Business tier / never |

### 4.5 Success Metrics

| Metric | MVP Target | How Measured |
|---|---|---|
| Invoice→payment median | < 3 days | `payments.created_at − invoices.sent_at` |
| Paid within 24h of send | ≥ 60% | Payments where `paid_at ≤ sent_at + 24h` |
| Creation time (from library) | ≤ 60s | Stopwatch, median of 50 first-invoice creations |
| Mobile send share | ≥ 75% | User-agent parsing of `sent` events |
| Duplicate numbering | 0 | Load test: 100 concurrent `finalize()` calls |
| Snapshot integrity | 100% verifiable | `snapshotService.verify()` passes on all finalized invoices |
| Dashboard load (mobile 3G) | < 1s | Lighthouse / DevTools network throttling |
| KPI accuracy | Exact to the penny | Dashboard totals match raw SQL sums |

---

## Appendix A — API Endpoints (Invoices)

| Method | Route | Description | Key Logic |
|---|---|---|---|
| `GET` | `/api/invoices` | List + filter/paginate | `status`, `customerId`, `search`, `paymentState`; tenant-scoped |
| `POST` | `/api/invoices` | Create draft | `createDraft()` → validates customer, applies product snapshots, records "created" event |
| `GET` | `/api/invoices/:id` | Get invoice summary | Loads + recalculates via `CalculationEngine` (drafts) or cached totals (finalized) |
| `PATCH` | `/api/invoices/:id` | Update draft | `updateDraft` or `updateDraftWithItems` (items+fees in one txn); rejects if finalized |
| `PUT` | `/api/invoices/:id/items` | Replace line items | Transaction: delete all + insert; applies product snapshots |
| `PUT` | `/api/invoices/:id/fees` | Replace fees | Transaction: delete all + insert |
| `POST` | `/api/invoices/:id/finalize` | Finalize | `CalculationEngine` + validation + atomic numbering + snapshot + state transition |
| `POST` | `/api/invoices/:id/send` | Send via email | Generate public token (30-day), render HTML+PDF, email, transition to `sent` |
| `POST` | `/api/invoices/:id/send-reminder` | Payment reminder | Renders reminder template, emails, records event |
| `POST` | `/api/invoices/:id/cancel` | Cancel | Checks `isCancellable`; transitions to `cancelled` |
| `POST` | `/api/invoices/:id/void` | Void | Checks `isVoidable`; transitions to `void` |
| `POST` | `/api/invoices/:id/payment-intent` | Create payment intent | Stripe Checkout Session or stub; applies late fee if overdue |
| `POST` | `/api/invoices/:id/pdf` | Download PDF | Streams PDF generated from immutable snapshot |
| `GET` | `/api/invoices/:id/events` | Audit trail | `invoice_events` sorted by `created_at` |
| `GET` | `/api/invoices/:id/payments` | List payments | Payment records |
| `POST` | `/api/invoices/:id/payments` | Record payment | Idempotent via `idempotency_key`; updates totals; transitions state |
| `POST` | `/api/invoices/:id/duplicate` | Duplicate | Copies customer, items, terms, template; resets number/date to today |
| `DELETE` | `/api/invoices/:id` | Delete draft | Returns 400 if finalized |
| `GET` | `/api/dashboard` | Dashboard summary | Outstanding / overdue / paid-this-month / revenue / upcoming |
| `GET` | `/api/public/invoices/:token` | Customer view | No-auth; returns invoice + rendered HTML + PDF URL |
| `POST` | `/api/public/invoices/:token/pay` | Customer pay | No-auth; validates amount ≤ balance; records payment |
| `POST` | `/api/public/invoices/:token/payment-intent` | Customer payment intent | No-auth; Stripe or stub |

## Appendix B — Development Commands

```bash
# Full stack
npm run dev:all          # Backend (4000) + Frontend (5173) concurrently

# Backend
npm install              # Install backend dependencies
npm run migrate          # Run DB migrations (creates all tables)
npm run migrate:reset    # Drop & re-run all migrations (dev only)
npm run dev              # Backend in watch mode (tsx)
npm run typecheck        # Type-check the backend
npm run lint             # Lint the backend
npm run test             # Run all unit/integration tests (vitest)
npm run test:watch       # Watch mode
npm run build            # Compile to dist/

# Frontend
cd webapp && npm install
cd webapp && npm run dev          # Vite dev server (localhost:5173)
cd webapp && npm run typecheck
cd webapp && npm run lint
cd webapp && npm run build        # Production build → webapp/dist/
```

## Appendix C — Key Source File Index

| Concern | File |
|---|---|
| Calculation engine (backend) | `src/domain/calculation.ts` |
| Calculation engine (frontend mirror) | `webapp/src/utils/calculation.ts` |
| Currency metadata | `src/domain/value-objects/currency.ts` |
| Invoice service (orchestration) | `src/services/invoice-service.ts` |
| State machine | `src/services/state-machine/invoice-state-machine.ts` |
| Atomic numbering | `src/services/numbering/service.ts` |
| Immutable snapshot | `src/services/snapshot/snapshot-service.ts` |
| Validation | `src/services/validation/invoice-validation.ts` |
| Template rendering (Handlebars) | `src/services/templates/template-renderer.ts` |
| Invoice repository | `src/repositories/invoice.repo.ts` |
| Zod DTOs | `src/schemas/invoice-dto.ts` |
| Domain models | `src/domain/models/index.ts` |
| API routes | `src/index.ts` |
| Invoice Creator (admin) | `webapp/src/components/InvoiceWorkspace.tsx` |
| Customer Invoice View | `webapp/src/pages/PublicInvoice.tsx` |
| Live preview | `webapp/src/components/InvoicePreview.tsx` |
| API client | `webapp/src/api/client.ts` |
| Typed API responses | `webapp/src/types/api.ts` |
| Initial schema | `src/db/migrations/001_initial_schema.sql` |
| Discounts & types | `src/db/migrations/002_discounts_and_types.sql` |
| Reminders & payments | `src/db/migrations/011_invoice_reminders_and_payments.sql` |
| Invoice lifecycle | `src/db/migrations/013_invoice_lifecycle.sql` |
| Late fees | `src/db/migrations/033_invoice_late_fee.sql` |
| Calculation tests (50+ cases) | `tests/calculation.test.ts` |
| State machine tests | `tests/state-machine.test.ts` |
| Validation tests | `tests/invoice-validation.test.ts` |

---

*End of design specification. This document maps to and extends the existing codebase; see `AGENTS.md` for build/run commands and `docs/` for the upstream product specifications (`MVP-PRD.md`, `invoice-creation-specification.md`, `ui-ux-specification.md`, `payment-ux-specification.md`, `invoice-creation-plan.md`).*
