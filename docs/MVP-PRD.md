# MVP Product Requirements Document (PRD)
## Universal Invoice Generator — Tradesperson Edition

| Field | Value |
|---|---|
| **Product** | Universal Invoice Generator (Tradesperson SKU) |
| **Target Price** | **$30/month** (single-tier, no free/freemium fragmentation) |
| **Mission** | Minimize administrative friction for blue-collar tradespeople — "getting paid faster with less effort" |
| **Core Value Prop** | High-velocity, mobile-first invoicing that turns a completed job into a paid invoice and a paid invoice into a banked deposit with near-zero friction |
| **Status** | MVP — Phase 1 scope (see §5) |
| **Stack** | Backend: Express + TypeScript + PostgreSQL (`src/`); Frontend: React 18 + Vite + TS + Tailwind (`webapp/src/`) |
| **Money Engine** | `decimal.js` — integer minor-unit math, never float |
| **Key invariant** | Backend is authoritative for all calculations (`src/domain/calculation.ts`); finalized invoices are immutable (`src/services/snapshot/`) |

---

## 0. Executive Summary

This PRD defines the **MVP** for a **$30/month** invoicing SaaS purpose-built for blue-collar tradespeople (plumbers, electricians, HVAC techs, roofers, carpenters, landscapers, mechanics). The product is a **single paid tier** — no free tier, no usage caps on invoices/customers — so the price is unambiguous and the workflow is unconstrained by artificial limits.

The scope is intentionally narrow: **invoice creation → send → get paid**, plus the minimum customer, catalog, and automation tooling required to make that loop fast. Accounting, payroll, inventory, scheduling, and CRM are explicitly out of scope (§4). The existing codebase already implements the core foundation (state machine, calculation engine, snapshot service, PDF service, Stripe payment service, email service, structured document editor, templates, projects, products catalog); this document re-roles that foundation for the $30 Tradesperson SKU, marks what is **DONE** vs **NEW**, and prioritizes the remaining work.

**Success metrics (MVP):** Invoice-to-payment cycle < 3 days median; 60% of invoices paid within 24h of send; invoice creation time ≤ 60 seconds from a saved service library; 75% of sends originate from a mobile device.

---

## 1. Core User Personas

### 1.1 Primary User: The Tradesperson / Business Owner

| Attribute | Detail |
|---|---|
| **Name (archetype)** | Marcus — Master Plumber, single-truck operator |
| **Business** | Solo proprietor or 2–10 employee crew; one "business identity" |
| **Tech comfort** | Smartphone-first; laptop only at month-end for taxes |
| **Hours** | On-site or in the van; billing happens **in the field** right after a job closes |
| **Goals** | (1) Close a job and bill the customer within 5 minutes; (2) Get paid within 24–48 hours; (3) Know exactly how much cash is coming in and when |
| **Pain points** | Slow desktop-only invoicing apps; manual re-entry of job details; lost paperwork; checks in the mail taking a week; chasing customers for payment; unclear what's owed vs. paid |
| **Interaction method** | iPhone/Android, one thumb, sometimes greasy gloves; intermittent signal on job sites; hates typing long descriptions |
| **Key quote** | *"I fix sinks, not spreadsheets. Just let me bill 'em and get paid."* |

**Jobs-to-be-Done:**
1. "When I finish a job, I want to whip out my phone, tap a customer, tap a saved service, and hit send — in under a minute."
2. "I want to see, on one screen, exactly how much money is sitting out there uncollected and how much just landed."
3. "I want the customer to pay me with a tap and have the money move toward my bank without me lifting a finger."

### 1.2 Secondary User: The End Customer (Receiving the Invoice)

| Attribute | Detail |
|---|---|
| **Name (archetype)** | Dana — Homeowner who just had her sink repaired |
| **Relationship** | One-off or repeat customer of the tradesperson |
| **Tech comfort** | Smartphone-native; pays with Apple Pay / Google Pay / card |
| **Goals** | Pay quickly and correctly; have a record of what she paid for; dispute only if clearly wrong |
| **Pain points** | Confusing invoices with jargon; being asked to write a check and mail it; no way to pay online or pay a deposit upfront |
| **Interaction method** | Mobile web link delivered via SMS or email; one screen to view, one tap to pay |
| **Key quote** | *"Just send me the link, let me pay with my phone, and email me the receipt."* |

