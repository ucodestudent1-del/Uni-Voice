import { z } from "zod";
import { Decimal } from "decimal.js";

export const UUIDSchema = z.string().uuid();

export const DecimalStringSchema = z.union([z.string(), z.number()]).transform((v) => new Decimal(v));

export const OptionalDecimalSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v == null ? undefined : new Decimal(v)));

export const NonNegativeDecimalSchema = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const d = new Decimal(v);
    if (d.isNegative()) throw new z.ZodError([{ code: "custom", message: "Must be non-negative" } as never]);
    return d;
  });

export const CurrencyCodeSchema = z.enum([
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "BRL",
  "MXN", "SGD", "HKD", "NZD", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF",
  "TRY", "RUB", "ZAR", "KRW", "THB", "IDR", "MYR", "PHP", "VND",
]);

export const MoneySchema = z.object({
  amount: DecimalStringSchema,
  currency: CurrencyCodeSchema,
});

export type MoneyInput = z.infer<typeof MoneySchema>;

export const InvoiceLineItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().nullable().optional(),
  description: z.string().min(1, "description required"),
  quantity: DecimalStringSchema,
  unit: z.string().optional(),
  unitPrice: DecimalStringSchema,
  discount: OptionalDecimalSchema,
  discountType: z.enum(["fixed", "percentage"]).optional(),
  taxRate: DecimalStringSchema.default("0"),
  taxAmount: DecimalStringSchema.default("0"),
  lineSubtotal: DecimalStringSchema.default("0"),
  lineTotal: DecimalStringSchema.default("0"),
  sortOrder: z.number().optional(),
  isTaxInclusive: z.boolean().optional(),
});

export type InvoiceLineItemInput = z.infer<typeof InvoiceLineItemSchema>;

export const InvoiceTotalsSchema = z.object({
  subtotal: DecimalStringSchema,
  discountTotal: DecimalStringSchema,
  taxTotal: DecimalStringSchema,
  feeTotal: DecimalStringSchema,
  total: DecimalStringSchema,
  amountPaid: DecimalStringSchema,
  amountDue: DecimalStringSchema,
});

export type InvoiceTotalsInput = z.infer<typeof InvoiceTotalsSchema>;

export const PaginationSchema = z.object({
  limit: z.number().min(1).max(200).default(50),
  offset: z.number().min(0).default(0),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

export { Decimal };
