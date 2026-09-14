# Implementation Plan: Enhanced Invoice Creation Experience

## Overview

The user has provided a comprehensive design vision for a three-panel drag-and-drop invoice editor.
After thorough codebase analysis, a significant portion of this vision is **already implemented** in
`webapp/src/document-model/`. This plan maps the vision against existing reality, identifies gaps,
and prioritizes remaining work.

---

## What Already Exists (Already Built)

| Vision Feature | Implementation | Location |
|---|---|---|
| Three-panel editor | `DocumentEditor.tsx` — palette (left), canvas (center), `PropertyInspector` (right) | `webapp/src/document-model/editor/` |
| Component library (24 types) | `registerAllComponents()` in `components.tsx` | `webapp/src/document-model/registry/components.tsx` |
| All named components | text, image/logo, customerInfo, invoiceNumber, date, lineItems, subtotal, tax, discount, paymentTerms, signature, customField, notes, terms, paymentInstructions, fees, total, amountDue, businessInfo, spacer, divider | `schemas.ts`, `types.ts`, `components.tsx` |
| Structured layout (sections/rows/columns) | `InvoiceDocument` with normalized `sections`, `rows`, `columns`, `components` maps | `types.ts` |
| Document operations | `DocumentBuilder` — insert, update, move, remove | `document-operations.ts` |
| Component registry with contract | `ComponentDefinition` interface with type, label, description, icon, category, defaultProps, defaultStyle, schema, canHaveChildren, allowedParentTypes, render, inspector | `registry/index.ts` |
| Data binding via RenderContext | Components read from business/customer/invoice/calculations via `RenderContext` | `registry/index.ts` |
| zod schema validation | All component schemas + document schema | `schemas.ts` |
| Undo/redo | `EditorContext` with history array (100-step) | `editor/EditorContext.tsx` |
| Debounced autosave | `EditorContext` with configurable delay | `editor/EditorContext.tsx` |
| Version tracking | `document.version`, `document.updatedAt` | `types.ts` |
| Drop zones + validation | `DropZone` component with `canDropComponent` validation | `DocumentEditor.tsx` |
| State machine (draft→sent→…) | `InvoiceStateMachine` with ALLOWED_TRANSITIONS | `src/services/state-machine/` |
| Backend calculation engine | `calculationEngine` with Decimal | `src/domain/calculation.ts` |
| Snapshot/immutability | `snapshotService` captures template version + rendered HTML at finalize | `src/services/snapshot/` |
| PDF service abstraction | Pluggable `PdfService` interface | `src/services/pdf/` |
| Template CRUD + revisions | `templateRepository` with revision tracking | `src/repositories/template.repo.ts` |
| Document converter | `invoiceToDocument`, `getDefaultDocument`, `documentToInvoice` | `converter.ts` |
| Document renderer | `renderDocumentTree` for production rendering | `renderer.tsx` |
| beforeunload guard | Unsaved changes warning | `EditorContext.tsx` |

**Key invariant confirmed:** The frontend can calculate totals for responsiveness (`calculationEngine` in `utils/calculation.ts`), and the backend independently validates via `InvoiceService.buildCalculationInput()` + `calculationEngine` before finalizing.

---

## What's Missing (Gaps to Fill)

### Phase A: Industry Presets & Template Starting Points
- **Industry-specific presets** for construction, consulting, photography, freelancing, legal services, landscaping, cleaning, automotive, retail, professional services
- These should be document-template objects (pre-built `InvoiceDocument` layouts) selectable at invoice creation time
- A template gallery UI showing preview cards for each industry preset

### Phase B: Backend Document Template Persistence
- The structured `InvoiceDocument` layout is currently **frontend-only** — it's not persisted as a reusable template
- Need backend schema + repository for document-layout templates (distinct from Handlebars HTML templates)
- API endpoints: `GET/POST /api/document-templates`, `GET/PUT /api/document-templates/:id`
- Templates should support duplication, default setting, organization sharing

### Phase C: Pre-Send Validation Layer
- Systematic invoice validation that catches: missing customer, invalid dates, empty line items, unsupported currencies, missing payment info, calculation discrepancies
- Frontend validation UI that surfaces issues before "Finalize & Send"
- Backend validation endpoint or integrated into finalize

### Phase D: Component Duplication & Custom Reusable Blocks
- Duplicate selected component (with all props/style)
- Save custom components as reusable blocks in the palette
- Right-click context menu or action buttons on selected components

### Phase E: Non-Drag Keyboard Accessibility
- List/outline view for reordering components without drag
- Keyboard navigation: arrow keys to move, Enter to select, Delete to remove
- Screen-reader labels, ARIA attributes on all interactive elements
- Reduced-motion support

### Phase E: Snapping & Alignment Guides
- Visual drop indicators and alignment guides during drag
- Snap-to-grid for component positioning

### Phase F: Analytics
- Product-level events: template_selected, component_added, invoice_created, invoice_sent, invoice_paid, draft_abandoned
- Lightweight event emitter, not user tracking

---

## Implementation Priority

### Sprint 1 (High Priority) — Industry Presets + Template Gallery
1. Create `webapp/src/document-model/templates/preset-templates.ts` — industry-specific `InvoiceDocument` presets
2. Build `DocumentTemplateGallery.tsx` component showing preset cards
3. Wire into `InvoiceEditor` so "new invoice" shows gallery first
4. Tests for preset document validity

### Sprint 2 (High Priority) — Backend Document Template Persistence
1. Add migration `009_document_templates.sql` — table for structured document templates
2. Add `DocumentTemplateRepository` in `src/repositories/`
3. Add API routes: `/api/document-templates/*` (CRUD + duplicate + set default)
4. Add zod schema for document template in `src/schemas/`
5. Add frontend API client functions
6. Tests for repository + API

### Sprint 3 (Medium Priority) — Pre-Send Validation Layer
1. Add `InvoiceValidationService` in backend — validates invoice draft before finalize
2. Add frontend `useInvoiceValidation` hook with issue detection
3. Add `ValidationPanel` / pre-send checklist in editor
4. Gate "Finalize & Send" behind validation pass
5. Tests for validation rules

### Sprint 4 (Medium Priority) — Component Duplication + Outline Editor
1. Add "Duplicate" action in PropertyInspector
2. Build `OutlineEditor.tsx` — tree view with keyboard reorder (up/down arrows, Enter to select)
3. Add keyboard shortcuts in DocumentEditor (Delete to remove, Ctrl+D to duplicate, Arrow keys)
4. Add ARIA labels and roles throughout editor components
5. Tests for outline editor operations

### Sprint 5 (Low Priority) — Snapping & Alignment + Analytics
1. Add alignment guide overlay in DocumentEditor using dnd-kit's `DragOverlay` + position tracking
2. Add `AnalyticsService` with `trackEvent` calls at key funnel points
3. Wire analytics into editor lifecycle events

---

## Testing Strategy
- Frontend: `vitest` in `webapp/src/__tests__/` — extend existing `document-model.test.ts`
- Backend: `vitest` in `tests/` — extend existing test patterns
- Run `npm run typecheck` and `npm run lint` after each sprint

## Commands
- Frontend dev: `npm run dev:frontend` (localhost:5173)
- Backend dev: `npm run dev` (localhost:4000)
- Full stack: `npm run dev:all`
- Frontend tests: `cd webapp && npx vitest`
- Backend tests: `npm run test`
- Typecheck: `npm run typecheck` + `cd webapp && npm run typecheck`
- Lint: `npm run lint` + `cd webapp && npm run lint`
