import { z } from "zod";

export const DiscountRuleScopeSchema = z.enum(["invoice", "line_item"]);

export type DiscountRuleScope = z.infer<typeof DiscountRuleScopeSchema>;

export const DiscountRuleTypeSchema = z.enum(["fixed", "percentage"]);

export type DiscountRuleType = z.infer<typeof DiscountRuleTypeSchema>;

export const DiscountRuleSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(255),
  type: DiscountRuleTypeSchema.default("percentage"),
  value: z.coerce.number().min(0, "Value must be non-negative"),
  scope: DiscountRuleScopeSchema.default("invoice"),
  appliesTo: z.string().nullish(),
  minAmount: z.coerce.number().min(0).nullish(),
  maxDiscount: z.coerce.number().min(0).nullish(),
  startsAt: z.date().nullish(),
  endsAt: z.date().nullish(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DiscountRule = z.infer<typeof DiscountRuleSchema>;

export const DiscountRuleCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  type: DiscountRuleTypeSchema.optional(),
  value: z.coerce.number().min(0, "Value must be non-negative"),
  scope: DiscountRuleScopeSchema.optional(),
  appliesTo: z.string().nullish(),
  minAmount: z.coerce.number().min(0).nullish(),
  maxDiscount: z.coerce.number().min(0).nullish(),
  startsAt: z.string().datetime().nullish(),
  endsAt: z.string().datetime().nullish(),
  isActive: z.boolean().optional(),
});

export type DiscountRuleCreateInput = z.infer<typeof DiscountRuleCreateSchema>;

export const DiscountRuleUpdateSchema = DiscountRuleCreateSchema.partial();

export type DiscountRuleUpdateInput = z.infer<typeof DiscountRuleUpdateSchema>;

export const DiscountRuleSearchParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  active: z.coerce.boolean().optional(),
});

export type DiscountRuleSearchQuery = z.infer<typeof DiscountRuleSearchParamsSchema>;

export const DiscountEvaluationContextSchema = z.object({
  currency: z.string().length(3),
  invoiceDate: z.string().datetime().optional(),
  lineItems: z.array(
    z.object({
      description: z.string(),
      productId: z.string().nullish(),
      quantity: z.string(),
      unitPrice: z.string(),
      category: z.string().nullish(),
    })
  ),
  subtotal: z.string(),
});

export type DiscountEvaluationContext = z.infer<typeof DiscountEvaluationContextSchema>;
