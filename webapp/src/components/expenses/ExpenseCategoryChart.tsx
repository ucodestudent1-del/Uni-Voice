import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from "recharts";
import { useMemo } from "react";
import { EXPENSE_CATEGORY_CONFIG } from "./ExpenseCategoryBadge";
import type { ApiExpenseCategoryBreakdown } from "@/types/expenses";

interface ExpenseCategoryChartProps {
  data: ApiExpenseCategoryBreakdown[] | null;
  currency?: string;
  loading?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  supplies: "rgb(59 130 246)",
  software: "rgb(37 99 232)",
  meals: "rgb(245 158 11)",
  travel: "rgb(96 165 250)",
  office: "rgb(100 116 139)",
  marketing: "rgb(34 197 94)",
  utilities: "rgb(251 191 21)",
  professional_fees: "rgb(239 68 68)",
  taxes: "rgb(239 68 68)",
  insurance: "rgb(96 165 250)",
  equipment: "rgb(34 197 94)",
  other: "rgb(148 163 188)",
};

function formatCurrencyCompact(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `$${value}`;
  }
}

export default function ExpenseCategoryChart({
  data,
  currency = "USD",
  loading = false,
}: ExpenseCategoryChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((d) => ({
      category: EXPENSE_CATEGORY_CONFIG[d.category]?.label ?? d.category,
      value: Number(d.total),
      amount: formatCurrencyCompact(Number(d.total), currency),
      count: d.count,
      percentage: d.percentage,
      rawCategory: d.category,
    }));
  }, [data, currency]);

  const total = useMemo(
    () => chartData.reduce((sum, d) => sum + d.value, 0),
    [chartData]
  );

  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-color p-5 h-72 flex items-center justify-center">
        <p className="text-sm text-tertiary">Loading categories…</p>
      </div>
    );
  }

  if (!chartData.length || total === 0) {
    return (
      <div className="bg-surface rounded-xl border border-color p-5 h-72 flex items-center justify-center">
        <p className="text-sm text-tertiary">No expenses to categorize</p>
      </div>
    );
  }

  const pieData = chartData.filter((d) => d.value > 0);

  return (
    <div className="bg-surface rounded-xl border border-color p-5">
      <h3 className="text-sm font-semibold text-primary mb-4">Spending by Category</h3>

      <div className="relative h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : "0"}%`}
                labelLine={false}
              >
              {pieData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CATEGORY_COLORS[entry.rawCategory] ?? "rgb(148 163 188)"}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "rgb(var(--color-surface))",
                border: "none",
                borderRadius: "8px",
                color: "rgb(var(--color-text))",
                fontSize: "12px",
                padding: "8px 12px",
              }}
              formatter={(value, name) => {
                const entry = pieData.find((d) => d.category === name);
                if (!entry) return [value, name];
                return [entry.amount, `${name} (${entry.percentage.toFixed(0)}%)`];
              }}
              labelStyle={{
                color: "rgb(var(--chart-text-secondary))",
                marginBottom: "4px",
              }}
            />
            <Label
              value={formatCurrencyCompact(total, currency)}
              position="center"
              style={{
                fontSize: "24px",
                fontWeight: 700,
                fill: "rgb(var(--color-text))",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 space-y-1.5">
        {pieData
          .sort((a, b) => b.value - a.value)
          .map((entry) => (
            <div
              key={entry.rawCategory}
              className="flex items-center justify-between py-1.5 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[entry.rawCategory] ??
                      "rgb(148 163 188)",
                  }}
                />
                <span className="text-secondary truncate">
                  {entry.category}
                </span>
              </div>
              <div className="text-right">
                <span className="font-medium text-primary font-tabular-nums">
                  {entry.amount}
                </span>
                <span className="text-xs text-tertiary ml-2">
                  {entry.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
