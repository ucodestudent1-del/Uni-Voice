import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "../value-objects/currency.js";

export const ProjectStatusSchema = z.enum(["planning", "active", "on_hold", "completed", "archived"]);

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  customerId: z.string().uuid().nullable(),
  name: z.string().min(1),
  description: z.string().nullable(),
  status: ProjectStatusSchema.default("planning"),
  startDate: z.date().nullable(),
  dueDate: z.date().nullable(),
  budget: z.string(),
  currency: z.enum(SUPPORTED_CURRENCIES).default("USD"),
  amountInvoiced: z.string(),
  amountPaid: z.string(),
  remainingBillable: z.string(),
  version: z.number().int().min(1).default(1),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const ProjectCreateSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  name: z.string().min(1, "Project name is required").max(255),
  description: z.string().max(5000).nullish(),
  status: ProjectStatusSchema.optional(),
  startDate: z.union([z.string(), z.date()]).nullable().optional(),
  dueDate: z.union([z.string(), z.date()]).nullable().optional(),
  budget: z.string().or(z.number()).optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  tags: z.array(z.object({
    name: z.string().min(1),
    color: z.string().optional(),
  })).optional(),
  teamMemberIds: z.array(z.string().uuid()).optional(),
});

export type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>;

export const ProjectUpdateSchema = ProjectCreateSchema.partial();

export type ProjectUpdateInput = z.infer<typeof ProjectUpdateSchema>;

export const ProjectSearchQuerySchema = z.object({
  search: z.string().max(255).optional(),
  status: ProjectStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  includeArchived: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  sortBy: z.enum(["name", "created_at", "updated_at", "due_date", "start_date", "budget", "amount_invoiced"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ProjectSearchQuery = z.infer<typeof ProjectSearchQuerySchema>;
