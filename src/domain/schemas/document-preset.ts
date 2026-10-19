import { z } from "zod";
import { DocumentTypeSchema } from "./invoice-template.js";

export const DocumentPresetDataSchema = z.object({
  customerId: z.string().uuid().optional(),
  currency: z.string().length(3).optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  paymentInstructions: z.string().optional(),
  paymentTerms: z.string().optional(),
  items: z.array(z.record(z.string(), z.unknown())).optional(),
  fees: z.array(z.record(z.string(), z.unknown())).optional(),
  invoiceDiscount: z.string().optional(),
  invoiceDiscountType: z.enum(["fixed", "percentage"]).optional(),
  taxRate: z.string().optional(),
  taxName: z.string().optional(),
  scopeOfWork: z.string().optional(),
  internalNotes: z.string().optional(),
  quoteDiscount: z.string().optional(),
  quoteDiscountType: z.enum(["fixed", "percentage"]).optional(),
  expiryDate: z.string().optional(),
  poNumber: z.string().optional(),
  referenceInvoiceId: z.string().optional(),
  reason: z.string().optional(),
  shippingDescription: z.string().optional(),
  shippingAmount: z.string().optional(),
  shippingTaxRate: z.string().optional(),
  voucherDate: z.string().optional(),
  payeeName: z.string().optional(),
  payeeEmail: z.string().optional(),
  payeePhone: z.string().optional(),
  payeeTaxId: z.string().optional(),
  referenceNumber: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentProvider: z.string().optional(),
  receiptAmount: z.string().optional(),
  receiptPaymentMethod: z.string().optional(),
  receiptPaymentProvider: z.string().optional(),
  receiptProviderPaymentId: z.string().optional(),
  receiptIssuedAt: z.string().optional(),
  supplierName: z.string().optional(),
  supplierEmail: z.string().optional(),
  supplierPhone: z.string().optional(),
  supplierTaxId: z.string().optional(),
  deliveryDate: z.string().optional(),
});

export type DocumentPresetData = z.infer<typeof DocumentPresetDataSchema>;

export const DocumentPresetSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().nullable().optional(),
  documentType: DocumentTypeSchema.default("invoice"),
  data: DocumentPresetDataSchema,
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  createdBy: z.string().uuid().nullable().optional(),
  updatedBy: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DocumentPreset = z.infer<typeof DocumentPresetSchema>;

export const DocumentPresetInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().nullable().optional(),
  documentType: DocumentTypeSchema.default("invoice"),
  data: DocumentPresetDataSchema,
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type DocumentPresetInput = z.infer<typeof DocumentPresetInputSchema>;

export const DocumentPresetUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  documentType: DocumentTypeSchema.optional(),
  data: DocumentPresetDataSchema.optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type DocumentPresetUpdate = z.infer<typeof DocumentPresetUpdateSchema>;

export interface FindManyPresetOptions {
  documentType?: string | string[];
  isDefault?: boolean;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}
