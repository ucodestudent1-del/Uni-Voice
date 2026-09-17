import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "../value-objects/currency.js";

const CurrencyEnum = z.enum(SUPPORTED_CURRENCIES).default("USD");

export const ProjectTimeEntrySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  businessId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  catalogServiceId: z.string().uuid().nullable(),
  description: z.string().min(1),
  billable: z.boolean().default(true),
  startTime: z.union([z.string(), z.date()]).nullable(),
  endTime: z.union([z.string(), z.date()]).nullable(),
  durationMinutes: z.number().int().positive().nullable(),
  billableRate: z.string(),
  billableAmount: z.string(),
  isInvoiced: z.boolean().default(false),
  invoiceId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProjectTimeEntry = z.infer<typeof ProjectTimeEntrySchema>;

export const ProjectTimeEntryCreateSchema = z.object({
  catalogServiceId: z.string().uuid().nullable().optional(),
  description: z.string().min(1, "Description is required").max(2000),
  billable: z.boolean().default(true),
  startTime: z.union([z.string(), z.date()]).nullable().optional(),
  endTime: z.union([z.string(), z.date()]).nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  billableRate: z.preprocess(
    (v) => {
      if (typeof v === "string" || typeof v === "number") return Number(v);
      return v;
    },
    z.number().min(0, "Billable rate must be >= 0").optional()
  ),
});

export type ProjectTimeEntryCreateInput = z.infer<typeof ProjectTimeEntryCreateSchema>;

export const ProjectTimeEntryUpdateSchema = z.object({
  catalogServiceId: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(2000).optional(),
  billable: z.boolean().optional(),
  startTime: z.union([z.string(), z.date()]).nullable().optional(),
  endTime: z.union([z.string(), z.date()]).nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  billableRate: z.preprocess(
    (v) => {
      if (typeof v === "string" || typeof v === "number") return Number(v);
      return v;
    },
    z.number().min(0).optional()
  ),
});

export type ProjectTimeEntryUpdateInput = z.infer<typeof ProjectTimeEntryUpdateSchema>;

export const ProjectTimeEntrySearchSchema = z.object({
  billable: z.coerce.boolean().optional(),
  isInvoiced: z.coerce.boolean().optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  sortBy: z.enum(["created_at", "duration_minutes", "billable_amount", "start_time"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ProjectTimeEntrySearchInput = z.infer<typeof ProjectTimeEntrySearchSchema>;

export const ProjectNoteCreateSchema = z.object({
  title: z.string().max(255).nullish(),
  content: z.string().min(1, "Note content is required").max(10000),
});

export type ProjectNoteCreateInput = z.infer<typeof ProjectNoteCreateSchema>;

export const ProjectNoteSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  businessId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  title: z.string().nullable(),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProjectNote = z.infer<typeof ProjectNoteSchema>;

export const ProjectTimeEntrySummarySchema = z.object({
  totalMinutes: z.number().int().nonnegative(),
  billableMinutes: z.number().int().nonnegative(),
  nonBillableMinutes: z.number().int().nonnegative(),
  unbilledBillableMinutes: z.number().int().nonnegative(),
  invoicedBillableMinutes: z.number().int().nonnegative(),
  totalBillableAmount: z.string(),
  unbilledBillableAmount: z.string(),
  currency: CurrencyEnum,
});

export type ProjectTimeEntrySummary = z.infer<typeof ProjectTimeEntrySummarySchema>;