**Jobs-to-be-Done:**
1. "Open a link, see what I owe in plain English, and pay with one tap — no account, no login."
2. "Get a PDF receipt in my email immediately so I can throw it in my 'home projects' folder."

### 1.3 Personas — Alignment to Codebase

| Persona need | Where it maps today |
|---|---|
| Smartphone-first invoice creation | `webapp/src/document-model/editor/` (dnd-kit drag editor) — **needs mobile refinement** |
| Thumb-friendly "tap customer → tap service → send" | `webapp/src/components/CustomerSelector.tsx`, catalog picker — **needs simplified mobile flow** |
| Instant calculation feedback | `webapp/src/utils/calculation.ts` mirrors backend `src/domain/calculation.ts:95` — **DONE** |
| One-tap pay for customers | `public/invoices/:token` (no-auth route) + `src/services/payments/stripe.ts` — **DONE** (stub provider) |
| Clear cash-in/cash-out dashboard | `GET /api/dashboard` — **needs cash-flow refocus per §2.5** |

---

## 2. Functional Requirements

### 2.1 High-Performance Invoice Builder

**Status: DONE (backend) / NEW polish for tradesperson workflow**

The builder is a split-screen editor (desktop) / stacked card editor (mobile) backed by a **structured document model** (`webapp/src/document-model/`, `InvoiceDocument` type) that compiles to both live HTML preview and server-rendered PDF/HTML. All monetary math is computed by the backend `CalculationEngine` (`src/domain/calculation.ts`) and mirrored client-side (`webapp/src/utils/calculation.ts`) for zero-latency feedback; the backend is authoritative on finalize.

