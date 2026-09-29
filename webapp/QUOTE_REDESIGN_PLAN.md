# Quote Builder Redesign Plan
## Transforming the Quote Builder from a Spreadsheet to an Intuitive Quote-Building Workflow

---

## 1. Current State Analysis

### Architecture Summary
The quote builder is structured across these files in `webapp/src/components/QuoteBuilder/`:

| File | Purpose |
|---|---|
| `QuoteBuilder.tsx` | Main container — orchestrates layout (3-column grid), header, autosave, send/convert actions |
| `useQuoteBuilder.ts` | Hook managing all state, autosave, calculations via `calculationEngine` |
| `LineItemsTable.tsx` | The line-item table — the core "spreadsheet" surface |
| `QuoteTotals.tsx` | Sidebar totals display (subtotal, discount, tax, fees, total) |
| `QuoteDetailsForm.tsx` | Secondary form: customer, currency, dates, invoice-level discount, notes, terms |
| `FeesSection.tsx` | Fees table (similar density issues) |
| `ReviewAndSendDialog.tsx` | Modal for reviewing before sending |
| `types.ts` | Re-exports types from `types/quote-builder.ts` |

### Key Issues Identified

**A. Layout & Spacing (Spreadsheet Feel)**
- The `LineItemsTable` packs **10 columns** into a single table row: Description, Qty, Unit, Rate, Disc., Type, Tax %, Inc., Total, Actions.
- Column widths are cramped (e.g., Qty at `w-[8%]`, Tax % at `w-[8%]`).
- `py-2` vertical padding per row (only 0.5rem) creates a dense, cramped appearance.
- The description `<textarea>` is only 2 rows tall with `min-h-[40px]`, making it easy to miss.
- No visual grouping — all fields are peers in a flat table.
- The "Add line item" button is a tiny text-link style button (`text-xs`, no prominent icon spacing).

**B. Information Hierarchy**
- The `Description` field (`w-[20%]` of table width) is the most important field for a quote line, but it competes with 9 other columns.
- The `Line Total` column is only `w-[10%]` and uses `text-right font-medium` — it should be more visually dominant.
- The `Overall Quote Total` in `QuoteTotals` uses `text-lg font-bold` but sits in a sidebar that is only 1/3 of the screen width on desktop — it gets visually lost.
- `RATEDISC.` appears in the header as "Disc." (line 74: `<th className="pb-2 w-[10%]">Disc.</th>`) — ambiguous abbreviation.
- `INC.` appears as a checkbox label (line 81: `<span className="ml-1">Inc.</span>`) — ambiguous abbreviation for "Tax Inclusive."

**C. Clarity & Labeling**
- "Disc." → should be "Discount"
- "Inc." → should be "Tax Inclusive"
- "Type" column header is ambiguous — it refers to discount type (Fixed vs %), not line item type
- "Unit" is clear, but the select dropdown only shows raw values ("each", "hour", etc.) without capitalization
- The `Tax %` column header is clear but the input lacks a `%` suffix visually
- "Quote Discount" in `QuoteDetailsForm` line 83 uses "Invoice Discount" label — inconsistent terminology
- The "Totals" sidebar header says "Totals" but should say "Quote Summary"

**D. Functional UI Elements**
- **Quote Summary**: `QuoteTotals` exists but is a simple list of `flex justify-between` rows. No visual grouping, no card/surface styling, no clear visual hierarchy for the final total. The subtotal row, discount row, and tax rows are all `text-sm` with similar visual weight.
- **Add line item button**: Currently a small ghost-style button with `+ Add line item` text in `text-xs` font. No primary color, no prominent icon. It blends into the page.
- **Delete controls**: The `Trash2` icon is in a `p-1` rounded button (line 178-185), only 4x4 icon size. On the InvoiceWorkspace, it's slightly better with `p-1.5` but still small. No text label — purely icon-based.

