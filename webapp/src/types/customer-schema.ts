import { z } from "zod";

export const CustomerFormSchema = z.object({
  name: z
    .string({ error: "Customer name is required" })
    .refine((value) => value.trim().length > 0, "Customer name is required")
    .max(255),
  companyName: z.string().max(255).optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  taxId: z.string().max(100).optional(),
  addressLine1: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  stateOrRegion: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  countryCode: z.string().length(2, "Country code required").optional(),
  defaultCurrency: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
  paymentTerms: z.number().int().nonnegative("Payment terms must be non-negative").optional(),
});

export type CustomerFormValues = z.infer<typeof CustomerFormSchema>;

export function validateCustomerForm(values: CustomerFormValues): void {
  CustomerFormSchema.parse(values);
}
