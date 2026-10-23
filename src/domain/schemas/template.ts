import { z } from "zod";

export const TemplateCreateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  htmlTemplate: z.string().optional().default(""),
  config: z.record(z.unknown()).optional().default({}),
  isDefault: z.boolean().optional().default(false),
});

export const TemplateUpdateSchema = z.object({
  name: z.string().min(1, "Template name is required").optional(),
  htmlTemplate: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  isDefault: z.boolean().optional(),
});