| Requirement | Spec | Source |
|---|---|---|
| **FR-2.1.1 Live preview** | Real-time dual-pane: editor (left) + live HTML preview (right) on desktop; toggle-to-preview on mobile. Preview updates on every keystroke/change with ≤ 100ms latency. | `DocumentPreview.tsx`, `renderer.tsx` |
| **FR-2.1.2 Real-time subtotals** | As items are added/edited, recompute line totals, subtotal, discounts — instantly. Zero-value invoices default to empty (no crash). | `calculation.ts:95`, `webapp/src/utils/calculation.ts` |
| **FR-2.1.3 Taxes** | Per-line and invoice-level tax, both **tax-exclusive** and **tax-inclusive** extraction. Currency-aware rounding (`getCurrencyMetadata`). Default tax drawn from `business_settings` + line-item overrides supported. | `src/domain/calculation.ts:45-247`, `src/services/tax/tax-service.ts` |
| **FR-2.1.4 Discounts** | Line-level discount (fixed or %) capped at line subtotal; invoice-level discount distributed **proportionally** across lines. | `calculation.ts:11-29` (`discountAmount`), two-pass engine |
| **FR-2.1.5 Deposits** | Optional deposit as % or fixed amount. `depositType: none|fixed|percentage`, `depositDueDate`, `depositPaymentPurpose`. Deposit is a separate tracked amount that reduces amount-due and has its own reminder cadence. | Invoice model fields `deposit_amount`, `deposit_type`, `deposit_due_date` (migration `013`); validated in `invoice-service.ts` |
| **FR-2.1.6 Fees** | Line-item-style fees (description, amount, optional tax). Rendered separately. | `invoice_fees` table, `FeeInput` interface |
| **FR-2.1.7 Branding — Logo** | Upload/store business logo (`business.logo_url`). Toggle visibility via `businessInfo` component prop. | Template `document.settings`, `businessInfo.props.showLogo` |
| **FR-2.1.8 Branding — Colors & Fonts** | Primary color (hex), font family (System UI / Serif / Monospace / Helvetica / TNR), font size (8–24px), page size (A4/Letter/Legal), orientation, margins. All driven by document `settings`. | §3 of `docs/templates-functional-specification.md`, `document.settings` |
| **FR-2.1.9 Component palette** | 24+ drag-drop component types (businessInfo, customerInfo, invoiceNumber, date, lineItems, subtotal, tax, discount, fees, total, amountDue, paymentTerms, notes, terms, paymentInstructions, signature, customField, text, image, logo, spacer, divider). | `registerAllComponents()`./components.tsx` |
| **FR-2.1.10 Validation gate** | "Finalize & Send" is gated on `InvoiceValidationService.validate()` (errors block; warnings surface). Client mirrors via `useInvoiceValidation.ts`. | `src/services/validation/invoice-validation.ts`, `webapp/src/hooks/useInvoiceValidation.ts` |
| **FR-2.1.11 Offline-capable draft** | Drafts auto-save (2s debounce) and persist to backend; mobile can queue edits for later sync. | `EditorContext.tsx` autosave, `createDraft`/`updateDraft` API |

### 2.2 Lightweight Customer Management

**Status: DONE**

A flat, tenant-scoped customer database (`customers` table, migration `002`) scoped to `business_id`. No CRM fields (no notes pipeline, no lead staging, no activity scoring). One-click from customer → new invoice.

| Requirement | Spec | Source |
|---|---|---|
| **FR-2.2.1 Contact info** | Name (req), email, phone, company, address (multi-line), website. | `src/db/migrations/002_customers.sql` |
| **FR-2.2.2 Invoice history** | Link from customer card to all invoices (filter by status). | `GET /api/invoices?customerId=` |
| **FR-2.2.3 Outstanding balances** | Roll-up: total outstanding, overdue, last paid date, last invoice date. | Computed from invoice totals; surfaced on customer list + detail |
| **FR-2.2.4 Creation on-the-fly** | From the invoice editor's new-customer flow (inline mini-form captures name + phone + email; full details editable later). | `CustomerSelector.tsx` |
| **FR-2.2.5 Mobile tap target** | Customer name acts as a tappable chip; tap → quick view (balance + last invoice) or edit. | — (NEW: customer quick-view drawer) |
| **FR-2.2.6 Tenant isolation** | Every query filtered by `business_id` (`requireAuth` middleware sets `req.user.businessId`). | `src/middleware/auth.ts:13` |

### 2.3 Automated Payment Lifecycle

**Status: DONE (state machine + Stripe provider stub) — NEW: reminder automation wiring**

Invoices progress through a fixed state machine enforced server-side. Transitions trigger emails, reminder cadence, and (on paid) receipts. Online payment is a no-login, mobile-optimized web flow.

| Requirement | Spec | Source |
|---|---|---|
| **FR-2.3.1 Status tracking** | `draft → sent → viewed → partially_paid → paid` / `sent/sent → overdue`; `cancelled`, `void` as manual terminal states. Derived `overdue` triggered by `determineOverdue()` when `dueDate` passed + balance > 0. | `invoice-state-machine.ts:16-25`, `ALLOWED_TRANSITIONS` |
| **FR-2.3.2 Status invariants** | `draft` cannot be paid; `paid` is terminal (cannot be voided from `paid` → only `voidable` statuses); `overdue` re-evaluates daily. | `CANCELLABLE/VOIDABLE/TERMINAL` arrays |
| **FR-2.3.3 Automated reminders** | Configurable cadence (default: due-date + 3d + 7d + 14d) for `sent/viewed/partially_paid` open invoices. Gated by `reminders.automated` entitlement (Pro). MVP wires the cron stub to `sendReminder()`. | `reminders.automated` feature flag; `POST /invoices/:id/send-reminder` |
| **FR-2.3.4 Reminder content** | Plain-language SMS/email: "Marcus did the work on Sep 12. $420 is due. Pay in one tap: <link>." Tone = friendly-pro, never legal-threat. | `email-service.ts`; NEW: SMS template variant |
| **FR-2.3.5 Online payment (customer side)** | Public no-auth payment page (`GET public/invoices/:token`) — view invoice, tap pay, Apple/Google Pay + card. 30-day token expiry, rotates on each send. | `public/invoices/:token` route, `src/services/payments/stripe.ts` |
| **FR-2.3.6 Payment idempotency** | Every payment record has a unique `idempotency_key`; duplicate Stripe events are deduped. | `payments` table (`005`) + `idempotency_key` unique constraint |
| **FR-2.3.7 Payment success → receipt** | On `paid`/`partially_paid`, generate PDF receipt + email it automatically. | `recordPayment()` in `invoice-service.ts` + snapshot-rendered receipt |
| **FR-2.3.8 Partial payments** | Allowed; status → `partially_paid`, balance tracked via `amount_due`. | `statusAfterPayment()` logic |
| **FR-2.3.9 Refunds / credits** | **OUT OF SCOPE for MVP** (reserved for Business tier). | §4 |

### 2.4 Efficiency & Speed Tools

**Status: DONE (catalog, duplicate, recurring) / NEW: saved-service quick-add**

| Requirement | Spec | Source |
|---|---|---|
| **FR-2.4.1 Saved service library** | Persist "services" (from `products` table, type=service) with name, description, default price, unit (each/hour/day), default tax rate, unit cost (internal). Tradesperson-specific presets seeded per industry (e.g., "Drain Snaking — $250"). | `products` table; `ProductServiceService`; catalog spec docs/projects-and-services-spec.md |
| **FR-2.4.2 Quick-add from library** | In the line-item editor, a "services" tab shows the saved library as tappable chips; one tap adds a line with defaults pre-filled. Search + recent-used ordering. | `CatalogPicker.tsx`; NEW: mobile chip layout |
| **FR-2.4.3 One-click duplication** | "Duplicate" copies customer, items, terms, template; resets number/date to today. Gated `invoices.duplicate` (Pro). MVP: ungated for the $30 SKU. | `POST /invoices/:id/duplicate` |
| **FR-2.4.4 Recurring invoicing** | Saved schedule (weekly/bi-weekly/monthly/custom) with start + optional end. Generates draft invoice on schedule via stub scheduler; sends via cron. Gated `invoices.recurring` (Pro). MVP: included in $30 tier. | `recurring_invoices` table (`006`/`013`); `recurring-invoice-service` (planned) |
| **FR-2.4.5 "Bill last job" shortcut** | On dashboard, a prominent "+ New Invoice" pre-fills from the most-recent paid invoice (customer + last 3 services). | NEW: dashboard CTA wiring |

### 2.5 Cash-Flow-Focused Dashboard

**Status: DONE (summary endpoint) — NEW: visual refocus on cash flow**

The dashboard is a **single-page cash command center**: "Money out there" + "Money landed" + "Next few days." No revenue trend charts, no tax summaries, no profit/loss (those are Business-tier reports, §4).

| Requirement | Spec | Source |
|---|---|---|
| **FR-2.5.1 Total Outstanding** | Sum of `amount_due` across `sent/viewed/partially_paid/overdue` (excluding draft). Large KPI. | `GET /api/dashboard` |
| **FR-2.5.2 Overdue** | Sum + count of invoices past due. Red highlight, primary nav badge count. | `determineOverdue()` |
| **FR-2.5.3 Paid (this week / MTD)** | Running total of payments received, toggle weekly/monthly. | Dashboard summary |
| **FR-2.5.4 Upcoming** | Next 7 days of due dates (invoices + scheduled recurring). | Dashboard "upcoming" section |
| **FR-2.5.5 Quick actions** | "+ New Invoice", "+ Record Payment" (manual cash/check entry), "Send Reminder" (on selected overdue). | Dashboard CTAs |
| **FR-2.5.6 Recent activity feed** | Chronological stream: invoice created/sent/viewed/paid, reminder sent, payment received. Icons per event type. | `invoice_events` table |
| **FR-2.5.7 Mobile-first layout** | Single KPI hero on mobile; swipeable sections. Desktop: 3-col KPI + feed + upcoming. | `docs/ui-ux-specification.md` §3 (refocused) |

---

## 3. Technical Specifications

### 3.1 Responsive Design Strategy

**Philosophy:** *Mobile is the primary form factor; desktop is the power-user refinement tool.* The same codebase must serve both without two implementations.

| Concern | Mobile (field) | Desktop (office) | Architecture decision |
|---|---|---|---|
| **Editor layout** | Stacked: editor on top, "Preview" toggle below. Minimal fields visible, expandable. | Split-screen: 3-panel (palette / canvas / inspector) with live preview pinned right. | `DocumentEditor.tsx` uses `dnd-kit` + Tailwind responsive breakpoints (`md`); `previewMode` toggle for mobile |
| **Navigation** | Bottom tab bar: Dashboard, Invoices, Customers, + FAB "New". Collapsed sidebar drawer. | Persistent left sidebar (256px) + global top bar with "+ Create Invoice" CTA. | `App.tsx` router + responsive sidebar; NEW: bottom tab bar component |
| **Input** | Large touch targets (44px min), numeric keypad for amounts, voice-to-text for descriptions via `<textarea inputMode>` | Keyboard shortcuts (Alt+N new invoice, Ctrl+S save, Ctrl+Shift+F finalize), mouse drag-drop | `InvoiceEditor.tsx` keyboard handling (existing) + NEW mobile input optimizations |
| **Connectivity** | Intermittent/offline drafts queued, sync on reconnect. | Always-on assumed. | Service worker (NEW) + backend draft autosave (existing autosave) |
| **Performance** | First meaningful paint < 1s on 3G; preview recalc < 100ms. | Sub-50ms recalc; split-screen render parallelization. | `decimal.js` engine is synchronous & fast; React `useMemo` on totals |

**Breakpoint strategy** (aligned with existing Tailwind v4 config):

| Breakpoint | Width | Layout behavior |
|---|---|---|
| `sm` | ≥ 640px | Tablet portrait: 2-col KPIs |
| `md` | ≥ 768px | Tablet landscape: sidebar collapses to icons |
| `lg` | ≥ 1024px | Desktop: full 3-panel editor + persistent sidebar |
| `xl` | ≥ 1280px | Desktop: 4-col KPIs, wide tables |

### 3.2 Output & Delivery Requirements

#### 3.2.1 PDF Generation

| Requirement | Spec |
|---|---|
| Engine | Puppeteer-based `PdfService` abstraction (`src/services/pdf/pdf-service.ts`) — renders HTML from snapshot's `rendered_html` |
| Source of truth | PDF is generated from the **immutable snapshot** captured at finalize (`snapshotService`), so a finalized invoice always renders the same PDF even if the template changes later |
| Fidelity | Print-grade HTML/CSS: @page margins, embedded fonts, vector logo, proper decimal alignment, page breaks per line-item table |
| Async | Generated server-side; download is a streaming response to avoid buffering large files. Route: `POST /invoices/:id/pdf` |
| Filename | `{businessName}-{invoiceNumber}.pdf` |
| Versioning | Snapshot stores `template_revision` + `schema_version` used, for reproducible regeneration |

#### 3.2.2 Payment Links (web, mobile-optimized)

| Requirement | Spec |
|---|---|
| URL | `https://{public_base}/pay/{token}` — no login, no account, fully public |
| Auth | Optional (`optionalAuth` middleware); public token has 30-day TTL and rotates on each send |
| Mobile UI | Single-screen: invoice summary (plain language), total due, Apple Pay / Google Pay / card field. No nav, no chrome. |
| Deep link | SMS body: "You owe $420 for the sink repair. Tap to pay → {link}" |
| Provider | Stripe Checkout Session (default); stub provider in dev (`PAYMENT_PROVIDER=stub`) |
| Token security | `public_token` is a 32-char opaque token; `public_token_expires_at` enforced; invalidated on void/cancel |

