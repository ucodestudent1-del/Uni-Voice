import { useMemo } from "react";
import { formatCurrencyValue } from "@/lib/utils";
import type { ApiExpenseSummary } from "@/types/api";
import type { ApiExpenseBudgetSettings } from "@/types/expenses";
import { AlertCircle, CheckCircle, TrendingUp } from "lucide-react";

export interface BudgetProgressProps {
  summary: ApiExpenseSummary | null;
  budget: ApiExpenseBudgetSettings | null;
  loading?: boolean;
}

export default function BudgetProgress({ summary, budget, loading = false }: BudgetProgressProps) {
  const monthlySpent = useMemo(() => {
    return summary ? parseFloat(summary.total_amount) : 0;
  }, [summary]);

  const currency = summary?.currency ?? "USD";
  const budgetAmount = budget ? parseFloat(budget.monthly_budget) : 0;

  if (!budget) {
    return (
      <div className="bg-surface rounded-xl border border-color p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-primary">Monthly Budget</h3>
        </div>
        <div className="text-center py-6 text-tertiary">
          <p className="text-sm">No budget set</p>
          <p className="text-xs mt-1">Set a monthly budget in Settings to track progress.</p>
        </div>
      </div>
    );
  }

  const percentage = budgetAmount > 0 ? Math.min((monthlySpent / budgetAmount) * 100, 100) : 0;
  const remaining = budgetAmount - monthlySpent;
  const warningThreshold = budget?.budget_warning_threshold ?? 80;
  const overThreshold = budget?.budget_over_threshold ?? 100;

  const isOverBudget = percentage >= overThreshold;
  const isWarning = percentage >= warningThreshold && !isOverBudget;

  const progressBarColor = isOverBudget
    ? "rgb(var(--color-error))"
    : isWarning
      ? "rgb(var(--color-warning))"
      : "rgb(var(--color-success))";

  const bgColor = isOverBudget
    ? "status-error-bg"
    : isWarning
      ? "status-warning-bg"
      : "status-success-bg";

  const iconColor = isOverBudget
    ? "text-error-text"
    : isWarning
      ? "text-warning-text"
      : "text-success-text";

  const statusMessage = isOverBudget
    ? `You've exceeded your monthly budget by ${formatCurrencyValue(remaining, currency)}`
    : isWarning
      ? `Near budget limit — ${formatCurrencyValue(remaining, currency)} remaining`
      : "On track with your monthly budget";

  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-color p-5">
        <h3 className="text-sm font-semibold text-primary mb-4">Monthly Budget</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-full bg-surface-alt rounded" />
          <div className="h-4 w-3/4 bg-surface-alt rounded" />
        </div>
      </div>
    );
  }

  return (
      <div className={`bg-surface rounded-xl border border-color p-5 ${bgColor} transition-colors`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className={`w-4 h-4 ${iconColor}`} />
            <h3 className="text-sm font-semibold text-primary">Monthly Budget</h3>
          </div>
          <div className="text-xs text-tertiary">
            {formatCurrencyValue(monthlySpent, currency)} /{" "}
            {formatCurrencyValue(budgetAmount, currency)}
          </div>
        </div>

        <div className="relative h-4 rounded-full bg-surface border border-color-subtle overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${percentage}%`, backgroundColor: progressBarColor }}
          />
        </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOverBudget ? (
            <AlertCircle className="w-4 h-4 text-error-text" />
          ) : isWarning ? (
            <AlertCircle className="w-4 h-4 text-warning-text" />
          ) : (
            <CheckCircle className="w-4 h-4 text-success-text" />
          )}
          <span className="text-xs text-tertiary">{statusMessage}</span>
        </div>
        <span className="text-xs font-medium text-tertiary">
          {percentage.toFixed(0)}% used
        </span>
      </div>

      {isOverBudget && (
        <div className="mt-3 rounded-lg status-error-bg border status-error-border px-3 py-2">
          <p className="text-xs text-error-text">
            You have exceeded your monthly spending budget. Consider reviewing your expenses.
          </p>
        </div>
      )}
    </div>
  );
}
