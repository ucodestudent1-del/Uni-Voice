# Technical Design Document: Invoice Generator Module Replacement

**Status:** Draft  
**Author:** Senior Software Architect  
**Date:** 2026-10-12  
**Target Environment:** Express + TypeScript + PostgreSQL backend; React 18 + Vite + TailwindCSS frontend

---

## 1. Executive Summary

This document specifies the technical design for a new Invoice Generator Module that will replace the legacy invoicing subsystem within the existing Universal Invoice Generator application. The new module supports itemized line items with automated rule-based tax and discount logic, customizable branding templates, high-fidelity PDF generation, and seamless integration with the existing client database.

The implementation follows a phased approach that extends the current codebase's established patterns: domain-driven design with a service layer, `decimal.js` for all monetary math, `zod` for validation, PostgreSQL with sequential migration naming, Express REST endpoints with JWT auth, and a React + Tailwind frontend with shared UI primitives.

---

## 2. Context: Existing System Architecture

The current codebase provides the following foundational architecture that the new module will extend:

### 2.1 Backend Stack
- **Runtime:** Node.js 20+ with TypeScript (ESM modules)
- **Framework:** Express 4.x
- **Database:** PostgreSQL with `pg` driver
- **Migrations:** Custom runner (`src/db/migrate.ts`) using a `migrations` table, sequential naming (`Nxx_description.sql`)
- **Decimal arithmetic:** `decimal.js` — all money fields stored as `NUMERIC(18,6)`, never float
- **Validation:** `zod` schemas in `src/domain/schemas/`
- **Auth:** JWT bearer tokens (`src/middleware/auth.ts`), tenant isolation via `business_id` on every table
- **PDF:** Pluggable service abstraction (`src/services/pdf/`) with Puppeteer (HTML→PDF) as default, stub as fallback
- **Email:** Nodemailer-based service (`src/services/email/`) with stub provider
- **Templates:** Handlebars-based template renderer (`src/services/templates/template-renderer.ts`)
- **Error hierarchy:** `AppError`, `NotFoundError`, `ConflictError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `BusinessLogicError` (`src/domain/errors.ts`)

### 2.2 Frontend Stack
- **Runtime:** React 18 + TypeScript
- **Build:** Vite with `@vitejs/plugin-react`
- **Styling:** TailwindCSS v4 with CSS variable-based semantic theme
- **State Management:** React `useState`/`useReducer`/`useContext` with local component state for complex forms; `axios` for API calls
- **UI Components:** Shared component library at `webapp/src/components/ui/` with barrel export (`index.ts`)
- **Drag-and-drop:** `@dnd-kit/core` + `@dnd-kit/sortable` for line item reordering
- **Money formatting:** Shared `Money` component with cached `Intl.NumberFormat`
- **API client:** `webapp/src/api/client.ts` with axios instance, response caching, automatic auth token injection

### 2.3 Key Design Patterns in Use
1. **Tenant isolation:** Every query includes `business_id`; multi-tenant `AsyncLocalStorage` request context (`src/db/pool.ts`)
2. **Backend-authoritative calculations:** A `CalculationEngine` class (`src/domain/calculation.ts`) runs on the backend; a mirror exists on the frontend (`webapp/src/utils/calculation.ts`) for real-time preview only
3. **Immutable finalized invoices:** Snapshot into `invoice_snapshots` table on finalize
4. **Atomic numbering:** `invoice_number_sequences` table with row-level lock for unique-per-business invoice numbers
5. **Optimistic concurrency:** `version` column on invoices, checked on update
6. **State machine:** `ALLOWED_STATE_TRANSITIONS` map in `invoice-service.ts` controls invoice status transitions
7. **Event sourcing:** All significant actions logged to `invoice_events` table

---

## 3. Relational Database Schema

### 3.1 New Tables

All new tables follow the existing naming convention (snake_case), use `UUID` primary keys with `uuid_generate_v4()`, include `business_id` for tenant isolation, and follow the `created_at`/`updated_at` pattern with `TIMESTAMPTZ`.

#### 3.1.1 `tax_rules` — Rule-based tax configuration

```sql
CREATE TABLE tax_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(50),
  rate            NUMERIC(5,4) NOT NULL,
  type            VARCHAR(20) NOT NULL DEFAULT 'percentage',
  country_code    VARCHAR(3),
  region          VARCHAR(100),
  is_compound     BOOLEAN NOT NULL DEFAULT FALSE,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_tax_rate_nonneg CHECK (rate >= 0),
  CONSTRAINT uq_tax_rule_business_name UNIQUE (business_id, name)
);