#### 3.2.3 Delivery Channels

| Channel | Provider | Notes |
|---|---|---|
| Email (customer) | `nodemailer` stub (dev) / SMTP (prod) | HTML + text; PDF attached; tracking pixel for `viewed` transition |
| Email (tradesperson) | Same | Notifications: payment received, overdue reminder summary |
| SMS (customer) | Twilio (NEW for MVP) | Payment link only; plain text, < 160 chars |
| SMS (tradesperson) | Optional push | NEW for MVP: "Dana paid $420 — deposited to bank" |

**Delivery orchestration:** `emailService.sendInvoiceEmail()` renders HTML from the snapshot, attaches the PDF, and sends. The `viewed` event is recorded when the public link is visited (tracked via `optionalAuth` + `viewed_at` timestamp).

---

## 4. Out-of-Scope Definition (Strict MVP Boundary)

These capabilities are **explicitly excluded** from the $30/month Tradesperson SKU MVP to preserve a lightweight, high-velocity experience. They are reserved for future tiers or future phases.

| Excluded Feature | Why it's out of scope | Future home |
|---|---|---|
| **Bookkeeping / General ledger** | Tradespeople outsource taxes to an accountant; they don't want to be bookkeepers | Business tier / integration partner |
| **Payroll** | Out of scope entirely | Never in this product |
| **Inventory / Parts tracking** | Tradespeople track parts loosely; real inventory = ERP territory | Out of scope |
| **Scheduling / Dispatch / Route optimization** | Separate software category; would balloon complexity | Out of scope (possible standalone) |
| **Full CRM** | No lead pipeline, no opportunity stages, no email campaigns | Out of scope — customer = invoice recipient only |
| **Project & time tracking** | Tradespeople don't log time; they bill by job | Out of scope for this SKU (projects/time-tracking exist as internal modules but are NOT exposed) |
| **Multi-currency** | Trade locally in one currency | Out of scope (engine supports it, but UI hides it) |
| **Multiple tax rates / advanced tax** | Single default rate + line override only | Business tier (`tax.multiple_rates`, `tax.advanced`) |
| **Quotes / Estimates** | Bill for completed work, not proposals | Business tier (`quotes.create`) |
| **Credit notes / refunds** | Manual check/void only | Business tier (`credit_notes.create`) |
| **Receipts (beyond payment confirmations)** | Out of scope — receipt = payment confirmation email + PDF copy of invoice | Simplified only |
| **Profit & Loss / revenue analytics** | Cash-in / cash-out only, no profitability analysis | Business tier (`reports.profit_loss`, `reports.revenue`) |
| **Bulk import/export (CSV/Excel)** | Manual entry + service library is enough | Pro tier (`export.csv`) |
| **API / third-party integrations** | No Zapier, no QuickBooks sync, no API tokens | Business tier (`api.access`) |
| **Multi-user / team roles** | Solo operator or owner handles everything | Out of scope (team assignment is in projects module, not exposed) |
| **Custom invoice fields** | Standard fields only | Business tier (`invoices.custom_fields`) |
| **Custom document numbering** | Fixed `INV-YYYY-NNNNNN` format | Business tier (`documents.custom_numbering`) |
| **Advanced PDF customization** | Standard templates only | Business tier (`templates.advanced_pdf`) |

