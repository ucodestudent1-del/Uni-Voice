# Payment UX/UI Specification

**Project:** Universal Invoice Generator (InvoiceFlow)  
**Date:** 2026-09-26  
**Status:** Specification  
**Aligned With:** `PublicInvoice.tsx`, `InvoiceDetail.tsx`, `InvoiceWorkspace.tsx`, `PaymentsSettings.tsx`, `ReminderAutomation.tsx`, and the Tailwind CSS v4 + semantic CSS-variable design system defined in `docs/ui-ux-specification.md` and `webapp/src/index.css`.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Core UX Principle: Configuration vs. Execution Separation](#2-core-ux-principle-configuration-vs-execution-separation)
3. [Customer-Facing Invoice: Payment View](#3-customer-facing-invoice-payment-view)
4. [Invoice Creator: Payment Configuration Dashboard](#4-invoice-creator-payment-configuration-dashboard)
5. [Cross-Perspective Information Architecture](#5-cross-perspective-information-architecture)
6. [User Flows](#6-user-flows)
7. [Data Model Alignment](#7-data-model-alignment)
8. [Accessibility & Responsiveness](#8-accessibility--responsiveness)

---

## 1. Design Principles

### 1.1 Foundational Principles

All payment-related UI adheres to the following principles, consistent with the existing codebase philosophy:

| Principle | Implementation |
|---|---|
| **Backend-authoritative math** | All monetary calculations are performed server-side (`src/services/invoice-service.ts:recordPayment`). The frontend displays amounts but never computes the authoritative balance. |
| **Immutability after finalization** | Payment configuration is only editable on drafts (`is_finalized = FALSE`). Once finalized, the invoice snapshot is immutable — the customer view is rendered from `invoice_snapshots.rendered_html`. |
| **Tenant isolation** | All configuration is per-business. Payment settings are stored in `business_settings` (`src/db/migrations/011_invoice_reminders_and_payments.sql:73`). |
| **Idempotent payments** | Payment recording uses `idempotency_key` (DB unique constraint in `payments` table). Duplicate submissions are silently rejected at the DB level (`src/services/invoice-service.ts:recordPayment`). |

### 1.2 Visual Language

The design system uses **semantic CSS variables** defined in `webapp/src/index.css`. All components consume these tokens — no hardcoded hex values in component files.

| Token | Light Theme | Dark Theme |
|---|---|---|
| `--color-primary` | `#2563eb` (blue-600) | `#60a5fa` (blue-400) |
| `--color-success-*` | green-50 / green-800 / green-200 border | green-900 / green-300 / green-700 |
| `--color-error-*` | red-50 / red-800 / red-300 border | red-900 / red-300 / red-800 |
| `--color-warning-*` | amber-50 / amber-800 / amber-200 border | amber-900 / amber-300 / amber-800 |
| `--color-info-*` | blue-50 / blue-800 / blue-200 border | blue-900 / blue-200 / blue-800 |
| `--color-surface` | white | slate-800 |
| `--color-surface-alt` | sky-50 | slate-800 |

**Status badge color mapping** (from `webapp/src/components/ui/InvoiceStatus.tsx:14`):

| Invoice Status | Badge Classes | Dot |
|---|---|---|
| `paid` | `status-success-bg status-success-text` | green-500 |
| `overdue` | `status-error-bg status-error-text` | red-500 |
| `partially_paid` | `status-warning-bg status-warning-text` | amber-500 |
| `sent` / `viewed` | `status-info-bg status-info-text` | blue-500 |
| `draft` | `status-tertiary-bg status-tertiary-text` | slate-400 |
| `cancelled` / `void` | `status-tertiary-bg status-tertiary-text` | slate-400 |

**Typography** (from `docs/ui-ux-specification.md` §1.3):

| Element | Size | Weight | Color |
|---|---|---|---|
| Page Title | 24px | 700 | `text-primary` |
| Section Header | 18px | 600 | `text-primary` |
| Card Header | 14px | 600 | `text-primary` |
| Body | 14px | 400 | `text-secondary` |
| Caption | 12px | 500 | `text-tertiary` |
| KPI Value | 30px | 700 | `text-primary` |

**Border Radius** (from `docs/ui-ux-specification.md` §1.6):

| Token | Value | Usage |
|---|---|---|
| `md` (8px) | `rounded-lg` | Buttons, inputs, badges |
| `lg` (12px) | `rounded-xl` | Cards, panels, modals |
| `full` | `rounded-full` | Status pills, circular buttons |

---

## 2. Core UX Principle: Configuration vs. Execution Separation

The payment system is designed around a fundamental separation of two distinct user roles and their respective mental models:

### 2.1 The Invoice Creator (Editor)

The invoice creator is a **business user** (e.g., tradesperson, accountant) who configures payment terms, selects accepted methods, and sets up automation. Their mental model is one of **control and setup**:

- They need **comprehensive configuration** before the invoice is sent
- They operate in an **authenticated, admin-facing environment**
- They need **granular controls** with tooltips, validation, and save/discard patterns
- Their workflow is: *configure → finalize → send → monitor*

### 2.2 The Customer (Payer)

The customer is a **bill receiver** (e.g., client, consumer) who executes a payment. Their mental model is one of **clarity and action**:

- They need to see **only what is relevant to payment** — not configuration options
- They may access the invoice via a **public, unauthenticated link** (`/invoice/:token`)
- They want a **single clear call-to-action** to pay
- Their workflow is: *view invoice → pay → confirm*

### 2.3 Separation Enforcement

This separation is enforced at three levels:

| Level | How It Works | Code Reference |
|---|---|---|
| **Data** | Configuration (terms, methods, reminders) is stored on the business/invoice record. Only relevant display fields (total, due date, instructions) are exposed to the public view via the snapshot. | `src/services/snapshot/snapshot-service.ts` |
| **Routing** | `/invoice/:token` serves the public payment view (unauthenticated). `/app/invoices/:id/edit` serves the editor (authenticated). | `webapp/src/App.tsx:70`, `App.tsx:82` |
| **UI** | The customer sees a read-only payment card. The editor sees a configuration panel with tabs/accordions. | `PublicInvoice.tsx:244`, `InvoiceWorkspace.tsx:904` |

---

## 3. Customer-Facing Invoice: Payment View

### 3.1 Overview

The customer-facing payment view is rendered at route `/invoice/:token` via `PublicInvoice` (`webapp/src/pages/PublicInvoice.tsx`). This is a **read-only, action-oriented** interface with no editable fields. The page renders the finalized invoice HTML (from the immutable snapshot) and appends a payment execution section at the bottom.

### 3.2 Information Hierarchy

The payment section follows this strict visual hierarchy, rendered below the invoice HTML body:

```
┌─────────────────────────────────────────────────────────────┐
│  [Deposit Required] (if applicable)                          │  ← Priority 0
│  Deposit Due: $X.XX  Deposit Paid: $Y.YY                     │
│  [Pay Deposit Now]                                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐      ┌─────────────────────────┐ │
│  │  Amount Due          │      │  [Pay Now] Button        │ │  ← Priority 1-2
│  │  $X,XXX.XX           │      │  Pay $1,200.00           │ │
│  │  Due: Sep 26, 2026    │      │                           │ │
│  │                       │      │  ┌─────────────────────┐ │ │  ← Priority 3
│  │  [Unpaid] badge      │      │  │Payment Method Choice│ │ │
│  └──────────────────────┘      │  │[●] Card  [○] Bank   │ │ │  ← Priority 4
│                                │  │[○] PayPal           │ │ │
│                                │  └─────────────────────┘ │ │
│                                │                           │ │
│                                │  Bank Transfer Details    │ │  ← Priority 5
│                                │  Routing: 123456789       │ │
│                                │  Account: 987654321       │ │
│                                │  Ref: INV-2026-0042       │ │
│                                └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Component Specifications

#### 3.3.1 Payment Status Header Bar

| Property | Specification |
|---|---|
| **Trigger condition** | Always visible when `!isFullyPaid` and `due.gt(0)` |
| **Amount display** | `formatCurrency(invoice.total, currency)` in `text-3xl font-bold` (`text-primary-brand`) |
| **Due date** | `formatDate(invoice.due_date)` in `text-xs text-tertiary` |
| **Status badge** | `<span>` with `getStatusColor(invoice.status)` classes, rounded-full, `px-3 py-1 text-sm font-medium` |
| **Layout** | `flex flex-col sm:flex-row items-center justify-between gap-6` |

**Status → Color mapping** (from `PublicInvoice.tsx:124`):

| Status | Background | Text |
|---|---|---|
| `sent` / `viewed` | `status-info-bg` | `status-info-text` |
| `partially_paid` | `bg-yellow-100` | `text-yellow-800` |
| `paid` | `status-success-bg` | `status-success-text` |
| `overdue` | `status-error-bg` | `status-error-text` |
| `draft` / `cancelled` / `void` | `bg-surface-alt` | `text-primary` |

#### 3.3.2 Primary Call-to-Action: "Pay Now" Button

| Property | Specification |
|---|---|
| **Label** | `Pay ${formatCurrency(amountDue, currency)}` (e.g., "Pay $1,200.00") |
| **Trigger** | Clicking sets `payAmount = amountDue` and toggles the payment method section into view |
| **Disabled state** | N/A — always enabled when `amountDue > 0` |
| **Style** | `bg-primary-action px-6 py-3 text-sm font-medium text-on-primary hover:bg-primary-hover` |
| **Icon** | `<CreditCard className="h-5 w-5" />` (from `lucide-react`) |
| **Width** | Full-width on mobile (`w-full`), auto on desktop (`sm:w-auto`) |

#### 3.3.3 Payment Method Selection

When the customer clicks "Pay Now," they are presented with available payment methods based on the business's configured provider and accepted methods.

| Provider State | UI Behavior |
|---|---|
| **Stripe configured** (`env.STRIPE_SECRET_KEY` set, `payment_provider = "stripe"`) | Renders Stripe Payment Element (card, Apple Pay, Google Pay). Client secret fetched from `createPaymentIntentPublic(token)`. |
| **Stub provider** (default dev mode) | Renders a numeric amount input + "Confirm" button that calls `payInvoicePublic` with `provider: "stub"`. |
| **No online payment** (provider disabled) | Only shows bank transfer/PayPal instructions with manual payment instructions. No CTA button. |

**Payment method selector** (when online payment is available):

| Element | Specification |
|---|---|
| Container | `max-w-lg` with `border-t border-color-subtle pt-6` |
| Method label | `Secure Card Payment ({{CURRENCY}})` in `text-sm font-medium text-secondary` |
| Stripe Element mount point | `<div id="public-payment-element" className="w-full min-h-[160px]" />` |
| Confirm button | `bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover` — shows `Pay {{amount}}` |
| Cancel link | `text-xs text-secondary hover:text-primary` — "Cancel Payment" |

#### 3.3.4 Partial Payment / Custom Amount

When the business has enabled partial payments (`deposit_type` or manual partial payment support):

| Property | Specification |
|---|---|
| **Amount input** | `<input type="number" step="0.01" min="0.01">` with `max` = outstanding balance |
| **Quick-fill buttons** | "Pay full amount" link below input |
| **Cancel** | "Cancel" link that resets amount input and hides payment form |
| **Validation** | `Number(payAmount) <= 0` disables the Confirm button |

**State transitions** for partial flow:

1. Customer clicks "Pay Now" → `payAmount` set to full balance, payment form appears
2. Customer edits amount → form validates against `0 < amount <= balance`
3. Customer clicks "Confirm" → payment processing begins
4. On success → `paymentSuccess = true`, balance updates, form collapses
5. On failure → `paymentError` shown in `status-error-text` below the input

#### 3.3.5 Payment Instructions Display

Rendered from `invoice.payment_instructions` field (stored per-invoice, overridden from business default at finalize):

| Property | Specification |
|---|---|
| **Trigger** | Visible when `invoice.payment_instructions` is non-empty |
| **Container** | `bg-surface-alt rounded-lg p-4` with `mt-4` |
| **Label** | `text-xs font-semibold text-tertiary uppercase` — "Payment Instructions" |
| **Content** | `text-sm text-secondary whitespace-pre-line` — preserves line breaks |
| **Example content** | `Bank: 1234 5678 90\nAccount: 987654321\nReference: INV-2026-0042` |

This section appears **below** the payment card/form, not inside it, so customers can reference instructions while choosing their payment method.

#### 3.3.6 Deposit Required Banner

| Property | Specification |
|---|---|
| **Trigger** | `deposit_type !== "none" && deposit_due.gt(0)` |
| **Container** | `border-t border-color-subtle px-8 py-6 status-warning-bg` |
| **Icon** | Information icon (`<AlertCircle>`) in `w-8 h-8` circle |
| **Title** | `Deposit Required` in `text-lg font-semibold status-warning-text` |
| **Description** | Dynamic: percentage (`"{X}% deposit"`) or fixed (`"fixed amount of ${currency} {amount}"`) |
| **Due date** | Optional: `"due by {date}"` appended if `deposit_due_date` present |
| **Quick-pay grid** | Two `bg-surface rounded-lg p-3` cards: "Deposit Due" (amber) and "Deposit Paid" (green), showing amounts in `text-2xl font-bold` |
| **Pay Deposit button** | `bg-primary-action px-6 py-3 text-sm font-medium text-on-primary hover:bg-primary-hover` |

#### 3.3.7 Fully Paid State

| Property | Specification |
|---|---|
| **Trigger** | `paid.gte(total)` |
| **Container** | `border-t border-color-subtle px-8 py-6 status-success-bg` |
| **Icon** | Checkmark (`<CheckCircle>`) in `w-16 h-16 rounded-full` |
| **Status** | `Fully Paid` badge (`status-success-bg status-success-text`) |
| **Paid date** | `Paid on {date}` in `text-xs text-tertiary` |

### 3.4 Customer View States

#### State 1: Unpaid (Primary)

```
┌──────────────────────────────────────────────────┐
│ Invoice #INV-2026-0042       [Unpaid badge]     │
│ ...invoice HTML...                              │
│                                                 │
│ ┌──────────────────┐ ┌─────────────────────────┐│
│ │ Amount Due       │ │ [Pay $1,200.00 Now]     ││
│ │ $1,200.00        │ │                         ││
│ │ Due: Sep 26      │ │  [Payment form hidden]  ││
│ │ [Unpaid]         │ │                         ││
│ └──────────────────┘ └─────────────────────────┘│
│                                                 │
│ Payment Instructions                            │
│ Bank: 1234 5678 90                              │
│ Account: 987654321                              │
│ Reference: INV-2026-0042                        │
└──────────────────────────────────────────────────┘
```

#### State 2: Partially Paid

```
┌──────────────────────────────────────────────────┐
│ Invoice #INV-2026-0042 [Partially Paid badge]   │
│ ...invoice HTML...                              │
│                                                 │
│ ┌──────────────────┐ ┌─────────────────────────┐│
│ │ Amount Due       │ │ [Pay $600.00 Now]       ││
│ │ $600.00          │ │                         ││
│ │ Due: Sep 26      │ │  [Payment form]         ││
│ │ [Partially Paid] │ │  Amount: [600.00]       ││
│ └──────────────────┘ │  [Confirm Pay $600]     ││
│                      └─────────────────────────┘│
└──────────────────────────────────────────────────┘
```

#### State 3: Overdue

Same as State 1, but the status badge shows "Overdue" with error styling, and the amount due box may include an additional warning message:

| Element | Specification |
|---|---|
| Warning text | `text-xs status-error-text` below the amount |
| Message | "This invoice is past its due date. Late fees may apply." |

#### State 4: Paid (Terminal)

```
┌──────────────────────────────────────────────────┐
│ Invoice #INV-2026-0042    [Paid badge]         │
│ ...invoice HTML...                              │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │     ✓         Fully Paid                    │ │
│ │           Paid on Sep 24, 2026              │ │
│ └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

No payment button, no form, no instructions section — the page ends with the paid confirmation.

---

## 4. Invoice Creator: Payment Configuration Dashboard

### 4.1 Overview

The invoice creator configures payment settings in two contexts:

1. **Invoice-level configuration** — within the Invoice Editor (`InvoiceWorkspace.tsx`), for per-invoice overrides
2. **Business-level configuration** — within Settings → Payments (`PaymentsSettings.tsx`), for system-wide defaults

### 4.2 Invoice-Level Configuration (Invoice Editor)

The Invoice Workspace is a split-screen editor (`webapp/src/components/InvoiceWorkspace.tsx:904`). The payment configuration lives in two places within the editor:

#### 4.2.1 Financial Parameters (TotalsCard)

Located in the `TotalsCard` component (`InvoiceWorkspace.tsx:1241`):

| Field | Input Type | Binding | Validation |
|---|---|---|---|
| Subtotal | Read-only display | `calc.subtotal` | — |
| Discount | Read-only display | `calc.discountTotal` | — |
| Tax | Read-only display | `calc.taxTotal` | — |
| Fees | Read-only display | `calc.feeTotal` | — |
| **Total** | Read-only display, bold | `calc.total` | backend-validated |
| **Amount Paid** | Editable `<input type="number">` | `invoice.amountPaid` | Must be `>= 0`, must be `<= total` |
| **Balance Due** | Read-only display, bold, `text-primary-brand` | `calc.amountDue` | Backend authoritative |

**Amount Paid field behavior:**

| Property | Specification |
|---|---|
| `onChange` | Calls `onField("amountPaid", value)` → triggers `updateData()` → schedules autosave (2s debounce) |
| `className` | `w-28 rounded-lg border border-input-border bg-input px-2 py-1 text-right text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary` |
| `placeholder` | Defaults to `"0"` (from `WorkspaceInvoiceData.amountPaid` default of `"0"`) |
| **Validation** | If `amountPaid > total`, backend validation will flag during finalize (`CALCULATION_DISCREPANCY` or custom rule) |

**Note:** The `amountPaid` field is only editable when the invoice is in `draft` status. After finalization, the field is disabled and payments are recorded via `POST /api/invoices/:id/payments` (see `InvoiceDetail.tsx:172`).

#### 4.2.2 Payment Terms & Instructions (NotesSection)

Located in `NotesSection` (`InvoiceWorkspace.tsx:1601`):

| Field | Input Type | Binding | Placeholder |
|---|---|---|---|
| **Payment Instructions** | `<textarea rows={3}>` | `invoice.paymentInstructions` | "Bank transfer, PayPal, etc.…" |
| **Terms** | `<textarea rows={3}>` | `invoice.terms` | "Payment terms (e.g. Net 30)…" |

**Payment Instructions field:**

| Property | Specification |
|---|---|
| Label | `text-sm font-semibold text-secondary` — "Payment instructions" |
| Persistence | Autosaved via `updateData({ paymentInstructions: value })` → `doSave()` (2s debounce) |
| Backend | Stored as `payment_instructions` column on `invoices` table; included in snapshot at finalize |
| Preview | Rendered in live preview via `InvoicePreview.tsx:221` in a `bg-surface-alt rounded-lg p-4` callout |

**Terms field:**

| Property | Specification |
|---|---|
| Label | `text-sm font-semibold text-secondary` — "Terms" |
| Default | `"Net 30"` (from `settings.default_terms` or built-in default) |
| Persistence | Autosaved via `updateData({ terms: value })` |
| Backend | Stored as `terms` column; rendered in template footer |

#### 4.2.3 Deposit Configuration (TotalsCard → expandable)

The existing editor supports deposits via `depositType`, `depositValue`, `depositDueDate` in `WorkspaceInvoiceData`. These are configured inline:

| Field | Input | Binding | Options |
|---|---|---|---|
| Deposit Type | Not currently exposed in UI (stored but not configured in editor) | `invoice.depositType` | `"none" \| "fixed" \| "percentage"` |
| Deposit Value | Not currently exposed | `invoice.depositValue` | Numeric |
| Deposit Due Date | Not currently exposed | `invoice.depositDueDate` | Date picker |

**Gap identified:** The current editor does NOT expose deposit configuration in the UI (lines 104-106 store the fields, but no form control is bound). This section should be added as an expandable "Payment Terms" section below the TotalsCard.

**Proposed Deposit Configuration Panel (to be added):**

| Property | Specification |
|---|---|
| Container | `border-t border-color pt-4` below TotalsCard, collapsible via chevron |
| Trigger label | "Payment Terms & Deposits" in `text-xs font-semibold text-tertiary uppercase` |
| Toggle | Chevron right/down icon, `rounded-lg p-2 hover:bg-surface-alt` |
| Content (when expanded) | Grid of controls |
| **Accept Deposits** | Checkbox: `invoice.depositType !== "none"` |
| **Deposit Type** | Radio: Fixed Amount / Percentage (shown when deposits enabled) |
| **Deposit Value** | `<input type="number">` bound to `invoice.depositValue` |
| **Deposit Due Date** | `<input type="date">` bound to `invoice.depositDueDate` |
| **Payment Terms** | `<select>`: Net 7 / Net 14 / Net 30 / Due on receipt / Net 60 / Net 90 / None |
| **Late Payment Penalty** | `<input type="number" min="0" step="0.01">` (percentage or fixed) — **new field, not currently in data model** |
| **Partial Payments** | Checkbox: "Allow customers to pay a custom amount" — toggles partial payment support |

### 4.3 Business-Level Configuration (Settings → Payments)

The `PaymentsSettings` component (`webapp/src/components/settings/PaymentsSettings.tsx`) is the **centralized payment configuration hub**. This is where editors configure system-wide payment behavior.

#### 4.3.1 Payment Provider Configuration

| Field | Input | Binding | Options |
|---|---|---|---|
| Payment Provider | `<select>` | `form.paymentProvider` → `business_settings.payment_provider` | "Built-in (Test Mode)" / "Stripe — Coming soon" / "PayPal — Coming soon" |

**Design notes:**

- Currently, only the stub provider is functional. Stripe and PayPal options are shown as `disabled` with "Coming soon" labels, communicating roadmap intent.
- When Stripe is selected (future), a sub-panel for API key entry and webhook configuration should appear.
- The provider selection affects the customer-facing view: only methods supported by the selected provider are shown.

#### 4.3.2 Payment Instructions (Business Default)

| Field | Input | Binding | Description |
|---|---|---|---|
| Payment Instructions | `<textarea rows={4}>` | `form.paymentInstructions` → `payment_provider_config.payment_instructions` | "Instructions shown to customers when paying invoices manually" |

**Behavior:**

- This serves as the **default** for all invoices. When creating a new invoice, `InvoiceWorkspace` populates `paymentInstructions` from `settings.default_payment_instructions` (`InvoiceWorkspace.tsx:400`).
- Per-invoice overrides take precedence (stored on the invoice row, not the business).
- The value is included in the invoice snapshot at finalize, ensuring immutability.

#### 4.3.3 Accepted Payment Methods

Currently a static list with non-functional checkboxes (`PaymentsSettings.tsx:148-163`). The specification requires this to be **data-driven**:

| Method | Key | Stored Setting |
|---|---|---|
| Credit / Debit Card | `card` | `payment_provider_config.accepted_methods` |
| Bank Transfer | `bank_transfer` | `payment_provider_config.accepted_methods` |
| ACH | `ach` | `payment_provider_config.accepted_methods` |
| PayPal | `paypal` | `payment_provider_config.accepted_methods` |
| Check | `check` | `payment_provider_config.accepted_methods` |
| Cash | `cash` | `payment_provider_config.accepted_methods` |

**Proposed redesign of this section:**

```
Accepted Payment Methods
┌─────────────────────────────────────────────────────────┐
│ Online (via payment provider)                           │
│ [x] Credit / Debit Card     [Visa] [Mastercard] [Amex] │
│ [x] Apple Pay / Google Pay  [Apple] [Google]           │
│ [ ] PayPal                                            │
│ [ ] ACH                                               │
│                                                       │
│ Offline (manual)                                      │
│ [x] Bank Transfer                                     │
│ [x] Check                                             │
│ [x] Cash                                            │
│                                                       │
│ [Save Changes]                                          │
└─────────────────────────────────────────────────────────┘
```

| Property | Specification |
|---|---|
| **Group labels** | "Online (via payment provider)" in `text-xs font-semibold text-tertiary uppercase` |
| **Method rows** | `flex items-center justify-between py-2 border-b border-color-subtle` |
| **Checkbox** | Stateful `checked` + `onChange` bound to `form.acceptedMethods` array |
| **Method icon** | Small payment brand icon (Visa, Mastercard, etc.) next to label |
| **Disabled methods** | Dimmed with `opacity-50 cursor-not-allowed` when online payment is disabled |
| **Toggle: Online Payments** | Master switch at the top: "Enable online payments" — when off, all online method checkboxes are disabled |

#### 4.3.4 Automation Settings

| Field | Input | Binding | Description |
|---|---|---|---|
| Enable Automated Reminders | Checkbox | `form.remindersEnabled` → `business_settings.reminders_enabled` | "Send automated payment reminders to customers who haven't paid." |
| Overdue Reminder Days | `<input type="number" min="1" max="120">` | `form.overdueReminderDays` → `business_settings.overdue_reminder_days` | "Days after the due date to send the first overdue reminder." |

**Note:** The granular reminder sequence configuration (before-due and after-due rules) currently lives in `ReminderAutomation.tsx` (`webapp/src/pages/ReminderAutomation.tsx`), accessed via a separate route. The `PaymentsSettings` component only has the high-level toggle + days. The detailed configuration should ideally be linked or inlined here.

### 4.4 Invoice Detail: Payment Recording (Post-Finalization)

When viewing a finalized invoice in `InvoiceDetail.tsx`, the editor can record payments manually:

| Control | Location | Binding | Notes |
|---|---|---|---|
| **Record Payment** button | `InvoiceDetail.tsx:277` | `setShowPayDialog(true)` | Only shown when `!isFullyPaid && amountDue > 0 && status !== 'draft' && status !== 'cancelled' && status !== 'void'` |
| **Record Deposit** button | `InvoiceDetail.tsx:301` | `setShowDepositDialog(true)` | Only shown when `hasDeposit && depositDue > 0 && status not in [draft, cancelled, void]` |

#### 4.4.1 PaymentDialog Component

| Property | Specification |
|---|---|
| **Container** | `fixed inset-0 bg-black/40 flex items-center justify-center z-50` (modal overlay) |
| **Card** | `bg-surface rounded-xl shadow-xl w-full max-w-md` |
| **Header** | `p-6 border-b border-color-subtle` with title "Record Payment" |
| **Amount label** | "Amount due: {formatCurrency(amountDue, currency)}" in `text-sm text-secondary` |
| **Amount input** | `<input type="number" step="0.01">` bound to `payAmount` |
| **Quick-fill** | "Pay full amount ({formatCurrency(amountDue)})" link below input |
| **Stripe flow** | If `paymentIntent.provider === "stripe"` and has `clientSecret`, renders `<StripePaymentElement>` instead of amount input |
| **Stub flow** | "Pay with Card" button → creates payment intent → if not Stripe, falls back to "Complete Stub Payment" button |
| **Footer** | `p-6 border-t border-color-subtle flex justify-end gap-3` with Cancel + Confirm buttons |

#### 4.4.2 Payment History Table

Located at `InvoiceDetail.tsx:363`:

| Column | Content | Style |
|---|---|---|
| Date | `formatDate(p.paid_at)` or `formatDate(p.created_at)` | `text-sm text-secondary` |
| Amount | `formatCurrency(p.amount, p.currency)` | `text-sm font-medium text-primary` |
| Method | `p.method || p.provider` | `text-sm text-secondary` |
| Status | `<PaymentStatus status={p.status} showIcon />` | Centered |

| Property | Specification |
|---|---|
| Container | `bg-surface rounded-xl border border-color-subtle p-5` |
| Title | "Payment History" in `text-lg font-semibold text-primary` |
| Empty state | `text-sm text-secondary` — "No payments recorded yet." |
| Table | `w-full` with `text-left text-xs font-medium text-secondary uppercase` headers |

### 4.5 Configuration State Transitions

The payment configuration has three lifecycle stages:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   DRAFT     │    │  FINALIZED  │    │    PAID     │
│ (Editable)  │───▶│ (Frozen)    │───▶│(Terminal)   │
└─────────────┘    └─────────────┘    └─────────────┘
  │                    │                  │
  │ • Total          │ • Read-only      │ • Immutable
  │ • Amount Paid    │ • Snapshot       │ • Receipts
  │ • Due Date       │ • Payments via    │ • No edits
  │ • Terms          │   dialog only    │
  │ • Instructions   │ • Status badges  │
  │ • Methods        │ • Payment history│
  │ • Automation     │                  │
  └─ Autosave         └─ Locked fields   └─ Terminal
```

| Stage | Editor Access | Customer Access | Payment Recording |
|---|---|---|---|
| Draft | Full configuration | N/A (not sent) | Via "Amount Paid" field in editor |
| Finalized | Read-only view + payment recording dialog | Full payment execution via `/invoice/:token` | Via "Record Payment" button |
| Paid | Read-only + receipt generation | "Fully Paid" confirmation | N/A |

---

## 5. Cross-Perspective Information Architecture

### 5.1 Data Sources → Customer View Mapping

| Customer View Element | Source Field | Source Location |
|---|---|---|
| Total amount | `invoice.total` | Backend-calculated, stored on invoice |
| Amount paid | `invoice.amount_paid` | Backend-maintained on payment recording |
| Amount due | `invoice.amount_due` | Backend-calculated (`total - amount_paid`) |
| Due date | `invoice.due_date` | Editor `CustomerHeaderSection` date picker |
| Payment status | `invoice.status` | State machine derived (`src/services/state-machine/invoice-state-machine.ts`) |
| Payment instructions | `invoice.payment_instructions` | Editor `NotesSection` textarea / business default |
| Accepted methods | `business_settings.payment_provider` + `payment_provider_config.accepted_methods` | Settings → Payments |
| Currency | `invoice.currency` | Editor `CustomerHeaderSection` currency select |
| Invoice number | `invoice.invoice_number` | Auto-generated on finalize via `invoiceNumberService.generate()` |

### 5.2 Data Sources → Editor Dashboard Mapping

| Editor Setting | API Endpoint | DB Column/Table |
|---|---|---|
| Payment provider | `PATCH /businesses/current/settings` | `business_settings.payment_provider` |
| Payment instructions | `PATCH /businesses/current/settings` | `business_settings.payment_provider_config.payment_instructions` |
| Accepted methods | `PATCH /businesses/current/settings` | `business_settings.payment_provider_config.accepted_methods` |
| Online payment toggle | `PATCH /businesses/current/settings` | `business_settings.payment_provider_config.online_payments_enabled` |
| Reminders enabled | `PATCH /businesses/current/settings` | `business_settings.reminders_enabled` |
| Overdue reminder days | `PATCH /businesses/current/settings` | `business_settings.overdue_reminder_days` |
| Invoice-level amount paid | `PATCH /invoices/:id` (via `updateInvoice`) | `invoices.amount_paid` |
| Invoice-level terms | `PATCH /invoices/:id` (via `updateInvoice`) | `invoices.terms` |
| Invoice-level payment instructions | `PATCH /invoices/:id` (via `updateInvoice`) | `invoices.payment_instructions` |
| Deposit type/value/date | `PATCH /invoices/:id` (via `updateInvoice`) | `invoices.deposit_type`, `invoices.deposit_value`, etc. |
| Payment terms | `PATCH /invoices/:id` (via `updateInvoice`) | `invoices.terms` (free text field) |

### 5.3 Payment Events Flow

```
Customer Action (PublicInvoice.tsx)
        │
        ├── Create Payment Intent
        │   → POST /public/invoices/{token}/payment-intent
        │   → InvoiceService.createPaymentIntent()
        │   → Stripe API or stub
        │   → INSERT INTO payment_intents
        │   ← client_secret or provider
        │
        ├── Confirm Payment
        │   (Stripe) → stripe.confirmPayment()
        │             → Stripe webhook → InvoicePaymentService.reconcileStripeEvent()
        │   (Stub)   → POST /public/invoices/{token}/pay
        │             → InvoiceService.recordPublicPayment()
        │             → INSERT INTO payments (idempotent)
        │             → UPDATE invoices SET amount_paid, amount_due
        │             → State transition via statusAfterPayment()
        │             → Record event
        │
        └── Status Update
            InvoiceDetail.tsx auto-refreshes on dialog close
            PublicInvoice.tsx updates UI optimistically
```

---

## 6. User Flows

### Flow 1: Customer — Pay a Fully Unpaid Invoice

```
1. Customer receives email with link → /invoice/{token}
2. PublicInvoice component loads
3. Invoice data fetched from GET /public/invoices/{token}
4. UI renders:
   a. Invoice HTML (from snapshot)
   b. Payment Status Header: "$1,200.00 — Amount Due, Due: Sep 26, [Unpaid]"
   c. [Pay $1,200.00 Now] button (prominent)
   d. (Below fold) Accepted methods list
   e. (Below fold) Payment instructions
5. Customer clicks "Pay $1,200.00 Now"
6. Amount input + payment method form appears
7. Customer selects payment method (e.g., Card)
8. Stripe Elements mount (or stub confirmation)
9. Customer enters payment details
10. Clicks "Confirm Pay $1,200.00"
11. On success: green "Payment Successful!" banner, balance updates to $0
12. Page shows "Fully Paid" confirmation section
```

### Flow 2: Customer — Pay Partially (Custom Amount)

```
1. Customer navigates to /invoice/{token}
2. UI shows: "$600.00 — Amount Due, [Partially Paid]"
3. Customer clicks "Pay $600.00 Now"
4. Amount input appears, pre-filled with $600.00
5. Customer changes amount to $200.00
6. "Pay full amount ($600.00)" and "Cancel" links available
7. Customer clicks "Confirm Pay $200.00"
8. On success: banner shows "$200.00 payment received"
9. Balance updates to $400.00
10. Status remains or transitions to "Partially Paid"
```

### Flow 3: Customer — Deposit-Required Invoice

```
1. Customer navigates to /invoice/{token}
2. Deposit Required banner appears at top (amber background)
   - "Deposit Required: 25% deposit due by Sep 20, 2026"
   - Two value cards: "Deposit Due: $300.00" / "Deposit Paid: $0.00"
   - [Pay Deposit Now] button
3. Below deposit banner: main payment card with remaining balance
   - "$900.00 — Amount Due"
   - [Pay $900.00 Now] button
4. Customer clicks "Pay Deposit Now"
   - Sets payAmount = depositDue ($300.00)
   - Shows "Pay Deposit Now" section
   - Payment method form appears
5. Customer pays deposit
6. On success: deposit section collapses, main payment card updates
   - "Deposit Paid: $300.00"
   - Amount Due: $900.00 (unchanged, deposit was separate)
```

### Flow 4: Editor — Configure Payment Terms Before Sending

```
1. Editor opens InvoiceWorkspace at /app/invoices/{id}/edit
2. In TotalsCard:
   - Sees "Amount paid" input (editable, default: 0)
   - Sees "Balance due" calculated live
3. In NotesSection:
   - "Payment instructions" textarea (populated from business default)
   - "Terms" textarea (default: "Net 30")
4. Editor clicks "Payment Terms & Deposits" expander (proposed):
   - Sets deposit: "Fixed" → $200.00, due date = Sep 20
   - Sets payment terms: "Net 15" from dropdown
   - Enables "Late payment penalty": 1.5% per month
   - Enables "Allow partial payments"
5. Editor clicks "Review & Send"
6. ReviewAndSendDialog shows:
   - Payment terms summary
   - Deposit summary (if applicable)
   - Payment instructions preview
7. Editor clicks "Finalize & send by email"
8. Backend: finalize() assigns number, creates snapshot (freezes all payment config)
9. Backend: send() emails to customer with payment link
```

### Flow 5: Editor — Record a Manual Payment

```
1. Editor opens InvoiceDetail at /app/invoices/{id}
2. Invoice status: "sent", amount_due: $1,200.00
3. Editor clicks "Record Payment" button
4. PaymentDialog opens:
   - "Amount due: $1,200.00" header
   - Amount input (pre-filled with $1,200.00)
   - "Pay full amount" link
   - "Pay with Card" button (creates Stripe intent if configured)
   - "Complete Stub Payment" (test mode fallback)
5. Editor selects "Complete Stub Payment" (test mode)
6. Payment recorded:
   - INSERT INTO payments (idempotent)
   - UPDATE invoices SET amount_paid += X, amount_due -= X
   - State transition: sent → paid (via statusAfterPayment)
   - Record event: "paid"
7. Dialog closes, InvoiceDetail refreshes
8. UI shows:
   - "Payment recorded successfully!" toast
   - Status badge: "Paid" (green)
   - Payment history table: new entry
   - "Generate Receipt" button now visible
```

### Flow 6: Editor — Configure Business Payment Settings

```
1. Editor navigates to /app/settings/payments
2. PaymentsSettings component loads:
   a. Fetches business settings via GET /businesses/current/settings
   b. Maps fields to form state:
      - payment_provider → form.paymentProvider
      - payment_provider_config.payment_instructions → form.paymentInstructions
      - reminders_enabled → form.remindersEnabled
      - overdue_reminder_days → form.overdueReminderDays
3. Editor configures:
   - Payment Provider: "Built-in (Test Mode)" (only functional option)
   - Payment Instructions: "Bank: 1234 5678 90\nAccount: 987654321\nRef: {invoice_number}"
   - Accepted Methods: toggles for Card, Bank Transfer, Check, Cash
   - Enable Automated Reminders: checked
   - Overdue Reminder Days: 7
4. Editor clicks "Save Payment Settings"
5. PATCH /businesses/current/settings with:
   {
     payment_provider: "stub",
     payment_provider_config: { payment_instructions: "...", accepted_methods: [...] },
     reminders_enabled: true,
     overdue_reminder_days: 7
   }
6. "Saved" indicator shows briefly (green checkmark)
7. Changes apply to all future invoices
```

---

## 7. Data Model Alignment

### 7.1 Existing Schema

The payment system leverages these existing database structures:

**payments table** (`docs/invoice-creation-specification.md` §2.2):

```sql
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id),
  business_id     UUID NOT NULL,
  amount          NUMERIC(18,6) NOT NULL,
  provider        VARCHAR(50) NOT NULL,
  provider_payment_id VARCHAR(255),
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,  -- Idempotency guard
  payment_method  VARCHAR(50),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**business_settings table** (extension from migration `011_invoice_reminders_and_payments.sql`):

```sql
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50) DEFAULT 'stub',
  ADD COLUMN IF NOT EXISTS payment_provider_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS overdue_reminder_days INTEGER NOT NULL DEFAULT 7;
```

**invoice_reminder_rules table** (for automation):

```sql
CREATE TABLE IF NOT EXISTS invoice_reminder_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  trigger_type    VARCHAR(20) NOT NULL CHECK (trigger_type IN ('before_due', 'after_due', 'manual')),
  offset_days     INTEGER NOT NULL DEFAULT 0,
  min_status      VARCHAR(20) NOT NULL DEFAULT 'sent',
  max_send_count  INTEGER NOT NULL DEFAULT 3,
  subject_template VARCHAR(500) NOT NULL DEFAULT '...',
  message_template TEXT NOT NULL DEFAULT '...',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 7.2 Invoice Data Model (Frontend)

The `ApiInvoice` interface (`webapp/src/types/api.ts:147`) contains all fields the customer view and editor need:

| Field | Type | Customer View | Editor View |
|---|---|---|---|
| `id` | string | Internal | Reference |
| `invoice_number` | string? | Display as title | Display |
| `status` | string | Primary status badge | Primary status badge |
| `due_date` | string? | Display next to amount | Date picker in header |
| `currency` | string | Currency context for amounts | Currency selector |
| `total` | string | Display total | Read-only in TotalsCard |
| `amount_paid` | string | Compute remaining | Editable input |
| `amount_due` | string | **Primary display** | Read-only calculated |
| `payment_instructions` | string? | **Display instructions** | Editable textarea |
| `notes` | string? | Display | Editable textarea |
| `terms` | string? | Rendered in template | Editable textarea |
| `deposit_type` | enum? | Deposit banner | (Not currently exposed) |
| `deposit_value` | string? | Deposit calculation | (Not currently exposed) |
| `deposit_due_date` | string? | Deposit deadline | (Not currently exposed) |
| `deposit_paid` | string? | Deposit tracking | (Not currently exposed) |
| `deposit_due` | string? | Deposit calculation | (Not currently exposed) |
| `public_token` | string? | URL routing | Internal use |

---

## 8. Accessibility & Responsiveness

### 8.1 Accessibility (a11y)

All payment UI components must meet WCAG 2.1 AA standards:

| Component | a11y Requirement | Implementation |
|---|---|---|
| Pay Now button | `aria-label` with amount | `Pay ${amount} now` |
| Status badge | `aria-label` with description | `"Paid — Invoice has been fully paid."` (from `InvoiceStatus.tsx:69`) |
| Payment form | `aria-live` for errors | Error text in `status-error-text` with `aria-live="polite"` |
| Amount input | `inputMode="decimal"` | Mobile numeric keyboard |
| Stripe Element | Standard Stripe a11y | Library handles |
| Focus management | `focus:ring-2 focus:ring-primary` | Applied to all interactive elements |

### 8.2 Responsive Design

| Breakpoint | Payment View | Editor Configuration |
|---|---|---|
| **Mobile (< 640px)** | Single column; Pay button full-width; payment form stacks vertically | Editor switches to "Preview" toggle mode instead of split-screen |
| **Tablet (640–1024px)** | Two-column grid for status/amount; Pay button auto-width | Split-screen with 50/50 preview |
| **Desktop (≥ 1024px)** | Two-column: amount info (left) + Pay button (right); max-width 4xl | Three-column: editor / resize handle / preview (default ~560px preview width) |

**Container constraints:**

- Customer view: `max-w-4xl mx-auto` (from `PublicInvoice.tsx:246`)
- Payment card: `bg-surface rounded-xl border border-color-subtle shadow-sm`
- Editor panels: `flex flex-1 overflow-hidden` with resizable preview

---

*End of Specification*
