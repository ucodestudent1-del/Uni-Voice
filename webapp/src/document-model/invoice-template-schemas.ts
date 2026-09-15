import { z } from "zod";

const InvoiceTemplateLifecycleSchema = z.enum(["draft", "published", "archived"]);

export const FrontendInvoiceTemplateSettingsSchema = z.object({
  pageSize: z.enum(["A4", "Letter", "Legal"]).default("A4"),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  margins: z.object({
    top: z.number().default(40),
    right: z.number().default(40),
    bottom: z.number().default(40),
    left: z.number().default(40),
  }).default({ top: 40, right: 40, bottom: 40, left: 40 }),
  defaultFont: z.string().default("system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"),
  defaultFontSize: z.number().default(14),
  defaultColor: z.string().default("#1f2937"),
  currency: z.string().default("USD"),
  locale: z.string().default("en-US"),
});

export type FrontendInvoiceTemplateSettings = z.infer<typeof FrontendInvoiceTemplateSettingsSchema>;

export const FrontendInvoiceTemplateDocumentSchema = z.object({
  id: z.string(),
  version: z.number().int().min(1),
  name: z.string(),
  businessId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sections: z.record(z.string(), z.record(z.string(), z.unknown())),
  rows: z.record(z.string(), z.record(z.string(), z.unknown())),
  columns: z.record(z.string(), z.record(z.string(), z.unknown())),
  components: z.record(z.string(), z.record(z.string(), z.unknown())),
  rootSectionId: z.string(),
  settings: FrontendInvoiceTemplateSettingsSchema,
});

export type FrontendInvoiceTemplateDocument = z.infer<typeof FrontendInvoiceTemplateDocumentSchema>;

export const FrontendInvoiceTemplateSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  name: z.string().min(1, "name is required").max(255),
  description: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  schemaVersion: z.string().default("1.0"),
  revision: z.number().int().min(1),
  version: z.number().int().min(1),
  document: FrontendInvoiceTemplateDocumentSchema,
  htmlTemplate: z.string().nullable().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  lifecycle: InvoiceTemplateLifecycleSchema.default("draft"),
  publishedAt: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
});

export type FrontendInvoiceTemplate = z.infer<typeof FrontendInvoiceTemplateSchema>;

export const FrontendInvoiceTemplateRevisionSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  businessId: z.string(),
  revision: z.number().int().min(1),
  schemaVersion: z.string(),
  document: FrontendInvoiceTemplateDocumentSchema,
  htmlTemplate: z.string().nullable().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  changeSummary: z.string().max(500).nullable().optional(),
  createdAt: z.string(),
  createdBy: z.string().nullable().optional(),
});

export type FrontendInvoiceTemplateRevision = z.infer<typeof FrontendInvoiceTemplateRevisionSchema>;

export const FrontendInvoiceTemplateWithRevisionsSchema = FrontendInvoiceTemplateSchema.extend({
  revisions: z.array(FrontendInvoiceTemplateRevisionSchema),
});

export type FrontendInvoiceTemplateWithRevisions = z.infer<typeof FrontendInvoiceTemplateWithRevisionsSchema>;

export const FrontendInvoiceTemplateListResponseSchema = z.object({
  templates: z.array(FrontendInvoiceTemplateSchema),
  limit: z.number(),
  offset: z.number(),
});

export type FrontendInvoiceTemplateListResponse = z.infer<typeof FrontendInvoiceTemplateListResponseSchema>;

export const FrontendInvoiceTemplatePermissionSchema = z.object({
  userId: z.string(),
  permission: z.enum(["view", "edit", "publish", "archive"]),
});

export type FrontendInvoiceTemplatePermission = z.infer<typeof FrontendInvoiceTemplatePermissionSchema>;

export const FrontendInvoiceTemplatePublishRequestSchema = z.object({
  changeSummary: z.string().max(500).optional(),
});

export type FrontendInvoiceTemplatePublishRequest = z.infer<typeof FrontendInvoiceTemplatePublishRequestSchema>;

export const FrontendInvoiceTemplateUsageResponseSchema = z.object({
  templateId: z.string(),
  usageCount: z.number().int().min(0),
});

export type FrontendInvoiceTemplateUsageResponse = z.infer<typeof FrontendInvoiceTemplateUsageResponseSchema>;