CREATE INDEX idx_tax_rules_business ON tax_rules(business_id);
CREATE INDEX idx_tax_rules_country ON tax_rules(country_code);
CREATE INDEX idx_tax_rules_enabled ON tax_rules(enabled) WHERE enabled = TRUE;
```

#### 3.1.2 `tax_rule_conditions` — Conditions for rule-based tax application

```sql
CREATE TABLE tax_rule_conditions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tax_rule_id     UUID NOT NULL REFERENCES tax_rules(id) ON DELETE CASCADE,
  field           VARCHAR(50) NOT NULL,
  operator        VARCHAR(20) NOT NULL,
  value           VARCHAR(500) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_condition_field CHECK (field IN ('customer_country', 'customer_state', 'product_category', 'item_description', 'currency', 'total_amount_min', 'total_amount_max'))
);

CREATE INDEX idx_tax_conditions_rule ON tax_rule_conditions(tax_rule_id);
```

#### 3.1.3 `discount_rules` — Rule-based discount configuration

```sql
CREATE TABLE discount_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  type            VARCHAR(20) NOT NULL DEFAULT 'percentage',
  value           NUMERIC(18,6) NOT NULL,
  scope           VARCHAR(20) NOT NULL DEFAULT 'invoice',
  applies_to      VARCHAR(50),
  min_amount      NUMERIC(18,6),
  max_discount    NUMERIC(18,6),
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_discount_type CHECK (type IN ('fixed', 'percentage')),
  CONSTRAINT chk_discount_scope CHECK (scope IN ('invoice', 'line_item')),
  CONSTRAINT chk_discount_value_nonneg CHECK (value >= 0),
  CONSTRAINT uq_discount_rule_business_name UNIQUE (business_id, name)
);

CREATE INDEX idx_discount_rules_business ON discount_rules(business_id);
CREATE INDEX idx_discount_rules_active ON discount_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_discount_rules_active_time ON discount_rules(starts_at, ends_at) WHERE is_active = TRUE;
```

#### 3.1.4 `invoice_template_configs` — Branding template configuration

```sql
CREATE TABLE invoice_template_configs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  html_template   TEXT NOT NULL,
  schema_version  VARCHAR(50) NOT NULL DEFAULT '1.0',
  revision        INTEGER NOT NULL DEFAULT 1,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  updated_by      UUID,

  CONSTRAINT uq_template_config_business_name UNIQUE (business_id, name),
  CONSTRAINT uq_template_config_business_default UNIQUE (business_id, is_default) WHERE is_default = TRUE
);

