import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ApiExpenseMonthlyTrend } from "@/types/api";

type Period = "month" | "week";

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

function aggregateWeekly(
  data: ApiExpenseMonthlyTrend[]
): ApiExpenseMonthlyTrend[] {
  const weeklyMap = new Map<string, { period: string; amount: number; count: number }>();

  data.forEach((d) => {
    const date = new Date(d.period);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().slice(0, 10);
    const periodLabel = weekStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    const existing = weeklyMap.get(weekKey);
    if (existing) {
      existing.amount += Number(d.amount);
      existing.count += d.count;
    } else {
      weeklyMap.set(weekKey, {
        period: periodLabel,
        amount: Number(d.amount),
        count: d.count,
      });
    }
  });

  return Array.from(weeklyMap.values()).sort((a, b) => {
    return new Date(a.period).getTime() - new Date(b.period).getTime();
  }).map((item) => ({
    period: item.period,
    amount: item.amount.toFixed(2),
    count: item.count,
  }));
}

export default function ExpenseTrendChart({
  data,
  currency = "USD",
  loading = false,
}: {
  data: ApiExpenseMonthlyTrend[] | null;
  currency?: string;
  loading?: boolean;
}) {
  const [period, setPeriod] = useState<Period>("month");

  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    if (period === "month") return data;
    return aggregateWeekly(data);
  }, [data, period]);

  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-color p-5">
        <h3 className="text-sm font-semibold text-primary mb-4">Spending Trend</h3>
        <div className="h-64 flex items-center justify-center border border-dashed border-color-subtle rounded-lg">
          <p className="text-sm text-tertiary">Loading trends…</p>
        </div>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="bg-surface rounded-xl border border-color p-5">
        <h3 className="text-sm font-semibold text-primary mb-4">Spending Trend</h3>
        <div className="h-64 flex items-center justify-center border border-dashed border-color-subtle rounded-lg">
          <p className="text-sm text-tertiary">No expense data yet</p>
        </div>
      </div>
    );
  }

  const chartColor = "rgb(var(--chart-revenue))";

  return (
    <div className="bg-surface rounded-xl border border-color p-5">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-primary">Spending Trend</h3>
        <div className="inline-flex rounded-lg border border-color overflow-hidden">
          <button
            onClick={() => setPeriod("month")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              period === "month"
                ? "bg-primary-bg text-primary"
                : "text-tertiary hover:text-primary"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setPeriod("week")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              period === "week"
                ? "bg-primary-bg text-primary"
                : "text-tertiary hover:text-primary"
            }`}
          >
            Weekly
          </button>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="barExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.9} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              className="stroke-color-subtle"
            />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12, fill: "rgb(var(--chart-text))" }}
              tickLine={false}
              axisLine={{ stroke: "rgb(var(--chart-border))" }}
              minTickGap={15}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "rgb(var(--chart-text))" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatCurrencyCompact(v, currency)}
              width={60}
            />
            <Tooltip
              contentStyle={{
                background: "rgb(var(--color-surface))",
                border: "none",
                borderRadius: "8px",
                color: "rgb(var(--color-text))",
                fontSize: "12px",
                padding: "8px 12px",
              }}
              formatter={(value) => [
                formatCurrencyCompact(Number(value ?? 0), currency),
                "",
              ]}
              labelStyle={{
                color: "rgb(var(--chart-text-secondary))",
                marginBottom: "4px",
              }}
            />
            <Legend
              wrapperStyle={{
                fontSize: "12px",
                paddingTop: "8px",
                color: "rgb(var(--chart-text-secondary))",
              }}
              iconType="circle"
              iconSize={8}
              verticalAlign="top"
              align="right"
            />
            <Bar
              dataKey="amount"
              name="Spending"
              fill="url(#barExpense)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 text-xs text-tertiary">
        {chartData.length} data points • Total:{" "}
        <span className="font-medium text-primary font-tabular-nums">
          {formatCurrencyCompact(
            chartData.reduce((sum, d) => sum + Number(d.amount), 0),
            currency
          )}
        </span>
      </div>
    </div>
  );
}
