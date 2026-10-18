# Universal Document Generator — Strategic Plan

## 1. Goal
Reposition the existing `universal-invoice-generator` codebase as a universal, multi-document, multi-format SaaS platform covering the full business-document lifecycle for SMBs. This is a planning artifact — no source changes in this turn.

## 2. Current State (verified from code)

### Document types supported
| Document type | Backend API | Frontend `DocumentType` | Template schema enum |
|---|---|---|---|
| invoice | ✓ `src/index.ts` | ✓ | `"invoice", "recurring_invoice"` |
| quote | ✓ | ✓ | `"quote"` |
| credit-note | ✓ | ✓ | `"credit_note"` |
| debit-note | ✓ | ✓ | — (missing from schema enum!) |
| payment-voucher | ✓ | ✓ | — (missing from schema enum!) |
| receipt | ✓ AI only | — | `"receipt"` |
| purchase-order | ✓ AI only | — | `"purchase_order"` |

**Gap:** `DocumentTypeSchema` in `src/domain/schemas/invoice-template.ts:6` is `["invoice", "recurring_invoice", "credit_note"]` — only 3 types. Live API routes exist for all 5. `DocumentTemplateInputSchema` at `src/domain/schemas/document-template.ts:26` has the full enum.

### Money & calculation
- `decimal.js`, `NUMERIC(18,6)`, integer minor-unit math — backend authoritative.
- `src/domain/calculation.ts` `InvoiceCalculationInput` interface.

### Templates & rendering
- Handlebars path: `src/services/templates/template-renderer.ts` — `buildDocumentTemplateData()` (line 1866) accepts `docType: DocumentTypeKey` (line 1859), `DocumentTypeKey = "invoice" | "credit-note" | "quote" | "debit-note" | "payment-voucher"`.
- Structured HTML path: `src/services/templates/structured-renderer.ts` — `StructuredTemplateRenderer.render()` (line 454), outputs full HTML document string.
- Document model: 24 component types registered in `webapp/src/document-model/registry/components.tsx`.

### PDF & output
- Pluggable: `src/services/pdf/pdf-service.ts` — `PdfProvider` interface (line 7), `PuppeteerPdfService` (line 12), `StubPdfService` (line 62).
- PDF generated from HTML via Puppeteer.

### Email
- Pluggable: `src/services/email/email-service.ts` — SMTP / Stub / SendGrid / SES providers.

### Persistence & isolation
- 67 migrations (`src/db/migrations/`), 64 numbered SQL files through `061_invoice_generator_schema.sql`.
- Tenant isolation: `business_id` on every query.

### Document lifecycle
- Immutable snapshots on finalize with SHA-256 hash (`src/services/invoice-service.ts` `finalize()` line 539, transactionally).
- Atomic numbering via DB row locks.

### AI
- `src/services/ai-service.ts` — `AiParseDocumentType` (line 46) includes `receipt` & `purchase_order`; stub LLM parsing.

### Frontend document model
- `webapp/src/document-model/types.ts` — `InvoiceDocument` type.
- `webapp/src/document-model/converter.ts` — `invoiceToDocument()`.
- `webapp/src/document-model/renderer.tsx` — `renderDocumentTree()` (line 93).
- `webapp/src/document-model/structured-renderer.ts` — HTML string path with 24 component types.
- `webapp/src/pages/DocumentWorkspace.tsx` — handles all 5 doc types via `docType` prop.

### Pricing
- `docs/MVP-PRD.md` — single tier $30/month, no free tier, tradesperson focus.

## 3. Repositioning Strategy

### Brand & positioning
- Rename product internally to **InvoiceFlow** → **FlowDocs** (or keep "InvoiceFlow" as brand, market as "the FlowDocs universal document platform"). Product name currently inconsistent: package.json says `universal-invoice-generator`, docs say "InvoiceFlow".
- Messaging: "From invoices to receipts to purchase orders — one platform for all your business documents."

### Target segments & GTM
| Segment | Primary doc types | Value hook |
|---|---|---|
| Tradespeople / freelancers | Invoice, quote, receipt | Fast creation + payment follow-up |
| E-commerce merchants | Invoice, receipt, credit note, debit note | Automated generation from orders |
| Wholesalers / B2B | Quote, PO, invoice, credit note | Template reuse + approval workflows |
| Agencies / consultants | Invoice, quote, contract (phase 5) | Branding + multi-client |

### Tiering model (post-pivot)
| Tier | Documents | Formats | Storage | Users | Price |
|---|---|---|---|---|---|
| Free | 5 types, 10 docs/mo | PDF only | 100 MB | 1 | $0 |
| Starter | All 7+ types, 100 docs/mo | PDF, HTML, DOCX | 1 GB | 3 | $15/mo |
| Professional | Unlimited, batch, AI | All formats | 10 GB | 10 | $49/mo |
| Business | API, webhooks, white-label | All + custom | 100 GB+ | Unlimited | $149/mo |

