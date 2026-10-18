# Technical Plan: Universal Document Generation Pivot

## Goal

Pivot the codebase so "universal document generation" becomes the central architecture. All document types (invoice, quote, credit-note, debit-note, payment-voucher, receipt, purchase-order) route through shared services for template data assembly, output generation (8 formats), and artifact caching. Eliminate per-type duplication in both backend services and frontend workspace/editor pages.

## Context from Codebase Analysis

### Already Exists (Reusable)
- **OutputService** (`src/services/output/`) with 8 format providers (PDF, HTML, DOCX, TXT, CSV, email-HTML, PNG, SVG). Fully registered via `createDefaultOutputService()` but **never called** outside its own `index.ts`.
- **`document_artifacts` table** (migration 068) — stores any format for any doc type with SHA-256 hash, file_path, metadata. Ready to use.
- **`document_templates` table** — has `output_format`, `output_formats`, `default_output_format` columns (migration 069). Supports all 7 doc types via `document_type` enum.
- **`buildDocumentTemplateData()`** (`template-renderer.ts:1866`) — unified builder for 5 doc types (invoice, credit-note, quote, debit-note, payment-voucher). Supports `receipt` and `purchase-order` in `DocumentTypeKey` type but **has no switch cases** for them and **is never called** by any service.
- **`NormalizeDocumentTypeKey`** (`invoice-template.ts:28`) — maps dash-case to snake_case. **Bug**: `"quote"` maps to `"credit_note"` instead of `"quote"`.
- **Frontend document-model DSL** (`webapp/src/document-model/`) — component registry, DocumentBuilder, renderer, schemas. `invoiceToDocument` converter works but is invoice-specific.
- **`DocumentWorkspace.tsx`** — generic workspace accepting `docType` prop, but uses ~20 ternary chains for per-type logic.
- **`Documents.tsx`** — unified listing with create dialog for 5 doc types, tabs for 3.

### Key Finding: `buildDocumentTemplateData` is dead code
This function was written as the unified builder but never wired in. The actual services (`invoice-service.ts`, `receipt-service.ts`) still call the old `buildTemplateData` (invoice-shaped). This is the integration gap to close.

## Decisions

1. **Backend**: Migrate all services to use `buildDocumentTemplateData()` + new `DocumentService` wrapper. Add `receipt`/`purchase-order` cases to the builder. Fix `normalizeDocumentTypeKey` bug.
2. **Output integration**: Wire `OutputService` into the generation pipeline. Replace direct `pdfService.generatePdfFromHtml()` calls.
3. **Artifact caching**: Store generated outputs via `DocumentArtifactService` before returning to caller.
4. **Frontend**: Create a `documentHandlers` registry object to eliminate ternary chains. Add `receipt`/`purchase-order` to `DocumentType`.
5. **API routes**: Keep existing per-type endpoints (`/api/invoices/:id/finalize` etc.) but route through `DocumentService` internally. Add new `/api/documents/generate` universal endpoint.

## Implementation Steps

### Step 1: Fix `normalizeDocumentTypeKey` bug and add receipt/PO types to template data

**File**: `src/domain/schemas/invoice-template.ts`
- Fix line 32: change `"quote": "credit_note"` → `"quote": "quote"`

**File**: `src/services/templates/template-renderer.ts`
- Add `ReceiptTemplateData` interface and `PurchaseOrderTemplateData` interface
- Add `BuildReceiptInput` and `BuildPurchaseOrderInput` interfaces
- Add `"receipt" | PurchaseOrderTemplateData` and `"purchase-order" | PurchaseOrderTemplateData` to `DocumentTemplateData` union type
- Add `receipt` and `purchase-order` cases to `buildDocumentTemplateData()` switch
- Extend `TemplateRenderer` class: add `renderReceipt()`, `renderPurchaseOrder()`, `renderDebitNote()`, `renderPaymentVoucher()` methods (currently only `render`, `renderCreditNote`, `renderQuote` exist)
- Add `DEFAULT_RECEIPT_TEMPLATE` and `DEFAULT_PURCHASE_ORDER_TEMPLATE` HTML constants
- Update `TemplateRenderer` constructor to accept optional default templates for new types

### Step 2: Create `DocumentArtifactService`

