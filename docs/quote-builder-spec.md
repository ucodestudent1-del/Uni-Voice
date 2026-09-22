# Quote Builder — Functional Specification & Technical Architecture

> **Status**: Draft  
> **Audience**: Engineering, Product, Design  
> **Related existing files**: `webapp/src/pages/QuoteDetail.tsx`, `webapp/src/pages/Quotes.tsx`, `webapp/src/components/InvoiceEditor.tsx`, `src/services/quote-service.ts`, `src/db/migrations/023_quote_schema.sql`

---

## 1. Overview

The **Quote Builder** is a full-page interactive tool inside the quotes section of the application. It replaces the current placeholder text in `QuoteDetail.tsx:88-94` ("Quote builder is under construction") with a complete client-side quote construction experience. It reuses the existing calculation engine (`webapp/src/utils/calculation.ts`), the same data model as invoices (`ApiQuoteItem`, `ApiQuoteFee`), and the same backend service (`quoteService`).

### Goals
- Let users build a quote from scratch by adding line items, fees, discounts, and terms.
- Show **real-time** totals and validation, exactly as the Invoice Editor does.
- Persist the quote as a **draft** on the backend with debounced auto-save.
- Allow finalizing (assigning a quote number), sending by email, and converting to an invoice.

### Scope
- Replaces the "new quote" placeholder in `QuoteDetail.tsx`.
- Does **not** change the existing `Quotes.tsx` list page or `QuoteDetail.tsx` read-only view.
- Does **not** change backend quote routes (all needed APIs already exist).

---

## 2. User Interface (UI) Design

### Layout — Desktop (≥1024px)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PageHeader: "New Quote"  |  [← Back]  |  Status badge: Draft / Saved       │
│  ┌─────────────┐ ┌───────────────────────────────────────────────────────┐  │
│  │  LEFT (30%) │ │  RIGHT (70%)                                            │  │
│  │  ┌────────┐ │ │  Live Preview (iframe or static render of the quote)    │  │
│  │  │Items   │ │ │                                                       │  │
│  │  │+ Add    │ │ │  Shows:                                                │  │
│  │  │line item│ │ │  - Line items table (description, qty, rate, total)   │  │
│  │  └────────┘ │ │  - Fees                                                 │  │
│  │             │ │  - Discount (invoice-level)                              │  │
│  │  ┌────────┐ │ │  - Totals breakdown (subtotal, tax, total)              │  │
│  │  │Fees    │ │ │  - Terms / Notes                                        │  │
│  │  │+ Add    │ │ │  - Terms / Payment instructions                         │  │
│  │  │fee     │ │ │                                                       │  │
│  │  └────────┘ │ │                                                       │  │
│  │             │ │                                                       │  │
│  │  ┌────────┐ │ │                                                       │  │
│  │  │Customer│ │ │                                                       │  │
│  │  │Selector│ │ │                                                       │  │
│  │  └────────┘ │ │                                                       │  │
│  │             │ │                                                       │  │
│  │  ┌────────┐ │ │                                                       │  │
│  │  │Details │ │ │                                                       │  │
│  │  │Currency│ │ │                                                       │  │
│  │  │Issue   │ │ │                                                       │  │
│  │  │Due date│ │ │                                                       │  │
│  │  │Terms   │ │ │                                                       │  │
│  │  │Notes   │ │ │                                                       │  │
│  │  └────────┘ │ │                                                       │  │
│  └─────────────┘ └───────────────────────────────────────────────────────┘  │
│                                                                             │
│  Footer: [Save Draft] [Finalize & Send] [Convert to Invoice] [Download PDF] │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layout — Tablet / Mobile (<1024px)

- Single column: form fields on top, live preview collapses into a **toggleable drawer** at the bottom.
- PageHeader collapses to an icon bar.
- Action buttons stack vertically at the bottom.

### Input Fields

#### Line Items Section
| Field | Control Type | Options / Behavior |
|---|---|---|
| Description | Textarea | Multi-line, min 3 rows, auto-expand |
| Quantity | Number input | Step 0.01, default 1, min 0.01 |
| Unit | Select dropdown | "each", "hour", "day", "week", "month", "fixed", custom |
| Unit Price | Currency input | Prefix with currency symbol, live decimal |
| Discount | Number + Type toggle | Fixed / Percentage, applies to line subtotal |
| Tax Rate | Number input | Percentage (e.g. 8.5 for 8.5%) |
| Tax Inclusive | Checkbox | If checked, tax is included in unit price |
| Product catalog | Optional lookup | Auto-suggest from products API, pre-fills fields |