## 4. Technical Challenges & Solutions

### Challenge 1: Document-type-aware calculation engine
**Problem:** `InvoiceCalculationInput` is invoice-specific. Credit notes, debit notes, and payment vouchers have different line-item semantics (negative amounts, reference links, payee-vs-customer).

**Solution:**
1. Extend `DocumentTypeKey` to include `receipt` and `purchase_order` (currently only AI service supports them).
2. Create a `DocumentCalculationInput` interface that generalizes line items, taxes, discounts, and reference relationships.
3. Add type-specific calculators: `calculateInvoice()`, `calculateCreditNote()`, `calculateDebitNote()`, `calculatePaymentVoucher()` — each delegating to the shared `decimal.js` math primitives.
4. Migrate `finalize()` in `invoice-service.ts` to call a generic `calculateDocument()` dispatch.

### Challenge 2: Multi-format output pipeline
**Problem:** Currently only PDF via Puppeteer HTML→PDF. Need DOCX, HTML, TXT, CSV, email-embeddable HTML, PNG/SVG.

**Solution:** Leverage existing pluggable pattern from `PdfProvider`:
1. Create `src/services/output/` with a generic `OutputProvider` interface mirroring `PdfProvider`:
   ```typescript
   interface OutputProvider {
     name: string;
     generate(input: { html: string; ctx: RenderContext; options: OutputOptions }): Promise<OutputResult>;
   }
   ```
2. Implement:
   - `HtmlOutputProvider` — returns the structured HTML directly (from `StructuredTemplateRenderer`).
   - `PdfOutputProvider` — wraps existing `PuppeteerPdfService`.
   - `DocxOutputProvider` — use `html-to-docx` npm (verify no existing dependency) or build via `docx` library.
   - `TextOutputProvider` — parse HTML, emit plaintext with indentation.
   - `CsvOutputProvider` — extract line items to CSV format.
   - `EmailHtmlOutputProvider` — inline CSS, responsive email HTML (reuse structured renderer with email styles).
   - `PngOutputProvider` / `SvgOutputProvider` — Puppeteer screenshot (page for PNG, single element for SVG).
3. Output format selection driven by request query param or config.
4. **Key insight:** All formats derive from the same HTML intermediate from `StructuredTemplateRenderer`. Add format-aware style switching (media queries for screen vs. print vs. email).

### Challenge 3: Template schema unification
**Problem:** Two template schemas exist inconsistently (`invoice-template.ts` with 3 types, `document-template.ts` with 6 types). Component registry has 24 types but some are document-type-specific.

**Solution:**
1. Consolidate to a single `DocumentTemplateSchema` in `src/domain/schemas/document-template.ts` (the more complete version).
2. Add document-type-aware component visibility config: `{ visibleFor: ["invoice", "credit-note"] }` on each component.
3. Update `DocumentTypeSchema` in `invoice-template.ts` to match — add `debit_note`, `payment_voucher`, `receipt`, `purchase_order`.
4. Add `output_format` config per template (default: `pdf`, can specify `["pdf", "docx", "html"]`).
5. Update `buildDocumentTemplateData()` in `template-renderer.ts:1866` to accept `OutputProvider` options and merge format-specific context.

### Challenge 4: Batch & async generation
**Problem:** Currently synchronous finalize→send. Need batch generation for recurring invoices and bulk document export.

**Solution:**
1. Leverage existing Redis dependency (already used for rate-limiting, token revocation, job queue per AGENTS.md).
2. Add BullMQ (or existing queue lib if present) for job queue:
   - `batch-generate` job: takes list of document IDs + output format, dispatches parallel workers.
   - `async-render` job: for large batches, generates and emails link when ready.
3. Add `DocumentArtifact` storage table — stores generated file path/URL, format, document_id, SHA-256, expires_at.
4. Add `GET /documents/:id/download?format=docx` endpoint that returns the artifact (or triggers async generation if not yet rendered).

### Challenge 5: Document storage & public sharing
**Problem:** Public share links exist for invoices but need to extend to all doc types + format selection.

**Solution:**
1. Extend existing share-link table (check migration 053–061 for `shared_links` or similar).
2. Add `allowed_formats` column — restricts what formats a shared recipient can download.
3. Add `valid_until` override for shared links (existing links are permanent).
4. Storage backend: add `STORAGE_PROVIDER=s3|minio|local` config. Existing `pdf-service.ts` pattern of provider injection applies.

### Challenge 6: Frontend document model generalization
**Problem:** Types named `InvoiceDocument`, `InvoiceCalculation` — invoice-centric naming.

