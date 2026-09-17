# InvoiceFlow — Financial Command Center: UI/UX Specification

**Version:** 1.0  
**Date:** 2026-09-17  
**Status:** Draft  
**Aligned With:** React 18 + Tailwind CSS v4 + shadcn/ui design philosophy (Stripe/Linear aesthetic)

---

## Table of Contents

1. [Visual Language & Design System](#1-visual-language--design-system)
2. [Global Navigation & Layout](#2-global-navigation--layout)
3. [Dashboard Hierarchy & Information Architecture](#3-dashboard-hierarchy--information-architecture)
4. [Appendix: Component Specifications](#4-appendix-component-specifications)

---

## 1. Visual Language & Design System

### 1.1 Design Philosophy

The dashboard embraces a **"financial command center"** metaphor: every element is designed to reduce cognitive load, surface the most critical data first, and make actions unmistakable. We move away from spreadsheet aesthetics by using generous whitespace, subtle depth, and semantic color — inspired by Stripe Dashboard and Linear's product UI.

**Core principles:**

| Principle | Description |
|---|---|
| **Clarity over density** | Information is grouped into scannable modules, never crammed into grids. |
| **Hierarchy through whitespace** | Section spacing uses a 4px/8px scale; content breathes. |
| **Semantic color only** | Color conveys meaning (status, urgency), never decoration. |
| **Subtle depth** | Borders and shadows replace heavy visual weight. No gradients on UI surfaces. |
| **Progressive disclosure** | Detail is one click away; the surface stays clean. |

### 1.2 Color System

The existing `tailwind.config.js` palette is retained and extended with semantic aliases:

#### 1.2.1 Primary Palette (Brand)

| Token | Hex | Usage |
|---|---|---|
| `primary-50` | `#f0f9ff` | Hover/fill backgrounds for primary actions |
| `primary-100` | `#e0f2fe` | Active nav item background |
| `primary-500` | `#0ea5e9` | Primary button (hover state) |
| `primary-600` | `#0284c7` | **Primary button background, links, key CTAs** |
| `primary-700` | `#0369a1` | Primary button (active/pressed) |

#### 1.2.2 Neutral Palette (Slate)

| Token | Hex | Usage |
|---|---|---|
| `slate-50` | `#f8fafc` | Page background |
| `slate-100` | `#f1f5f9` | Card hover, table row hover |
| `slate-200` | `#e2e8f0` | **Borders, dividers, card borders** |
| `slate-300` | `#cbd5e1` | Input borders, secondary dividers |
| `slate-400` | `#94a3b8` | Placeholder text, disabled icons |
| `slate-500` | `#64748b` | Secondary text, labels |
| `slate-600` | `#475569` | Body text (default) |
| `slate-700` | `#334155` | Headings, emphasized body |
| `slate-800` | `#1e293b` | Page titles |
| `slate-900` | `#0f172a` | Highest emphasis text |

#### 1.2.3 Accent Palette

| Token | Hex | Usage |
|---|---|---|
| `accent-50` | `#fdf2f9` | Accent hover backgrounds |
| `accent-100` | `#fce7f3` | Accent badges, notifications |
| `accent-500` | `#ec4899` | Accent brand elements |
| `accent-600` | `#db2777` | Accent hover |

#### 1.2.4 Semantic Status Colors

These are used exclusively for data status indicators (badges, dots, alerts):

| Status | Background | Text | Dot/Pill | Meaning |
|---|---|---|---|---|
| **Paid** | `#dcfce7` (green-100) | `#166534` (green-800) | `#22c55e` | Transaction complete |
| **Overdue** | `#fee2e2` (red-100) | `#991b1b` (red-800) | `#ef4444` | Action required — urgent |
| **Sent** | `#dbeafe` (blue-100) | `#1e40af` (blue-800) | `#3b82f6` | Awaiting customer view |
| **Viewed** | `#e0e7ff` (indigo-100) | `#3730a3` (indigo-800) | `#6366f1` | Customer has seen it |
| **Draft** | `#f1f5f9` (slate-100) | `#334155` (slate-700) | `#94a3b8` | Not yet sent |
| **Partially Paid** | `#fef3c7` (amber-100) | `#92400e` (amber-800) | `#f59e0b` | Partial payment received |
| **Cancelled/VOID** | `#f1f5f9` (slate-100) | `#64748b` (slate-500) | `#cbd5e1` | Inactive |

### 1.3 Typography

| Element | Font Size | Weight | Line Height | Color |
|---|---|---|---|---|
| **Page Title** | 24px (text-2xl) | 700 (bold) | 1.2 | `slate-900` |
| **Section Title** | 18px (text-lg) | 600 (semibold) | 1.3 | `slate-900` |
| **Card Title** | 14px (text-sm) | 600 (semibold) | 1.4 | `slate-700` |
| **KPI Value** | 30px (text-3xl) | 700 (bold) | 1.1 | `slate-900` |
| **Body** | 14px (text-sm) | 400 (regular) | 1.5 | `slate-600` |
| **Caption/Label** | 12px (text-xs) | 500 (medium) | 1.4 | `slate-500` |
| **Table Header** | 12px (text-xs) | 500 (medium, uppercase) | 1.4 | `slate-500` |
| **Table Cell** | 14px (text-sm) | 400 (regular) | 1.4 | `slate-700` |

**Font stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

### 1.4 Spacing & Layout Grid

**Spacing scale (4px base):**

| Token | Value | Usage |
|---|---|---|
| `space-xs` | 4px | Icon-to-label gap |
| `space-sm` | 8px | Intra-card spacing |
| `space-md` | 16px | Card padding, section gap |
| `space-lg` | 24px | Module spacing |
| `space-xl` | 32px | Page section spacing |
| `space-2xl` | 48px | Major section breaks |
| `space-3xl` | 64px | Hero/page header spacing |

**Layout shell:**

```
┌──────────────────────────────────────────────────┐
│  Top Bar (h-16 / 64px)                           │
├────────┬─────────────────────────────────────────┤
│        │                                         │
│ Side-  │  Main Content                           │
│ bar    │  padding: 24px (p-6)                    │
│ w-64   │  max-width: unconstrained (fluid)       │
│ (256px)│                                         │
│        │                                         │
└────────┴─────────────────────────────────────────┘
```

### 1.5 Elevation & Borders

| Level | Shadow | Border | Usage |
|---|---|---|---|
| **Surface** | None | `border-slate-200` (1px) | Cards, panels |
| **Elevated** | `shadow-premium` | `border-slate-200` | Dropdowns, tooltips, mobile drawer |
| **High** | `shadow-premium-lg` | None | Modals, dialogs |
| **CTA Button** | None (flat) | None | Primary action buttons |
| **Hover** | None | `border-slate-300` | Interactive element hover state |

### 1.6 Border Radius

| Token | Value | Usage |
|---|---|---|
| `sm` | 6px | Badges, small inline elements |
| **`md`** | **8px** | **Buttons, inputs, badges** |
| `lg` | 12px | Cards, panels |
| `xl` | 16px | Large containers |
| `full` | 9999px | Status pills, avatars |

### 1.7 Iconography

- **Style:** Outlined, 1.5px stroke weight, 20×20px default size (16×16 for dense contexts).
- **Library:** Lucide React (consistent with shadcn/ui conventions).
- **Convention:** Icons always paired with a text label in navigation; standalone icons reserved for tooltips and inline actions.

---

## 2. Global Navigation & Layout

### 2.1 Sidebar (Left Navigation)

**Dimensions:** 256px (w-64) wide, full height, collapsible on mobile (drawer).

**Structure (top to bottom):**

```
┌─────────────────────────┐
│ [Logo] InvoiceFlow      │  ← Brand header (h-16, border-bottom slate-200)
├─────────────────────────┤
│                         │
│  ◆ Dashboard            │  ← Active state: bg-primary-50, text-primary-700
│  ○ Invoices             │  ← Inactive: text-slate-600, hover:bg-slate-100
│  ○ Customers            │
│  ○ Payments             │
│  ○ Estimates            │
│  ○ Recurring Invoices   │
│  ○ Products/Services    │
│  ○ Reports              │
│  ○ Settings             │
│                         │
├─────────────────────────┤
│  [Plan Badge]           │  ← Plan tier indicator
│  ─────────────────      │
│  ◯ Help Center          │
│  ◯ Sign Out             │
└─────────────────────────┘
```

**Navigation item specification:**

| Property | Value |
|---|---|
| Height | 40px (h-10) per item |
| Padding | `px-3 py-2` |
| Icon | 20px, left-aligned, 12px gap to label |
| Active indicator | Left edge: 2px `primary-600` bar **OR** full `bg-primary-50` background with `text-primary-700` |
| Inactive | `text-slate-600`, hover → `bg-slate-100` + `text-slate-900` |
| Font | 14px, weight 500 (medium) |
| Active pill | For plan-gated items: `bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded` pill on the right showing required plan |

**Nav item detail table:**

| # | Item | Route | Icon | Notes |
|---|---|---|---|---|
| 1 | **Dashboard** | `/app` | `LayoutDashboard` | Default landing; active route = exact match |
| 2 | **Invoices** | `/app/invoices` | `FileText` | Includes sub-filter for status |
| 3 | **Customers** | `/app/customers` | `Users` | Customer directory |
| 4 | **Payments** | `/app/payments` | `CreditCard` | Payment records & processing |
| 5 | **Estimates** | `/app/estimates` | `ClipboardList` | Quote/estimate management |
| 6 | **Recurring Invoices** | `/app/recurring` | `Repeat` | Automated billing schedules |
| 7 | **Products/Services** | `/app/products` | `Package` | Catalog & pricing |
| 8 | **Reports** | `/app/reports` | `BarChart3` | Analytics & exports |
| 9 | **Settings** | `/app/settings` | `Settings` | Opens settings sub-menu |

**Mobile behavior:**
- Hidden on `md` breakpoint by default.
- Triggered via hamburger button in top bar.
- Slides in as a fixed overlay drawer (`fixed inset-y-0 left-0 w-64`) with backdrop (`bg-black/40`).

### 2.2 Top Bar (Header)

**Dimensions:** Full width, height 64px (h-16), `bg-white` with `border-b border-slate-200`.

**Structure (left to right):**

```
┌────────────────────────────────────────────────────────────────────┐
│ [☰ Mobile Menu]  Workspace ▾    [🔍 Search...    ]  [🔔][?][Avatar▼]  [+ Create Invoice] │
└────────────────────────────────────────────────────────────────────┘
```

#### 2.2.1 Workspace/Company Switcher

| Property | Specification |
|---|---|
| Location | Left side, after mobile menu trigger |
| Style | Text button: `text-sm font-medium text-slate-700 hover:text-slate-900` |
| Behavior | Click opens dropdown panel with workspace list, "Switch workspace" flow |
| Content | Workspace name + plan indicator dot |
| Dropdown | `bg-white border border-slate-200 rounded-lg shadow-premium-lg` |

#### 2.2.2 Global Search

| Property | Specification |
|---|---|
| Location | Center-right, before notifications |
| Trigger | Keyboard shortcut `⌘K` (or `Ctrl+K`) |
| Style | Rounded input: `bg-slate-50 border-slate-200 text-sm w-64 placeholder:text-slate-400` |
| Placeholder | "Search invoices, customers..." |
| Behavior | Opens search overlay/modal with categorized results (invoices, customers, actions) |
| Focus State | `ring-2 ring-primary-500/20 border-primary-500` |

#### 2.2.3 Notification Center

| Property | Specification |
|---|---|
| Location | Right side, before user profile |
| Trigger | Bell icon button (20px, `slate-500 hover:text-slate-700`) |
| Badge | Red dot (`w-2 h-2 bg-red-500`) top-right of bell when unread > 0 |
| Dropdown | `bg-white border border-slate-200 rounded-lg shadow-premium-lg w-80 max-h-96 overflow-y-auto` |
| Item | Icon + title + timestamp, hover → `bg-slate-50` |
| Footer | "View all notifications" link to notifications page |

#### 2.2.4 Help Center

| Property | Specification |
|---|---|
| Location | Right side, between notifications and profile |
| Trigger | Question mark icon `?` (20px, `slate-500 hover:text-slate-700`) |
| Behavior | Opens help center in new tab OR dropdown with quick links |
| Links | Documentation, Contact Support, Keyboard Shortcuts |

#### 2.2.5 User Profile Menu

| Property | Specification |
|---|---|
| Location | Far right |
| Trigger | Avatar circle (32px, `rounded-full`) + name + dropdown chevron |
| Dropdown | `bg-white border border-slate-200 rounded-lg shadow-premium-lg w-56` |
| Items | Profile, Settings, Sign Out (with `LogOut` icon, red text) |
| Divider | Between profile/settings and sign out |

#### 2.2.6 Primary CTA Button (Global)

| Property | Specification |
|---|---|
| Location | Top bar, far right (after profile menu) |
| Text | "+ Create Invoice" |
| Style | `bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors` |
| Behavior | Navigates to `/app/invoices/new` |
| Mobile | Hidden on mobile; accessible via main CTA on Dashboard |

---

## 3. Dashboard Hierarchy & Information Architecture

### 3.1 Page Layout

```
┌──────────────────────────────────────────────────────────┐
│ Page Header: Title + Plan Badge          [Create Invoice]│  ← h-12 flex row
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
│ │  KPI 1 │ │  KPI 2 │ │  KPI 3 │ │  KPI 4 │             │  ← 4-col grid
│ └────────┘ └────────┘ └────────┘ └────────┘             │
│                                                          │
│ ┌──────────────────────────┐ ┌─────────────────────┐    │
│ │  Revenue Trend Chart     │ │  Status Breakdown    │    │  ← 2/3 + 1/3 split
│ │  (Donut/Bar chart)       │ │  (Donut chart)       │    │
│ │                          │ │                      │    │
│ └──────────────────────────┘ └─────────────────────┘    │
│                                                          │
│ ┌──────────────────────────┐ ┌─────────────────────┐    │
│ │  Recent Invoices Table   │ │  Upcoming Payments   │    │  ← 2/3 + 1/3 split
│ │  (Full data table)       │ │  (Mini list)         │    │
│ └──────────────────────────┘ └─────────────────────┘    │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐│
│ │  Recent Activity (Timeline / Feed)                   ││  ← Full width
│ └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### 3.2 Primary CTA: "Create Invoice"

**Placement:** Two locations for maximum discoverability:

| Location | Visibility | Behavior |
|---|---|---|
| **Top Bar** (global) | Desktop only | Navigates to `/app/invoices/new` |
| **Page Header** (dashboard-specific) | All viewports | Same target; more prominent on Dashboard |

**Page Header CTA (Dashboard-specific):**

| Property | Specification |
|---|---|
| Text | "+ New Invoice" |
| Size | `h-9 px-4 py-2` (medium) |
| Style | `bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2` |
| Icon | Plus icon (`Plus`, 16px) to the left of text |
| Keyboard | `Alt+N` shortcut hint shown in tooltip |
| Focus Ring | `focus:ring-2 focus:ring-primary-500 focus:ring-offset-2` |

**Rationale:** The dashboard is the default landing page. Having a CTA both in the top bar (global availability) and in the page header (situational prominence) ensures the primary action is always reachable within one second of glance.

### 3.3 Key Metrics (KPI) Section

**Layout:** 4-column responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`) with 16px gap (`gap-4`).

**Card specification:**

```
┌─────────────────────────────────┐
│ [Icon]  Outstanding             │  ← Label: 12px uppercase slate-500
│         $42,350.00              │  ← Value: 30px bold slate-900
│         5 unpaid invoices       │  ← Subtitle: 12px slate-500
└─────────────────────────────────┘
```

| Property | Specification |
|---|---|
| Container | `bg-white rounded-xl border border-slate-200 p-5 shadow-premium` |
| Hover | `hover:border-slate-300 transition-colors` |
| Icon container | `w-10 h-10 rounded-lg flex items-center justify-center` |
| Icon background | Semantic per KPI (see table below) |
| Label | `text-xs font-medium text-slate-500 uppercase tracking-wide` |
| Value | `text-3xl font-bold text-slate-900` |
| Subtitle | `text-xs text-slate-500 mt-1` |

**KPI Card Definitions:**

| # | Metric | Icon | Icon BG | Subtitle Format |
|---|---|---|---|---|
| 1 | **Total Outstanding** | `DollarSign` | `bg-blue-50 text-blue-600` | `{N} unpaid invoices` |
| 2 | **Overdue** | `AlertTriangle` | `bg-red-50 text-red-600` | `{N} overdue invoices` |
| 3 | **Payments Received (MTD)** | `CheckCircle` | `bg-green-50 text-green-600` | `{N} paid invoices` |
| 4 | **Monthly Revenue** | `TrendingUp` | `bg-primary-50 text-primary-600` | `{N} total invoices` |

**Responsive behavior:**
- Mobile (< 640px): Single column stack
- Tablet (640–1024px): 2 columns
- Desktop (≥ 1024px): 4 columns

### 3.4 Data Visualization

#### 3.4.1 Revenue / Payment Trend Chart

| Property | Specification |
|---|---|
| Location | 2/3 width of content area (`lg:col-span-2`) |
| Container | `bg-white rounded-xl border border-slate-200 p-5` |
| Title Bar | "Revenue & Payment Trends" + timeframe toggle |
| Timeframe Toggle | Segmented control: **30 Days** / **90 Days** / **12 Months** |
| Chart Type | **Line chart** (primary: payments received) + **Area chart** (secondary: revenue accrued) |
| Y-Axis | Currency values, formatted with compact notation ($1K, $2.5K) |
| X-Axis | Date labels (auto-scaled to timeframe) |
| Tooltip | `bg-slate-900 text-white text-xs rounded-lg px-3 py-2` on hover |
| Legend | Top-right of chart area, dot + label, clickable to toggle series |
| Grid Lines | `border-slate-100`, horizontal only |
| Empty State | `border border-dashed border-slate-300 rounded-lg p-8 text-center text-sm text-slate-400` |

**Chart card inner layout:**

```
┌──────────────────────────────────────────────┐
│ Revenue & Payment Trends    [30d][90d][12mo] │  ← Header row
│                                              │
│  $50K ┤                              ●       │
│  $40K ┤                        ●              │
│  $30K ┤                   ●      ─            │  ← Chart area (h-64 / 256px)
│  $20K ┤             ●                           │
│  $10K ┤        ●                                │
│    $0 ┼ ●                                  ●   │
│        Jan  Feb  Mar  Apr  May  Jun            │
│                                              │
│  ● Revenue    ─ Payments Received             │  ← Legend
└──────────────────────────────────────────────┘
```

#### 3.4.2 Invoice Status Breakdown

| Property | Specification |
|---|---|
| Location | 1/3 width of content area |
| Container | `bg-white rounded-xl border border-slate-200 p-5` |
| Title | "Invoice Status" |
| Chart Type | **Donut chart** (5 segments) |
| Segments | Draft (slate), Sent (blue), Viewed (indigo), Paid (green), Overdue (red) |
| Center Label | Total count in center of donut: bold large number |
| Legend | Below chart: colored dot + label + count, row layout |
| Interaction | Hover segment → highlight + percentage tooltip |
| Donut Size | 160×160px (w-40 h-40) |

**Status breakdown legend format:**

| Status | Color Dot | Label | Count |
|---|---|---|---|
| Draft | `w-2.5 h-2.5 rounded-full bg-slate-400` | Draft | 3 |
| Sent | `w-2.5 h-2.5 rounded-full bg-blue-500` | Sent | 7 |
| Viewed | `w-2.5 h-2.5 rounded-full bg-indigo-500` | Viewed | 4 |
| Paid | `w-2.5 h-2.5 rounded-full bg-green-500` | Paid | 23 |
| Overdue | `w-2.5 h-2.5 rounded-full bg-red-500` | Overdue | 2 |

**Row style:** `flex items-center justify-between py-1.5 text-sm`

### 3.5 Data Tables & Lists

#### 3.5.1 Recent Invoices

| Property | Specification |
|---|---|
| Location | 2/3 width, below charts |
| Container | `bg-white rounded-xl border border-slate-200 overflow-hidden` |
| Title Bar | "Recent Invoices" + "View All →" link (right-aligned) → navigates to `/app/invoices` |
| Row Count | 5 most recent invoices |

**Table specification:**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Recent Invoices                                    View All →              │
├──────────────────┬──────────────┬──────────┬────────────┬────────────────┤
│ INVOICE          │ CUSTOMER     │ AMOUNT   │ DUE DATE   │ STATUS         │
├──────────────────┼──────────────┼──────────┼────────────┼────────────────┤
│ INV-2024-0042 →  │ Acme Corp    │ $5,200   │ Sep 15     │ ● Paid         │
│                  │              │          │            │                │
│ INV-2024-0041    │ TechStart    │ $3,100   │ Sep 22     │ ● Sent         │
│                  │              │          │            │                │
│ ...              │              │          │            │                │
└──────────────────┴──────────────┴──────────┴────────────┴────────────────┘
```

| Column | Width | Content | Style |
|---|---|---|---|
| **Invoice** | ~200px | Invoice number (link to detail) + created date below | Number: `text-sm font-medium text-slate-900 hover:text-primary-600`; Date: `text-xs text-slate-500` |
| **Customer** | ~150px | Customer name | `text-sm text-slate-600` |
| **Amount** | ~100px | Total amount (right-aligned) | `text-sm font-medium text-slate-900 text-right` |
| **Due Date** | ~100px | Due date (right-aligned) | `text-sm text-slate-600 text-right`; overdue → `text-red-600 font-medium` |
| **Status** | ~120px | Status badge (centered) | Pill badge (see §1.2.4) |

**Row interaction:**
- Default: `border-b border-slate-100 last:border-b-0`
- Hover: `hover:bg-slate-50 transition-colors`
- Row height: `py-3 px-4`

#### 3.5.2 Upcoming Payments

| Property | Specification |
|---|---|
| Location | 1/3 width, beside Recent Invoices |
| Container | `bg-white rounded-xl border border-slate-200 p-5` |
| Title | "Upcoming Payments" |
| Item Count | 5 upcoming payments |

**List item specification:**

```
┌─────────────────────────────────┐
│ Sep 28, 2024                    │  ← Date: 12px text-slate-500
│ Acme Corp — $5,200.00          │  ← Line 1: 14px semibold slate-900
│ INV-2024-0042                   │  ← Line 2: 12px text-slate-500
├─────────────────────────────────┤
│ (next item...)                  │
└─────────────────────────────────┘
```

| Element | Style |
|---|---|
| Container | `py-3 border-b border-slate-100 last:border-b-0` |
| Date | `text-xs text-slate-500 mb-1` |
| Customer + Amount | `text-sm font-medium text-slate-900` |
| Invoice # | `text-xs text-slate-500 mt-0.5` |
| "View All" link | `text-xs text-primary-600 hover:text-primary-700 font-medium` at bottom |

#### 3.5.3 Recent Activity (Timeline)

| Property | Specification |
|---|---|
| Location | Full width, bottom of dashboard |
| Container | `bg-white rounded-xl border border-slate-200 p-5` |
| Title | "Recent Activity" |
| Type | Vertical timeline / activity feed |
| Item Count | 8 most recent events |

**Activity item specification:**

```
┌───────────────────────────────────────────────────────────────────┐
│ ●  Invoice INV-2024-0042 was paid by Acme Corp         2 min ago │
│       $5,200.00                                                  │
├───────────────────────────────────────────────────────────────────┤
│ ●  Payment reminder sent to TechStart                1 hour ago  │
│       Invoice INV-2024-0041                                           │
├───────────────────────────────────────────────────────────────────┤
│ ●  New invoice created: INV-2024-0040                      3h ago  │
│       Draft — $1,800.00                                              │
└───────────────────────────────────────────────────────────────────┘
```

| Element | Style |
|---|---|
| Timeline dot | `w-2 h-2 rounded-full bg-primary-500 mt-1.5` (or semantic color per event type) |
| Event text | `text-sm text-slate-700` |
| Detail text | `text-xs text-slate-500 mt-0.5` |
| Timestamp | `text-xs text-slate-400 whitespace-nowrap ml-4` |
| Connector | `absolute left-[5px] top-4 w-px h-full bg-slate-200` (vertical line) |
| Row | `flex items-start gap-3 py-3 border-b border-slate-100 last:border-b-0` |

**Event type colors for timeline dots:**

| Event Type | Dot Color |
|---|---|
| Payment Received | `bg-green-500` |
| Invoice Sent | `bg-blue-500` |
| Invoice Viewed | `bg-indigo-500` |
| Reminder Sent | `bg-amber-500` |
| Invoice Created | `bg-primary-500` |
| Invoice Overdue | `bg-red-500` |

### 3.6 Dashboard Loading & Empty States

#### Loading State
- Full page: Centered spinner with "Loading dashboard..." text (`text-slate-500 text-center py-20`)
- Per-section: Skeleton cards (gray placeholder blocks with pulse animation)

#### Empty State (No Invoices)
```
┌────────────────────────────────────────────┐
│                                            │
│           [Icon: FileText, 48px]           │
│          No invoices yet                   │
│   Create your first invoice to get         │
│      started with InvoiceFlow              │
│                                            │
│       [ + Create Invoice ]                 │
│                                            │
└────────────────────────────────────────────┘
```

- Background: `bg-white rounded-xl border border-dashed border-slate-300`
- Padding: `py-16`
- CTA button centered

---

## 4. Appendix: Component Specifications

### A. Status Badge (Reusable)

**Component:** `InvoiceStatusBadge` (existing in codebase at `src/components/InvoiceStatusBadge.tsx`)

**Specifications:**

| Property | Value |
|---|---|
| Padding | `px-2.5 py-0.5` |
| Border Radius | `rounded-full` |
| Font Size | `text-xs` |
| Font Weight | `font-medium` |
| Display | `inline-flex items-center` |

**Status → Class mapping** (per semantic palette in §1.2.4):

| Status | Classes |
|---|---|
| `paid` | `bg-green-100 text-green-800` |
| `overdue` | `bg-red-100 text-red-800` |
| `sent` | `bg-blue-100 text-blue-800` |
| `viewed` | `bg-indigo-100 text-indigo-800` |
| `draft` | `bg-slate-100 text-slate-800` |
| `partially_paid` | `bg-amber-100 text-amber-800` |
| `cancelled` / `void` | `bg-slate-100 text-slate-500` |

### B. KPI Card (Reusable)

```tsx
// Specification for reusable KPI card component
interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBackground: string;  // e.g., "bg-blue-50 text-blue-600"
  trend?: { value: string; direction: 'up' | 'down' };
}
```

**Container:** `bg-white rounded-xl border border-slate-200 p-5 shadow-premium hover:border-slate-300 transition-colors`

### C. Section Card (Reusable)

**Pattern for all dashboard modules:**

```tsx
// Shared card wrapper specification
<div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
  {/* Optional header */}
  <div className="flex items-center justify-between px-5 pt-5 pb-3">
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    {actions}  {/* right-aligned links, toggles, etc. */}
  </div>
  {/* Content */}
  <div className="px-5 pb-5">
    {content}
  </div>
</div>
```

### D. Page Header Pattern

Every page uses a consistent header pattern:

```tsx
<div className="flex items-center justify-between mb-8">
  <div>
    <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
    {/* Optional breadcrumbs or subtitle */}
  </div>
  <div className="flex items-center gap-3">
    {/* Secondary actions */}
    {/* Primary CTA */}
  </div>
</div>
```

### E. Responsive Breakpoint Strategy

| Breakpoint | Width | Layout Changes |
|---|---|---|
| **Mobile** | < 640px | Single column, sidebar = drawer, top bar CTA hidden, KPI cards stack |
| **Small Tablet** | 640–1023px | 2-column KPI grid, sidebar = drawer, tables horizontal scroll |
| **Desktop** | ≥ 1024px | Full layout, visible sidebar, 4-col KPIs, multi-column charts |

### F. Interaction & Micro-Behaviors

| Interaction | Specification |
|---|---|
| **Button hover** | Background darken one shade (`transition-colors duration-150`) |
| **Button active** | Background darken two shades |
| **Link hover** | Underline appears (`hover:underline` or `hover:text-primary-600`) |
| **Table row hover** | `bg-slate-50` |
| **Card hover** | `border-slate-300` (subtle elevation) |
| **Dropdown open** | `shadow-premium-lg` (immediate, no transition) |
| **Page transition** | Fade in (`animate-in fade-in duration-200`) |
| **Status badge** | Static (no animation) — clarity over flashiness |
| **Focus visible** | `ring-2 ring-primary-500 ring-offset-2` on all interactive elements |
| **Loading** | Skeleton screens with `animate-pulse` (never spinners for content areas) |

---

*End of Specification*
