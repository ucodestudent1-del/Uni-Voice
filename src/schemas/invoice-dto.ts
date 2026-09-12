import { z } from "zod";
import { Decimal } from "decimal.js";

export const DraftLineItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().nullable().optional(),
  description: z.string().min(1, "description required"),
  quantity: z.union([z.string(), z.number()]).transform((v) => new Decimal(v)),
  unit: z.string().optional(),
  unitPrice: z.union([z.string(), z.number()]).transform((v) => new Decimal(v)),
  discount: z.union([z.string(), z.number()]).optional().transform((v) => (v == null ? undefined : new Decimal(v))),
  discountType: z.enum(["fixed", "percentage"]).optional(),
  taxRate: z.union([z.string(), z.number()]).optional().transform((v) => (v == null ? new Decimal(0) : new Decimal(v))),
  isTaxInclusive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export const DraftFeeSchema = z.object({
  description: z.string().min(1, "description required"),
  amount: z.union([z.string(), z.number()]).transform((v) => new Decimal(v)),
  taxRate: z.union([z.string(), z.number()]).optional().transform((v) => (v == null ? new Decimal(0) : new Decimal(v))),
  sortOrder: z.number().optional(),
});

export const CreateInvoiceDraftSchema = z.object({
  customerId: z.string().nullable().optional(),
  currency: z.string().optional(),
  issueDate: z.union([z.string(), z.date()]).nullable().optional(),
  dueDate: z.union([z.string(), z.date()]).nullable().optional(),
  notes: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  paymentInstructions: z.string().nullable().optional(),
  items: z.array(DraftLineItemSchema).optional(),
  fees: z.array(DraftFeeSchema).optional(),
});

export type DraftLineItem = z.infer<typeof DraftLineItemSchema>;
export type DraftFee = z.infer<typeof DraftFeeSchema>;
export type CreateInvoiceDraftInput = z.infer<typeof CreateInvoiceDraftSchema>;

export const UpdateInvoiceDraftSchema = CreateInvoiceDraftSchema.partial();

export type UpdateInvoiceDraftInput = z.infer<typeof UpdateInvoiceDraftSchema>;