**E. Additional Issues**
- `QuoteDetailsForm` duplicates the Customer selector that already exists in `QuoteBuilder.tsx` (lines 204-216 vs `QuoteDetailsForm` lines 19-31). This is redundant — the customer is selected twice.
- The `QuoteBuilder.tsx` header uses inline button styles rather than the shared `Button` component.
- No keyboard navigation or accessibility enhancements (e.g., Enter to add line, arrow key navigation between cells).
- No "empty state" for line items that is visually intentional — just a text message.
- The "Save Draft" button only appears for new quotes; existing quotes save automatically via autosave with no visible save button.

---

## 2. Design Principles

1. **Progressive Disclosure**: Primary action (description + line total) is visible immediately. Secondary fields (discount, tax) are grouped but accessible.
2. **Visual Hierarchy Through Scale**: Description gets the most horizontal space and has the largest input area. Line Total and Quote Total are the most prominent numeric values.
3. **Consistent Component Language**: Use the shared `Button` component, shared design tokens, and consistent spacing patterns (`p-3`, `rounded-xl`, etc.).
4. **Clear Labeling**: Every field has a full-word label. No abbreviations unless universally understood (e.g., "Qty" is acceptable).
5. **Delightful Defaults**: New line items default to a sensible tax rate from business settings (as the InvoiceWorkspace does).
6. **Mobile-First**: The layout must collapse gracefully on mobile, not just squeeze the desktop table.

---

## 3. Detailed Redesign

### 3.1 Line Items — Card-Based Layout

**Replace the table with a card-per-line-item design.**

Each line item becomes a self-contained card with a clear visual boundary. This eliminates the "spreadsheet" feel and creates scannability.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Service: Website Design                    Line Total: $1,500.00     │
│ ┌───────────────────────────────────────┐  ┌─────────────────────┐ │
│ │ Description                           │  │ Quantity    [1    ] │ │
│ │ [Multi-line textarea, min 3 rows     ]│  │ Unit        [each ] │ │
│ │  expanding as you type...]           │  │ Rate        [$   50] │ │
│ └───────────────────────────────────────┘  │                       │ │
│                                            │ Discount    [0.00]   │ │
│                                            │ Discount Tp [Fixed ▼]│ │
│                                            │ Tax Rate    [0 %   ] │ │
│                                            │ Tax Incl.   [✓]      │ │
│                                            └───────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │                     [Remove This Line]                          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Key changes:**
- **Description field** is the leftmost element, taking ~60% of the card width, with a `min-h-[80px]` textarea that auto-expands.
- **Numeric fields** (Qty, Unit, Rate, Discount, Tax Rate) are in a compact 2-column grid on the right side of the description, taking ~40% of the width.
- **Line Total** is displayed as a prominent read-only value at the top-right of the card, using `text-xl font-bold text-primary`.
- **Remove button** is a full-width button at the bottom of the card with a trash icon + "Remove" text, using `variant="danger"` from the Button component.
- **Card styling**: `border border-color-subtle rounded-xl bg-surface`, with `hover:border-color-strong` on hover. Inner padding `p-4`.
- **Spacing between cards**: `space-y-4` (0.5rem * 2 = 1rem gap), giving each card breathing room.
- **Row number** (optional): A subtle `#1`, `#2` badge at the far left of each card for easy reference when discussing line items.

**Column layout within each card (on desktop):**
```
Grid: grid-cols-[3fr_1fr] gap-4
Left (3/4): Description + Line Total badge
Right (1/4): Qty, Unit, Rate, Discount, Discount Type, Tax Rate, Tax Inclusive
```

**On mobile:**
```
Stack: description full-width on top, then numeric fields in a 2-column grid below, then line total, then remove button.
```

### 3.2 Description Field Enhancement

**Current**: `<textarea>` with `min-h-[40px]`, `rows={2}`, cramped in a table cell with `pl-8` (left padding only).