**Guardrail principle:** If a request surfaces a spreadsheet, an accounting term, a schedule, or a team-permission question, it is **out of scope** for this SKU.

---

## 5. Development Prioritization

### 5.1 MoSCoW Analysis

| Priority | Feature | Rationale | Existing code |
|---|---|---|---|
| **MUST** | Real-time invoice builder with subtotals/tax/discount/deposit | Core value — can't bill without it | `calculation.ts` (backend) + `webapp/utils/calculation.ts` (frontend mirror) |
| **MUST** | Send via email + SMS payment link with one-tap pay | "Getting paid faster" — the whole point | `email-service.ts`, `public/invoices/:token`, Stripe provider stub |
| **MUST** | State machine: draft→sent→viewed→paid/overdue | Trustworthy status = no chasing | `invoice-state-machine.ts` |
| **MUST** | Atomic invoice numbering (no duplicates) | Professional correctness | `numbering/service.ts` (DB row lock) |
| **MUST** | Immutable snapshot on finalize | Integrity / dispute defense | `snapshot-service.ts` |
| **MUST** | Lightweight customer record | Can't invoice nobody | `customers` table, `CustomerSelector.tsx` |
| **MUST** | Saved service library (line-item catalog) | Cuts 90% of typing | `products` table, `ProductServiceService`, `CatalogPicker.tsx` |
| **MUST** | Cash-flow dashboard (outstanding / overdue / paid / upcoming) | "How much is coming in" | `GET /api/dashboard` |
| **SHOULD** | One-click duplication | Repeat jobs (weekly mowing) | `POST /invoices/:id/duplicate` |
| **SHOULD** | Recurring invoices | Subscription-style trades (HVAC maintenance) | `recurring_invoices` table |
| **SHOULD** | Automated payment reminders (cadence) | Cuts manual chasing | `sendReminder()` + `reminders.automated` flag |
| **SHOULD** | Branding: logo, colors, fonts | "Looks like my business" | Template `document.settings` |
| **COULD** | Industry-specific service presets (seeded) | Faster first-invoice | NEW: preset seed data per `industry` |
| **COULD** | Mobile bottom tab bar + FAB | Field-optimized nav | NEW component |
| **COULD** | SMS (Twilio) integration | Faster than email for reminders | NEW provider |
| **WON'T (this SKU)** | Payroll, bookkeeping, scheduling, CRM, quotes, multi-currency, multi-tax-rate, P&L reports | §4 | — |

