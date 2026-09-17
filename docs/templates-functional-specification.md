# Functional Specification: Templates Module

**Version:** 1.0  
**Date:** 2026-09-17  
**Status:** Draft  
**Product:** Universal Invoice Generator  
**Scope:** Invoice, estimate, and recurring invoice template design and management  

---

## Table of Contents

1. [Overview & Purpose](#1-overview--purpose)
2. [Core Functionality](#2-core-functionality)
3. [Customization Options](#3-customization-options)
4. [Data Model](#4-data-model)
5. [API Layer](#5-api-layer)
6. [User Interface Design](#6-user-interface-design)
7. [Workflow Integration](#7-workflow-integration)
8. [Business Logic & Segmentation](#8-business-logic--segmentation)
9. [Lifecycle & Versioning](#9-lifecycle--versioning)
10. [Security & Data Integrity](#10-security--data-integrity)
11. [Business Rules & Constraints](#11-business-rules--constraints)
12. [Appendix A: Component Type Reference](#appendix-a-component-type-reference)
13. [Appendix B: Settings Schema](#appendix-b-settings-schema)

---

## 1. Overview & Purpose

The **Templates module** enables users to create, manage, and reuse visual and structural designs for all document types produced by the system — invoices, estimates/quotes, and recurring invoices. A template is a **structured, versioned, tenant-scoped document layout** composed of reusable components arranged in a section → row → column hierarchy.

### 1.1 Problem Statement

Without templates, every invoice is created from scratch, leading to:

- Inconsistent branding across documents sent to different customers.
- Wasted time reconfiguring layout, payment terms, tax settings, and footers for each document.
- Errors from manually entering recurring line items or terms.
- No mechanism to enforce compliance with industry-specific or regulatory requirements.

### 1.2 Solution

Templates solve these problems by providing:

- **Reusable designs** — A single template can be applied to any invoice, estimate, or recurring invoice.
- **Brand consistency** — Logo, colors, fonts, and business details are stored centrally in the template.
- **Pre-configured content** — Payment terms, default notes, tax configurations, and predefined line items are stored in the template and applied on use.
- **Segment-based customization** — Different templates can be associated with different customer segments or service types.
- **Version control** — Published revisions are immutable and tracked; changes create new revisions.

### 1.3 Document Types Supported

| Document Type | Description | Template Storage |
|---|---|---|
| **Invoices** | One-off or project-based bills | `invoices.template_id` foreign key |
| **Estimates/Quotes** | Proposals provided to customers before work | `quotes.template_id` foreign key (Phase 4) |
| **Recurring Invoices** | Automated periodic billing schedules | `recurring_invoices.template_id` foreign key |

All three document types share the same `InvoiceTemplate` entity and the same structured `InvoiceDocument` model. The template's `document` JSON contains the full layout; the `config` JSONB column stores document-type-specific overrides (e.g., default payment terms, default footer messages, default line items).

### 1.4 Relationship to Existing Systems

```
Businesses ──┐
             ├── TemplateService (src/services/templates/invoice-template-service.ts)
             │     ├── TemplateRepository (src/repositories/invoice-template.repo.ts)
             │     ├── StructuredTemplateRenderer (src/services/templates/structured-renderer.ts)
             │     ├── TemplateRenderer / Handlebars (src/services/templates/template-renderer.ts)
             │     └── Migration Engine (src/services/templates/migrations.ts)
             │
             ├── DB: document_templates, document_template_revisions,
             │       invoice_template_permissions, invoice_template_usage
             │
             └── API: /api/invoice-templates/* (src/index.ts:1242–1375)
                     └── Frontend: api/client.ts:522–620
```

---

## 2. Core Functionality

### 2.1 Create Template

**User action:** The user clicks "New Template" on the Templates management page. The system presents a gallery of preset templates (Industry, Professional, and Blank canvases). Selecting a preset or starting from blank opens the template editor.

**System behavior:**

1. A new `InvoiceTemplate` record is created in `draft` lifecycle state with `is_default = false` and `is_active = true`.
2. The template's `document` field is populated with the selected preset's structured document model (or an empty blank document).
3. The template's `config` field is initialized with default values (currency, locale, default font, etc.).
4. The user edits the template in the Template Editor (see §6).
5. Saving creates/updates the template record via `POST /api/invoice-templates` (create) or `PATCH /api/invoice-templates/:id` (update).

**API contract:**

```
POST /api/invoice-templates
Request body (validated by InvoiceTemplateCreateRequestSchema):
  {
    "name": "string (required, max 255)",
    "description": "string | null",
    "industry": "string | null",          // e.g., "construction", "legal", "retail"
    "document": { ... },                   // InvoiceTemplateDocumentJSON
    "htmlTemplate": "string | null",       // optional Handlebars HTML template
    "config": { ... },                     // arbitrary key-value config
    "isDefault": boolean (default false),
    "isActive": boolean (default true)
  }
Response: { "template": { ...InvoiceTemplateResponseDTO } }
```

### 2.2 Read / List Templates

**User action:** The user navigates to the Templates management page (`/app/templates`). The system loads and displays all templates for the current business.

**System behavior:**

1. `GET /api/invoice-templates` is called with optional query parameters for filtering.
2. Templates are sorted by `is_default DESC, created_at DESC` — default templates appear first.
3. Each template is displayed as a preview card (see §6.2).

**API contract:**

```
GET /api/invoice-templates?limit=50&offset=0&industry=construction&isDefault=true&lifecycle=published

Response:
  {
    "templates": [ { ...InvoiceTemplateResponseDTO }, ... ],
    "limit": 50,
    "offset": 0
  }
```

### 2.3 Update Template

**User action:** The user modifies template properties (name, description, industry, document layout, config) in the Template Editor and saves.

**System behavior:**

1. `PATCH /api/invoice-templates/:id` is called with partial update fields.
2. Only `draft` and `published` templates can be updated. `archived` templates must be unarchived first.
3. The `revision` and `version` counters are not incremented on draft saves — they increment on publish.
4. The `document`, `htmlTemplate`, and `config` fields are validated against their respective Zod schemas.

**API contract:**

```
PATCH /api/invoice-templates/:id
Request body (validated by InvoiceTemplateUpdateRequestSchema — all fields optional):
  {
    "name": "string",
    "description": "string | null",
    "industry": "string | null",
    "document": { ... },
    "htmlTemplate": "string | null",
    "config": { ... },
    "isDefault": boolean,
    "isActive": boolean
  }
Response: { "template": { ...InvoiceTemplateResponseDTO } }
```

### 2.4 Delete Template

**User action:** The user clicks the Delete action on a template card, confirms the deletion in a modal dialog.

**System behavior:**

1. A confirmation dialog is shown: "Delete '{templateName}'? This action cannot be undone."
2. On confirmation, `DELETE /api/invoice-templates/:id` is called.
3. If the template is the business default (`is_default = true` and `lifecycle = 'published'`), the system rejects the deletion with a `400 Bad Request` and an error message: "Cannot delete the default template. Change the default first."
4. If the template is referenced by any non-draft invoices, the system rejects the deletion with a `409 Conflict` and an error message: "Template is in use by {n} finalized invoices. Archive it instead."
5. On success, the template row and all associated revisions and permissions are cascade-deleted (PostgreSQL `ON DELETE CASCADE`).

**API contract:**

```
DELETE /api/invoice-templates/:id
Response: 204 No Content (on success)
          400 Bad Request (is the default published template)
          409 Conflict (referenced by finalized invoices)
```

### 2.5 Duplicate Template

**User action:** The user clicks the "Duplicate" action on a template card.

**System behavior:**

1. `POST /api/invoice-templates/:id/duplicate` is called.
2. A new template is created with:
   - `name` = "{original name} (Copy)"
   - `revision` = original.revision + 1
   - `version` = original.version + 1
   - `lifecycle` = "draft"
   - `is_default` = false
   - `is_active` = original.is_active
   - `published_at`, `archived_at` = null
   - All other fields (document, config, htmlTemplate, industry, description) copied from the original.
3. The new template inherits the same `business_id` (tenant isolation).
4. The new template appears in the list immediately with a "Draft" lifecycle badge.

**API contract:**

```
POST /api/invoice-templates/:id/duplicate
Response: { "template": { ...InvoiceTemplateResponseDTO } }  (HTTP 201)
```

### 2.6 Set Default Template

**User action:** The user clicks "Set as Default" on a published template card.

**System behavior:**

1. `POST /api/invoice-templates/:id/set-default` is called.
2. A database transaction ensures atomicity:
   - All other templates for the business have `is_default = FALSE`.
   - The selected template has `is_default = TRUE`.
3. Only `published` templates can be set as default. Attempting to set a `draft` or `archived` template as default returns `400 Bad Request`.
4. The default template is automatically applied when creating new invoices, estimates, or recurring invoices if no explicit template is selected.

**API contract:**

```
POST /api/invoice-templates/:id/set-default
Response: { "template": { ...InvoiceTemplateResponseDTO } }
          400 Bad Request (template is not published)
```

### 2.7 Preview Template

**User action:** The user clicks the "Preview" action on a template card.

**System behavior:**

1. The system renders the template's structured document using sample data (see `TemplatePreview.tsx` — uses `SAMPLE_BUSINESS`, `SAMPLE_CUSTOMER`, `SAMPLE_INVOICE` with sample line items and totals).
2. The rendered preview appears in a modal overlay showing a realistic invoice/estimate layout.
3. The preview uses the `StructuredTemplateRenderer` (server-side) or the frontend `renderDocumentTree` for client-side rendering.
4. The preview is read-only — no editing is possible from the preview modal.

**API contract (server-rendered preview):**

```
POST /api/invoice-templates/:id/render
Request body:
  {
    "document": { ... } | null,     // optional override; uses template if null
    "config": { ... } | null,       // optional override
    "schemaVersion": "1.0"          // defaults to current
  }
Response: { "html": "string", "templateId": "uuid", "schemaVersion": "1.0" }
```

### 2.8 Search, Filter, and Paginate Templates

**User action:** The user uses the search bar, filter dropdowns, or pagination controls on the Templates management page.

**System behavior:**

1. Filtering is supported by:
   - `lifecycle` (draft, published, archived)
   - `industry` (string match)
   - `isDefault` (boolean)
   - `isActive` (boolean)
   - Text search (name contains query)
2. Pagination uses `limit` (max 200, default 50) and `offset`.
3. Results are sorted by `is_default DESC, created_at DESC`.

---

## 3. Customization Options

Templates expose a comprehensive set of customization options organized into logical sections. These are accessible via the **Template Customization Panel** (`TemplateCustomizationPanel.tsx`) in the template editor.

### 3.1 Branding

| Setting | Path | Description |
|---|---|---|
| **Logo** | `businessInfo.props.showLogo` + business `logo_url` | Toggle visibility of the business logo in the document header. Logo is fetched from the business record. |
| **Primary Color** | `document.settings.defaultColor` | Global text and accent color (default `#1f2937` / slate-700). Applied to all text elements. |
| **Font Family** | `document.settings.defaultFont` | Font stack for the entire document (default: system-ui stack). Predefined options: System UI, Serif, Monospace, Helvetica, Times New Roman. |
| **Font Size** | `document.settings.defaultFontSize` | Base font size in px (default 14, range 8–24). |
| **Accent Colors** | Per-component `style.color` | Individual component colors can be overridden in the Property Inspector. |

### 3.2 Layout Design

The layout is based on a **structured document model** — a hierarchical composition of:

```
Section → Row → Column → Component
```

Each level supports its own styling (padding, margins, gaps, flexbox properties, borders).

**Layout settings** (in `document.settings`):

| Setting | Type | Default | Description |
|---|---|---|---|
| `pageSize` | enum | `"A4"` | Paper size: A4, Letter, Legal |
| `orientation` | enum | `"portrait"` | Page orientation: portrait, landscape |
| `margins.top` | number | `40` | Top margin in px |
| `margins.right` | number | `40` | Right margin in px |
| `margins.bottom` | number | `40` | Bottom margin in px |
| `margins.left` | number | `40` | Left margin in px |

**Structural settings per component:**

| Component | Layout Properties | Description |
|---|---|---|
| Section | `fullWidth` (boolean) | Whether the section spans the full page width or is constrained |
| Row | `columns` (number), `columnGap`, `rowGap` | Grid-like row with N columns and gap spacing |
| Column | `span` (number) | Relative width fraction (used in flex layout) |

### 3.3 Component Visibility

Every component in the document model has a `visible` boolean flag (default `true`). Toggling visibility is per-component via the Property Inspector. Common visibility toggles include:

- Business info fields: name, email, phone, website, address, logo
- Customer info fields: name, company, email, address, phone
- Line item columns: quantity, unit, unit price, discount, tax, line total
- Line item table header
- Subtotal, discount, tax, fees, total, amount due sections
- Signature block (date, name)

### 3.4 Payment Terms

Payment terms are stored as a `paymentTerms` component within the document structure:

```json
{
  "type": "paymentTerms",
  "props": {
    "content": "Net 30",
    "label": "Payment Terms"
  }
}
```

- **Content**: The payment terms text (e.g., "Net 30", "Due on Receipt", "50% upfront, balance on delivery").
- **Label**: The display label above the terms content (default "Payment Terms").
- **Preset defaults**: Vary by industry (e.g., construction defaults to "Net 30", landscaping defaults to "Due on Receipt").

### 3.5 Default Notes

Default notes are stored as a `notes` component:

```json
{
  "type": "notes",
  "props": {
    "content": "Thank you for your business! Please reach out with any questions.",
    "label": "Notes"
  }
}
```

- **Content**: Full multi-line text for the notes section.
- **Label**: Display label (default "Notes").
- **Preset defaults**: Vary by industry (e.g., photography includes copyright retention notice, legal includes privilege disclaimer).

### 3.6 Tax Configurations

Tax configuration is **dynamic per document** — the template does not hardcode tax rates but controls how tax is displayed. The actual tax rates are determined at document creation time from:

1. The invoice's `currency` field.
2. The business's `default_tax_rate` from `business_settings`.
3. Product-level `default_tax_rate` from the `products` table.
4. Manual tax rate overrides on individual line items or fees.
5. Customer-level tax exemptions.

**Template-level tax display settings** (via `lineItems` component props and `TaxComponent`):

| Setting | Path | Description |
|---|---|---|
| Show tax column in line items | `lineItems.props.showTax` | Toggle visibility of the tax column in the line items table |
| Tax label | `tax.props.label` | Label for the tax total row (default "Tax") |
| Show tax breakdown | `tax.props.showBreakdown` | Whether to show per-rate tax breakdown or a combined total |
| Currency display | `document.settings.currency` | Default currency for the template (e.g., "USD") |
| Locale | `document.settings.locale` | Locale for number formatting (e.g., "en-US") |

### 3.7 Predefined Line Items / Services

Predefined line items are stored in the template's `config` field as a JSON array. This allows industry-specific default services to be offered when creating an invoice from a template:

```json
{
  "config": {
    "defaultLineItems": [
      {
        "description": "Consultation",
        "quantity": "1",
        "unit": "each",
        "unitPrice": "150.00",
        "taxRate": "0.08",
        "isTaxInclusive": false
      },
      {
        "description": "Project Management",
        "quantity": "10",
        "unit": "hours",
        "unitPrice": "125.00",
        "taxRate": "0.08",
        "isTaxInclusive": false
      }
    ],
    "defaultFees": [],
    "defaultFooterMessage": "Thank you for your business!",
    "defaultTerms": "Payment is due within 30 days of the invoice date."
  }
}
```

**Fields per predefined line item:**

| Field | Type | Description |
|---|---|---|
| `description` | string (required) | Service or product description |
| `quantity` | string | Default quantity (supports decimals) |
| `unit` | string | Unit of measure: each, hour, day, week, month, license, etc. |
| `unitPrice` | string | Default unit price in the template's currency |
| `taxRate` | string | Default tax rate as decimal (e.g., "0.08" for 8%) |
| `isTaxInclusive` | boolean | Whether the price includes tax |
| `discount` | string | Optional default discount |
| `discountType` | enum | "fixed" or "percentage" |

**Fields per predefined fee:**

| Field | Type | Description |
|---|---|---|
| `description` | string (required) | Fee description (e.g., "Processing Fee") |
| `amount` | string | Default fee amount |
| `taxRate` | string | Tax rate applied to the fee |

### 3.8 Additional Customization Fields

| Setting | Path | Description |
|---|---|---|
| **Document Title** | `document.name` | Internal name shown in the template editor |
| **Industry** | Root-level `industry` column | Tags the template for industry-specific default lookup |
| **Description** | Root-level `description` column | Short description shown on the template card |
| **Currency Override** | `document.settings.currency` | Default currency when creating from this template |

---

## 4. Data Model

### 4.1 Database Schema

The primary template table is `document_templates`, created in migration `008_document_composition.sql` and extended in `009_document_templates.sql` and `010_invoice_templates_lifecycle.sql`.

```sql
-- Primary table: document_templates
CREATE TABLE document_templates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  industry          TEXT,                                    -- 009_document_templates.sql
  schema_version    VARCHAR(20) NOT NULL DEFAULT '1.0',      -- 008
  revision          BIGINT NOT NULL DEFAULT 1,               -- 008
  version           INTEGER NOT NULL DEFAULT 1,              -- 009
  document          JSONB NOT NULL,                          -- structured document model
  html_template     TEXT,                                    -- optional Handlebars template
  config            JSONB NOT NULL DEFAULT '{}'::jsonb,     -- extensibility config
  is_default        BOOLEAN NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  lifecycle         invoice_template_lifecycle NOT NULL DEFAULT 'draft',  -- 010
  published_at      TIMESTAMPTZ,                             -- 010
  archived_at       TIMESTAMPTZ,                             -- 010
  published_revision BIGINT,                                  -- 010
  lifecycle_updated_by UUID,                                 -- 010
  lifecycle_updated_at TIMESTAMPTZ,                           -- 010
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID,
  updated_by        UUID,
  CONSTRAINT uq_document_template_business_name UNIQUE (business_id, name)
);

-- Revision history table
CREATE TABLE document_template_revisions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id     UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  revision        BIGINT NOT NULL,
  schema_version  VARCHAR(20) NOT NULL,
  document        JSONB NOT NULL,
  html_template   TEXT,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary  VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  CONSTRAINT uq_template_revision UNIQUE (template_id, revision)
);

-- Usage tracking
CREATE TABLE invoice_template_usage (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_id     UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  invoice_id      UUID REFERENCES invoices(id) ON DELETE SET NULL,
  used_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fine-grained permissions
CREATE TABLE invoice_template_permissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_id     UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  permission      VARCHAR(50) NOT NULL CHECK (permission IN ('view', 'edit', 'publish', 'archive')),
  granted_by      UUID,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_template_user_permission UNIQUE (template_id, user_id, permission)
);

-- Schema version registry
CREATE TABLE document_template_schema_versions (
  version         VARCHAR(20) PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  schema          JSONB NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.2 Template Lifecycle Enum

```sql
CREATE TYPE invoice_template_lifecycle AS ENUM ('draft', 'published', 'archived');
```

| State | Description | Can Edit? | Can Apply to Documents? | Can Delete? | Can Archive? |
|---|---|---|---|---|---|
| `draft` | Newly created, not yet live | Yes | No | Yes* | No (already draft) |
| `published` | Live and available for use | Yes (creates new revision) | Yes | No (must archive first) | Yes |
| `archived` | Retired, hidden from active use | No | No | Yes | No (already archived) |

\* Delete is permitted for draft templates. Published templates must be archived first.

### 4.3 Structured Document Model

The `document` JSONB field contains a structured layout:

```typescript
interface InvoiceDocument {
  id: string;              // UUID
  version: number;         // document version
  name: string;            // internal name
  businessId: string;
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
  sections: Record<SectionId, SectionComponent>;
  rows: Record<RowId, RowComponent>;
  columns: Record<ColumnId, ColumnComponent>;
  components: Record<ComponentId, AnyComponent>;
  rootSectionId: SectionId;
  settings: DocumentSettings;
  schemaVersion?: string;  // defaults to "1.0"
}
```

### 4.4 Template Model (TypeScript)

Located at `src/domain/schemas/invoice-template.ts:57`:

```typescript
interface InvoiceTemplate {
  id: string;
  businessId: string;
  name: string;                          // 1–255 chars
  description?: string | null;
  industry?: string | null;
  schemaVersion: string;                // "1.0"
  revision: number;                     // BIGINT, incremented on publish
  version: number;                      // INTEGER, incremented on any update
  document: Record<string, unknown>;    // structured document model
  htmlTemplate?: string | null;         // Handlebars template (optional)
  config: Record<string, unknown>;      // extensibility config
  isDefault: boolean;                   // only one per business + lifecycle
  isActive: boolean;                    // soft delete alternative
  lifecycle: "draft" | "published" | "archived";
  publishedAt?: Date | null;
  archivedAt?: Date | null;
  publishedRevision?: number | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
}
```

### 4.5 Existing Templates Table (Legacy)

The system also maintains a legacy `templates` table (`001_initial_schema.sql:110`) used by the older Handlebars-only template system:

```sql
CREATE TABLE templates (
  id          UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  name        VARCHAR(255) NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  config      JSONB NOT NULL DEFAULT '{}',
  html_template TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

This table is maintained for backward compatibility with older invoices that used Handlebars templates. The `invoice_snapshots` table stores the rendered HTML from whichever system was used.

---

## 5. API Layer

### 5.1 RESTful Endpoints

All template endpoints are defined in `src/index.ts:1242–1375` and require authentication (`requireAuth`). Every operation enforces tenant isolation via `req.user.businessId`.

| Method | Route | Description | Auth |
|---|---|---|---|
| GET | `/api/invoice-templates` | List templates with filtering | `requireAuth` |
| POST | `/api/invoice-templates` | Create new template (initial draft) | `requireAuth` |
| GET | `/api/invoice-templates/default` | Get default template for business (optionally by industry) | `requireAuth` |
| GET | `/api/invoice-templates/:id` | Get single template by ID | `requireAuth` |
| PATCH | `/api/invoice-templates/:id` | Update template fields | `requireAuth` |
| DELETE | `/api/invoice-templates/:id` | Delete template | `requireAuth` |
| POST | `/api/invoice-templates/:id/duplicate` | Create a copy of the template | `requireAuth` |
| POST | `/api/invoice-templates/:id/set-default` | Set as the business default template | `requireAuth` |
| POST | `/api/invoice-templates/:id/publish` | Publish (creates revision, sets lifecycle to published) | `requireAuth` |
| POST | `/api/invoice-templates/:id/archive` | Archive template | `requireAuth` |
| POST | `/api/invoice-templates/:id/unarchive` | Restore archived template | `requireAuth` |
| GET | `/api/invoice-templates/:id/revisions` | List all revisions for a template | `requireAuth` |
| GET | `/api/invoice-templates/:id/revisions/:revision` | Get a specific revision | `requireAuth` |
| POST | `/api/invoice-templates/:id/revisions/:revision/restore` | Restore a revision as the current version | `requireAuth` |
| GET | `/api/invoice-templates/:id/with-revisions` | Get template with revision history | `requireAuth` |
| POST | `/api/invoice-templates/:id/migrate` | Migrate template schema to a newer version | `requireAuth` |
| POST | `/api/invoice-templates/:id/render` | Render template to HTML with sample or provided data | `requireAuth` |
| GET | `/api/invoice-templates/:id/usage` | Get usage count (how many invoices used this template) | `requireAuth` |
| POST | `/api/invoice-templates/:id/permissions` | Set per-user permission on template | `requireAuth` |
| GET | `/api/invoice-templates/:id/permissions` | List template permissions | `requireAuth` |

### 5.2 Query Parameters

**List templates** (`GET /api/invoice-templates`):

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer (string→int transform) | 50 (max 200) | Page size |
| `offset` | integer (string→int transform) | 0 | Pagination offset |
| `industry` | string | — | Filter by industry tag |
| `isDefault` | string→boolean | — | Filter by default status |
| `lifecycle` | string | — | Filter by lifecycle state (can be comma-separated for multiple) |
| `isActive` | string→boolean | — | Filter by active status |

Validation is performed via `InvoiceTemplateListParamsSchema` (`src/schemas/invoice-template-dto.ts:167`).

### 5.3 Request/Response DTOs

**Create request** (`InvoiceTemplateCreateRequestSchema`):

| Field | Required | Schema |
|---|---|---|
| `name` | Yes | string, 1–255 chars |
| `description` | No | string \| null |
| `industry` | No | string \| null |
| `schemaVersion` | No | string, default "1.0" |
| `document` | Yes | `InvoiceTemplateDocumentSchema` |
| `htmlTemplate` | No | string \| null, default null |
| `config` | No | `Record<string, unknown>`, default {} |
| `isDefault` | No | boolean, default false |
| `isActive` | No | boolean, default true |

**Update request** (`InvoiceTemplateUpdateRequestSchema`):

All fields from Create request, but all are optional (`.optional()`).

**Response** (`InvoiceTemplateResponseSchema`):

All fields from `InvoiceTemplate` model plus:
- `publishedRevision` — the revision number that was published
- `publishedAt` — when the template was last published
- `archivedAt` — when the template was archived

### 5.4 Business Layer

The `InvoiceTemplateService` (`src/services/templates/invoice-template-service.ts`) encapsulates all business logic:

- **create** — Validates input via `InvoiceTemplateInputSchema`, delegates to repository.
- **findDefault** — Looks up default template, with industry-specific fallback to generic default.
- **publish** — Validates lifecycle is not `archived`, creates a revision record, atomically updates lifecycle, increments revision, sets timestamps.
- **archive** — Validates that the template is not both `isDefault` and `published` (would leave business without a default).
- **setDefault** — Delegates to repository which uses a transaction to clear other defaults and set the new one.
- **renderToHtml** — Loads template, calls `StructuredTemplateRenderer.render()` with provided `RenderData`.

### 5.5 Repository Layer

The `InvoiceTemplateRepository` (`src/repositories/invoice-template.repo.ts`) handles all database operations:

- **`setDefault`** — Uses a transaction (`getClient`, `BEGIN`/`COMMIT`/`ROLLBACK`) to ensure atomicity.
- **`publish`** — Creates a revision record and updates the template in the same transaction.
- **`archive`** — If archiving the default published template, automatically promotes another published template as the new default.
- **`createRevision`** — Increments `revision`, `version`, and creates a revision record in the same transaction.
- **`restoreRevision`** — Copies a revision's data back to the template, creates a new revision entry.
- **`normalizeDocument`** — Ensures `settings` defaults are present if not provided.

---

## 6. User Interface Design

### 6.1 Page: Templates Management (`/app/templates`)

#### 6.1.1 Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Templates                                    [ + New Template ] │
│ Choose a preset to get started or customize an existing template.│
├─────────────────────────────────────────────────────────────────┤
│ [ Search ]  [ Filter: Lifecycle ▼ ]  [ Filter: Industry ▼ ]     │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐ ┌──────────────────────────┐ ...  │
│ │ [ PREVIEW ]              │ │ [ PREVIEW ]              │      │
│ │ My Corporate Invoice     │ │ Construction Co.         │      │
│ │ Invoice • Published      │ │ Invoice • Published      │      │
│ │ Updated Sep 12           │ │ Updated Sep 10           │      │
│ │ Default                  │ │                          │      │
│ │ [E] [D] [P] [X]          │ │ [E] [D] [P] [X]          │      │
│ └──────────────────────────┘ └──────────────────────────┘      │
│                                                                 │
│ ┌──────────────────────────┐ ┌──────────────────────────┐ ...  │
│ │ [ PREVIEW ]              │ │ [ PREVIEW ]              │      │
│ │ Brand Consistency        │ │ Legal Services           │      │
│ │ Invoice • Draft          │ │ Invoice • Published      │      │
│ │ Updated Sep 8            │ │ Updated Sep 5            │      │
│ │ [E] [D] [P] [X]          │ │ [E] [D] [X]              │      │
│ └──────────────────────────┘ └──────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

**Key elements:**

1. **Page header**: Title "Templates", subtitle description.
2. **Primary CTA button**: "+ New Template" — opens the preset gallery modal.
3. **Search & Filters**: Text search, lifecycle filter dropdown, industry filter dropdown.
4. **Preview card grid**: 3-column responsive grid on desktop, 2-column on tablet, 1-column on mobile.
5. **Empty state**: Centered content with "No templates yet" message and "Create from preset" button.

#### 6.1.2 Preview Card Components

Each template is displayed as a **preview card** with the following elements:

##### Visual Preview (Top)

- A scaled-down rendering of the template using sample data.
- Rendered via `TemplatePreview` component (`webapp/src/components/TemplatePreview.tsx`).
- Uses a `scale-[0.3]` transform on a 210mm-wide content area.
- Maximum height of 120px for the preview container.
- Fallback to `DEFAULT_DOCUMENT` if the template document is invalid.

##### Card Header (Overlay badges)

Positioned absolutely at `top-2, right-2` with a flex gap:

| Badge | Condition | Style |
|---|---|---|
| **Default** | `template.isDefault === true` | `bg-primary-100 text-primary-800` pill, "Default" label |
| **Lifecycle** | Always shown | Color varies: Draft=`bg-amber-100 text-amber-800`, Published=`bg-green-100 text-green-800`, Archived=`bg-slate-100 text-slate-800` |

##### Card Body

```
┌─────────────────────────────────────────┐
│ <Template Name>                         │  ← font-semibold, slate-900
│ <Description>                           │  ← text-sm, slate-500 (optional, line-clamp-2)
│ <Industry>                              │  ← text-xs, bg-slate-100 text-slate-600 (optional)
│                                         │
│ Updated <date>    [E] [D] [P] [X]       │  ← text-xs, slate-500; action buttons
└─────────────────────────────────────────┘
```

**Template name**: `t.name` — bold, slate-900.
**Description**: `t.description` — optional, truncated to 2 lines.
**Industry**: `t.industry` — optional, small badge with `bg-slate-100 text-slate-600`.
**Last updated**: `new Date(t.updatedAt).toLocaleDateString()` — displayed as "Updated Sep 12".

##### Management Actions

Each card has action buttons in the bottom-right, displayed as small text links:

| Action | Icon | Condition | Behavior |
|---|---|---|---|
| **Edit** | `Edit template →` | Always | Link to `/app/templates/{id}/edit` |
| **Duplicate** | `Duplicate` | Always | Calls `duplicateInvoiceTemplate(id)`, shows loading state |
| **Preview** | `Preview` | Always | Opens a modal with full-size rendered preview |
| **Delete** | `Delete` | Draft or Archived only | Confirmation dialog, then `deleteInvoiceTemplate(id)` |
| **Set Default** | `Set Default` | Not currently default, Published lifecycle | Calls `setDefaultInvoiceTemplate(id)` |
| **Publish** | `Publish` | Draft lifecycle | Calls `publishInvoiceTemplate(id)` |
| **Archive** | `Archive` | Published lifecycle | Calls `archiveInvoiceTemplate(id)` |
| **Unarchive** | `Unarchive` | Archived lifecycle | Calls `unarchiveInvoiceTemplate(id)` |

**Loading states**: Each action shows a loading spinner when `actionLoading` matches the action's key (e.g., `dup-${id}`, `lc-${id}`, `default-${id}`, `del-${id}`).

**Card styling**: `bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group transition-shadow hover:shadow-md` — consistent with the design system's card specification (see `docs/ui-ux-specification.md:629`).

### 6.2 Page: Template Editor (`/app/templates/:id/edit` and `/app/templates/new`)

#### 6.2.1 Editor Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back   Template Name           [Undo] [Redo] [Preview] [Save] │
│ ┌───────────┬───────────────────────────────────────────────────┐ │
│ │           │                                                   │ │
│ │ Customization│    Live Preview                           │ │
│ │ Panel        │    (scaled document render)                │ │
│ │              │                                               │ │
│ │ - Brand      │                                               │ │
│ │ - Typography │                                               │ │
│ │ - Page Setup │                                               │ │
│ │ - Business   │                                               │ │
│ │ - Customer   │                                               │ │
│ │ - Payment    │                                               │ │
│ │ - Notes      │                                               │ │
│ │ - Terms      │                                               │ │
│ └───────────┴───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Left panel** (`TemplateCustomizationPanel.tsx`): Collapsible sections for:

1. **Brand** — Primary color picker (hex input + color picker), logo URL (shows when `businessInfo.props.showLogo` is checked), "Show Logo" checkbox.
2. **Typography** — Font family dropdown (5 predefined options), font size slider (8–24px).
3. **Page Setup** — Page size dropdown (A4, Letter, Legal), orientation toggle (portrait/landscape), margin sliders (top, right, bottom, left, each 0–100px).
4. **Business Details** — Checkboxes for each business info field (Name, Email, Phone, Website, Address, Logo). Only shown when a `businessInfo` component exists in the document.
5. **Customer Details** — Checkboxes for each customer info field (Name, Company, Email, Address, Phone). Only shown when a `customerInfo` component exists.
6. **Payment Terms** — Text input for terms content (e.g., "Net 30"). Shows "Add Payment Terms" button if no `paymentTerms` component exists.
7. **Notes** — Label input + textarea for notes content. Shows "Add Notes Section" button if no `notes` component exists.
8. **Terms** — Label input + textarea for terms content. Shows "Add Terms Section" button if no `terms` component exists.

**Right panel**: Live preview of the template using `TemplatePreview` component with sample data. Updates in real-time as settings change.

#### 6.2.2 Editor Header Controls

| Control | Behavior |
|---|---|
| **Template name input** | Inline editable text field, triggers save state change |
| **Template description input** | Secondary text field below name |
| **Lifecycle badge** | Visual indicator with dropdown: Draft → Publish, Published → Archive, Archived → Unarchive |
| **Set Default button** | Only visible for non-default templates; sets as business default |
| **Delete button** | Confirmation dialog; only available for draft/archived templates |
| **Save button** | Persists all changes via API; disabled while saving |
| **Save state indicator** | "All changes saved" / "Saving..." / "Unsaved changes" / "Save failed" |

#### 6.2.3 New Template Flow

When navigating to `/app/templates/new` (without a preset):

1. The `DocumentTemplateGallery` component (`webapp/src/components/DocumentTemplateGallery.tsx`) is displayed full-page.
2. The gallery shows all preset templates (blank, professional, and 10 industry presets).
3. Each preset card shows: a silhouette preview, category badge, name, description, and industry tag.
4. Keyboard navigation: arrow keys to navigate, Enter to select, Esc to cancel.
5. On selection, the URL becomes `/app/templates/new?preset={key}` and the editor loads with the preset's document.

#### 6.2.4 Preset Gallery Design

```
┌─────────────────────────────────────────────────────────┐
│ Choose a starting template                              │
│ Pick a blank canvas, the professional default, or an   │
│ industry-specific preset.                               │
├─────────────────────────────────────────────────────────┤
│ [Search...]                                             │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │ ◇ Blank      │ │ ★ Professnl │ │ ◼ Construction│        │
│ │ Empty canvas │ │ Clean layout│ │ Job-site bill.│        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │ ◼ Consulting  │ │ ◼ Photography│ │ ◼ Freelance  │        │
│ │ Milestone     │ │ Package-based│ │ Project-based│        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
│ ...                                                     │
├─────────────────────────────────────────────────────────┤
│ ← ↑ → ↓ navigate cards  Enter select  Esc to cancel  │
└─────────────────────────────────────────────────────────┘
```

**Categories:**

| Category | Icon | Label | Description |
|---|---|---|---|
| Blank | `◇` | "Blank" | Empty canvas — build from scratch |
| Default | `★` | "Default Templates" | Professional base layouts |
| Industry | `◼` | "Industry Presets" | Industry-specific presets with unique line item columns and default content |

**Industry presets available:**

| Key | Name | Industry Tag |
|---|---|---|
| `construction` | Construction Invoice | construction |
| `consulting` | Consulting Invoice | consulting |
| `photography` | Photography Invoice | photography |
| `freelancing` | Freelance Invoice | freelancing |
| `legal` | Legal Services Invoice | legal |
| `landscaping` | Landscaping Invoice | landscaping |
| `cleaning` | Cleaning Invoice | cleaning |
| `automotive` | Automotive Service Invoice | automotive |
| `retail` | Retail Invoice | retail |
| `professional-services` | Professional Services Invoice | professional services |

### 6.3 Component Palette & Drag-Drop Editor

The template editor (accessed via `DocumentEditor.tsx` in the document model) provides a drag-and-drop interface with:

- **Component palette** on the left — draggable components organized by category (Business Info, Invoice Details, Line Items, Totals, Text, Layout, etc.).
- **Canvas** in the center — the document tree rendered as a visual layout with drop zones.
- **Property inspector** on the right — context-aware property editor for the selected component.

**Component types supported** (17 structural + 13 content = 30 total, see Appendix A for full list):

- **Structural**: section, row, column
- **Business content**: businessInfo, customerInfo, invoiceNumber, date, lineItems, subtotal, tax, discount, fees, total, amountDue, paymentTerms, notes, terms, paymentInstructions, signature, customField
- **Visual**: text, image, logo, spacer, divider

Each component supports drag-and-drop reordering, property editing, visibility toggling, and conditional rendering.

---

## 7. Workflow Integration

### 7.1 Template Selector in Invoice Creation

The template selector is integrated into the invoice creation workflow in `InvoiceEditor.tsx`.

#### 7.1.1 Initial Template Selection (New Invoice)

When creating a new invoice (`/app/invoices/new`):

1. If the user has not yet chosen a template, the `DocumentTemplateGallery` is shown in full-page mode (see §6.2.3).
2. The user selects a preset template from the gallery.
3. The `handleTemplateSelect` function (`InvoiceEditor.tsx:402`) is called:
   - Builds the document from the preset: `preset.build(businessId)`.
   - Sets the document in the editor context.
   - Sets `editorData` with default currency from the document settings.
   - Sets `templateChoice` state to track the selection.
   - Fires an analytics event `trackTemplateSelected`.
4. The invoice editor then loads with the selected template's document structure.

#### 7.1.2 Template Switching (Existing Invoice)

When editing an existing invoice:

1. A "Gallery" button is available in the editor toolbar (`InvoiceEditor.tsx:725`).
2. Clicking it opens the `TemplateGallery` modal (from `webapp/src/components/TemplateGallery.tsx`).
3. The user can browse saved invoice templates or select a preset.
4. Selecting a different template replaces the document structure, resetting the editor state.

#### 7.1.3 TemplateSelector Component

A dropdown-based `TemplateSelector` component (`webapp/src/components/TemplateSelector.tsx`) is also available for:

- Selecting from saved templates (loaded via `getTemplates` from `/api/templates`).
- Showing a text preview of each template's style.
- Creating new templates inline.

**Note:** The `TemplateSelector` currently uses the legacy `/api/templates` endpoint (Handlebars-based templates), while the `DocumentTemplateGallery` uses preset templates. The canonical template system uses `/api/invoice-templates`.

### 7.2 Default Template Application

When a new invoice is created without an explicit template selection:

1. The system calls `GET /api/invoice-templates/default?industry={business.industry}`.
2. The service looks up the default template:
   - First tries to find a template where `is_default = TRUE` AND `industry = '{industry}'`.
   - Falls back to a generic default (any `is_default = TRUE` template, regardless of industry).
   - Returns `null` if no default exists.
3. If a default template is found, its `document` and `config` are applied to the new invoice.
4. If no default template exists, the system uses the built-in `PROFESSIONAL_PRESET` (via `getDefaultDocument()`).

### 7.3 Template Usage Tracking

Every time a template is applied to a new invoice:

1. The invoice creation flow sets `templateId` on the invoice record (`invoices.template_id`).
2. The system calls `POST /api/invoice-templates/:id/usage` to record the usage event.
3. The `invoice_template_usage` table tracks: `business_id`, `template_id`, `invoice_id`, `used_at`.
4. The usage count is available via `GET /api/invoice-templates/:id/usage`.

### 7.4 Snapshot Integration

When an invoice is finalized:

1. The `SnapshotService` (`src/services/snapshot/snapshot-service.ts`) captures the invoice's state.
2. If a template was used, the snapshot includes:
   - `template_id` — the template UUID
   - `template_schema_version` — the schema version at finalization time
   - `template_revision` — the revision number at finalization time
   - `rendered_html` — the full HTML output of rendering the invoice with the template
3. This ensures reproducible PDFs and emails even if the template is later modified.
4. The snapshot's `snapshot_hash` is computed over the entire JSON payload, allowing tamper detection.

### 7.5 Recurring Invoice Integration

Recurring invoices (`recurring_invoices` table) support a `template_id` column (added in migration `013_invoice_lifecycle.sql`). When a recurring invoice generates a new invoice:

1. The generation process calls the template service to retrieve the template.
2. The template's `config.defaultLineItems` are used as default line items for the generated invoice.
3. The template's `document` determines the layout of the generated invoice.
4. The generated invoice's `template_id` is set to the recurring invoice's `template_id`.

### 7.6 Estimate/Quote Integration

Quotes (`quotes` table) support a `template_id` column (added in migration `013_invoice_lifecycle.sql`). When a quote is created from a template:

1. The template's document structure is loaded.
2. The template's `config` provides default terms, notes, and line items for the quote.
3. If the quote is accepted and converted to an invoice, the template carries over via `quotes.converted_invoice_id`.

---

## 8. Business Logic & Segmentation

### 8.1 Customer Segment-Based Templates

Templates can be associated with customer segments via the `industry` field and the `config` field:

**Industry-based segmentation:**

- Each template can have an `industry` tag (e.g., "construction", "legal", "retail").
- When creating a new invoice, the system checks the customer's `industry` field (if available) and suggests templates tagged with that industry.
- The `getDefaultTemplate` function (`invoice-template-service.ts:69`) first looks for a default template matching the customer's industry, falling back to a generic default.

**Config-based segmentation:**

The `config` JSONB field supports arbitrary key-value pairs for advanced segmentation:

```json
{
  "config": {
    "segmentRules": [
      {
        "matchBy": "customer.tags",
        "matchValue": "wholesale",
        "description": "Wholesale pricing template"
      },
      {
        "matchBy": "project.type",
        "matchValue": "retainer",
        "description": "Retainer billing template"
      }
    ],
    "defaultLineItems": [...],
    "defaultFooterMessage": "...",
    "defaultTerms": "...",
    "paymentInstructions": "..."
  }
}
```

### 8.2 Service Type-Based Templates

Industry presets already encode service-type-specific layouts:

| Service Type | Template Key | Line Item Columns | Default Notes | Default Terms |
|---|---|---|---|---|
| Professional services | `professional` | Description, Qty, Rate, Amount | (none) | "Net 30" |
| Construction | `construction` | Description, Hours, Rate, Amount | (none) | "Net 30" |
| Consulting | `consulting` | Description, Hours, Rate, Amount | Expense reimbursement note | "Net 15" |
| Photography | `photography` | Package, Usage Rights, Qty, Price, Total | Copyright retention | License expiry terms |
| Freelancing | `freelancing` | Task, Hours, Rate, Total | Thank you message | "Net 30" |
| Legal services | `legal` | Description, Time, Rate, Total | (none) | Privilege disclaimer |
| Landscaping | `landscaping` | Service, Season, Qty, Rate, Total | Property access note | "Due on Receipt" |
| Cleaning | `cleaning` | Service, Visits, Rate, Total | Property access note | "Net 15" |
| Automotive | `automotive` | Description, Type, Qty, Rate, Total | Warranty note | (none) |
| Retail | `retail` | SKU, Product, Qty, Price, Total | Returns policy | Tax-inclusive pricing |

### 8.3 Predefined Footer Messages

Footer messages are stored in the template's `config` field:

```json
{
  "config": {
    "footerMessage": "Thank you for your business! Please reach out with any questions.",
    "footerLegalDisclaimer": "All services are subject to our terms of service.",
    "footerBankDetails": "Bank: Example Bank | Account: 1234-5678-90 | Routing: 0987654321"
  }
}
```

These are rendered in the document via a `customField` component or can be mapped to the `notes` or `paymentInstructions` component content.

### 8.4 Predefined Terms

Default terms are stored in two places:

1. **Document level**: The `paymentTerms` component content (e.g., "Net 30").
2. **Config level**: The `config.defaultTerms` field for longer legal terms text.

When a draft invoice is created from a template, the terms are applied to the invoice's `terms` field.

### 8.5 Predefined Service Lists

Predefined line items (services) are stored in `config.defaultLineItems`:

```json
{
  "config": {
    "defaultLineItems": [
      {
        "description": "Consultation",
        "quantity": "1",
        "unit": "each",
        "unitPrice": "150.00",
        "taxRate": "0.08",
        "isTaxInclusive": false
      }
    ]
  }
}
```

When creating an invoice from a template:

1. The template's `config.defaultLineItems` are offered as suggested line items.
2. The user can add, remove, or modify these items.
3. Product catalog integration: if a line item has a `productId`, the system snapshots the product's current price and tax rate at invoice creation time (see `invoice-product-snapshot.test.ts`).

### 8.6 Industry Catalogs

The system maintains 10 industry-specific preset templates (`INDUSTRY_PRESETS` in `preset-templates.ts:591`). Each preset encodes:

- **Industry-specific line item columns** (e.g., "Hours" vs "Qty" vs "Visits", "Package" vs "SKU").
- **Industry-specific custom fields** (e.g., "Job Number" for construction, "VIN" for automotive, "Project Code" for professional services).
- **Industry-specific default notes and terms** (e.g., lien waiver requirement for construction, copyright retention for photography).
- **Industry-specific payment terms** (e.g., "Due on Receipt" for landscaping, "Net 15" for consulting).

These presets are stored client-side in `webapp/src/document-model/templates/preset-templates.ts` and are used when creating new templates. They are not persisted as database records until the user customizes and saves them.

### 8.7 Segment Resolution Priority

When determining which template to use for a new document, the system resolves in this order:

1. **Explicit user selection** — The template chosen by the user during invoice creation.
2. **Customer-linked template** — If the customer has a `template_id` set, use that.
3. **Industry default** — The business's default template tagged with the customer's industry.
4. **Business default** — The business's generic default template (any industry).
5. **Built-in preset** — The `PROFESSIONAL_PRESET` from code.

---

## 9. Lifecycle & Versioning

### 9.1 Template Lifecycle States

| State | Entry Conditions | Exit Conditions | Side Effects |
|---|---|---|---|
| **draft** | Created via `POST /api/invoice-templates` | Publish (`POST .../publish`), Archive (`POST .../archive`), Delete | Not visible in invoice creation flow |
| **published** | `lifecycle` set to "published", `published_at` timestamp set, `published_revision` set to current revision | Archive, Delete (if not default) | Visible in invoice creation flow; can be set as default |
| **archived** | `lifecycle` set to "archived", `archived_at` timestamp set | Unarchive (`POST .../unarchive`) | Hidden from invoice creation flow; not available for new documents |

### 9.2 Revision Versioning

Every time a template is **published**, a new revision is created:

1. The current `document`, `html_template`, and `config` are copied to `document_template_revisions`.
2. The template's `revision` counter is incremented.
3. The `version` counter is incremented.
4. The `publishedRevision` is set to the new revision number.
5. The `publishedAt` timestamp is set.

**Revision history** is immutable — once a revision is created, it cannot be modified. Users can:

- View revision history via `GET /api/invoice-templates/:id/revisions`.
- Restore any previous revision via `POST .../revisions/:revision/restore` (creates a new revision based on the old one).
- Inspect individual revisions via `GET .../revisions/:revision`.

### 9.3 Default Template Promotion on Archive

When archiving the **default** published template:

1. The system checks for other published templates.
2. If another published template exists, it is promoted to default (`is_default = TRUE`).
3. If no other published template exists, the template cannot be archived — the user receives an error: "Cannot archive the default template. Change the default first."

### 9.4 Schema Version Migration

Templates have a `schemaVersion` field (currently "1.0"). The migration engine (`src/services/templates/migrations.ts`) allows upgrading templates to newer schema versions:

1. `GET /api/invoice-template/:id` returns the template's current `schemaVersion`.
2. `POST /api/invoice-templates/:id/migrate` with an optional `targetVersion` upgrades the template's `document` to the target schema.
3. The migration is tracked in `invoice_template_migrations` table.
4. If the template is already at the target version, the response is `{ template, migrated: false }`.

### 9.5 Document Template Schema Versions Registry

The `document_template_schema_versions` table stores the registry of supported schema versions:

```sql
INSERT INTO document_template_schema_versions (version, name, description, schema, is_active)
VALUES ('1.0', 'Standard Invoice Document', '...', '{ ... JSON schema ... }', TRUE);
```

This allows the system to validate template documents against their declared schema version and provides the JSON Schema for UI generation.

---

## 10. Security & Data Integrity

### 10.1 Tenant Isolation

Every template operation enforces business-level tenant isolation:

- **Database level**: The `business_id` column is present on `document_templates`, `document_template_revisions`, `invoice_template_permissions`, and `invoice_template_usage`. All queries filter by `business_id`.
- **Repository level**: Every repository method (`findById`, `findMany`, `update`, `delete`, etc.) takes `businessId` as a parameter and includes it in the `WHERE` clause.
- **API level**: The `requireAuth` middleware populates `req.user.businessId`, and every route handler passes it to the service layer.
- **Cross-tenant access**: Attempting to access another business's template returns "InvoiceTemplate {id} not found or access denied."

### 10.2 Immutability After Publication

Once a template is published:

1. The current revision's `document` is immutable — it is snapshotted in `document_template_revisions`.
2. Any edits create a new draft revision (the template stays in `published` lifecycle but the `document` is updated, creating a new revision on next publish).
3. Invoices that were finalized using a published template snapshot the template's revision at finalization time, ensuring reproducible PDFs.

### 10.3 Default Template Atomicity

Setting a template as default uses a database transaction to ensure exactly one default per business:

```sql
BEGIN;
UPDATE document_templates SET is_default = FALSE WHERE business_id = $1 AND is_default = TRUE;
UPDATE document_templates SET is_default = TRUE WHERE id = $2 AND business_id = $1;
COMMIT;
```

This prevents race conditions where two templates could be default simultaneously.

### 10.4 Optimistic Concurrency

The `templates` table (legacy) and `document_templates` table both have a `version` column. Updates increment the version, and the repository can implement optimistic locking (though the current implementation does not check for version conflicts on update).

### 10.5 Input Validation

All template inputs are validated at three layers:

| Layer | Validation | Tool |
|---|---|---|
| **API** | Request body parsed with Zod schemas (`InvoiceTemplateCreateRequestSchema`, `InvoiceTemplateUpdateRequestSchema`) | `zod` |
| **Service** | Business logic validation (e.g., "cannot archive default published template") | `BusinessLogicError` |
| **Repository** | Database constraints (unique name per business, lifecycle enum, foreign keys) | PostgreSQL constraints |

### 10.6 Audit Trail

All template operations are tracked via:

1. **Database timestamps**: `created_at`, `updated_at`, `published_at`, `archived_at` on `document_templates`.
2. **User tracking**: `created_by`, `updated_by`, `lifecycle_updated_by` columns.
3. **Revision history**: Every publish creates an immutable revision record in `document_template_revisions` with `created_at` and `created_by`.
4. **Migration history**: `invoice_template_migrations` table records all schema migrations.

---

## 11. Business Rules & Constraints

### 11.1 Uniqueness Constraints

| Constraint | Scope | Error |
|---|---|---|
| Unique template name per business | `document_templates` | `uq_document_template_business_name` (UNIQUE) |
| Unique revision per template | `document_template_revisions` | `uq_template_revision` (UNIQUE template_id + revision) |
| Unique migration per template+version pair | `invoice_template_migrations` | `uq_template_migration` (UNIQUE template_id + from_version + to_version) |

### 11.2 Lifecycle State Transitions

```
draft ──→ published ──→ archived
  ↑         │              │
  │    ┌────┘              └────┐
  └───→│    (terminal: delete)   │
│      ↓                          ↓
│   (unarchive only)         (unarchive only)
└───→  archived ──→ published ──→ archived
```

| From State | To State: Published | To State: Archived | To State: Draft | Delete |
|---|---|---|---|---|
| **draft** | Allowed (publishes, creates revision) | Allowed (archives) | N/A (already draft) | Allowed |
| **published** | Allowed (re-publishes, creates new revision) | Allowed (archives) | N/A | Allowed (if not default) |
| **archived** | Allowed (unarchives to published) | N/A (already archived) | Allowed (unarchives to draft) | Allowed |

### 11.3 Default Template Constraints

| Rule | Enforcement |
|---|---|
| Only one default template per business | Transactional `setDefault` clears others first |
| Only `published` templates can be default | Service-level check in `setDefault` |
| Cannot archive the default `published` template | Service-level check in `archive` + auto-promotion logic |
| Cannot delete the default `published` template | Service-level check in `deleteTemplate` |

### 11.4 Usage Constraints

| Rule | Enforcement |
|---|---|
| Templates in use by finalized invoices cannot be deleted | Repository checks `invoice_snapshots` for references before delete |
| Archived templates cannot be applied to new documents | `findDefault` only queries `lifecycle = 'published'` |
| Draft templates are not visible in the invoice creation flow | `getInvoiceTemplates` filters by lifecycle; `findDefault` requires published |

### 11.5 Permission Model

Fine-grained permissions are supported via the `invoice_template_permissions` table:

| Permission | Description |
|---|---|
| `view` | Can view the template details and preview |
| `edit` | Can modify the template document and settings |
| `publish` | Can publish archive/unarchive the template |
| `archive` | Can archive the template (distinct from publish) |

**Default access**: All users within a business can perform all operations on templates in that business (tenant isolation is the primary security boundary). Per-user permissions are an enhancement for multi-user businesses and are checked via `checkPermission` in the service layer.

### 11.6 Data Retention

| Entity | Retention Policy |
|---|---|
| `document_templates` | Retained until manually deleted |
| `document_template_revisions` | Retained indefinitely (cascade on template delete) |
| `invoice_template_usage` | Retained indefinitely (no cascade — usage history preserved after template deletion if `invoice_id` is set) |
| `invoice_template_permissions` | Retained until manually revoked or template deleted |
| `invoice_template_migrations` | Retained indefinitely |

---

## Appendix A: Component Type Reference

The structured document model supports 30 component types, organized into structural and content categories.

### Structural Components

| Type | Props | Description |
|---|---|---|
| `section` | `name`, `fullWidth` | Top-level container; root section is the document's rootSectionId |
| `row` | `name`, `columns`, `columnGap`, `rowGap` | Flexbox row container |
| `column` | `name`, `span` | Flexbox column; `span` controls relative width |

### Business Content Components

| Type | Props | Description |
|---|---|---|
| `businessInfo` | `showName`, `showEmail`, `showPhone`, `showWebsite`, `showAddress`, `showLogo`, `label` | Renders business details from the business record |
| `customerInfo` | `showName`, `showCompany`, `showEmail`, `showAddress`, `showPhone`, `label` | Renders customer details |
| `invoiceNumber` | `prefix`, `format`, `label` | Renders the invoice/quote number |
| `date` | `dateType` ("issue"\|"due"\|"custom"), `format`, `label`, `customValue` | Renders issue date, due date, or custom date |
| `lineItems` | `columns[]`, `showHeader`, `showQuantity`, `showUnit`, `showUnitPrice`, `showDiscount`, `showTax`, `showLineTotal`, `currency`, `allowMultiPage`, `emptyStateMessage` | Renders the line items table with configurable columns |
| `subtotal` | `label`, `currency` | Renders subtotal total |
| `discount` | `label`, `currency` | Renders discount total (shown as negative) |
| `tax` | `label`, `currency`, `showBreakdown` | Renders tax total (or breakdown by rate) |
| `fees` | `label`, `currency`, `showHeader` | Renders fees total |
| `total` | `label`, `currency` | Renders grand total |
| `amountDue` | `label`, `currency` | Renders amount due (total minus payments) |
| `paymentTerms` | `content`, `label` | Renders payment terms text |
| `notes` | `content`, `label` | Renders notes section |
| `terms` | `content`, `label` | Renders terms and conditions |
| `paymentInstructions` | `content`, `label` | Renders payment instructions |
| `signature` | `label`, `placeholder`, `showDate`, `showName` | Renders signature line with optional date and name |
| `customField` | `key`, `label`, `value`, `type`, `options[]` | Renders a custom key-value field |
| `deposit` | `label`, `currency`, `depositType`, `depositValue`, `depositDueDate`, `showDepositDue`, `showDepositPaid` | Renders deposit information |

### Visual Components

| Type | Props | Description |
|---|---|---|
| `text` | `content`, `format` ("plain"\|"markdown"\|"html") | Free-form text content |
| `image` | `src`, `alt`, `width`, `height`, `fit` | Embedded image |
| `logo` | `src`, `alt`, `width`, `height`, `fit` | Business logo (specialized image) |
| `spacer` | `height` | Vertical spacing |
| `divider` | `thickness`, `color`, `style` ("solid"\|"dashed"\|"dotted") | Horizontal divider line |

---

## Appendix B: Settings Schema

The `settings` object on every `InvoiceDocument` follows this schema (defined in `webapp/src/document-model/types.ts:416` and `src/domain/schemas/invoice-template.ts:10`):

```typescript
interface DocumentSettings {
  pageSize: "A4" | "Letter" | "Legal";       // default: "A4"
  orientation: "portrait" | "landscape";      // default: "portrait"
  margins: {
    top: number;    // default: 40 (px)
    right: number;  // default: 40
    bottom: number; // default: 40
    left: number;   // default: 40
  };
  defaultFont: string;          // default: system-ui stack
  defaultFontSize: number;      // default: 14 (px)
  defaultColor: string;         // default: "#1f2937" (slate-700)
  currency: string;             // default: "USD" (ISO 4217)
  locale: string;               // default: "en-US"
}
```

These settings are rendered into CSS by the `StructuredTemplateRenderer.buildSettingsStyles()` method (`structured-renderer.ts:481`):

```css
body { font-family: {defaultFont}; font-size: {defaultFontSize}px; color: {defaultColor}; }
.page { padding: {margins.top}px {margins.right}px {margins.bottom}px {margins.left}px; }
```

---

*End of Specification*