**Redesign**:
- Move from `<td>` to a full-width card section.
- `min-h-[80px]` (5rem) instead of 40px.
- `auto-resize` — the textarea grows vertically as the user types more content.
- `placeholder="Describe the product or service..."` (more descriptive than "Item description").
- Font size: `text-sm` (keep), but with `leading-relaxed` for readability.
- Add a subtle `focus:border-primary` ring on focus.
- **Product linking** (optional enhancement): If a product is selected, show a small badge. For now, the description remains the primary entry point.

### 3.3 Secondary Fields (Qty, Unit, Rate, Discount, Tax)

**Current**: All fields are `text-xs` font, `px-2 py-1`, crammed into tiny table cells.

**Redesign** — Group into a labeled 2-column grid within each card:

```
[Quantity]        [Unit]
[10       ]       [each ▼]

[Rate]
[$50.00          ]

[Discount]        [Discount Type]
[0.00       ]     [Fixed ▼]

[Tax Rate]        [Tax Inclusive]
[0 %       ]      [✓]
```

**Field styling:**
- Labels: `text-xs font-medium text-tertiary uppercase` — consistent with `CustomerHeaderSection` in InvoiceWorkspace.
- Inputs: `px-3 py-2` (more padding than current `px-2 py-1`), `text-sm`, `rounded-lg`, `border border-input-border`, `focus-ring-primary`.
- `Rate` input shows currency symbol as a prefix inside the input (current behavior preserved).
- `Tax Rate` input shows a `%` suffix.
- `Tax Inclusive` checkbox is replaced with a labeled toggle switch for better UX:
  - Label: "Tax Inclusive" with a brief description on hover: "Check if the price already includes tax."
  - Uses `text-sm text-secondary` for the label, positioned to the right of the checkbox.

### 3.4 Line Total & Quote Total Prominence

**Line Total (per card):**
- Positioned at the top-right of each card, right-aligned.
- `text-xl font-bold text-primary` with `tabular-nums` for stable width.
- Computed from the calculation engine (not from the local `lineTotal()` function — use `calcResult` to ensure backend-authoritative values).

**Overall Quote Total (sidebar):**
- Extract the totals display into a dedicated `QuoteSummary` card component.
- The final total uses `text-3xl font-bold text-primary-brand` (larger than current `text-lg`).
- The total is displayed with a `bg-primary-bg` background tint on the final row for emphasis.
- All subtotal/discount/tax/fees rows use consistent `text-sm` or `text-base` with clear labels.
- Add a bottom border and extra padding to separate the total from the line items above.
- The sidebar card has `shadow` and `sticky top-6` (already present) but with increased padding (`p-6`) and rounded corners.

### 3.5 Clarity & Labeling (All Abbreviations)

| Current Label | New Label |
|---|---|
| "Disc." (column header) | "Discount" |
| "Inc." (checkbox label) | "Tax Inclusive" |
| "Type" (discount type column) | "Discount Type" |
| "Rate" | "Unit Price" |
| "Qty" | "Quantity" (keep "Qty" for brevity in tight spaces) |
| "Tax %" | "Tax Rate" |
| "Total" (line total) | "Line Total" |
| "Totals" (sidebar) | "Quote Summary" |
| "Invoice Discount" (in QuoteDetailsForm) | "Quote Discount" |
| "+ Add line item" button | "Add Line Item" (title case, larger) |

### 3.6 Quote Summary Component

**New component: `QuoteSummary.tsx`** — replaces/wraps `QuoteTotals.tsx`.

```
┌────────────────────────────────────┐
│  Quote Summary                     │
├────────────────────────────────────┤
│  Subtotal          $1,500.00       │
│  Discount         −$0.00           │
│  ────────────────────────────────  │
│  Tax               $120.00        │
│  ────────────────────────────────  │
│  Fees              $0.00          │
│  ─────────────────────────────────│
│  TOTAL             $1,620.00      │  ← text-2xl, bold, primary color
└────────────────────────────────────┘
```

