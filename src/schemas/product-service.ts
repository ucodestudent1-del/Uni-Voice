import { z } from "zod";
import { Decimal } from "decimal.js";
import { SUPPORTED_CURRENCIES } from "../domain/value-objects/currency.js";
import { PRODUCT_SERVICE_TYPES, PRODUCT_SERVICE_STATUSES } from "../domain/models/product-service.js";

const CurrencyEnum = z.enum(SUPPORTED_CURRENCIES).default("USD");
const ProductServiceTypeSchema = z.enum(PRODUCT_SERVICE_TYPES).default("product");
const ProductServiceStatusSchema = z.enum(PRODUCT_SERVICE_STATUSES).default("active");
const DiscountTypeSchema = z.enum(["fixed", "percentage"]).default("percentage");

const decimalFromString = z
  .union([z.string(), z.number(), z.instanceof(Decimal)])
  .transform((v) => new Decimal(v));

export const CreateProductServiceSchema = z.object({
  type: ProductServiceTypeSchema,
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(2000).nullable().optional(),
  sku: z.string().min(1, "SKU must not be empty").max(100).nullable().optional(),
  unit: z.string().min(1).default("each"),
  unitPrice: decimalFromString.refine((d) => !d.isNegative(), "Unit price must be >= 0"),
  taxCategory: z.string().max(50).nullable().optional(),
  currency: CurrencyEnum,
  status: ProductServiceStatusSchema,
  discountType: DiscountTypeSchema,
  discountValue: decimalFromString.refine((d) => !d.isNegative(), "Discount value must be >= 0"),
});

export const UpdateProductServiceSchema = CreateProductServiceSchema.partial().extend({
  status: ProductServiceStatusSchema.optional(),
  version: z.number().int().positive().optional(),
});

export const ProductServiceSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: ProductServiceTypeSchema,
  name: z.string(),
  description: z.string().nullable(),
  sku: z.string().nullable(),
  unit: z.string(),
  unitPrice: z.string(),
  taxCategory: z.string().nullable(),
  currency: CurrencyEnum,
  status: ProductServiceStatusSchema,
  discountType: DiscountTypeSchema,
  discountValue: z.string(),
  version: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ProductServiceSnapshotSchema = z.object({
  productId: z.string().uuid(),
  productType: ProductServiceTypeSchema,
  name: z.string(),
  description: z.string().nullable(),
  sku: z.string().nullable(),
  unit: z.string(),
  unitPrice: z.string(),
  taxCategory: z.string().nullable(),
  taxRate: z.string(),
  discountType: DiscountTypeSchema,
  discountValue: z.string(),
  currency: CurrencyEnum,
});

export const CatalogSearchSchema = z.object({
  search: z.string().max(255).optional(),
  type: ProductServiceTypeSchema.optional(),
  status: z
    .enum([...PRODUCT_SERVICE_STATUSES, "all"] as unknown as [string, ...string[]])
    .default("all"),
  taxCategory: z.string().max(50).optional(),
  hasSku: z.boolean().optional(),
  sortBy: z.enum(["name", "sku", "unitPrice", "createdAt"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const CatalogSelectionSchema = z.object({
  search: z.string().max(255).optional(),
  type: ProductServiceTypeSchema.optional(),
  onlyActive: z.coerce.boolean().default(true),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const BulkCatalogItemSchema = CreateProductServiceSchema.extend({
  id: z.string().uuid().optional(),
  _action: z.enum(["create", "update", "upsert"]).default("upsert"),
});

export const BulkCatalogSchema = z.object({
  items: z.array(BulkCatalogItemSchema).min(1, "At least one item is required"),
  conflictStrategy: z.enum(["skip", "overwrite"]).default("overwrite"),
});

export type CreateProductServiceInput = z.infer<typeof CreateProductServiceSchema>;
export type UpdateProductServiceInput = z.infer<typeof UpdateProductServiceSchema>;
export type ProductServiceDTO = z.infer<typeof ProductServiceSchema>;
export type ProductServiceSnapshotDTO = z.infer<typeof ProductServiceSnapshotSchema>;
export type CatalogSearchInput = z.infer<typeof CatalogSearchSchema>;
export type CatalogSelectionInput = z.infer<typeof CatalogSelectionSchema>;
export type BulkCatalogInput = z.infer<typeof BulkCatalogSchema>;
export type BulkCatalogItemInput = z.infer<typeof BulkCatalogItemSchema>;

export const PagedProductServicesSchema = z.object({
  data: z.array(ProductServiceSchema),
  total: z.number().int().min(0),
  limit: z.number().int().min(1),
  offset: z.number().int().min(0),
});

export type PagedProductServices = z.infer<typeof PagedProductServicesSchema>;
