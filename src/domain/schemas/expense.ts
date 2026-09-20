import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "../value-objects/currency.js";

const CurrencyEnum = z.enum(SUPPORTED_CURRENCIES).default("USD");
const ExpenseCategoryEnum = z.enum([
  "supplies",
  "software",
  "meals",
  "travel",
  "office",
  "marketing",
  "utilities",
  "professional_fees",
  "taxes",
  "insurance",
  "equipment",
  "other",
]);

export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  customerId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  invoiceId: z.string().uuid().nullable(),
  description: z.string().min(1),
  amount: z.string(),
  currency: CurrencyEnum,
  category: ExpenseCategoryEnum.default("other"),
  expenseDate: z.union([z.string(), z.date()]),
  paymentMethod: z.string().default("cash"),
  receiptUrl: z.string().nullable(),
  notes: z.string().nullable(),
  isBillable: z.boolean().default(false),
  isReimbursed: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Expense = z.infer<typeof ExpenseSchema>;

export const ExpenseCreateSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  description: z.string().min(1, "Description is required").max(2000),
  amount: z.preprocess(
    (v) => {
      if (typeof v === "string" || typeof v === "number") return Number(v);
      return v;
    },
    z.number().min(0, "Amount must be >= 0")
  ),
  currency: CurrencyEnum.optional(),
  category: ExpenseCategoryEnum.default("other"),
  expenseDate: z.union([z.string(), z.date()]).optional(),
  paymentMethod: z.string().default("cash"),
  receiptUrl: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  isBillable: z.boolean().default(false),
});

export type ExpenseCreateInput = z.infer<typeof ExpenseCreateSchema>;

export const ExpenseUpdateSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(2000).optional(),
  amount: z.preprocess(
    (v) => {
      if (typeof v === "string" || typeof v === "number") return Number(v);
      return v;
    },
    z.number().min(0).optional()
  ),
  currency: CurrencyEnum.optional(),
  category: ExpenseCategoryEnum.optional(),
  expenseDate: z.union([z.string(), z.date()]).optional(),
  paymentMethod: z.string().optional(),
  receiptUrl: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  isBillable: z.boolean().optional(),
  isReimbursed: z.boolean().optional(),
});

export type ExpenseUpdateInput = z.infer<typeof ExpenseUpdateSchema>;

export const ExpenseSearchSchema = z.object({
  customerId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  category: ExpenseCategoryEnum.optional(),
  isBillable: z.coerce.boolean().optional(),
  isReimbursed: z.coerce.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  sortBy: z.enum(["expense_date", "amount", "created_at", "category"]).default("expense_date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ExpenseSearchInput = z.infer<typeof ExpenseSearchSchema>;

export const ExpenseSummarySchema = z.object({
  totalAmount: z.string(),
  billableAmount: z.string(),
  reimbursedAmount: z.string(),
  nonReimbursedBillable: z.string(),
  count: z.number().int().nonnegative(),
  currency: CurrencyEnum,
  periodStart: z.union([z.string(), z.date()]).nullable(),
  periodEnd: z.union([z.string(), z.date()]).nullable(),
});

export type ExpenseSummary = z.infer<typeof ExpenseSummarySchema>;
