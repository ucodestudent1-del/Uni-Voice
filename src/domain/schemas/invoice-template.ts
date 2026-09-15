import { z } from "zod";

export const InvoiceTemplateLifecycleSchema = z.enum(["draft", "published", "archived"]);
export type InvoiceTemplateLifecycle = z.infer<typeof InvoiceTemplateLifecycleSchema>;
export const InvoiceTemplateStatus = InvoiceTemplateLifecycleSchema;
export type InvoiceTemplateStatus = InvoiceTemplateLifecycle;

export const INVOICE_TEMPLATE_CURRENT_SCHEMA_VERSION = "1.0";
export const INVOICE_TEMPLATE_SCHEMA_VERSIONS = ["1.0"] as const;
export type InvoiceTemplateSchemaVersion = (typeof INVOICE_TEMPLATE_SCHEMA_VERSIONS)[number];

export const InvoiceTemplateSettingsSchema = z.object({
  pageSize: z.enum(["A4", "Letter", "Legal"]).default("A4"),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  margins: z.object({
    top: z.number().default(40),
    right: z.number().default(40),
    bottom: z.number().default(40),
    left: z.number().default(40),
  }).default({}),
  defaultFont: z.string().default("system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"),
  defaultFontSize: z.number().default(14),
  defaultColor: z.string().default("#1f2937"),
  currency: z.string().default("USD"),
  locale: z.string().default("en-US"),
});

export type InvoiceTemplateSettings = z.infer<typeof InvoiceTemplateSettingsSchema>;

export const InvoiceTemplateComponentSchema: z.ZodType<Record<string, unknown>> = z.object({
  id: z.string(),
  type: z.string(),
  props: z.record(z.string(), z.unknown()),
  style: z.record(z.string(), z.unknown()).optional(),
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
});

export const InvoiceTemplateDocumentSchema = z.object({
  id: z.string(),
  version: z.number().int().min(1),
  name: z.string(),
  businessId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.string().optional().default(INVOICE_TEMPLATE_CURRENT_SCHEMA_VERSION),
  sections: z.record(z.string(), z.record(z.string(), z.unknown())),
  rows: z.record(z.string(), z.record(z.string(), z.unknown())),
  columns: z.record(z.string(), z.record(z.string(), z.unknown())),
  components: z.record(z.string(), z.record(z.string(), z.unknown())),
  rootSectionId: z.string(),
  settings: InvoiceTemplateSettingsSchema,
});

export type InvoiceTemplateDocument = z.infer<typeof InvoiceTemplateDocumentSchema>;

export const InvoiceTemplateSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  name: z.string().min(1, "name is required").max(255),
  description: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  schemaVersion: z.string().default(INVOICE_TEMPLATE_CURRENT_SCHEMA_VERSION),
  revision: z.number().int().min(1),
  version: z.number().int().min(1),
  document: z.record(z.string(), z.unknown()),
  htmlTemplate: z.string().nullable().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  lifecycle: InvoiceTemplateLifecycleSchema.default("draft"),
  publishedAt: z.date().nullable().optional(),
  publishedRevision: z.number().int().min(1).nullable().optional(),
  archivedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
});

export type InvoiceTemplate = z.infer<typeof InvoiceTemplateSchema>;

export const InvoiceTemplateInputSchema = z.object({
  name: z.string().min(1, "name is required").max(255),
  description: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  schemaVersion: z.string().default(INVOICE_TEMPLATE_CURRENT_SCHEMA_VERSION),
  document: InvoiceTemplateDocumentSchema,
  htmlTemplate: z.string().nullable().optional().default(null),
  config: z.record(z.string(), z.unknown()).default({}),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type InvoiceTemplateInput = z.infer<typeof InvoiceTemplateInputSchema>;

export const InvoiceTemplateUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  schemaVersion: z.string().optional(),
  document: InvoiceTemplateDocumentSchema.optional(),
  htmlTemplate: z.string().nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type InvoiceTemplateUpdate = z.infer<typeof InvoiceTemplateUpdateSchema>;

export const InvoiceTemplateRevisionSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  businessId: z.string(),
  revision: z.number().int().min(1),
  schemaVersion: z.string(),
  document: InvoiceTemplateDocumentSchema,
  htmlTemplate: z.string().nullable().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  changeSummary: z.string().max(500).nullable().optional(),
  createdAt: z.date(),
  createdBy: z.string().nullable().optional(),
});