**Design details:**
- Section header: "Quote Summary" with `text-xs font-semibold text-tertiary uppercase`.
- Each row: `flex justify-between items-center py-2`, label on left (`text-sm text-secondary`), value on right (`text-sm text-primary font-medium text-right`, `tabular-nums`).
- Discount row: value shown in `text-error-text` with a `−` prefix.
- Tax row: has a top border `border-color-subtle` separator before it.
- Fees row: has a top border separator.
- Total row: `border-t-2 border-color-strong` (double-thickness divider), `text-xl font-bold`, value in `text-primary-brand`.
- `Amount Due` row (if different from total): shown below total in smaller text.
- Empty state: if no items added, show placeholder text: "Add line items to see quote totals."

### 3.7 Enhanced "Add Line Item" Button

**Current**: 
```html
<button className="inline-flex items-center gap-2 rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-xs font-medium text-secondary hover:bg-surface">
  + Add line item
</button>
```

**Redesign**:
- Use the shared `Button` component with `variant="primary"` and `size="md"`.
- Icon: `<Plus className="h-5 w-5" />` on the left.
- Text: "Add Line Item" (title case).
- Padding: `px-4 py-2.5 text-sm` (Button `md` size).
- Position: Below the line items list, center-aligned when empty, right-aligned when items exist.
- Background: `bg-primary-action` with `hover:bg-primary-hover`.
- Full-width on mobile (`w-full`), auto on desktop.
- When line items list is empty, show a full empty-state card:
  ```
  ┌────────────────────────────────────┐
  │  📄                              │
  │  No line items yet                │
  │  Add your first product or service│
  │  ┌──────────────────────────────┐ │
  │  │  + Add Line Item             │ │
  │  └──────────────────────────────┘ │
  └────────────────────────────────────┘
  ```

### 3.8 Delete Controls Enhancement

**Current**: 4x4 `Trash2` icon in a `p-1` button, no text label, tooltip only on hover.

**Redesign**:
- Button size: `p-2` (minimum 36px touch target for accessibility).
- Icon: `h-5 w-5` (larger than current `h-4 w-4`).
- Add text label: "Remove" next to the icon.
- Use the `Button` component with `variant="danger"`.
- Full-width on the bottom of each card (as specified in 3.1).
- On hover: background changes to `bg-error-bg` with `text-error-text`.
- Confirmation dialog for deletion (optional, but recommended for line items):
  - "Remove this line item? This cannot be undone."
  - "Cancel" / "Remove" buttons.

### 3.9 Fees Section Redesign

Apply the same card-based pattern to fees:

```
┌──────────────────────────────────────────┐
│ Shipping Fee                   [$50.00]  │
│ ┌────────────────────────────────────┐  │
│ │ Description                      │  │
│ │ [Rushing shipping               ]│  │
│ └────────────────────────────────────┘  │
│ [Amount] [Tax Rate]                    │
│ ┌────────────────────────────────────┐  │
│ │ Remove Fee                       │  │
│ └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

- Each fee is a card with `border border-color-subtle rounded-xl bg-surface p-4`.
- Description takes full width at the top.
- Amount and Tax Rate in a 2-column grid below.
- Remove button at the bottom.
- "Add Fee" button uses `Button` component with `variant="ghost"` + `Plus` icon.

### 3.10 Main Layout Restructure

**Current layout (QuoteBuilder.tsx):**
```
Grid: lg:grid-cols-3
  Col 1-2: Customer selector + Line items table + Fees + Quote details form
  Col 3:    Totals sidebar (sticky)
```

**New layout:**
```
Col 1 (main, 2/3 width):
  - Customer selector (card)
  - Quote Summary sidebar (sticky, right side)
  
Col 2 (sidebar, 1/3 width):
  - Quote Summary card (prominent totals)
  - Save Draft button
  - Send / Convert buttons