### 5.2 Phased Roadmap (3 phases, 6 weeks MVP)

#### Phase 1 — Core Invoice Loop (Weeks 1–2) · MUST

**Goal:** A tradesperson can create, send, and get a customer to pay an invoice using a phone.

| Sprint | Deliverable | Backend | Frontend | QA |
|---|---|---|---|---|
| 1a | Build & send | `finalize()` (numbering + snapshot), `send()` (email + token rotation) | Invoice editor (mobile-stacked), live preview, customer selector, catalog picker | State machine transitions; snapshot immutability; duplicate numbering under concurrency |
| 1b | Get paid | Payment intent + `public/invoices/:token` (no auth), `recordPayment` (idempotent) | Payment page (Apple/Google Pay + card), receipt email | End-to-end: create → finalize → send → pay → receipt |

**Exit criteria:** Demo a complete paid invoice on a phone in < 5 min; no duplicate numbers under load test.

#### Phase 2 — Speed Tools (Weeks 3–4) · SHOULD

**Goal:** Cut invoice creation to < 60 seconds using saved data; automate chasing.

| Sprint | Deliverable | Backend | Frontend | QA |
|---|---|---|---|---|
| 2a | Saved services + duplication | Catalog CRUD hardened, `duplicate()` | Industry service presets (seeds), quick-add chip list, "duplicate" action | Preset import; duplicate fidelity; tax/discount edge cases |
| 2b | Recurring + reminders | Recurring scheduler stub, reminder cron wire-up | Recurring schedule UI, reminder-settings panel | Recurring generates correct draft; reminder cadence sends correct message |