export type InvoiceTemplateRevision = z.infer<typeof InvoiceTemplateRevisionSchema>;

export const InvoiceTemplateRevisionInputSchema = z.object({
  document: InvoiceTemplateDocumentSchema.optional(),
  htmlTemplate: z.string().nullable().optional().default(null),
  config: z.record(z.string(), z.unknown()).default({}),
  changeSummary: z.string().max(500).optional(),
});

export type InvoiceTemplateRevisionInput = z.infer<typeof InvoiceTemplateRevisionInputSchema>;

export const InvoiceTemplatePublishSchema = z.object({
  changeSummary: z.string().max(500).optional(),
});

export type InvoiceTemplatePublishInput = z.infer<typeof InvoiceTemplatePublishSchema>;

export const InvoiceTemplatePreviewRequestSchema = z.object({
  document: InvoiceTemplateDocumentSchema.optional(),
  htmlTemplate: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  schemaVersion: z.string().default(INVOICE_TEMPLATE_CURRENT_SCHEMA_VERSION),
});

export type InvoiceTemplatePreviewRequest = z.infer<typeof InvoiceTemplatePreviewRequestSchema>;

export const InvoiceTemplateWithRevisionsSchema = InvoiceTemplateSchema.extend({
  revisions: z.array(InvoiceTemplateRevisionSchema),
});

export type InvoiceTemplateWithRevisions = z.infer<typeof InvoiceTemplateWithRevisionsSchema>;

export const InvoiceTemplateWithVersionsSchema = InvoiceTemplateSchema.extend({
  versions: z.array(InvoiceTemplateRevisionSchema),
  currentVersion: z.number().int().min(1),
});

export type InvoiceTemplateWithVersions = z.infer<typeof InvoiceTemplateWithVersionsSchema>;

export interface InvoiceTemplateRepository {
  create(businessId: string, input: InvoiceTemplateInput, createdBy?: string | null): Promise<InvoiceTemplate>;
  findById(businessId: string, id: string): Promise<InvoiceTemplate>;
  findMany(businessId: string, opts?: FindInvoiceTemplatesOptions): Promise<InvoiceTemplate[]>;
  findDefault(businessId: string): Promise<InvoiceTemplate | null>;
  findDefaultByIndustry(businessId: string, industry: string): Promise<InvoiceTemplate | null>;
  update(businessId: string, id: string, input: InvoiceTemplateUpdate, updatedBy?: string | null): Promise<InvoiceTemplate>;
  delete(businessId: string, id: string): Promise<void>;
  duplicate(businessId: string, id: string, createdBy?: string | null): Promise<InvoiceTemplate>;
  setDefault(businessId: string, id: string): Promise<InvoiceTemplate>;
  publish(businessId: string, id: string, changeSummary?: string | null, publishedBy?: string | null): Promise<InvoiceTemplate>;
  archive(businessId: string, id: string, archivedBy?: string | null): Promise<InvoiceTemplate>;
  unarchive(businessId: string, id: string, unarchivedBy?: string | null): Promise<InvoiceTemplate>;
  createRevision(businessId: string, id: string, input: InvoiceTemplateRevisionInput, createdBy?: string | null): Promise<InvoiceTemplateRevision>;
  findRevisions(businessId: string, id: string): Promise<InvoiceTemplateRevision[]>;
  findRevision(businessId: string, templateId: string, revision: number): Promise<InvoiceTemplateRevision>;
  restoreRevision(businessId: string, id: string, revision: number, restorerBy?: string | null): Promise<InvoiceTemplate>;
  findByIdWithRevisions(businessId: string, id: string): Promise<InvoiceTemplateWithRevisions>;
}

export interface FindInvoiceTemplatesOptions {
  industry?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  lifecycle?: InvoiceTemplateLifecycle | InvoiceTemplateLifecycle[];
  limit?: number;
  offset?: number;
}
