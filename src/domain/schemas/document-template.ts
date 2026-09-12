import { z } from "zod";

export const DocumentTemplateSchemaVersionSchema = z.object({
  version: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  schema: z.record(z.string(), z.unknown()),
  is_active: z.boolean().default(true),
  created_at: z.date(),
});

export type DocumentTemplateSchemaVersion = z.infer<
  typeof DocumentTemplateSchemaVersionSchema
>;

export const DocumentTemplateInputSchema = z.object({
  name: z.string().min(1, "name is required").max(255),
  schema_version: z.string().default("1.0"),
  document: z.record(z.string(), z.unknown()),
  html_template: z.string().default(""),
  config: z.record(z.string(), z.unknown()).default({}),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export type DocumentTemplateInput = z.infer<typeof DocumentTemplateInputSchema>;

export const DocumentTemplateUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  schema_version: z.string().optional(),
  document: z.record(z.string(), z.unknown()).optional(),
  html_template: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export type DocumentTemplateUpdate = z.infer<typeof DocumentTemplateUpdateSchema>;

export const DocumentTemplateRevisionInputSchema = z.object({
  document: z.record(z.string(), z.unknown()),
  html_template: z.string().default(""),
  config: z.record(z.string(), z.unknown()).default({}),
  change_summary: z.string().max(500).optional(),
});

export type DocumentTemplateRevisionInput = z.infer<
  typeof DocumentTemplateRevisionInputSchema
>;

export const DocumentTemplatePreviewRequestSchema = z.object({
  document: z.record(z.string(), z.unknown()).optional(),
  html_template: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  schema_version: z.string().default("1.0"),
});

export type DocumentTemplatePreviewRequest = z.infer<
  typeof DocumentTemplatePreviewRequestSchema
>;