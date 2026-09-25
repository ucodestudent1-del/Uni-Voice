import { forwardRef } from "react";
import { Decimal } from "decimal.js";
import type { ReactNode } from "react";
import { formatCurrencyValue } from "@/lib/utils";

export interface ExpenseKPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  iconBackground: string;
  currency?: string;
  trend?: { value: string; direction: "up" | "down" };
  isLoading?: boolean;
}

const ExpenseKPICard = forwardRef<HTMLDivElement, ExpenseKPICardProps>(
  function ExpenseKPICard(
    { title, value, subtitle, icon, iconBackground, currency = "USD", trend, isLoading = false },
    ref
  ) {
    const d = new Decimal(value ?? 0);
    const formatted = d.isZero() && !trend
      ? "—"
      : formatCurrencyValue(value, currency);

    return (
      <div
        ref={ref}
        className="bg-surface rounded-xl border border-color p-5 shadow hover:border-color-strong transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className={`rounded-lg p-2 flex-shrink-0 ${iconBackground}`}
            aria-hidden="true"
          >
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-tertiary uppercase tracking-wide">
              {title}
            </p>
            {isLoading ? (
              <div className="h-7 w-32 bg-surface-alt rounded mt-1 animate-pulse" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-primary truncate font-tabular-nums">
                {formatted}
              </p>
            )}
            {(subtitle || trend) && (
              <div className="flex items-center gap-2 mt-1">
                {subtitle && (
                  <p className="text-xs text-tertiary truncate">{subtitle}</p>
                )}
                {trend && (
                  <span
                    className={`text-xs font-medium flex items-center gap-0.5 ${
                      trend.direction === "up"
                        ? "text-error-text"
                        : "text-success-text"
                    }`}
                  >
                    {trend.direction === "up" ? "↑" : "↓"} {trend.value}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

export default ExpenseKPICard;
