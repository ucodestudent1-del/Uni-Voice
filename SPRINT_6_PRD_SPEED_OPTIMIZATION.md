# Sprint 6 PRD: Speed Optimization & Predictive UX
## Universal Invoice Generator — "Invoice in Seconds"

| Field | Value |
|---|---|
| **Product** | Universal Invoice Generator (InvoiceFlow) |
| **Sprint** | Sprint 6 — Speed & Predictive UX |
| **Objective** | New customer: invoice in <60s. Returning customer: invoice in <15s. |
| **Status** | Specification |
| **Aligned With** | `AGENTS.md`, `AGENTS_PLAN.md`, `docs/invoice-creation-specification.md`, `docs/quote-builder-spec.md`, `docs/MVP-PRD.md`, `docs/ui-ux-specification.md`, `docs/payment-ux-specification.md`, `docs/projects-and-services-spec.md` |
| **Stack** | Backend: Express + TypeScript + PostgreSQL; Frontend: React 18 + Vite + TS + Tailwind v4 |

---

## Table of Contents

1. [UX Strategy & Core Principles](#1-ux-strategy--core-principles)
2. [Feature Specifications](#2-feature-specifications)
3. [User Flow Mapping](#3-user-flow-mapping)
4. [Technical Implementation Considerations](#4-technical-implementation-considerations)
5. [Success Metrics](#5-success-metrics)

---

## 1. UX Strategy & Core Principles

### 1.1 Philosophy: Zero-Friction Billing

The core philosophy is that **billing should be an afterthought** — a natural extension of completing a job, not a separate administrative task. Every interaction is evaluated against three questions:

1. **Can we eliminate this step entirely?** (Remove friction)
2. **Can we infer this from existing data?** (Leverage context)
3. **If the user must act, can it be done in one tap?** (Minimize effort)

### 1.2 Progressive Autofill

Rather than requiring users to fill fields sequentially, the system **progressively autofills** based on a cascading priority of data sources:

**Priority order for any field:**
1. **Current session context** — the invoice being edited right now
2. **Recent history** — the last 3 times the user touched this field
3. **Customer defaults** — the selected customer's stored preferences
4. **Business defaults** — the business's global settings
5. **System defaults** — sensible fallbacks (e.g., "Net 30", "each", today's date)
6. **Industry presets** — seeded values for the business's industry

*Example:* When a user selects a customer, the system autofills address, tax ID, currency, payment terms, and default tax rate from the customer record. If the customer has no custom terms, the business default applies. If the business default is blank, "Net 30" is used.

This means the user sees a **pre-populated invoice** on 80% of invoice opens, requiring only item entry (or selection from the catalog).

### 1.3 Adaptive Interfaces

The interface **adapts to the user's behavior patterns** in three ways:

| Layer | Behavior | Trigger |
|---|---|---|
| **Layout Adaptation** | Switches between "Express Mode" (minimal fields) and "Detail Mode" (full fields) | Invoice count per customer; power-user detection |
| **Field Prioritization** | Reorders form fields by recent usage frequency | User fills field X before field Y in 3+ sessions |
| **Tool Discovery** | Surfaces advanced features contextually | User spends >10s on a basic field |

**Express Mode** (default for first 10 invoices and mobile):
- Only: Customer, items, total, send button
- All other fields behind "Add more details"

**Detail Mode** (unlocked after 10 invoices, or on desktop):
- Full structured editor with all fields visible
- Keyboard shortcuts (`Alt+N`, `Ctrl+S`, `Ctrl+Shift+F`)
- Split-screen preview

### 1.4 Smart Continuation

When a user has an **unfinished draft** or just **sent an invoice**, the system offers intelligent "pick-up where you left off" patterns:

- **Draft resumption**: If a draft exists for this customer, a banner appears: "Continue editing your draft from 2 hours ago"
- **Post-send continuation**: After sending an invoice to a customer, the next new invoice defaults to the same customer, and the line items panel shows the last 3 invoiced services as quick-add chips
- **Multi-invoice batching**: If the user has 3+ open invoices for the same customer, a "Batch send" option appears

---

## 2. Feature Specifications

### 2.1 Progressive Autofill Engine

**Purpose:** Auto-populate customer metadata upon customer selection, cascading through fallback sources.

**Data Sources (in priority order):**

| Field | Source 1 | Source 2 | Source 3 |
|---|---|---|---|
| Address | Customer.billing_address | Business.address | — |
| Tax ID / VAT | Customer.tax_id | — | — |
| Currency | Customer.last_invoice_currency | Business.default_currency | USD |
| Payment Terms | Customer.default_payment_terms | Business.default_terms | "Net 30" |
| Tax Rate | Customer.default_tax_rate | Business.default_tax_rate | 0 |
| Template | Customer.last_used_template | Business.default_template | Default template |
| Payment Instructions | Customer.payment_instructions | Business.payment_instructions | "Pay via bank transfer" |
| Language | Customer.language | Business.language | en-US |

**Implementation Logic:**

```typescript
interface AutofillContext {
  customer?: ApiCustomer;
  business: ApiBusiness;
  recentInvoices: ApiInvoice[];
  industryPresets: IndustryPreset;
}

function progressiveAutofill(field: string, ctx: AutofillContext): string {
  // 1. Check recent history (last 3 invoices to this customer)
  const recent = ctx.recentInvoices
    .filter(i => i.customer_id === ctx.customer?.id)
    .map(i => i[field]);
  if (recent.length > 0 && recent[0]) return recent[0];

  // 2. Check customer defaults
  if (ctx.customer?.[field]) return ctx.customer[field];

  // 3. Check business defaults
  if (ctx.business?.[field]) return ctx.business[field];

  // 4. Industry preset
  if (ctx.industryPresets?.[field]) return ctx.industryPresets[field];

  // 5. System default
  return SYSTEM_DEFAULTS[field] || "";
}
```

**UI Integration:**
- Fields that are autofilled show a subtle "auto" badge (lightbulb icon) on the right
- Clicking the badge reveals the source: "From John's last invoice" or "From your business settings"
- Fields with no autofill data show the industry preset as a placeholder

---

### 2.2 Command-Bar Line Item Entry

**Purpose:** Allow users to type natural-language descriptions and have the system infer unit price, tax, and units.

**Input Format:**
```
3 x Logo design @ $150 = $450
Drano plumber's snake — 1 hr @ $120
Materials: PVC pipes 2" (qty 3) @ $12/each
```

**Parsing Logic:**

| Pattern | Extracted Fields |
|---|---|
| `N x description @ $price` | qty=N, unit="each", price=$price |
| `N hr description @ $price/hr` | qty=N, unit="hour", price=$price |
| `description — N hr @ $price` | qty=N, unit="hour", price=$price |
| `description (qty N) @ $price/unit` | qty=N, unit, price=$price |
| `description @ $price` | qty=1, unit="each", price=$price |
| `description` (no price) | qty=1, unit="each", price=0, tax=0 |

**NLP Engine:**

```typescript
interface ParsedLineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number; // from product catalog match or 0
  productId?: string;
}

function parseCommandLineItem(input: string): ParsedLineItem {
  // Regex patterns for common formats
  const patterns = [
    /(\d+(?:\.\d+)?)\s*x\s*(.+?)\s*@\s*\$?([\d,]+\.?\d*)/i,  // N x desc @ $price
    /(.+?)\s*—\s*(\d+(?:\.\d+)?)\s*(hr|hour|hourly)\s*@\s*\$?([\d,]+\.?\d*)/i, // desc — N hr @ $price
    /(.+?)\s*\(qty\s*(\d+)\)\s*@\s*\$?([\d,]+\.?\d*)\/([\w\s]+)/i,  // desc (qty N) @ $price/unit
    /(.+?)\s*@\s*\$?([\d,]+\.?\d*)\/([\w\s]+)/i,  // desc @ $price/unit
    /(.+?)\s*@\s*\$?([\d,]+\.?\d*)/i,  // desc @ $price
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      const [, qtyOrDesc, descOrQty, ...rest] = match;
      // ... extract and normalize
    }
  }

  // Fallback: plain text description, qty=1, price=0
  return {
    description: input.trim(),
    quantity: 1,
    unit: "each",
    unitPrice: 0,
    taxRate: 0,
  };
}
```

**Product Catalog Integration:**
- After parsing the free-text description, the system performs a **fuzzy match** against the product catalog (`products` table)
- If a match is found (>85% similarity), the line item is auto-linked to the product, inheriting its tax rate, SKU, and default unit
- The user sees: "Did you mean 'Drain Snaking'?" with a one-click accept button

**UI: Command Bar Component**

```
┌─────────────────────────────────────────────────────────────────┐
│ Type a service or line item... (e.g., "2 x Logo design @ $150")  │
│                                                                 │
│ ┌─ Recent: [Drain Snaking $250] [Logo Design $150]             │
│ └───────────────────────────────────────────────────────────────┘
│                                                                 │
│ Parsed result:                                                ↗│
│ ├ Description: Logo design                                     ││
│ ├ Quantity: 2    Unit: each                                    ││
│ ├ Price: $150.00  Tax: 10% (from product match)                ││
│ └ [Add to invoice]  [Add and +]                                ││
└─────────────────────────────────────────────────────────────────┘
```

**Keyboard Shortcuts:**
- `Cmd/Ctrl + K` — Focus command bar
- `Enter` — Add parsed line item
- `Enter + Shift` — Add and keep typing
- `Tab` — Accept suggested product match

---

### 2.3 Predictive Intelligence & Learning

#### 2.3.1 Frequently Invoiced Module

**Purpose:** Surface the user's most commonly invoiced services as one-tap additions.

**Algorithm:**

```sql
-- Query to compute "frequently invoiced" services
-- Scores based on: frequency × recency × monetary value
SELECT
  p.id,
  p.name,
  p.description,
  p.unit_price,
  p.unit,
  p.tax_rate,
  COUNT(*) as frequency,
  MAX(i.created_at) as last_used,
  AVG(i.unit_price * i.quantity) as avg_value,
  -- Score: frequency weighted by recency (decays 30 days/month)
  COUNT(*) * 0.7 +
    EXP(-EXTRACT(DAY FROM (NOW() - MAX(i.created_at))) / 30) * 0.3 as score
FROM invoice_items i
JOIN invoices inv ON i.invoice_id = inv.id
JOIN products p ON i.product_id = p.id
WHERE inv.business_id = $1
  AND inv.created_at > NOW() - INTERVAL '6 months'
GROUP BY p.id
ORDER BY score DESC
LIMIT 12;
```

**UI: Frequently Invoiced Chips**

```
┌────────────────────────────────────────────────────────────────┐
│ Your frequently invoiced services:                             │
│                                                                │
│ [Drain Snaking $250] [Oil Change $80] [Logo Design $150]     │
│ [Plumbing Fix $180] [Resume Update $200]                       │
│                                                                │
│ These appear above your full catalog.                          │
└────────────────────────────────────────────────────────────────┘
```

- Chips are ordered by the score algorithm
- Hover shows last-used date and total invoiced value
- Clicking adds the item with one tap
- "Pin to top" option allows manual reordering

#### 2.3.2 Use Last Invoice

**Purpose:** When creating a new invoice, offer to clone the structure of the most recent invoice (customer pre-selected, items pre-filled, terms copied).

**Logic:**
1. On "New Invoice" click, check if a final-sended invoice exists for this customer
2. If yes, show banner: "Quick repeat: Clone your last invoice to {Customer} (sent 3 days ago)"
3. If user clicks "Clone", the new invoice inherits:
   - Customer (pre-selected)
   - All line items (editable)
   - Currency, terms, payment instructions
   - Template
   - Tax rate
4. Invoice number and dates reset to today

**UI:**

```
┌────────────────────────────────────────────────────────────────┐
│ New Invoice                                                    │
│                                                                │
│ Quick repeat:                                                  │
│ Clone your last invoice to Acme Corp                           │
│ sent 3 days ago • $1,200 total                                │
│ [Clone and edit]  [No thanks, start fresh]                     │
└────────────────────────────────────────────────────────────────┘
```

---

### 2.4 Adaptive UI Framework: Common Path vs. Advanced Details

**Purpose:** Present only essential fields upfront, with progressive disclosure for secondary fields.

#### 2.4.1 Common Path (Visible by Default)

| Field | Description |
|---|---|
| Customer | Searchable dropdown with inline creation |
| Issue Date | Defaults to today |
| Due Date | Defaults to today + payment terms |
| Line Items | Command-bar entry + catalog chips |
| Invoice Total | Calculated, read-only |

#### 2.4.2 Progressive Disclosure: "Add more details"

**Trigger:** Collapsed by default. Click expands an accordion with advanced sections.

**Sections revealed:**

| Section | Fields |
|---|---|
| **Customer Details** | Address, phone, email (if not autofilled) |
| **Invoice Details** | Invoice number (read-only on draft), PO Number, Currency, Template |
| **Tax & Discounts** | Invoice-level discount, tax rate override, tax-inclusive toggle |
| **Payment Terms** | Deposit configuration, late fees, payment instructions |
| **Attachments** | Before/after photos, receipts, contracts |
| **Notes & Terms** | Notes, terms, footer text |

**"Add more details" Accordion UI:**

```
[+] Add more details
    └── Customer Details        (3 fields filled)
    └── Invoice Details         (2 fields needed)
    └── Tax & Discounts         (defaults applied)
    └── Payment Terms           (Net 30)
    └── Attachments             (none)
    └── Notes & Terms           (defaults from template)
```

Each subsection shows a preview of filled fields:
- Green checkmark = field has a value (autofilled or entered)
- Gray dash = field is empty
- Orange dot = required field missing

#### 2.4.3 Express Mode vs. Detail Mode Toggle

On desktop, users can toggle between modes:
- **Express Mode** (toggle off): Common path only, "Add more details" collapsed
- **Detail Mode** (toggle on): All sections expanded by default

The system remembers the user's preference per device type (mobile defaults to Express, desktop to Detail).

---

### 2.5 Workflow Conversions

#### 2.5.1 Quote to Invoice

**Flow:** A finalized, accepted quote can be converted to an invoice with one click.

**Conversion Logic:**
1. User opens the quote detail page
2. Quote must be in `accepted` status
3. Click "Convert to Invoice"
4. Backend creates a new invoice draft:
   - Customer copied from quote
   - All line items, fees, discounts copied
   - Currency, terms, notes copied
   - Invoice number NOT assigned (stays draft)
   - Status = `draft`
5. User is redirected to the invoice editor at `/app/invoices/{id}/edit`
6. All fields are editable; the user can adjust quantities, add items, change terms
7. User finalizes and sends as normal

**UI — Quote Detail Page:**
```
[Convert to Invoice]  [Send Reminder]  [More actions ▼]
```

**Confirmation Dialog:**
```
┌────────────────────────────────────────────────────┐
│ Convert to Invoice                                │
│                                                    │
│ This will create a new invoice from this quote.    │
│ All line items, terms, and notes will be copied.   │
│                                                    │
│ [Cancel]  [Convert to Invoice]                     │
└────────────────────────────────────────────────────┘
```

**Backend:** `POST /api/quotes/:id/convert` — already implemented in `quote-service.ts`

#### 2.5.2 Invoice to Credit Note (Partial Credit)

**Purpose:** Issue a partial credit against an invoice item without voiding the entire invoice.

**Flow:**
1. User opens a finalized, paid (or partially paid) invoice
2. Click "Issue Credit" in the actions menu
3. A credit note draft is created:
   - Inherits customer, currency, terms from the original invoice
   - Line items are copied with a "Select" checkbox
4. User checks the items to credit:
   ```
   ┌────────────────────────────────────────────┐
   │ Issue Credit — Partial                                      │
   │                                                              │
   │ Select items to credit (you can adjust the amounts):          │
   │                                                               │
   │ [✓] Drain Snaking       $250.00       [Qty: 1]              │
   │ [✓] Plumbing Assessment $180.00       [Qty: 1]              │
   │ [ ] Follow-up Visit     $0.00         [Qty: 0]  (excluded)  │
   │                                                               │
   │ Credit amount: $430.00                                       │
   │ [Apply credit to this invoice]  [Apply to other invoice]      │
   └──────────────────────────────────────────────────────────────┘
   ```
5. User adjusts quantities if needed (e.g., credit 50% of a line)
6. Click "Apply" → backend creates a credit note and applies it to the invoice
7. Invoice `amount_due` is reduced by the credit amount
8. Status transitions appropriately

**Backend:** `POST /api/invoices/:id/credit-notes` — new endpoint needed

**Data Model:**
```sql
-- credit_notes table (migration 013 already started this)
CREATE TABLE credit_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  credit_note_number VARCHAR(100) NOT NULL,
  status credit_note_status NOT NULL DEFAULT 'draft',
  total NUMERIC(18,6) NOT NULL DEFAULT 0,
  applied_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ
);

CREATE TABLE credit_note_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  original_invoice_item_id UUID REFERENCES invoice_items(id),
  description VARCHAR(500) NOT NULL,
  quantity NUMERIC(18,6) NOT NULL,
  unit_price NUMERIC(18,6) NOT NULL,
  line_total NUMERIC(18,6) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

---

## 3. User Flow Mapping

### 3.1 First-Time User Journey (0–60 seconds)

**Goal:** A brand-new user can create, finalize, and send their first invoice in under 60 seconds.

```
Step 1: Signup & Onboarding (0:00–0:15)
  ├─ User signs up (email + password or Google OAuth)
  ├─ Quick onboarding: business name, industry, currency, logo
  ├─ System seeds industry-specific service presets
  └─ Redirect to dashboard → "Create Invoice" CTA prominent

Step 2: New Invoice (0:15–0:30)
  ├─ Click "+ New Invoice"
  ├─ System: creates draft invoice, auto-assigns business info
  ├─ CustomerSelector: "No customers yet" → inline mini-form
  │   ├─ Name (required), Email, Phone
  │   └─ Click "Add" → customer saved, autofill cascade begins
  └─ System auto-fills: address (if entered), currency, terms, tax rate

Step 3: Add Line Items (0:30–0:45)
  ├─ Command bar focused automatically
  ├─ User types: "1 x Drain snaking"
  ├─ System: fuzzy-matches "Drain Snaking" from industry presets
  │   └─ Shows: "Did you mean 'Drain Snaking ($250)'?"
  ├─ User presses Enter → item added with price $250, qty 1
  ├─ System: "Frequently invoiced" chip shown for next selection
  └─ User adds 1 more item via chip: "Oil Change ($80)"

Step 4: Finalize & Send (0:45–1:00)
  ├─ System auto-fills due date: today + Net 14 (industry default for plumbing)
  ├─ "Finalize & Send" button enabled
  ├─ User clicks → backend assigns invoice #INV-2026-000001
  ├─ System sends confirmation: "Invoice sent! Link copied."
  │   └─ Preview shows customer sees: simple payment page
  └─ User clicks "Copy payment link" → done

Total: ~45 seconds (within 60s goal)
```

**Key optimizations for first-time users:**
- Industry presets seed the service catalog so no manual entry is needed
- Customer creation inline (no separate "add customer" step)
- Command bar auto-focused, with fuzzy matching to presets
- Due date auto-calculated from industry-standard terms
- Payment link auto-copied to clipboard

### 3.2 Returning Customer Journey (0–15 seconds)

**Goal:** A returning user can create and send an invoice in under 15 seconds using existing data.

```
Step 1: Quick Access (0:00–0:03)
  ├─ From dashboard: "Invoice Acme Corp again?" quick action
  ├─ OR: Click "+ New Invoice" → "Use Last Invoice" suggestion appears
  ├─ User clicks suggestion
  └─ System: clones last invoice to this customer

Step 2: Adjust (0:03–0:08)
  ├─ System pre-fills:
  │   ├─ Customer: Acme Corp (from last invoice)
  │   ├─ Items: same 3 line items (editable)
  │   ├─ Terms: Net 30 (from last invoice)
  │   └─ Template: last used template
  ├─ User adjusts quantities if needed (2 taps)
  └─ User adds one new item via command bar: "1 x Emergency fee @ $100"

Step 3: Send (0:08–0:15)
  ├─ System: issue date = today, due date = today + 30
  ├─ "Finalize & Send" → backend finalizes + sends
  ├─ System: "Invoice sent to acme@example.com!"
  └─ Payment link auto-copied

Total: ~12 seconds (within 15s goal)
```

**Key optimizations for returning users:**
- "Use Last Invoice" one-click clone
- Recent customer quick actions on dashboard
- Items pre-filled and editable (not just selectable)
- Command bar for additions
- Single "Finalize & Send" action (no review step for returning users)

---

## 4. Technical Implementation Considerations

### 4.1 Data Models for Predictive Features

#### 401. Invoice Metadata Cache

To support "Use Last Invoice" and "Frequently Invoiced" without expensive queries, we cache per-customer metadata:

```sql
-- Aggregated cache, updated via background job (hourly)
CREATE TABLE customer_invoice_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id),
  last_invoice_id UUID REFERENCES invoices(id),
  last_invoice_items JSONB, -- [{description, quantity, unitPrice, productId, taxRate}]
  last_invoice_total NUMERIC(18,6),
  last_invoice_currency VARCHAR(3),
  last_invoice_terms TEXT,
  last_invoice_template_id UUID,
  last_invoice_sent_at TIMESTAMPTZ,
  frequently_invoiced JSONB, -- [{productId, name, unitPrice, frequencyScore}]
  avg_invoice_total NUMERIC(18,6),
  invoice_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)
);
```

#### 4.2 User Interaction History

For adaptive field prioritization and express/detail mode detection:

```sql
CREATE TABLE user_interaction_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  action_type VARCHAR(50) NOT NULL, -- 'field_edit', 'invoice_create', 'command_bar_use', etc.
  target_field VARCHAR(100), -- e.g., 'paymentInstructions', 'poNumber'
  invoice_id UUID REFERENCES invoices(id),
  duration_ms INTEGER, -- time spent on the action
  value_changed_from TEXT,
  value_changed_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interaction_user ON user_interaction_log(user_id, action_type, created_at DESC);
CREATE INDEX idx_interaction_field ON user_interaction_log(business_id, target_field, created_at DESC);
```

### 4.2 Pattern-Matching Logic for "Smart Continuation"

#### Command Bar NLP Parser

The command bar uses a **multi-stage regex pipeline** rather than a full NLP model (for performance on mobile):

```typescript
// Stage 1: Extract quantity patterns
const QUANTITY_PATTERNS = [
  { pattern: /(\d+(?:\.\d+)?)\s*x\s*/i, extract: (m) => ({ qty: parseFloat(m[1]) }) },
  { pattern: /(\d+(?:\.\d+)?)\s*(hr|hour)/i, extract: (m) => ({ qty: parseFloat(m[1]), unit: "hour" }) },
  { pattern: /(\d+(?:\.\d+)?)\s*(each|ea)/i, extract: (m) => ({ qty: parseFloat(m[1]), unit: "each" }) },
];

// Stage 2: Extract price patterns
const PRICE_PATTERNS = [
  { pattern: /@\s*\$?([\d,]+\.?\d*)/i, extract: (m) => ({ price: parseFloat(m[1].replace(/,/g, "")) }) },
  { pattern: /@\s*\$?([\d,]+\.?\d*)\/hr/i, extract: (m) => ({ price: parseFloat(m[1].replace(/,/g, "")), unit: "hour" }) },
  { pattern: /@\$?([\d,]+\.?\d*)\/each/i, extract: (m) => ({ price: parseFloat(m[1].replace(/,/g, "")) }) },
];

// Stage 3: Clean remaining text as description
const cleanDescription = (input: string): string => {
  return input
    .replace(/@\$?[\d,]+\.?\d*(?:\/hr|\/each|\/\w+)?/i, "")
    .replace(/\d+(?:\.\d+)?\s*x\s*/i, "")
    .replace(/\d+(?:\.\d+)?\s*(hr|hour|each|ea)\s*/i, "")
    .replace(/—/g, "")
    .trim();
};
```

#### Fuzzy Product Match

Uses **trigram similarity** for fuzzy matching against the product catalog:

```typescript
function fuzzyMatchProduct(input: string, products: ApiProduct[]): ProductMatch | null {
  const inputTokens = input.toLowerCase().split(/\s+/);

  let bestMatch: { product: ApiProduct; score: number } | null = null;

  for (const product of products) {
    const productNameTokens = product.name.toLowerCase().split(/\s+/);
    const descriptionTokens = (product.description || "").toLowerCase().split(/\s+/);

    // Token overlap score (Jaccard similarity)
    const allTokens = new Set([...inputTokens, ...productNameTokens, ...descriptionTokens]);
    const overlap = inputTokens.filter(t =>
      productNameTokens.includes(t) || descriptionTokens.includes(t)
    ).length;
    const jaccard = overlap / allTokens.size;

    // Length difference penalty
    const lengthDiff = Math.abs(input.length - product.name.length) / Math.max(input.length, product.name.length);
    const lengthPenalty = 1 - lengthDiff;

    const score = jaccard * 0.7 + lengthPenalty * 0.3;

    if (score > 0.65 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { product, score };
    }
  }

  return bestMatch ? { product: bestMatch.product, confidence: bestMatch.score } : null;
}
```

#### "Use Last Invoice" Clone Logic

```typescript
function buildClonePayload(lastInvoice: ApiInvoice, overrides?: Partial<WorkspaceInvoiceData>) {
  return {
    customerId: lastInvoice.customer_id,
    currency: lastInvoice.currency,
    issueDate: todayISO(),
    dueDate: addDaysISO(todayISO(), getPaymentTermsDays(lastInvoice.terms || "Net 30")),
    notes: lastInvoice.notes,
    terms: lastInvoice.terms,
    paymentInstructions: lastInvoice.payment_instructions,
    templateId: lastInvoice.template_id,
    items: lastInvoice.items.map(item => ({
      description: item.description,
      quantity: formatDecimal(item.quantity),
      unit: item.unit,
      unitPrice: formatDecimal(item.unit_price),
      taxRate: formatDecimal(item.tax_rate * 100), // decimal to percentage
      discount: formatDecimal(item.discount || 0),
      discountType: item.discount_type,
      isTaxInclusive: item.is_tax_inclusive,
      productId: item.product_id,
    })),
    fees: lastInvoice.fees?.map(fee => ({
      description: fee.description,
      amount: formatDecimal(fee.amount),
      taxRate: formatDecimal(fee.tax_rate * 100),
    })) || [],
    ...overrides,
  };
}
```

### 4.3 API Endpoints (New)

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/invoices/suggested-actions` | Returns "Use Last Invoice," "Clone recent," "Frequently invoiced" for the current business |
| `POST` | `/api/invoices/from-command` | Parses a command-bar line item and returns structured item data (price inference, tax match) |
| `GET` | `/api/customers/{id}/invoice-history` | Returns last 5 invoices + frequently invoiced services for a customer |
| `POST` | `/api/quotes/:id/convert-to-invoice` | Converts a quote to an invoice draft (already exists as `convert`) |
| `POST` | `/api/invoices/:id/credit-notes` | Creates a credit note from selected line items |

### 4.4 Frontend Architecture

**New Components:**

| Component | Location | Responsibility |
|---|---|---|
| `CommandLineItemInput` | `webapp/src/components/CommandLineItemInput.tsx` | Command bar with NLP parsing, fuzzy product matching |
| `FrequentlyInvoicedChips` | `webapp/src/components/FrequentlyInvoicedChips.tsx` | Shows top 12 frequently invoiced services as tappable chips |
| `QuickRepeatBanner` | `webapp/src/components/QuickRepeatBanner.tsx` | "Use Last Invoice" / "Clone recent" banner with one-click clone |
| `AdvancedDetailsAccordion` | `webapp/src/components/AdvancedDetailsAccordion.tsx` | Progressive disclosure for secondary fields |
| `ExpressModeToggle` | `webapp/src/components/ExpressModeToggle.tsx` | Toggle between express and detail modes |
| `InvoiceSpeedMetrics` | `webapp/src/components/InvoiceSpeedMetrics.tsx` | Tracks and displays time-to-invoice per session |

**Integration Point: InvoiceWorkspace**

The `InvoiceWorkspace.tsx` component (2198 lines) is the primary integration target. New props:

```typescript
// New props for InvoiceWorkspace
interface SpeedOptimizations {
  showQuickRepeat: boolean;           // Show "Use Last Invoice" banner
  showFrequentlyInvoiced: boolean;   // Show frequent service chips
  expressMode: boolean;              // Collapsed advanced details
  commandBarFocused: boolean;        // Auto-focus command bar on new
}
```

---

## 5. Success Metrics

### 5.1 Primary Metrics (Speed)

| Metric | Definition | Target | Measurement Method |
|---|---|---|---|
| **New Customer Invoice Time** | Time from user landing on "New Invoice" to successful send | <60 seconds | Frontend instrumentation: `performance.now()` at page load → at send click |
| **Returning Customer Invoice Time** | Time from "New Invoice" to send, using pre-existing data | <15 seconds | Same as above, segmented for users with ≥3 prior invoices |
| **Command Bar Adoption** | % of new invoices created via command bar entry | >70% | Track `command_bar_item_added` events |
| **Frequent Item Usage** | % of line items added from "frequently invoiced" chips | >40% | Track `chip_item_added` vs `manual_item_added` |

### 5.2 Secondary Metrics (Efficiency)

| Metric | Definition | Target | Measurement Method |
|---|---|---|---|
| **Form Field Completion Rate** | % of invoices where all required fields are filled without opening "Add more details" | >85% | Track `advanced_details_opened` events |
| **Express Mode Retention** | % of returning users who keep Express Mode enabled | >60% | Persist mode preference per user; segment by device |
| **One-Tap Send Rate** | % of invoices sent with ≤2 clicks after initial customer selection | >50% | Frontend event funnel |
| **Catalog Lookup Hits** | % of command-bar entries that match a product catalog entry | >65% | Track `product_match_found` vs `product_match_not_found` |

### 5.3 Business Metrics

| Metric | Definition | Target | Measurement Method |
|---|---|---|---|
| **Task Completion Rate** | % of "New Invoice" sessions that result in a sent invoice (not abandoned) | >90% | Funnel: new invoice → send, excluding cancellations |
| **Time to Second Invoice** | Median time between first and second invoice for new users | <7 days | `sent_at` timestamps |
| **Invoice Volume Growth** | Month-over-month increase in invoice count per active user | >25% MoM | Backend reporting |
| **Mobile Send Share** | % of invoices sent from mobile devices | >75% | User-agent parsing on send events |
| **Customer Payment Speed** | Median time from invoice send to payment received | <24 hours | `payment.created_at - invoice.sent_at` |

### 5.4 Error & Friction Reduction Metrics

| Metric | Definition | Target | Measurement Method |
|---|---|---|---|
| **Validation Abandonment** | % of users who abandon at the validation gate (Finalize blocked) | <5% | Track `finalize_blocked` → `abandon_invoice_page` |
| **Autofill Correction Rate** | % of autofilled fields that the user edits | <20% | Track `field_autofilled` → `field_edited` |
| **Command Bar Correction Rate** | % of parsed command bar entries where user modifies suggested values | <30% | Track `command_parsed` → `item_modified_in_editor` |
| **Duplicate Entry Prevention** | % of customer entries that match existing customer (fuzzy) | >40% | Track `customer_match_suggested` |

### 5.5 Instrumentation Plan

All metrics are captured via the existing `useAnalytics` hook (`webapp/src/hooks/useAnalytics.ts`) and sent to:

1. **Frontend timing**: `performance.now()` marks at key journey points
2. **Event tracking**: `analytics.track(event, properties)` at action completion
3. **Backend aggregation**: `GET /api/dashboard` enriched with speed metrics

```typescript
// Example instrumentation in InvoiceWorkspace.tsx
const startTimeRef = useRef<number>();

useEffect(() => {
  startTimeRef.current = performance.now();
  analytics.trackInvoiceStarted({ method: isReturningUser ? "clone" : "new" });
}, []);

// At send success:
const elapsed = performance.now() - startTimeRef.current;
analytics.trackInvoiceSent({
  durationMs: elapsed,
  itemCount: invoice.items.length,
  customerSelectedVia: customerSelectMethod, // "search" | "chip" | "autofill" | "recent"
  usedLastInvoice: !!wasCloned,
  commandBarUsed: commandBarItemsAdded,
});
```

---

*Document Owner: Product & Design. Last updated: 2026-10-04. This PRD builds upon the existing architecture documented in `AGENTS.md`, `AGENTS_PLAN.md`, and `docs/`. Backend is authoritative for all calculations. All new features must respect tenant isolation and immutability invariants.*
