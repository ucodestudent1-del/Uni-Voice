import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "../value-objects/currency.js";

export const CustomerStatusSchema = z.enum(["active", "inactive", "archived"]);

export type CustomerStatus = z.infer<typeof CustomerStatusSchema>;

export const AddressSchema = z.object({
  addressLine1: z.string().min(1, "addressLine1 required"),
  addressLine2: z.string().nullish(),
  city: z.string().min(1, "city required"),
  stateOrRegion: z.string().nullish(),
  postalCode: z.string().nullish(),
  countryCode: z.string().length(2, "countryCode required"),
  taxId: z.string().nullish(),
});

export const CustomerAddressSchema = z.object({
  id: z.string().uuid(),
  label: z.string().max(100).nullish(),
  type: z.enum(["billing", "shipping"]).default("billing"),
  isDefault: z.boolean().default(false),
  addressLine1: z.string().min(1),
  addressLine2: z.string().nullish(),
  city: z.string().min(1),
  stateOrRegion: z.string().nullish(),
  postalCode: z.string().nullish(),
  countryCode: z.string().length(2),
});

export const TaxIdentifierSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1, "Tax identifier type is required"),
  value: z.string().min(1, "Tax identifier value is required"),
  isDefault: z.boolean().default(false),
  verified: z.boolean().default(false),
});

export const CustomerSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  name: z.string().min(1),
  companyName: z.string().nullish(),
  email: z.string().email("Invalid email address").nullish(),
  phone: z.string().nullish(),
  taxId: z.string().nullish(),
  address: AddressSchema,
  countryCode: z.string().length(2).nullish(),
  defaultCurrency: z.enum(SUPPORTED_CURRENCIES).nullish(),
  notes: z.string().nullish(),
  status: CustomerStatusSchema.default("active"),
  paymentTerms: z.number().int().nonnegative("Payment terms must be non-negative").nullish(),
  taxIdentifiers: z.array(TaxIdentifierSchema).optional(),
  billingAddressId: z.string().uuid().nullish(),
  shippingAddressId: z.string().uuid().nullish(),
  archivedAt: z.date().nullish(),
  archivedBy: z.string().uuid().nullish(),
  updatedBy: z.string().nullish(),
  version: z.number().int().min(1).default(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Customer = z.infer<typeof CustomerSchema>;

export const CustomerCreateSchema = z.object({
  name: z.string().min(1, "Customer name is required").max(255),
  companyName: z.string().max(255).nullish(),
  email: z.string().email("Invalid email address").nullish(),
  phone: z.string().max(50).nullish(),
  taxId: z.string().max(100).nullish(),
  addressLine1: z.string().max(255).nullish(),
  addressLine2: z.string().max(255).nullish(),
  city: z.string().max(100).nullish(),
  stateOrRegion: z.string().max(100).nullish(),
  postalCode: z.string().max(20).nullish(),
  countryCode: z.string().length(2).nullish(),
  defaultCurrency: z.enum(SUPPORTED_CURRENCIES).nullish(),
  notes: z.string().nullish(),
  status: CustomerStatusSchema.optional(),
  paymentTerms: z.number().int().nonnegative("Payment terms must be non-negative").nullish(),
  taxIdentifiers: z.array(z.object({
    type: z.string().min(1, "Tax identifier type is required"),
    value: z.string().min(1, "Tax identifier value is required"),
    isDefault: z.boolean().optional(),
  })).optional(),
});

export type CustomerCreateInput = z.infer<typeof CustomerCreateSchema>;

export const CustomerUpdateSchema = CustomerCreateSchema.partial();

export type CustomerUpdateInput = z.infer<typeof CustomerUpdateSchema>;

export const CustomerSortFieldSchema = z.enum([
  "name", "company_name", "email", "created_at", "updated_at", "status",
]);

export type CustomerSortField = z.infer<typeof CustomerSortFieldSchema>;

export const CustomerSortOrderSchema = z.enum(["asc", "desc"]).default("asc");

export const CustomerSearchQuerySchema = z.object({
  search: z.string().max(255).optional(),
  status: CustomerStatusSchema.optional(),
  email: z.string().max(255).optional(),
  companyName: z.string().max(255).optional(),
  countryCode: z.string().max(3).optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  sortBy: CustomerSortFieldSchema.default("name"),
  sortOrder: CustomerSortOrderSchema.default("asc"),
  includeArchived: z.boolean().optional(),
  enrich: z.coerce.boolean().optional(),
});

export type CustomerSearchQuery = z.infer<typeof CustomerSearchQuerySchema>;

export const CustomerListItemSchema = CustomerSchema.extend({
  invoiceCount: z.number().int().nonnegative().optional(),
  totalOutstanding: z.string().optional(),
  mostRecentInvoiceDate: z.string().nullable().optional(),
});

export type CustomerListItem = z.infer<typeof CustomerListItemSchema>;

export const CustomerImportSchema = z.object({
  csv: z.string().min(1, "CSV data is required"),
});