**File**: `src/services/document-artifact-service.ts` (NEW)
- `store(artifact: ArtifactInput): Promise<DocumentArtifact>` — inserts into `document_artifacts` table
- `getByKey(docType, docId, format): Promise<DocumentArtifact | null>`
- `getByHash(sha256): Promise<DocumentArtifact | null>`
- `list(docType, docId): Promise<DocumentArtifact[]>`
- `cleanupExpired(): Promise<number>`

**ArtifactInput shape**:
```typescript
interface ArtifactInput {
  businessId: string;
  documentId: string;
  documentType: string; // snake_case
  outputFormat: string;
  data: string | Buffer;
  metadata?: Record<string, unknown>;
}
```

### Step 3: Create `DocumentService` (unified CRUD service)

**File**: `src/services/document-service.ts` (NEW)
- Constructor takes `OutputService`, `DocumentArtifactService`, `TemplateRenderer`, and a `Map<DocumentTypeKey, DocumentHandler>` registry
- Methods: `createDocument`, `updateDocument`, `finalizeDocument`, `sendDocument`, `generateOutput`, `getDocumentArtificats`
- Each `DocumentHandler` provides: `createFn`, `updateFn`, `finalizeFn`, `sendFn`, `toTemplateDataFn`, `validateFn`
- Migrates logic from `invoice-service.ts`, `quote-service.ts`, `debit-note-service.ts`, `payment-voucher-service.ts`, `receipt-service.ts`

**Key integration point**: `generateOutput` calls `buildDocumentTemplateData()` → `templateRenderer.renderUnified()` → `OutputService.generate()` → `DocumentArtifactService.store()`

### Step 4: Add `renderUnified` method to `TemplateRenderer`

**File**: `src/services/templates/template-renderer.ts`
- Add `async renderUnified(docType, data, templateHtml?): Promise<string>` method
- Dispatches to `render`, `renderCreditNote`, `renderQuote`, `renderReceipt`, `renderPurchaseOrder`, etc. based on `docType`
- Accepts `DocumentTemplateData` (the union type)

### Step 5: Wire `OutputService` into the generation pipeline

**File**: `src/services/document-service.ts` (in `generateOutput` method)
```typescript
async generateOutput(docType, docId, format) {
  const data = buildDocumentTemplateData(docType, input);
  const html = await templateRenderer.renderUnified(docType, data, templateHtml);
  const result = await outputService.generate(format, html, ctx);
  await artifactService.store({ ...result, docType, docId });
  return result;
}
```

### Step 6: Add `/api/documents/generate` endpoint

**File**: `src/index.ts`
- POST `/api/documents/generate` — accepts `{ docType, docId, format?, templateId? }`
- Uses `DocumentService.generateOutput()`
- Returns generated content with proper MIME type

### Step 7: Wire `DocumentService` into existing per-type routes

**File**: `src/index.ts`
- Update existing `/api/invoices/:id/finalize`, `/api/quotes/:id/finalize`, etc. to delegate to `DocumentService.finalizeDocument(docType, id)`
- Update `/api/invoices/:id/pdf`, `/api/quotes/:id/pdf`, etc. to use `DocumentService.generateOutput("invoice", id, "pdf")`
- Ensure backward-compatible response shapes

### Step 8: Migrate invoice-service and receipt-service to use `buildDocumentTemplateData`

**File**: `src/services/invoice-service.ts`
- Replace `buildTemplateData(...)` call with `buildDocumentTemplateData("invoice", { ... })`
- Route PDF generation through `DocumentService` or `OutputService` directly

**File**: `src/services/receipt-service.ts`
- Replace `buildTemplateData(...)` call with `buildDocumentTemplateData("receipt", { ... })`
- Add `toTemplateData` method for receipt that produces `ReceiptTemplateData`

### Step 9: Add `receipt` and `purchase-order` to frontend `DocumentType`

**File**: `webapp/src/components/document/document-types.ts`
- Line 4: Add `"receipt"` and `"purchase-order"` to `DocumentType` union
- Add `referenceNumber?`, `providerName?`, etc. fields to `DocumentState` for receipt-specific fields

### Step 10: Create frontend handler registry

**File**: `webapp/src/components/document/document-handlers.ts` (NEW)
```typescript
export const documentHandlers = {
  invoice: {
    create: createInvoice,
    finalize: finalizeInvoice,
    send: sendInvoice,
    duplicate: duplicateInvoice,
    getPdf: getInvoicePdf,
    statusConfig: invoiceStatusConfig,
    createInputSchema: createInvoiceInputSchema,
    numberField: "invoice_number",
  },
  quote: { ... },
  "credit-note": { ... },
  "debit-note": { ... },
  "payment-voucher": { ... },
  receipt: { ... },       // NEW
  "purchase-order": { ... },  // NEW
}
```

