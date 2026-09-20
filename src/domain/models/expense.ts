import type { CurrencyCode } from "../value-objects/currency.js";

export type ExpenseCategory =
  | "supplies"
  | "software"
  | "meals"
  | "travel"
  | "office"
  | "marketing"
  | "utilities"
  | "professional_fees"
  | "taxes"
  | "insurance"
  | "equipment"
  | "other";

export interface Expense {
  id: string;
  businessId: string;
  userId: string | null;
  customerId: string | null;
  projectId: string | null;
  invoiceId: string | null;
  description: string;
  amount: string;
  currency: CurrencyCode;
  category: ExpenseCategory;
  expenseDate: Date;
  paymentMethod: string;
  receiptUrl: string | null;
  notes: string | null;
  isBillable: boolean;
  isReimbursed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseSummary {
  totalAmount: string;
  billableAmount: string;
  reimbursedAmount: string;
  nonReimbursedBillable: string;
  count: number;
  currency: CurrencyCode;
  periodStart: Date | null;
  periodEnd: Date | null;
}
