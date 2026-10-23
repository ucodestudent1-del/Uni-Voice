import { z } from "zod";

export const ProductCreateSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  defaultUnitPrice: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().optional().nullable(),
  ),
  defaultTaxRate: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().optional().nullable(),
  ),
  unit: z.string().default("each"),
  defaultCurrency: z.string().default("USD"),
});

export const ProductUpdateSchema = ProductCreateSchema.partial();