- **Add row** button at the bottom of the items list
- **Remove** row button (trash icon) per line item
- **Reorder** by drag handle

#### Fees Section (optional)
| Field | Control Type |
|---|---|
| Description | Text input |
| Amount | Currency input |
| Tax Rate | Number input (percentage) |
| + Add Fee | Button |

#### Invoice-Level Discount
- Dropdown: "None", "Fixed amount", "Percentage"
- If not "None", a number input appears for the discount value
- Applied to the subtotal (after line-item discounts)

#### Customer Section
- **Customer selector** — reuses `CustomerSelector` component
- Shows selected customer name, email, and billing address
- "Create new customer" inline quick-add link

#### Quote Details
| Field | Control Type | Notes |
|---|---|---|
| Currency | Select dropdown | Defaults to business default currency, locked after first line item |
| Issue Date | Date picker | Defaults to today |
| Due Date | Date picker | Defaults to issue + 30 days |
| Expiry Date | Date picker | Defaults to due + 30 days, shown when finalizing |
| Terms | Textarea | Default from business settings |
| Notes | Textarea | Default from business settings |
| Payment Instructions | Textarea | Default from business settings |

### Real-Time Visual Feedback

1. **Totals sidebar** (right column) updates in real-time as the user types:
   - Subtotal (sum of line subtotals)
   - Line-item discounts total
   - Invoice-level discount
   - Tax breakdown (by rate, shown as a collapsible list)
   - Fees total
   - **Grand Total** (bold, larger font)

2. **Validation** (reuses `useInvoiceValidation` hook):
   - Fields with issues get a **red border** and an error icon.
   - A **ValidationPanel** at the bottom of the form shows a summary of issues.
   - "Finalize & Send" button is **disabled** until all errors are resolved.

3. **Save state indicator** in the PageHeader:
   - "Saving..." while debounced save is in-flight
   - "Saved" (green) when save completes
   - "Unsaved changes" (orange) when dirty and not yet saved

4. **Line item row highlighting**: rows that fail validation get a subtle red background.

---

## 3. User Experience (UX) Flow

### Flow Diagram

```
[New Quote button] or [/app/quotes/new route]
         │
         ▼
┌───────────────────┐
│ Quote Builder     │  (empty state: one blank line item row)
│ Page              │  (currency = business default, dates auto-filled)
└───────────────────┘
         │
         ▼
┌───────────────────┐
│ User fills in    │  - Adds line items (product selector or manual)
│ form fields      │  - Edits customer, dates, terms
│                   │  - Adds fees, invoice-level discount
└───────────────────┘
         │
         ▼
┌───────────────────┐
│ Real-time updates │  - CalculationEngine recomputes on each keystroke
│                   │  - Totals in sidebar update instantly
│                   │  - Validation issues appear as-you-type
└───────────────────┘
         │
         ▼
┌───────────────────┐
│ Auto-save         │  - Debounced (500ms) save to backend as draft
│ (every change)    │  - Save state indicator shows "Saving..." → "Saved"
└───────────────────┘
         │
         ├─────────────────────────────────────┐
         ▼                                      ▼
┌───────────────────┐         ┌─────────────────────────┐
│ Finalize & Send   │         │ Convert to Invoice      │
│ button            │         │ button                  │
└───────────────────┘         └─────────────────────────┘
         │                                      │
         ▼                                      ▼
┌───────────────────┐         ┌─────────────────────────┐
│ Review & Send     │         │ Confirmation dialog:    │
│ Modal             │         │ "Convert this quote..." │
│ - Preview quote   │         │                         │
│ - Edit email      │         │  [Cancel] [Convert]     │
│ - Send            │         └─────────────────────────┘
│                   │                     │
│ → Quote status:   │                     ▼
│   "sent"          │         ┌─────────────────────────┐
│ → Public token    │         │ Backend: finalize()   │
│   generated       │         │ → generates quote #    │
│ → Email sent      │         │ → creates invoice      │
└───────────────────┘         │ → updates quote status │
         │                    │   to "accepted"        │
         │                    └─────────────────────────┘
         │                              │
         │                              ▼
         │                    ┌─────────────────────────┐
         │                    │ Redirect to new invoice │
         │                    │ at /app/invoices/{id}/  │
         │                    │ edit                     │
         │                    └─────────────────────────┘
         │                              │
         └──────────────────────┬───────┘
                                ▼
                    ┌─────────────────────────┐
                    │ User is redirected to   │
                    │ QuoteDetail page        │
                    │ (read-only view)        │
                    └─────────────────────────┘
```