**Exit criteria:** A repeat job (same customer + same 3 services) is invoiced in ≤ 4 taps. Reminders auto-send to an unpaid invoice.

#### Phase 3 — Cash-Flow Command Center (Weeks 5–6) · WILL

**Goal:** One dashboard screen shows everything about money in/out, mobile-first.

| Sprint | Deliverable | Backend | Frontend | QA |
|---|---|---|---|---|
| 3 | Dashboard + branding | Dashboard summary (outstanding / overdue / paid / upcoming) | Mobile dashboard (KPI hero + feed + upcoming), bottom tab bar, FAB, branding panel | Dashboard numbers match raw queries; mobile layout < 640px |

**Exit criteria:** Dashboard loads on a 3G phone in < 1s; all four KPIs are correct to the penny.

#### Phase 4 — Post-MVP (Future Tiers) · WON'T / COULD

Tracked but not built in MVP scope: SMS (Twilio), deep analytics, team accounts, API access, integrations (QuickBooks/Xero), estimates/quotes, multi-currency, advanced tax, profit & loss.

### 5.3 Key Architecture Decisions (for engineers)

1. **Backend-authoritative math.** The frontend `calculation.ts` is for UX responsiveness only. On finalize, `InvoiceService.finalize()` re-runs `CalculationEngine` and rejects discrepant totals with `VALIDATION_FAILED` (422). This invariant is non-negotiable.
2. **Immutability by snapshot.** After `finalize()`, the invoice row is frozen; all future reads of the PDF/email render from `invoice_snapshots.rendered_html`. No mutation path exists after `is_finalized = TRUE`.
3. **Atomic numbering via DB.** `NumberingService.generate()` uses `UPDATE ... WHERE business_id FOR UPDATE` (row lock) to guarantee uniqueness under concurrency. Format: `{prefix}-{YYYY}-{NNNNNN}` (e.g., `INV-2026-000001`), configurable per business.
4. **Tenant isolation everywhere.** Every query carries `business_id` from `req.user.businessId` (set by `requireAuth`). No query omits it.
5. **Pluggable providers.** Payments (`stripe` vs `stub`), PDF (Puppeteer vs future wkhtmltopdf), Email (SMTP vs stub) are all abstracted behind service interfaces — no vendor lock-in in the domain layer.

### 5.4 Success Definition & Metrics

| Metric | MVP Target | How measured |
|---|---|---|
| Invoice→payment median | < 3 days | Payment `created_at` − invoice `sent_at` |
| Pay within 24h (sent) | ≥ 60% | Payments where `paid_at` ≤ `sent_at` + 24h |
| Creation time (from library) | ≤ 60s | Stopwatch, median of 50 first-invoices |
| Mobile send share | ≥ 75% | User-agent parsing of `sent` events |
| Duplicate numbering | 0 | Load test: 100 concurrent finalizes |
| Snapshot integrity | 100% verifiable | `snapshotService.verify()` passes on 100% of finalized invoices |

---

*Document owner: Product. Last updated: 2026-09-18. Aligns with existing architecture in `src/` and `webapp/src/`; see `AGENTS.md` for build/run commands and `docs/` for detailed specs.*