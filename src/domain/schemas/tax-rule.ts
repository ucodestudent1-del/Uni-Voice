import { z } from "zod";

export const TaxRuleConditionFieldSchema = z.enum([
  "customer_country",
  "customer_state",
  "product_category",
  "item_description",
  "currency",
  "total_amount_min",
  "total_amount_max",
]);

export type TaxRuleConditionField = z.infer<typeof TaxRuleConditionFieldSchema>;

export const TaxRuleConditionOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "in",
  "not_in",
  "contains",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
]);

export type TaxRuleConditionOperator = z.infer<typeof TaxRuleConditionOperatorSchema>;

export const TaxRuleConditionSchema = z.object({
  id: z.string().uuid().optional(),
  field: TaxRuleConditionFieldSchema,
  operator: TaxRuleConditionOperatorSchema,
  value: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

export type TaxRuleConditionInput = z.infer<typeof TaxRuleConditionSchema>;

export const TaxRuleSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(50).nullish(),
  rate: z.coerce.number().min(0, "Rate must be non-negative"),
  type: z.enum(["percentage", "fixed"]).default("percentage"),
  countryCode: z.string().length(3).nullish(),
  region: z.string().max(100).nullish(),
  isCompound: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  enabled: z.boolean().default(true),
  conditions: z.array(TaxRuleConditionSchema).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TaxRule = z.infer<typeof TaxRuleSchema>;

export const TaxRuleCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(50).nullish(),
  rate: z.coerce.number().min(0, "Rate must be non-negative"),
  type: z.enum(["percentage", "fixed"]).optional(),
  countryCode: z.string().length(3).nullish(),
  region: z.string().max(100).nullish(),
  isCompound: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  enabled: z.boolean().optional(),
  conditions: z.array(TaxRuleConditionSchema).optional(),
});

export type TaxRuleCreateInput = z.infer<typeof TaxRuleCreateSchema>;

export const TaxRuleUpdateSchema = TaxRuleCreateSchema.partial();

export type TaxRuleUpdateInput = z.infer<typeof TaxRuleUpdateSchema>;

export const TaxRuleSearchParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  enabled: z.coerce.boolean().optional(),
  countryCode: z.string().optional(),
});

export type TaxRuleSearchQuery = z.infer<typeof TaxRuleSearchParamsSchema>;

export const TaxEvaluationContextSchema = z.object({
  customerCountry: z.string().nullish(),
  customerState: z.string().nullish(),
  productCategories: z.array(z.string()).optional(),
  currency: z.string().length(3).nullish(),
  lineItemCount: z.number().int().nonnegative().optional(),
  totalAmount: z.string().optional(),
});

export type TaxEvaluationContext = z.infer<typeof TaxEvaluationContextSchema>;