### Step-by-Step Journey

| Step | Action | System Response |
|------|--------|-----------------|
| 1 | User navigates to `/app/quotes/new` or clicks "New Quote" from Quotes list | Empty `QuoteBuilder` component loads |
| 2 | Default quote created client-side: currency from business settings, issue date = today, due date = +30 days, one blank line item | Live preview shows a near-empty quote with zeros |
| 3 | User selects a customer via `CustomerSelector` | Customer name/email/address populate the quote header in the preview |
| 4 | User adds line items | Line items table updates; subtotal and grand total recalculate instantly |
| 5 | User edits any field | Auto-save triggers after 500ms debounce; status indicator shows "Saving…" → "Saved" |
| 6 | User clicks "Finalize & Send" | If validation passes, `ReviewAndSendDialog` opens |
| 7 | User reviews and confirms send | Backend `POST /api/quotes/:id/finalize` then `POST /api/quotes/:id/send`; quote receives a number and public token |
| 8 | User optionally clicks "Convert to Invoice" | Confirmation dialog → `POST /api/quotes/:id/convert` → redirected to the new invoice's edit page |
| 9 | User clicks "Download PDF" | Backend `GET /api/quotes/:id/pdf` returns a blob; file downloads as `quote-{id}.pdf` |

### Edge Cases / Error States

- **Network failure during save**: Status indicator shows "Save failed" in red. User can retry.
- **Validation errors**: "Finalize & Send" is disabled. A ValidationPanel shows specific issues.
- **Empty line items**: User sees "At least one line item is required" error.
- **No customer selected**: Warning shown; "Finalize & Send" disabled.
- **Currency change after line items added**: Currency selector is disabled once the first line item has a unit price (prevents mixing currencies within a single quote).

---

## 4. Core Functionality

### 4.1 Calculation Engine Integration

The Quote Builder reuses the existing `CalculationEngine` from `webapp/src/utils/calculation.ts`:

```typescript
import { calculationEngine, type LineItemInput, type FeeInput, type InvoiceCalculationInput } from "../utils/calculation";

const calcInput: InvoiceCalculationInput = {
  currency: quoteData.currency,
  lineItems: quoteData.items.map(item => ({
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    discount: item.discount && Number(item.discount) > 0
      ? { type: item.discountType ?? "fixed", value: item.discount }
      : undefined,
    taxRate: item.taxRate ?? "0",
    isTaxInclusive: item.isTaxInclusive ?? false,
  })),
  fees: quoteData.fees.length > 0
    ? quoteData.fees.map(fee => ({
        description: fee.description,
        amount: fee.amount,
        taxRate: fee.taxRate ?? "0",
      }))
    : undefined,
  invoiceDiscount: (quoteData.discountType && quoteData.discountValue && Number(quoteData.discountValue) > 0)
    ? { type: quoteData.discountType, value: quoteData.discountValue }
    : undefined,
  amountPaid: quoteData.amountPaid,
};

const calcResult = calculationEngine.calculate(calcInput);
```

The calculation logic is identical to the Invoice Editor, ensuring consistency between quotes and invoices.

### 4.2 Dynamic Pricing

- **Line-item level**: Each line item has its own `unitPrice`, `quantity`, `discount`, and `taxRate`.
- **Invoice-level discount**: Applied to the subtotal after all line-item discounts are summed.
- **Tax calculation**: Supports both tax-exclusive (default) and tax-inclusive pricing.
- **Fees**: Added after tax is calculated; each fee can optionally have its own tax rate.

### 4.3 Discount Logic

| Discount Type | Application |
|---|---|
| **Line-item fixed** | Subtracted from the line subtotal (`quantity × unitPrice`) before tax |
| **Line-item percentage** | Percentage of the line subtotal, before tax |
| **Invoice-level fixed** | Subtracted from the invoice subtotal (after line-level discounts, before invoice-level percentage discount) |
| **Invoice-level percentage** | Percentage of the invoice subtotal (after line-level discounts) |

Discounts are **never** allowed to make a line total or the overall total negative.

### 4.4 Variable Dependencies

The following dependencies exist in the data model:

1. **Currency** → drives formatting and decimal precision for all monetary fields
2. **Tax rate** → affects line totals and tax totals
3. **Quantity × Unit Price** → drives line subtotal
4. **Line discount** → affects taxable amount, which affects tax
5. **Tax-inclusive flag** → if true, the tax is extracted from the unit price using the reverse-calculation formula
6. **Invoice discount** → affects the overall taxable base
7. **Fees** → added after subtotal and tax, each fee may carry its own tax

The calculation engine resolves all of these atomically in a single pass.

### 4.5 Auto-Save & Persistence

- **Trigger**: 500ms debounce after the last field change.
- **API**: `PATCH /api/quotes/:id` (uses existing `updateQuote` endpoint).
- **Behavior**: The quote is persisted to the backend as a draft with `status = 'draft'`. The backend recalculates line totals and subtotal on save.
- **Conflict handling**: If the backend returns a 409 (quote was modified by another user), the user is shown a conflict resolution dialog.

### 4.6 State Management

The Quote Builder uses local component state (same pattern as `InvoiceEditor.tsx`):

```typescript
interface EditorLineItem {
  id?: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount?: string;
  discountType?: "fixed" | "percentage";
  taxRate?: string;
  isTaxInclusive?: boolean;
  productId?: string | null;
}

interface EditorFee {
  description: string;
  amount: string;
  taxRate?: string;
}

interface EditorQuoteData {
  customerId?: string;
  customer?: ApiCustomer;
  currency: string;
  issueDate?: string;
  dueDate?: string;
  expiryDate?: string;
  notes?: string;
  terms?: string;
  paymentInstructions?: string;
  discountType?: "fixed" | "percentage";
  discountValue?: string;
  items: EditorLineItem[];
  fees: EditorFee[];
  templateId?: string;
}
```

### 4.7 Validation

Reuses the existing `useInvoiceValidation` hook from `webapp/src/hooks/useInvoiceValidation.ts`, which validates:

- Customer selection (error if missing)
- Currency support (error if invalid)
- Issue date presence (error if missing)
- Due date > issue date (error if violated)
- At least one line item (error if none)
- Line item description (error if blank)
- Line item quantity > 0 (error if zero/negative)
- Line item unit price >= 0 (error if negative)
- Payment instructions (warning if empty)
- Notes (warning if empty)

---

## 5. Backend Requirements

All required backend APIs already exist. No new routes or schema changes are needed.

### 5.1 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/quotes` | Create a new draft quote from builder data |
| `GET` | `/api/quotes/:id` | Load a quote for editing |
| `PATCH` | `/api/quotes/:id` | Auto-save / update quote details |
| `POST` | `/api/quotes/:id/finalize` | Assign a quote number, set status to "sent" |
| `POST` | `/api/quotes/:id/send` | Send quote by email, generate public token |
| `GET` | `/api/quotes/:id/pdf` | Download the quote as a PDF |
| `POST` | `/api/quotes/:id/convert` | Convert to an invoice |
| `GET` | `/api/quotes` | List quotes (for the Quotes page, not the builder) |
| `DELETE` | `/api/quotes/:id` | Delete a quote |

Additionally, the builder needs these supporting APIs:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/businesses/current` | Pre-fill currency, terms, notes, payment instructions |
| `GET` | `/api/customers` | Customer selector (limit/offset, search) |
| `GET` | `/api/products` | Product catalog lookup for line items |

### 5.2 Database Schema

The existing schema (migrations `001_initial_schema.sql`, `021_quote_number_sequences.sql`, `023_quote_schema.sql`) already supports the Quote Builder:

```sql
-- quotes table (migration 001 + 023)
CREATE TABLE quotes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  quote_number    VARCHAR(100),
  status          quote_status NOT NULL DEFAULT 'draft',
  issue_date      DATE,
  due_date        DATE,
  expiry_date     DATE,               -- added by migration 023
  currency        VARCHAR(3) NOT NULL,
  subtotal        NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_total  NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(18,6) NOT NULL DEFAULT 0,
  fee_total       NUMERIC(18,6) NOT NULL DEFAULT 0,
  total           NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount_paid     NUMERIC(18,6) NOT NULL DEFAULT 0,  -- added by migration 023
  amount_due      NUMERIC(18,6) NOT NULL DEFAULT 0,   -- added by migration 023
  notes           TEXT,
  terms           TEXT,
  payment_instructions TEXT,
  template_id     VARCHAR(50),
  is_finalized    BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,
  public_token    VARCHAR(64) UNIQUE,
  public_token_expires_at TIMESTAMPTZ,
  converted_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_by      UUID,
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- quote_items table (migration 001)
CREATE TABLE quote_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
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