```

**Detailed new layout:**
```
┌──────────────────────────────────────────────────┬──────────────┐
│ Customer Selector                               │              │
├──────────────────────────────────────────────────┤ Quote Summary│
│ Line Item Card #1                                │ Summary Card │
│  ┌─────────────────────────────────────────────┐ │              │
│  │ Description (expanding textarea)           │ │              │
│  │                                             │ │              │
│  │ [Qty] [Unit] [Rate] [Discount] [Tax %] [✓] │ │              │
│  └─────────────────────────────────────────────┘ │              │
│  Line Total: $1,500.00     [Remove]            │              │
├──────────────────────────────────────────────────┤              │
│ Line Item Card #2                                │              │
├──────────────────────────────────────────────────┤              │
│ [ + Add Line Item ]                              │              │
├──────────────────────────────────────────────────┤              │
│ Fees Cards                                       │              │
├──────────────────────────────────────────────────┤              │
│ Quote Details Form                               │              │
│ (dates, discount, notes, terms)                  │              │
└──────────────────────────────────────────────────┴──────────────┘
```

**Rationale for the sidebar repositioning:**
- The Quote Summary stays in the right sidebar but is given more width and prominence.
- The `sticky top-6` positioning means the summary is always visible while scrolling through line items.
- The summary card has `shadow-md` and a more prominent total.

**Alternative (desktop-wide layout):**
On very wide screens, consider a 3-column layout:
```
Col 1 (40%): Line items + fees
Col 2 (30%): Quote details form (dates, notes, terms)
Col 3 (30%): Quote summary sidebar
```

But the 2-column approach is simpler and more maintainable.

### 3.11 Redundant Customer Selector Fix

The current `QuoteBuilder.tsx` renders a customer `<select>` at lines 204-216, and `QuoteDetailsForm.tsx` also renders a customer selector at lines 19-31.

**Fix**: Remove the customer selector from `QuoteDetailsForm.tsx` since it's already handled at the builder level. The `QuoteDetailsForm` should only contain: Currency, Issue Date, Due Date, Expiry Date, Quote Discount, Notes, Terms, Payment Instructions.

### 3.12 Header Action Buttons

**Current**: The header uses inline-styled `<button>` elements rather than the shared `Button` component.

**Fix**: Replace inline buttons with `Button` component:
```tsx
<Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleDownloadPdf}>
  Download PDF
</Button>
<Button variant="secondary" size="sm" icon={<Send className="h-4 w-4" />} onClick={() => setReviewOpen(true)}>
  Send
</Button>
<Button variant="primary" size="sm" icon={<Copy className="h-4 w-4" />} onClick={handleConvert}>
  Convert to Invoice
</Button>
```

### 3.13 Save Draft Button

**Current**: Only visible for new quotes, uses inline styles.

**Fix**: Use `Button` component, position it prominently in the Quote Summary sidebar:
```tsx
<Button variant="secondary" size="md" icon={<Save className="h-4 w-4" />} onClick={doSave} disabled={saveState === "saving"} fullWidth>
  {saveState === "saving" ? "Saving…" : "Save Draft"}