### Step 11: Refactor `DocumentWorkspace.tsx` to use handler registry

**File**: `webapp/src/pages/DocumentWorkspace.tsx`
- Replace all `if (docType === "invoice") { ... } else if (...)` chains with `documentHandlers[docType].method()`
- Add `receipt` and `purchase-order` cases to `useDocumentData`, validation, save, finalize, send, duplicate flows
- Add handler entries for receipt/PO in the registry

**Key ternary chains to replace**:
- `useDocumentData` fetch dispatch (lines 168–193)
- `handleCreate`/`doSave` dispatch (lines ~700–780)
- `handleFinalize` dispatch (lines 842–875)
- `proceedFinalizeAndSend` dispatch (lines 895–926)
- `confirmSend` dispatch (lines 937–971)
- `handleDuplicate` dispatch (lines 973–990)

### Step 12: Add receipt/Purchase-Order routes to `App.tsx`

**File**: `webapp/src/App.tsx`
- Add `DocumentWorkspaceReceiptWithBoundary` and `DocumentWorkspacePurchaseOrderWithBoundary` wrappers
- Add routes:
  - `receipts/new`, `receipts/:id/edit` → `DocumentWorkspaceReceiptWithBoundary docType="receipt"`
  - `purchase-orders/new`, `purchase-orders/:id/edit` → `DocumentWorkspacePurchaseOrderWithBoundary docType="purchase-order"`

### Step 13: Refactor `Documents.tsx` to use unified hook

**File**: `webapp/src/pages/Documents.tsx`
- Extend `DocType` to include `receipt` and `purchase-order`
- Add receipt/PO to `createOptions` (already partially there, ensure paths match new routes)
- Convert to use `useDocuments` hook that handles all 7 types
- Add receipt/PO tabs or convert to single unified table with filter dropdown

### Step 14: Add universal document listing hook

**File**: `webapp/src/hooks/useDocuments.ts` (NEW)
- Fetches all 7 doc types via `Promise.allSettled`
- Returns unified list with `docType` discriminator
- Provides `loading`, `error`, `refetch`

### Step 15: Extend frontend document-model converter

**File**: `webapp/src/document-model/converter.ts`
- Rename `InvoiceDocument` type to `UniversalDocument` (it's already a generic structure)
- Add `receiptToDocument` and `purchaseOrderToDocument` converters
- Optionally generalize `invoiceToDocument` → `convertToDocument(docType, data, business, customer?)`

## Validation Plan

1. **Backend typecheck**: `npm run typecheck` — no new type errors
2. **Backend lint**: `npm run lint` — no new lint errors
3. **Backend tests**: `npm run test` — all existing tests pass + new tests for `buildDocumentTemplateData` receipt/PO cases and `DocumentArtifactService`
4. **Frontend typecheck**: `cd webapp && npm run typecheck` — no new type errors
5. **Frontend build**: `cd webapp && npm run build` — successful production build
6. **Integration smoke test**: Generate invoice PDF via both old endpoint (`/api/invoices/:id/pdf`) and new endpoint (`/api/documents/generate`) — verify identical output
7. **Artifact cache test**: Call `/api/documents/generate` twice with same inputs — second call should return cached artifact

## Risks

| Risk | Mitigation |
|---|---|
| Breaking existing invoice/quote workflows | Keep per-type API endpoints; route through `DocumentService` internally with backward-compatible response shapes |
| `buildDocumentTemplateData` never wired in → services still use `buildTemplateData` | Migrate one service at a time; keep `buildTemplateData` as backward-compatible wrapper if needed |
| `TemplateRenderer` class missing `renderDebitNote`/`renderPaymentVoucher`/`renderReceipt`/`renderPurchaseOrder` | Add these methods following the existing `renderCreditNote`/`renderQuote` pattern |
| `normalizeDocumentTypeKey` bug affects quote template lookup | Fix immediately in Step 1; add test |
| Frontend `DocumentWorkspace` ternary chains are deeply interdependent | Replace incrementally — start with `useDocumentData` (simplest), then add handlers for save/finalize/send |
| `InvoiceDocument` type rename affects many imports | Use type alias `export type InvoiceDocument = UniversalDocument` for backward compat |
| No `DocumentHandler` interface exists on backend yet | Define it as a simple interface in `document-service.ts` |