**Solution (low-risk, iterative):**
1. Create `webapp/src/document-model/types.ts` additions: `DocumentRecord` as alias, keep `InvoiceDocument` for backward compat.
2. Add `OutputProvider` selector dropdown in `DocumentWorkspace.tsx` — PDF, DOCX, HTML, etc.
3. Add batch-export button on `Documents.tsx` for lists.
4. Add format-aware `DownloadButton` component — shows format options in a popover.

### Challenge 7: AI document parsing expansion
**Problem:** `AiParseDocumentType` already includes receipt + purchase_order but backend only has invoice API routes.

**Solution:**
1. Add API routes: `POST /ai/parse-document` already exists (line 1520 in client.ts). Verify backend route exists in `src/index.ts`.
2. Add `POST /receipts` and `POST /purchase-orders` CRUD endpoints mirroring invoice pattern.
3. Wire AI parse results to populate the correct document type workspace.

## 5. Implementation Order (Phased)

### Phase A — Schema & type foundation (backend)
1. Unify `DocumentTypeSchema` + `DocumentTypeKey` to include all 7 types.
2. Create `OutputProvider` interface + `OutputResult` type in `src/services/output/`.
3. Create `DocumentCalculationInput` + dispatch in `src/domain/calculation.ts`.
4. Add `document_artifacts` table migration.
5. Add `document_templates.output_format` column.

### Phase B — Output providers (backend)
1. `HtmlOutputProvider` — wrap existing structured renderer output.
2. `PdfOutputProvider` — adapt existing `PuppeteerPdfService` to `OutputProvider` interface.
3. `DocxOutputProvider` — integrate `html-to-docx` or `docx` library.
4. `TextOutputProvider`, `CsvOutputProvider`, `EmailHtmlOutputProvider`.
5. `PngOutputProvider`, `SvgOutputProvider` via Puppeteer screenshot.

### Phase C — API endpoints (backend)
1. Add `GET /documents/:id/render?format=xxx` endpoint.
2. Add `POST /documents/:id/download-link` for async generation.
3. Extend `POST /documents/:id/share` with `allowed_formats`.
4. Add batch endpoints: `POST /batch-generate`, `GET /batch-generate/:jobId/status`.

### Phase D — Frontend (incrementally)
1. Add `OutputProvider` selector to `DocumentWorkspace` (reuse existing export/finalize flow).
2. Add `DownloadFormatPopover` component (shared, reusable).
3. Add batch export UI to `Documents.tsx` list page.
4. Add format selection to share dialog.

### Phase E — Batch & async (backend + frontend)
1. Integrate BullMQ job queue.
2. Add batch-generation route + frontend modal.
3. Add async-download with email notification when ready.

### Phase F — Pricing & billing migration
1. Add `plan` field to `businesses` table (free/starter/pro/business).
2. Add document-count + storage tracking per tenant.
3. Add usage limits middleware (documents_per_month, storage_bytes).
4. Update frontend pricing page with new tiers.

### Phase G — AI + new doc types
1. Add `POST /receipts` + `POST /purchase-orders` API routes.
2. Wire AI parsing results to new doc type workspaces.
3. Add receipt + purchase-order to frontend document list.

## 6. Key Risks

1. **Template schema inconsistency** — two schemas drift. Risk of breaking changes if not unified carefully. **Mitigation:** migrate gradually, keep `InvoiceDocument` alias.
2. **DOCX generation quality** — HTML→DOCX conversion loses fidelity. **Mitigation:** test with real-world templates, offer DOCX as "best effort" vs. PDF as print-fidelity.
3. **Batch generation resource limits** — Puppeteer workers consume memory. **Mitigation:** limit concurrent renders per tenant via BullMQ concurrency + queue.
4. **Pricing migration** — existing $30/mo customers. **Mitigation:** grandfather existing customers, offer downgrade path.
5. **Debit-note + payment-voucher missing from schema enum** — current API routes work but schema validation fails. Must fix in Phase A.

## 7. Validation Plan
- `npm run typecheck` — backend + frontend after each phase.
- `npm run lint` — 0 errors (warnings acceptable, matching existing 520-warning pattern).
- `npm run test` — vitest, add new tests for calculation dispatch + output providers.
- E2E smoke test: render a sample invoice/quote/credit-note in PDF/DOCX/HTML/CSV/TXT.
- Template rendering test: verify all 24 component types work with email HTML format.
- Integration test: batch-generate 50 documents, verify all artifacts stored + linked.

## 8. Out of Scope (for now)
- Workflow/approval engine (Phase 6+).
- Template marketplace (Phase 7+).
- White-label reseller features.
- OCR receipt scanning (beyond AI text-parse).