CREATE INDEX idx_template_configs_business ON invoice_template_configs(business_id);
CREATE INDEX idx_template_configs_default ON invoice_template_configs(business_id, is_default);
```

#### 3.1.5 `business_branding` — Business-level branding settings

```sql
CREATE TABLE business_branding (
  business_id         UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  primary_color       VARCHAR(7) NOT NULL DEFAULT '#2563eb',
  secondary_color     VARCHAR(7) NOT NULL DEFAULT '#64748b',
  font_family         VARCHAR(255),
  logo_url            TEXT,
  logo_width_px       INTEGER,
  logo_height_px      INTEGER,
  invoice_title       VARCHAR(255),
  invoice_subtitle    VARCHAR(255),
  footer_text         TEXT,
  show_logo           BOOLEAN NOT NULL DEFAULT TRUE,
  show_page_numbers    BOOLEAN NOT NULL DEFAULT TRUE,
  show_qr_code        BOOLEAN NOT NULL DEFAULT FALSE,
  pdf_page_size       VARCHAR(20) NOT NULL DEFAULT 'A4',
  pdf_margin_top_mm    NUMERIC(6,2) NOT NULL DEFAULT 24,
  pdf_margin_right_mm  NUMERIC(6,2) NOT NULL DEFAULT 24,
  pdf_margin_bottom_mm NUMERIC(6,2) NOT NULL DEFAULT 24,
  pdf_margin_left_mm   NUMERIC(6,2) NOT NULL DEFAULT 24,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_business_branding_business ON business_branding(business_id);
```

### 3.2 Schema Modifications to Existing Tables

#### 3.2.1 Add tax rule integration to `invoice_items`

```sql
ALTER TABLE invoice_items
  ADD COLUMN tax_rule_id UUID REFERENCES tax_rules(id) ON DELETE SET NULL,
  ADD COLUMN tax_rule_rate_snapshot NUMERIC(5,4);

CREATE INDEX idx_invoice_items_tax_rule ON invoice_items(tax_rule_id);
```

#### 3.2.2 Add discount rule integration to `invoices`

```sql
ALTER TABLE invoices
  ADD COLUMN discount_rule_id UUID REFERENCES discount_rules(id) ON DELETE SET NULL,
  ADD COLUMN discount_rule_snapshot JSONB;

CREATE INDEX idx_invoices_discount_rule ON invoices(discount_rule_id);
```

#### 3.2.3 Add template config reference to `invoices`

```sql
ALTER TABLE invoices
  ADD COLUMN template_config_id UUID REFERENCES invoice_template_configs(id) ON DELETE SET NULL;

CREATE INDEX idx_invoices_template_config ON invoices(template_config_id);
```

#### 3.2.4 Add customer address snapshot fields to `invoices` (already partially present)

The existing `invoices` table already has denormalized customer snapshot fields (`customer_name`, `customer_email`, `customer_address_line_1`, etc.). The new module will also store a JSON snapshot of the full customer record for immutability:

```sql
ALTER TABLE invoices
  ADD COLUMN customer_snapshot JSONB;
```

### 3.3 Entity Relationship Diagram (Textual)

```
businesses (1) ──< tax_rules
businesses (1) ──< discount_rules
businesses (1) ──< invoice_template_configs
businesses (1) ──< business_branding
businesses (1) ──< customers
businesses (1) ──< products
businesses (1) ──< invoices

invoices (*) ──< invoice_items >─(*) products
invoices (*) ──< invoice_fees
invoices (*) ──< payments
invoices (*) ──< invoice_snapshots
invoices (*) ──< invoice_events
invoices (*) ──< business_branding (via business_id)

tax_rules (*) ──< tax_rule_conditions
tax_rules (1) ──< invoice_items (via tax_rule_id)
discount_rules (1) ──< invoices (via discount_rule_id)
invoice_template_configs (1) ──< invoices (via template_config_id)
customers (1) ──< invoices (via customer_id)
```

---

## 4. RESTful API Endpoints

All endpoints follow the existing pattern: `requireAuth` middleware, `businessId` extraction from `req.user`, `AuthRequest` type, async handler wrapped with try/catch + `next(err)`.

### 4.1 Tax Rules

| Method | Path | Description | Auth | Request Body | Response |
|---|---|---|---|---|---|
| GET | `/api/tax-rules` | List tax rules for business | Yes | Query: `limit`, `offset`, `enabled` | `{ taxRules: ApiTaxRule[], total, limit, offset }` |
| POST | `/api/tax-rules` | Create a new tax rule | Yes | `ApiTaxRuleInput` | `{ taxRule: ApiTaxRule }` |
| GET | `/api/tax-rules/{id}` | Get a specific tax rule | Yes | — | `{ taxRule: ApiTaxRule }` |
| PATCH | `/api/tax-rules/{id}` | Update a tax rule | Yes | `ApiTaxRuleInput` (partial) | `{ taxRule: ApiTaxRule }` |
| DELETE | `/api/tax-rules/{id}` | Delete a tax rule | Yes | — | `{ deleted: true }` |
| POST | `/api/tax-rules/evaluate` | Evaluate applicable rules for a context | Yes | `TaxEvaluationContext` | `{ applicableRules: ApiTaxRule[] }` |

**`TaxEvaluationContext`:**
```typescript
interface TaxEvaluationContext {
  customerCountry?: string | null;
  customerState?: string | null;
  productCategories?: string[];
  currency?: string;
  lineItemCount?: number;
  totalAmount?: string;
}
```

### 4.2 Discount Rules

| Method | Path | Description | Auth | Request Body | Response |
|---|---|---|---|---|---|
| GET | `/api/discount-rules` | List discount rules | Yes | Query: `limit`, `offset`, `active` | `{ discountRules: ApiDiscountRule[], total, limit, offset }` |
| POST | `/api/discount-rules` | Create a discount rule | Yes | `ApiDiscountRuleInput` | `{ discountRule: ApiDiscountRule }` |
| GET | `/api/discount-rules/{id}` | Get a specific discount rule | Yes | — | `{ discountRule: ApiDiscountRule }` |
| PATCH | `/api/discount-rules/{id}` | Update a discount rule | Yes | `ApiDiscountRuleInput` (partial) | `{ discountRule: ApiDiscountRule }` |
| DELETE | `/api/discount-rules/{id}` | Delete a discount rule | Yes | — | `{ deleted: true }` |
| POST | `/api/discount-rules/evaluate` | Evaluate applicable rules for invoice context | Yes | `DiscountEvaluationContext` | `{ applicableRules: ApiDiscountRule[], totalDiscount: string }` |

**`DiscountEvaluationContext`:**
```typescript
interface DiscountEvaluationContext {
  currency: string;
  lineItems: Array<{
    description: string;
    productId?: string | null;
    quantity: string;
    unitPrice: string;
    category?: string;
  }>;
  subtotal: string;
  invoiceDate: string;
}
```

### 4.3 Invoice Templates

| Method | Path | Description | Auth | Request Body | Response |
|---|---|---|---|---|---|
| GET | `/api/invoice-templates` | List invoice templates | Yes | Query: `limit`, `offset`, `isDefault` | `{ templates: ApiInvoiceTemplate[], total }` |
| POST | `/api/invoice-templates` | Create an invoice template | Yes | `ApiInvoiceTemplateInput` | `{ template: ApiInvoiceTemplate }` |
| GET | `/api/invoice-templates/{id}` | Get a specific template | Yes | — | `{ template: ApiInvoiceTemplate }` |
| PATCH | `/api/invoice-templates/{id}` | Update a template | Yes | `ApiInvoiceTemplateInput` (partial) | `{ template: ApiInvoiceTemplate }` |
| DELETE | `/api/invoice-templates/{id}` | Archive/delete a template | Yes | — | `{ deleted: true }` |
| POST | `/api/invoice-templates/{id}/set-default` | Set as default template | Yes | — | `{ success: true }` |
| POST | `/api/invoice-templates/{id}/preview` | Render template preview with sample data | Yes | `PreviewContext` | `{ html: string }` |

### 4.4 Branding

| Method | Path | Description | Auth | Request Body | Response |
|---|---|---|---|---|---|
| GET | `/api/branding` | Get business branding settings | Yes | — | `{ branding: ApiBranding }` |
| PATCH | `/api/branding` | Update branding settings | Yes | `ApiBrandingInput` (partial) | `{ branding: ApiBranding }` |
| GET | `/api/branding/preview` | Get a preview of the current branding | Yes | — | `{ html: string }` |

### 4.5 Invoices (Enhanced)

The existing invoice endpoints (`/api/invoices`, `/api/invoices/{id}`, etc.) will be enhanced to include tax rule and discount rule integration. New sub-endpoints:

| Method | Path | Description | Auth | Request Body | Response |
|---|---|---|---|---|---|
| POST | `/api/invoices/{id}/apply-tax-rules` | Apply tax rules to current invoice draft | Yes | — | `{ invoice: ApiInvoice }` |
| POST | `/api/invoices/{id}/apply-discount-rules` | Apply discount rules to current invoice draft | Yes | — | `{ invoice: ApiInvoice }` |
| POST | `/api/invoices/{id}/preview-pdf` | Generate a PDF preview without finalizing | Yes | — | `Buffer` (PDF content) |
| POST | `/api/invoices/from-quote/{quoteId}` | Create invoice from an accepted quote with rule application | Yes | — | `{ invoice: ApiInvoice }` |

### 4.6 Client Database Integration

| Method | Path | Description | Auth | Request Body | Response |
|---|---|---|---|---|---|
| GET | `/api/clients` | List clients (alias for customers) | Yes | Query: `limit`, `offset`, `search`, `status` | `{ clients: ApiCustomer[], total }` |
| GET | `/api/clients/{id}` | Get a specific client | Yes | — | `{ client: ApiCustomer }` |
| GET | `/api/clients/{id}/invoices` | List invoices for a specific client | Yes | Query: `limit`, `offset`, `status` | `{ invoices: ApiInvoiceListItem[], total }` |
| GET | `/api/clients/{id}/balances` | Get client balance summary | Yes | — | `{ clientId, totalOutstanding, totalBilled, totalPaid, currency }` |

### 4.7 Response Types (TypeScript)

```typescript
// Shared with frontend via api/client.ts re-exports

export interface ApiTaxRule {
  id: string;
  business_id: string;
  name: string;
  code?: string | null;
  rate: string;
  type: "percentage" | "fixed";
  country_code?: string | null;
  region?: string | null;
  is_compound: boolean;
  is_default: boolean;
  enabled: boolean;
  conditions: ApiTaxRuleCondition[];
  created_at: string;
  updated_at: string;
}

export interface ApiTaxRuleCondition {
  id: string;
  tax_rule_id: string;
  field: string;
  operator: string;
  value: string;
  sort_order: number;
}

export interface ApiDiscountRule {
  id: string;
  business_id: string;
  name: string;
  type: "fixed" | "percentage";
  value: string;
  scope: "invoice" | "line_item";
  applies_to?: string | null;
  min_amount?: string | null;
  max_discount?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiInvoiceTemplate {
  id: string;
  business_id: string;
  name: string;
  is_default: boolean;
  config: Record<string, unknown>;
  html_template: string;
  schema_version: string;
  revision: number;
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface ApiBranding {
  business_id: string;
  primary_color: string;
  secondary_color: string;
  font_family?: string | null;
  logo_url?: string | null;
  logo_width_px?: number | null;
  logo_height_px?: number | null;
  invoice_title?: string | null;
  invoice_subtitle?: string | null;
  footer_text?: string | null;
  show_logo: boolean;
  show_page_numbers: boolean;
  show_qr_code: boolean;
  pdf_page_size: string;
  pdf_margin_top_mm: string;
  pdf_margin_right_mm: string;
  pdf_margin_bottom_mm: string;
  pdf_margin_left_mm: string;
  created_at: string;
  updated_at: string;
}
```

---

## 5. Front-End Component Architecture

### 5.1 State Management Strategy

The invoice creation workflow is the most complex interaction in the application. The following state management approach is used:

#### 5.1.1 Local Component State (Primary)
- The main `InvoiceWorkspace` component (`webapp/src/pages/InvoiceWorkspace.tsx`) uses `useState` for the `LocalState` object containing all form fields (customer, currency, line items, fees, discounts, terms, notes, etc.)
- All derived state (calculation results) is computed via `useMemo` to avoid redundant re-renders
- The `CalculationEngine` is instantiated once via `useRef` (the `CALC_ENGINE` constant) to avoid re-creating it on each render

#### 5.1.2 React Context (Shared/Global)
- `AuthContext` (`webapp/src/contexts/AuthContext.tsx`) — holds user, token, onboarding state
- `SubscriptionContext` — feature entitlement checks
- `ThemeContext` — dark/light mode via CSS variables

#### 5.1.3 API State (Server State)
- The `api` client (`webapp/src/api/client.ts`) uses axios with response caching via `cachedGet`
- Cache invalidation is manual via `invalidateCache` / `invalidateCacheByKey`
- No external state management library (Redux, Zustand, etc.) is used — the existing pattern relies on local state + API refetching

#### 5.1.4 Optimistic Updates
The `InvoiceWorkspace` component uses optimistic updates for the finalize → send workflow:
1. `finalizeInvoice(id)` returns `FinalizeInvoiceResult` with the updated invoice
2. The local `invoice` state is updated immediately from the response (no redundant `getInvoice` fetch)
3. `sendInvoice(id, data)` returns `SendInvoiceResult` with the updated invoice
4. Both results include the full invoice object, so no refetch is needed

### 5.2 Component Hierarchy

```
InvoiceWorkspace (page)
├── PageHeader
│   ├── StatusBadge (invoice status)
│   ├── Save state indicators (Loader2/CheckCircle/AlertCircle)
│   └── Action buttons (Save Draft, Review & Send, Send, Duplicate)
├── Editor Panel (left, scrollable)
│   ├── Customer Selector (FormField select + create new dialog)
│   ├── Currency Selector (FormField select)
│   ├── Issue Date / Payment Terms / Due Date (FormField)
│   ├── PO Number (FormField)
│   ├── Line Items (DndContext + SortableContext)
│   │   ├── SortableLineItem (drag handle, description, qty, unit, price, discount, tax rate, tax inclusive)
│   │   ├── Add Item / Add from Product buttons
│   │   └── Product Picker Dialog
│   ├── Calculation Summary (subtotal, discount, tax, fees, total)
│   ├── Invoice Discount (FormField)
│   ├── Invoice Discount Type (FormField select)
│   ├── Fees section (with add/remove)
│   ├── Notes / Terms / Payment Instructions (FormTextareaField)
│   ├── New Customer Dialog
│   ├── New Product Dialog
│   ├── Validation Issues Dialog
│   └── Send Dialog
├── Preview Panel (right, sticky)
│   └── DocumentPreview (render-only, no edits)
```

### 5.3 Shared UI Components (Used/Extended)

The module will reuse and extend the existing shared component library at `webapp/src/components/ui/`:

| Component | Purpose | Reuse Status |
|---|---|---|
| `Button` | All action buttons | Existing — no changes needed |
| `FormField` | All form inputs (text, select, date) | Existing — no changes needed |
| `FormTextareaField` | Notes, terms, instructions | Existing — no changes needed |
| `Money` | Currency display | Existing — no changes needed |
| `StatusBadge` | Invoice/customer status display | Existing — no changes needed |
| `EmptyState` | Empty/zero state handling | Existing — extend with loading/error variants |
| `PageHeader` | Page title and actions | Existing — no changes needed |
| `DataTable` | List views for invoices/clients | Existing — no changes needed |
| `Dialog` | Modal dialogs (validation, send, product picker) | Existing — no changes needed |
| `ConfirmationDialog` | Destructive action confirmation | Existing — no changes needed |
| `KPICard` | Dashboard metrics | Existing — no changes needed |
| `Toast` / `ToastProvider` | Notification system | Existing — no changes needed |

### 5.4 New Components to Be Created

| Component | File Path | Purpose |
|---|---|---|
| `TaxRuleSelector` | `webapp/src/components/TaxRuleSelector.tsx` | Dropdown selector for tax rules with condition preview |
| `DiscountRuleSelector` | `webapp/src/components/DiscountRuleSelector.tsx` | Dropdown selector for discount rules with preview |
| `BrandingPreview` | `webapp/src/components/BrandingPreview.tsx` | Live preview of branding settings applied to invoice |
| `BrandingEditor` | `webapp/src/components/BrandingEditor.tsx` | Form for editing business branding settings |
| `TemplateEditor` | `webapp/src/components/TemplateEditor.tsx` | Visual editor for invoice template configuration |
| `ValidationIssuesList` | Inline in `InvoiceWorkspace.tsx` | Existing — already implemented |
| `ProductPicker` | Inline in `InvoiceWorkspace.tsx` | Existing — already implemented |

### 5.5 State Management for Complex Workflows

#### 5.5.1 Invoice Creation State (`useInvoiceWorkspace` hook)

To improve testability and reusability, the complex state logic currently embedded in `InvoiceWorkspace` will be extracted into a custom hook:

```typescript
// webapp/src/hooks/useInvoiceWorkspace.ts
interface UseInvoiceWorkspaceOptions {
  invoiceId?: string;
  isNew: boolean;
}

interface UseInvoiceWorkspaceResult {
  state: LocalState;
  invoice: ApiInvoice | null;
  setState: React.Dispatch<React.SetStateAction<LocalState>>;
  calcResult: CalculationResult | null;
  saveState: SaveState;
  isFinalized: boolean;
  isFinalizing: boolean;
  isSending: boolean;
  doSave: () => Promise<void>;
  handleFinalize: () => Promise<void>;
  handleFinalizeAndSend: () => Promise<void>;
  handleSend: () => Promise<void>;
  handleDuplicate: () => Promise<void>;
  validateInvoice: () => ValidationIssue[];
  addItem: () => void;
  removeItem: (idx: number) => void;
  updateItem: (idx: number, field: keyof LocalItem, value: unknown) => void;
  addFee: () => void;
  removeFee: (idx: number) => void;
  updateFee: (idx: number, field: keyof LocalFee, value: string) => void;
}
```

#### 5.5.2 Real-time Validation

Validation runs synchronously on every keystroke change using pure functions:
- `validateInvoice()` returns `ValidationIssue[]` with `code`, `message`, `severity`, and optional `field`
- Errors block finalization; warnings are shown but allow proceeding
- Validation issues are displayed in a modal dialog before finalize/send

#### 5.5.3 Autosave

- Debounced via `setTimeout` with a 500ms delay
- Only saves when `hasUnsavedChanges` is true and the invoice is not finalized
- For new invoices, `createInvoice` is called; for existing, `updateInvoice` is called
- Save state tracked via `SaveState` enum: `"idle" | "saving" | "saved" | "error"`

### 5.6 State Machine in Frontend

The frontend mirrors the backend state machine from `invoice-service.ts`:

```typescript
// Frontend mirror of backend ALLOWED_STATE_TRANSITIONS
const ALLOWED_STATE_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent", "cancelled", "void"],
  sent: ["viewed", "partially_paid", "paid", "overdue", "cancelled", "void"],
  viewed: ["partially_paid", "paid", "overdue", "cancelled", "void"],
  partially_paid: ["paid", "overdue", "cancelled", "void"],
  overdue: ["paid", "partially_paid", "cancelled", "void"],
  paid: [],
  cancelled: [],
  void: [],
};
```

### 5.7 Edge Cases and UI Standards

All pages and components must handle:
- **Normal data:** Full rendering with all fields populated
- **Empty data:** EmptyState component with intentional messaging and action button
- **Zero values:** `Money` component renders placeholder or "0.00" with `signed={false}`
- **Loading:** Spinner via `EmptyState` with `variant="loading"` or inline `Loader2`
- **Errors:** `EmptyState` with `variant="error"`, error toast via `useToast`
- **Long text:** Truncation with `truncate` class, tooltips on hover
- **Missing/null values:** Null-coalescing with fallback values, `?? "—"` pattern
- **Mobile layouts:** Responsive grid classes (`grid-cols-1 lg:grid-cols-2`), collapsible sections

---

## 6. Migration and Deployment Plan

### 6.1 Migration Strategy: Phased Approach

#### Phase 1: Database Schema (Week 1)
- Create new migration file `061_invoice_generator_schema.sql` in `src/db/migrations/`
- Follow existing migration pattern: sequential naming, `CREATE TABLE IF NOT EXISTS`, transactional
- Tables: `tax_rules`, `tax_rule_conditions`, `discount_rules`, `invoice_template_configs`, `business_branding`
- Schema modifications: add `tax_rule_id`, `discount_rule_id`, `template_config_id`, `customer_snapshot` columns to existing tables
- Migration is safe to run on production — all additions are additive, no destructive changes

#### Phase 2: Backend Services (Week 1-2)
- Create `src/services/tax-rule-service.ts` — TaxRuleService for CRUD operations and rule evaluation
- Create `src/services/discount-rule-service.ts` — DiscountRuleService for CRUD operations and rule evaluation
- Create `src/services/branding-service.ts` — BrandingService for branding CRUD and PDF styling
- Extend `CalculationEngine` in `src/domain/calculation.ts` to support rule-based tax and discount evaluation
- Add Zod schemas in `src/domain/schemas/tax-rule.ts` and `src/domain/schemas/discount-rule.ts`
- Add repository classes or extend existing ones

#### Phase 3: API Endpoints (Week 2)
- Add new routes to `src/index.ts` following existing patterns
- Apply `requireAuth` middleware, extract `businessId` from `req.user`
- Use `handleAuthError` for error handling consistency
- Add zod validation via `RequestSchema` parsing

#### Phase 4: Frontend Components (Week 2-3)
- Create new shared components in `webapp/src/components/`
- Extract `useInvoiceWorkspace` hook from existing `InvoiceWorkspace` page
- Add new API client functions to `webapp/src/api/client.ts`
- Add new type definitions to `webapp/src/types/api.ts`
- Wire up new UI components into existing `InvoiceWorkspace` page

#### Phase 5: Testing (Week 3)
- Backend tests in `tests/` directory using `vitest`
- Frontend component tests in `webapp/src/__tests__/` using `@testing-library/react`
- Integration tests for tax rule evaluation, discount rule evaluation, and end-to-end invoice creation

#### Phase 6: Legacy System Decommission (Week 4)
- Audit existing legacy code paths
- Remove legacy-only endpoints (if any are redundant)
- Update documentation

### 6.2 Legacy Data Migration

#### 6.2.1 Data Migration Script
Create a one-time migration script `scripts/migrate-invoice-data.js` that:
1. Runs after migration `061_invoice_generator_schema.sql` is applied
2. Copies existing `business_tax_rates` data to `tax_rules` table:
   ```sql
   INSERT INTO tax_rules (business_id, name, code, rate, type, country_code, region, is_compound, is_default, enabled)
   SELECT business_id, name, code, rate, type, country_code, region, is_compound, false, enabled
   FROM business_tax_rates
   WHERE business_id NOT IN (SELECT DISTINCT business_id FROM tax_rules);
   ```
3. Sets the first tax rate per business as the default (`is_default = TRUE`)
4. Copies existing `templates` data to `invoice_template_configs`:
   ```sql
   INSERT INTO invoice_template_configs (business_id, name, is_default, config, html_template, schema_version, revision, version)
   SELECT business_id, name, is_default, config, html_template, '1.0', 1, 1
   FROM templates
   WHERE business_id NOT IN (SELECT DISTINCT business_id FROM invoice_template_configs);
   ```
5. Populates `business_branding` with default values for businesses that don't have branding settings:
   ```sql
   INSERT INTO business_branding (business_id)
   SELECT id FROM businesses
   WHERE id NOT IN (SELECT business_id FROM business_branding);
   ```

#### 6.2.2 Migration Execution
```bash
# 1. Run DB migrations (creates new tables)
npm run migrate

# 2. Run the data migration script
node scripts/migrate-invoice-data.js

# 3. Verify data integrity
node scripts/verify-migration.js
```

### 6.3 Deployment Process

#### 6.3.1 Pre-deployment Checklist
1. ✅ All migrations reviewed and tested on staging
2. ✅ Backend tests pass (`npm run test`)
3. ✅ Frontend type checks pass (`cd webapp && npm run typecheck`)
4. ✅ Backend type checks pass (`npm run typecheck`)
5. ✅ Backend lint passes (`npm run lint`)
6. ✅ Frontend lint passes (`cd webapp && npm run lint`)
7. ✅ Migration script tested on copy of production data

#### 6.3.2 Zero-Downtime Deployment Steps

1. **Deploy backend code** (new API endpoints are additive — no breaking changes to existing routes)
   - Build: `npm run build`
   - Deploy: `node dist/index.js` (behind process manager like PM2 or systemd)

2. **Run database migrations** (additive — safe for concurrent reads/writes)
   - `npm run migrate` (runs only unapplied migrations)

3. **Run data migration script**
   - `node scripts/migrate-invoice-data.js` (idempotent — safe to re-run)

4. **Deploy frontend code**
   - Build: `cd webapp && npm run build`
   - Deploy: static files to CDN/nginx

5. **Post-deployment verification**
   - Health check: `GET /api/health`
   - Verify new endpoints return 200 with expected data
   - Verify legacy endpoints still work (backward compatibility)
   - Monitor error logs for 30 minutes

#### 6.3.3 Rollback Plan

If issues are detected:

1. **Frontend rollback:** Revert to previous static build on CDN
2. **Backend rollback:** Revert to previous build, restart process
3. **Database rollback:** No destructive migration was applied — new tables can be dropped if needed:
   ```sql
   DROP TABLE IF EXISTS tax_rules CASCADE;
   DROP TABLE IF EXISTS tax_rule_conditions CASCADE;
   DROP TABLE IF EXISTS discount_rules CASCADE;
   DROP TABLE IF EXISTS invoice_template_configs CASCADE;
   DROP TABLE IF EXISTS business_branding CASCADE;
   ```
4. **Data rollback:** The data migration is read-only transformation — no data is lost. The original `business_tax_rates` and `templates` tables remain untouched.

#### 6.3.4 Canary Deployment (Optional)

For high-risk deployments, use the existing feature flag system:
1. Deploy to 10% of businesses via `business_settings` feature flags
2. Monitor error rates and performance metrics
3. Gradually increase traffic over 24 hours
4. Feature flag: `new_invoice_generator_enabled` (stored in `business_settings`)

### 6.4 Monitoring and Observability

#### 6.4.1 Metrics to Monitor
- **API response times:** P95/P99 latency for new endpoints (existing threshold: 1000ms, slow query threshold: 500ms)
- **Database query count per request:** Existing `AsyncLocalStorage` context tracks queries (threshold: 10 queries)
- **Error rates:** Track 4xx/5xx responses per endpoint
- **Migration execution time:** Should complete in < 30 seconds for typical dataset

#### 6.4.2 Alerts
- Database query count > 10 per request
- Request duration > 1000ms
- Slow query > 500ms
- 5xx error rate > 1% of total requests

#### 6.4.3 Logging
All new service methods follow the existing pattern:
```typescript
logger.info(`Created tax rule ${id} for business ${businessId}`);
logger.error({ err: e }, `Failed to create tax rule for business ${businessId}`);
```

---

## 7. Key Technical Decisions

### 7.1 Rule-Based Tax Engine
- **Approach:** Database-stored rules with conditions (customer country, product category, currency, amount thresholds)
- **Rationale:** More flexible than hardcoded tax rate lookups, enables complex business logic (e.g., "GST for Australian customers, PST for BC addresses")
- **Evaluation:** Rules evaluated server-side during invoice finalization; results cached in snapshot for immutability
- **Fallback:** Existing `business_tax_rates` table remains as a fallback for manually-specified rates

### 7.2 Rule-Based Discount Engine
- **Approach:** Database-stored rules with conditions (subtotal minimums, date ranges, product categories, scope of application)
- **Rationale:** Enables promotional campaigns, early-payment discounts, volume discounts
- **Evaluation:** Invoice-level and line-item-level rules evaluated during calculation
- **Precedence:** Line-item discounts applied before invoice-level; invoice discount applied after line discounts (matching existing `CalculationEngine` logic)

### 7.3 Branding Template System
- **Approach:** Jinja2-style template config stored as JSONB + Handlebars HTML template
- **Rationale:** JSONB allows structured configuration (colors, fonts, layout options); Handlebars provides logic-less templating for rendering
- **PDF Generation:** Uses existing Puppeteer-based PDF service with custom CSS injection for branding
- **Preview:** Real-time HTML preview in frontend using `DocumentPreview` component

### 7.4 Frontend State Management
- **Approach:** Local `useState` for form state, `useMemo` for derived calculation results
- **Rationale:** Consistent with existing `InvoiceWorkspace` pattern; avoids the complexity of external state management libraries for a single-page workflow
- **Optimistic Updates:** Finalize and send responses include full invoice object — no redundant refetch

### 7.5 Migration Strategy
- **Approach:** Additive schema changes + one-time data migration script
- **Rationale:** Zero-downtime deployment is critical; no destructive DB changes ensures rollback is a simple code revert
- **Data Integrity:** Migration script is idempotent and includes verification step

---

## 8. Testing Strategy

### 8.1 Backend Tests
```
tests/
├── tax-rule-service.test.ts      # Unit tests for rule evaluation logic
├── discount-rule-service.test.ts  # Unit tests for discount evaluation
├── branding-service.test.ts       # Unit tests for branding CRUD
├── calculation-rules.test.ts      # Integration tests: tax + discount rules in CalculationEngine
└── invoice-rules-integration.test.ts  # End-to-end: create invoice with rules applied
```

### 8.2 Frontend Tests
```
webapp/src/__tests__/
├── TaxRuleSelector.test.tsx      # Component tests
├── DiscountRuleSelector.test.tsx  # Component tests
├── BrandingEditor.test.tsx        # Component tests
└── useInvoiceWorkspace.test.ts    # Hook tests for state management
```

### 8.3 Test Conventions
- Backend: `vitest` with `describe`/`it`/`expect` pattern, DB test helpers from `tests/helpers/db.ts`
- Frontend: `@testing-library/react` + `vitest`, mock API client via `vi.mock`
- Test DB: PostgreSQL with `DATABASE_URL_TEST` environment variable, `truncateTestDb` for isolation

---

## 9. Rollout Timeline

| Week | Deliverable | Key Activities |
|---|---|---|
| Week 1 | Phase 1-2: Schema + Services | Migrations, TaxRuleService, DiscountRuleService, BrandingService |
| Week 2 | Phase 3-4: API + Frontend Components | API endpoints, shared components, hook extraction |
| Week 3 | Phase 5: Testing | Unit tests, integration tests, component tests |
| Week 4 | Phase 6: Data Migration + Deployment | Data migration script, staging deploy, production deploy |

---

## 10. Risk Assessment and Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Complex tax rules produce incorrect calculations | Medium | High | Backend authoritative — frontend calculation is preview-only; all finalized invoices re-calculated server-side |
| Migration script corrupts data | Low | High | Script is idempotent; tested on production copy; rollback plan documented |
| Performance degradation from rule evaluation | Medium | Medium | Rules evaluated once at finalize time only; results cached in snapshot |
| Frontend state desync | Low | Medium | Optimistic updates use API response data; version-based conflict detection on backend |
| PDF generation timeout | Low | Medium | Puppeteer timeout already set at 15s; fallback to stub service in non-production |

---

*End of Document*