</Button>
```

For existing quotes, add a "Save Changes" button that is always visible (not just for new quotes), since the current code only shows it for `isNew`.

### 3.14 Review & Send Dialog

The `ReviewAndSendDialog` also uses abbreviations and has a dense layout. Apply the same labeling improvements:
- "Totals" → "Quote Summary"
- Ensure all labels are clear words.
- Increase spacing between sections.

---

## 4. Component File Changes

### New Files
| File | Description |
|---|---|
| `QuoteLineCard.tsx` | Single line item card component (reusable) |
| `QuoteSummary.tsx` | Enhanced quote totals/summary card component |

### Modified Files
| File | Changes |
|---|---|
| `LineItemsTable.tsx` | Rewrite to use card-based layout instead of table; rename to `LineItemsList.tsx` or keep name |
| `QuoteTotals.tsx` | Replace with `QuoteSummary` or enhance existing |
| `QuoteBuilder.tsx` | Restructure grid, use `Button` component for all actions, fix customer selector redundancy |
| `QuoteDetailsForm.tsx` | Remove customer selector, fix "Invoice Discount" → "Quote Discount" label |
| `FeesSection.tsx` | Rewrite to use card-based layout |
| `ReviewAndSendDialog.tsx` | Fix abbreviations, increase spacing |

### Migration Strategy
Because the `LineItemsTable` is a self-contained component with well-defined props, the migration can be done incrementally:
1. First, rewrite `LineItemsTable.tsx` with the new card-based layout.
2. Replace `QuoteTotals.tsx` with the enhanced `QuoteSummary.tsx`.
3. Update `QuoteBuilder.tsx` to use `Button` components and restructure the grid.
4. Fix `QuoteDetailsForm.tsx` to remove the duplicate customer selector.
5. Rewrite `FeesSection.tsx` with card-based layout.
6. Update `ReviewAndSendDialog.tsx` with clear labels.

---

## 5. Design Principles Summary

1. **Eliminate table density** — Cards create natural whitespace and scannability.
2. **Description gets dominance** — Largest field, most vertical space, clear label.
3. **Line Total is always visible** — Top-right of each card, bold and large.
4. **Clear labels everywhere** — No abbreviations shorter than 3 letters.
5. **Delete is safe and obvious** — Large buttons with text, confirmation dialog.
6. **Add is a clear CTA** — Large, primary-colored, with icon and full-width on mobile.
7. **Quote Summary is prominent** — Larger total font, colored total, clear sectioning.
8. **Consistent component patterns** — Use shared `Button` component, design tokens, border-radius, shadows.
9. **Mobile-first** — Cards stack naturally; no horizontal scrolling.
10. **Backend-authoritative totals** — Use `calcResult` from the calculation engine for line totals, not local computation.

---

## 6. Implementation Priority

| Priority | Task | Estimated Effort |
|---|---|---|
| P0 | Rewrite `LineItemsTable.tsx` → card-based layout | High |
| P0 | Create `QuoteSummary.tsx` replacing `QuoteTotals.tsx` | Medium |
| P0 | Fix all abbreviations and labels across all files | Low |
| P1 | Restructure `QuoteBuilder.tsx` grid + use `Button` component | Medium |
| P1 | Fix `QuoteDetailsForm.tsx` — remove redundant customer selector | Low |
| P1 | Rewrite `FeesSection.tsx` → card-based layout | Medium |
| P2 | Enhance delete controls (larger buttons, confirmation) | Low |
| P2 | Enhance empty states and "Add" button | Low |
| P2 | Update `ReviewAndSendDialog.tsx` labels | Low |

---

## 7. Design Token Usage Reference

The project uses CSS variables defined in `webapp/src/index.css`. Key tokens to use:

| Visual Element | Token | Usage |
|---|---|---|
| Surface | `bg-surface` | Card backgrounds |
| Surface Alt | `bg-surface-alt` | Input backgrounds, hover surfaces |
| Border | `border-color-subtle` | Card borders |
| Border Strong | `border-color-strong` | Focus states, active borders |
| Text Primary | `text-primary` | Primary content |
| Text Secondary | `text-secondary` | Secondary content |
| Text Tertiary | `text-tertiary` | Labels, hints |
| Primary Action | `bg-primary-action` | Primary buttons, total highlight |
| Primary Hover | `hover:bg-primary-hover` | Button hover |
| Primary Text | `text-primary-brand` | Total amounts, links |
| Error | `bg-error-bg`, `text-error-text` | Delete buttons, errors |
| Success | `bg-success-bg`, `text-success-text` | Validation success |
| Shadow | `shadow`, `shadow-md` | Card elevation |
| Rounded | `rounded-lg`, `rounded-xl` | Border radius |

Input focus style: `focus:outline-none focus:ring-1 focus:ring-primary` or `focus-ring-primary` (the custom utility).
