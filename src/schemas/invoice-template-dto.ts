import { z } from "zod";

export const InvoiceTemplateDocumentSchema = z.object({
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
  settings: z.object({
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
  }),
});

export type InvoiceTemplateDocumentDTO = z.infer<typeof InvoiceTemplateDocumentSchema>;

export const InvoiceTemplateResponseSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  schemaVersion: z.string(),
  revision: z.number().int().min(1),
  version: z.number().int().min(1),
  document: InvoiceTemplateDocumentSchema,
  htmlTemplate: z.string().nullable().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  documentType: z.enum(["invoice", "quote", "recurring_invoice"]).default("invoice"),
  lifecycle: z.enum(["draft", "published", "archived"]).default("draft"),
  publishedAt: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
  publishedRevision: z.number().int().min(1).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
});

export type InvoiceTemplateResponseDTO = z.infer<typeof InvoiceTemplateResponseSchema>;

export const InvoiceTemplateListResponseSchema = z.object({
  templates: z.array(InvoiceTemplateResponseSchema),
  limit: z.number(),
  offset: z.number(),
});

export type InvoiceTemplateListResponseDTO = z.infer<typeof InvoiceTemplateListResponseSchema>;

export const InvoiceTemplateCreateRequestSchema = z.object({
  name: z.string().min(1, "name is required").max(255),
  description: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  schemaVersion: z.string().default("1.0"),
  document: InvoiceTemplateDocumentSchema,
  htmlTemplate: z.string().nullable().optional().default(null),
  config: z.record(z.string(), z.unknown()).default({}),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  documentType: z.enum(["invoice", "quote", "recurring_invoice"]).default("invoice"),
});

export type InvoiceTemplateCreateRequestDTO = z.infer<typeof InvoiceTemplateCreateRequestSchema>;

export const InvoiceTemplateUpdateRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  schemaVersion: z.string().optional(),
  document: InvoiceTemplateDocumentSchema.optional(),
  htmlTemplate: z.string().nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  documentType: z.enum(["invoice", "quote", "recurring_invoice"]).optional(),
});

export type InvoiceTemplateUpdateRequestDTO = z.infer<typeof InvoiceTemplateUpdateRequestSchema>;

export const InvoiceTemplateRevisionResponseSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  businessId: z.string(),
  revision: z.number().int().min(1),
  schemaVersion: z.string(),
  document: InvoiceTemplateDocumentSchema,
  htmlTemplate: z.string().nullable().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  changeSummary: z.string().max(500).nullable().optional(),
  createdAt: z.string(),
  createdBy: z.string().nullable().optional(),
});

export type InvoiceTemplateRevisionResponseDTO = z.infer<typeof InvoiceTemplateRevisionResponseSchema>;

export const InvoiceTemplateWithRevisionsResponseSchema = InvoiceTemplateResponseSchema.extend({
  revisions: z.array(InvoiceTemplateRevisionResponseSchema),
});

export type InvoiceTemplateWithRevisionsResponseDTO = z.infer<typeof InvoiceTemplateWithRevisionsResponseSchema>;

export const InvoiceTemplatePublishRequestSchema = z.object({
  changeSummary: z.string().max(500).optional(),
});

export type InvoiceTemplatePublishRequestDTO = z.infer<typeof InvoiceTemplatePublishRequestSchema>;

export const InvoiceTemplateRestoreRequestSchema = z.object({
  revision: z.number().int().min(1),
  restoredBy: z.string().optional(),
});

export type InvoiceTemplateRestoreRequestDTO = z.infer<typeof InvoiceTemplateRestoreRequestSchema>;

export const InvoiceTemplatePermissionRequestSchema = z.object({
  userId: z.string(),
  permission: z.enum(["view", "edit", "publish", "archive"]),
});

export type InvoiceTemplatePermissionRequestDTO = z.infer<typeof InvoiceTemplatePermissionRequestSchema>;

export const InvoiceTemplatePermissionResponseSchema = z.object({
  userId: z.string(),
  permission: z.string(),
});

export type InvoiceTemplatePermissionResponseDTO = z.infer<typeof InvoiceTemplatePermissionResponseSchema>;

export const InvoiceTemplateMigrationResponseSchema = z.object({
  template: InvoiceTemplateResponseSchema,
  migrated: z.boolean(),
});

export type InvoiceTemplateMigrationResponseDTO = z.infer<typeof InvoiceTemplateMigrationResponseSchema>;

export const InvoiceTemplateUsageResponseSchema = z.object({
  templateId: z.string(),
  usageCount: z.number().int().min(0),
});

export type InvoiceTemplateUsageResponseDTO = z.infer<typeof InvoiceTemplateUsageResponseSchema>;

export const InvoiceTemplateRenderResponseSchema = z.object({
  html: z.string(),
  templateId: z.string(),
  schemaVersion: z.string(),
});

export type InvoiceTemplateRenderResponseDTO = z.infer<typeof InvoiceTemplateRenderResponseSchema>;

export const InvoiceTemplateListParamsSchema = z.object({
  limit: z.string().optional().transform((v) => (v ? Math.min(Number(v), 200) : 50)),
  offset: z.string().optional().transform((v) => (v ? Number(v) : 0)),
  industry: z.string().optional(),
  documentType: z.enum(["invoice", "quote", "recurring_invoice"]).optional(),
  isDefault: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  lifecycle: z.string().optional(),
});

export type InvoiceTemplateListParamsDTO = z.infer<typeof InvoiceTemplateListParamsSchema>;
