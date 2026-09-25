import type { ExpenseCategory } from "@/types/api";

export type ExpensesCategory = ExpenseCategory;

export type ExpenseCategoryColor =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "tertiary"
  | "info";

export interface ApiExpenseCategoryBreakdown {
  category: ExpenseCategory;
  total: string;
  count: number;
  percentage: number;
}

export interface ApiExpenseMonthlyTrend {
  period: string;
  amount: string;
  count: number;
}

export interface ApiExpenseBudgetSettings {
  monthly_budget: string;
  monthly_budget_currency: string;
  budget_period: "calendar_month" | "rolling_30";
  budget_notifications: boolean;
  budget_warning_threshold: number;
  budget_over_threshold: number;
}