-- quote_fees table (migration 023)
CREATE TABLE quote_fees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description     VARCHAR(500) NOT NULL,
  amount          NUMERIC(18,6) NOT NULL,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(18,6) NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- quote_number_sequences (migration 021)
CREATE TABLE quote_number_sequences (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  prefix      VARCHAR(50) NOT NULL DEFAULT 'QOT',
  next_number BIGINT NOT NULL DEFAULT 1,
  padding     SMALLINT NOT NULL DEFAULT 6,
  includes_year BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.3 Integration Requirements

1. **CRM Integration**: The CustomerSelector component already fetches from `/api/customers`. If the user selects a customer, their name, email, and billing address are automatically populated in the quote.

2. **Email Service**: The existing `sendQuote` backend function calls `quoteService.send()`, which uses the EmailService (nodemailer) to send the quote to the customer. The builder's "Finalize & Send" flow calls this directly — no additional email integration is needed.

3. **PDF Generation**: The existing `getQuotePdf` backend function calls `quoteService.generatePdf()`, which uses the PDF service to render the quote. The builder can call this for download and preview.

4. **Currency Support**: The `SUPPORTED_CURRENCIES` constant from `webapp/src/utils/currency.ts` is used for the currency dropdown. The calculation engine handles decimal precision per currency.

5. **Subscription/Entitlements**: The existing `requireEntitlement("quotes.create")` on all quote routes means only users on plans that support quotes can use the builder. The UI should respect this — on lower plans, show an `UpgradePrompt` component.

### 5.4 Backend Modifications Needed

No schema changes are needed. However, the following backend behavior should be confirmed for the builder flow:

- **`POST /api/quotes`**: Should accept a payload matching `QuoteCreateInput` (already defined in `quote-service.ts`). The builder will send a fully-assembled quote object with line items, fees, customer ID, currency, dates, and terms.
- **`PATCH /api/quotes/:id`**: Should accept a `Partial<QuoteCreateInput>` for auto-save. The `update` method in `quote-service.ts` already handles partial updates and recalculates totals.
- **`POST /api/quotes/:id/finalize`**: Already assigns a quote number via `generateQuoteNumber` and sets status to "sent". No changes needed.

---

## 6. Technical Stack Recommendations

The Quote Builder should follow the **exact same stack** as the existing Invoice Editor, since it is a sister feature built on the same foundation.

### Frontend (webapp/)

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | React 18.3.1 + TypeScript 5.6.3 | Already in use across the entire app |
| **Build Tool** | Vite 5.4.10 | Already configured |
| **State Management** | React `useState` + `useMemo` + `useRef` | Same pattern as `InvoiceEditor.tsx` and `InvoiceWorkspace.tsx` — no additional state management library needed for a single-page form |
| **Routing** | React Router DOM 6.28 | Already in use |
| **Calculation** | `decimal.js` + existing `CalculationEngine` | Guarantees consistency with invoices; avoids float precision issues |
| **Styling** | Tailwind CSS + custom component library | Same design tokens and component patterns as the rest of the app |
| **Form Validation** | `useInvoiceValidation` custom hook | Already exists and exports `validateInvoice` |
| **UI Components** | Existing primitives | `Button`, `DataTable`, `PageHeader`, `CustomerSelector`, `FeatureGate`, `ErrorBoundary`, etc. |
| **Icons** | `lucide-react` | Already in use |
| **Analytics** | `useAnalytics` hook | Already exists |
| **Linting** | ESLint (to be added) | See note below |

**Note on ESLint**: The project currently does **not** have ESLint configured (as discovered during the hooks violation investigation). It is strongly recommended to add `eslint-plugin-react-hooks` to prevent Rules of Hooks violations in the Quote Builder and catch them during development. This is a separate infrastructure task, not a code change for the Quote Builder feature itself.

### Backend

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Express + TypeScript | Already in use |
| **Database** | PostgreSQL | Already in use |
| **ORM/Query Builder** | Raw SQL via `pg` node-postgres | Already in use (see `quote-service.ts`) |
| **Calculation Engine** | Backend `CalculationEngine` from `src/domain/calculation.ts` | Server-side revalidation of frontend calculations for security |
| **Email** | `nodemailer` (stub provider by default) | Already in use |
| **PDF** | Pluggable PDF service abstraction | Already in use |
| **Auth** | JWT + trusted headers (dev stub mode) | Already in use |
| **Validation** | `zod` | Already in use for DTOs |
| **Testing** | `vitest` | Already in use |

### Scalability Considerations

1. **Debounced auto-save**: Only one in-flight save request at a time. If a newer save is triggered while an older one is in-flight, the older one is cancelled.
2. **Frontend-only calculations**: All calculations happen client-side using `useMemo`. The backend recalculates and validates on save to prevent tampering.
3. **Pagination**: For line items beyond ~50 rows, consider virtualization (but this is an edge case for quotes).
4. **Concurrent editing**: If needed in the future, a WebSocket connection could broadcast changes between collaborators (Phase 4 Automation scope).

### Security Considerations

1. **Tenant isolation**: All backend quote queries are scoped to `business_id` (enforced in `quote-service.ts`).
2. **Calculation integrity**: Frontend calculations are for display only; the backend recalculates totals on every `save` and `finalize`.
3. **Input sanitization**: All string fields (notes, terms, payment instructions) are stored as plain text and sanitized on output (PDF rendering, email).
4. **Entitlements**: The `requireEntitlement("quotes.create")` middleware gates all quote API routes.

---

## 6.1 Proposed File Structure

```
webapp/src/
├── pages/
│   ├── Quotes.tsx                      (existing — list page, unchanged)
│   ├── QuoteDetail.tsx                 (modified — shows QuoteBuilder for new quotes)
│   └── QuoteBuilder/                   (NEW — extracted QuoteBuilder component)
│       ├── QuoteBuilder.tsx            (main component, state orchestration)
│       ├── QuoteLineItems.tsx          (line items table + add/remove/reorder)
│       ├── QuoteFees.tsx               (fees section)
│       ├── QuoteTotals.tsx             (live totals sidebar)
│       ├── QuotePreview.tsx            (live preview of the quote)
│       ├── QuoteDetailsForm.tsx        (customer, dates, terms, notes)
│       └── ReviewAndSendDialog.tsx     (finalize & send modal)
├── hooks/
│   └── useQuoteBuilder.ts              (NEW — custom hook for quote save/debounce logic)
├── utils/
│   ├── calculation.ts                  (existing — reused)
│   └── currency.ts                     (existing — reused)
└── components/
    ├── CustomerSelector.tsx            (existing — reused)
    ├── FeatureGate.tsx                 (existing — reused)
    └── ...                             (existing primitives reused)
```

### Backend (src/)

No new files needed. The `quote-service.ts` already provides all methods. The `index.ts` routes already cover the required endpoints.

---

## 7. Migration Path

### Phase 1 (MVP — this spec)
1. Implement `QuoteBuilder.tsx` with all input fields and real-time calculations.
2. Wire up auto-save to `PATCH /api/quotes/:id`.
3. Implement "Finalize & Send" via `ReviewAndSendDialog` (mirrors `InvoiceWorkspace`'s pattern).
4. Replace the placeholder in `QuoteDetail.tsx` with `<QuoteBuilder />` when `isNew` is true.
5. Implement "Convert to Invoice" → redirect to `/app/invoices/{id}/edit`.
6. Implement "Download PDF".

### Phase 2 (Polish)
1. Implement the live preview panel (iframe rendering the quote HTML).
2. Add keyboard shortcuts (Cmd/Ctrl + S to save, Esc to discard).
3. Add "Save as Template" functionality.

### Phase 3 (Future)
1. Quote versioning / revision history.
2. Multi-language quote templates.
3. Quote expiration reminders (automated emails via the scheduler service).

---

## 8. Open Questions

1. **Preview implementation**: Should the live preview render the quote as HTML (using `TemplateRender`) or as a simplified styled summary? The HTML approach is more accurate but heavier.
2. **Product catalog integration**: Should line items auto-populate from the product catalog, or remain manual-entry only? The `ApiProduct` type exists but the integration depth is TBD.
3. **Template selection**: Should the builder allow selecting a quote template (like `TemplateGallery` in the Invoice Editor), or always use the business default?
4. **Save-as-draft timing**: Should we create the backend quote record immediately on page load (so auto-save has an ID), or batch-create on first save? The latter is simpler but means the ID doesn't exist until the first save.

---

*End of specification.*
