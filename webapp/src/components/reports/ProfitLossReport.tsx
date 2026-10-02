import { useMemo } from "react";
import { DollarSign, TrendingUp, Download } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { KPICard } from "@/components/ui";
import { EXPENSE_CATEGORY_CONFIG } from "@/components/expenses/ExpenseCategoryBadge";
import type { ApiProfitLossReport } from "@/types/api";
import { formatCurrencyValue } from "@/lib/utils";

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

interface ProfitLossReportProps {
  data: ApiProfitLossReport | null;
  loading: boolean;
  currency: string;
  onExport: () => void;
}

export default function ProfitLossReport({ data, loading, currency, onExport }: ProfitLossReportProps) {
  const revenue = data?.revenue ?? null;
  const expenses = data?.expenses ?? null;
  const netIncome = data?.netIncome ?? "0";
  const grossMargin = data?.grossMargin ?? 0;

  const monthlyData = useMemo(() => {
    const months = new Set<string>();
    data?.revenue.byMonth.forEach((m) => months.add(m.period));
    data?.expenses.byMonth.forEach((m) => months.add(m.period));
    return Array.from(months).sort().map((period) => ({
      period,
      revenue: data?.revenue.byMonth.find((m) => m.period === period)?.amount ?? "0",
      expenses: data?.expenses.byMonth.find((m) => m.period === period)?.amount ?? "0",
    }));
  }, [data]);

  const chartData = monthlyData.map((m) => ({
    period: m.period,
    revenue: Number(m.revenue),
    expenses: Number(m.expenses),
    net: Number(m.revenue) - Number(m.expenses),
  }));

  const expenseCategoryData = useMemo(() => {
    return (expenses?.byCategory ?? []).map((c) => ({
      category: EXPENSE_CATEGORY_CONFIG[c.category as keyof typeof EXPENSE_CATEGORY_CONFIG]?.label ?? c.category,
      value: Number(c.total),
      count: c.count,
      rawCategory: c.category,
    }));
  }, [expenses?.byCategory]);

  const totalCategoryValue = expenseCategoryData.reduce((sum, c) => sum + c.value, 0);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-color p-5 h-24" />
          ))}
        </div>
        <div className="h-64 bg-surface rounded-xl border border-color" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-surface rounded-xl border border-color" />
          <div className="h-80 bg-surface rounded-xl border border-color" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-secondary">
        <DollarSign className="w-12 h-12 text-tertiary mx-auto mb-3" />
        <p>No profit & loss data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">Profit & Loss</h2>
        <button
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-lg border border-color px-4 py-2.5 text-sm font-medium text-secondary hover:bg-surface-alt transition-colors min-h-[44px]"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KPICard
          title="Total Revenue"
          value={revenue?.total ?? "0"}
          currency={currency}
          subtitle={`${revenue?.count ?? 0} invoices`}
          icon={<DollarSign className="w-5 h-5" />}
          iconBackground="bg-success-bg text-success-text"
        />
        <KPICard
          title="Total Expenses"
          value={expenses?.total ?? "0"}
          currency={currency}
          subtitle={`${expenses?.count ?? 0} expenses`}
          icon={<DollarSign className="w-5 h-5" />}
          iconBackground="bg-error-bg text-error-text"
        />
        <KPICard
          title="Net Income"
          value={netIncome}
          currency={currency}
          subtitle={`Gross margin: ${grossMargin.toFixed(1)}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          iconBackground={Number(netIncome) >= 0 ? "bg-success-bg text-success-text" : "bg-error-bg text-error-text"}
        />
      </div>

      <div className="bg-surface rounded-xl border border-color p-5">
        <h3 className="text-sm font-semibold text-primary tracking-tight mb-4">Revenue vs. Expenses</h3>
        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="plRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(34 197 94)" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="rgb(34 197 94)" stopOpacity={0.5} />
                  </linearGradient>
                  <linearGradient id="plExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(239 68 68)" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="rgb(239 68 68)" stopOpacity={0.5} />
                  </linearGradient>
                  <linearGradient id="plNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(59 130 246)" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="rgb(59 130 246)" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-color-subtle" />
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
                  tickFormatter={(v) => formatCurrencyCompact(v, currency)}
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
                  formatter={(value, name) => [formatCurrencyCompact(Number(value ?? 0), currency), name]}
                  labelStyle={{ color: "rgb(var(--chart-text-secondary))", marginBottom: "4px" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px", color: "rgb(var(--chart-text-secondary))" }}
                    iconType="circle"
                    iconSize={8}
                    verticalAlign="top"
                    align="right"
                  />
                  <Bar dataKey="revenue" name="Revenue" fill="url(#plRevenue)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="url(#plExpenses)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center border border-dashed border-color-subtle rounded-lg">
              <p className="text-sm text-secondary">No data for this period</p>
            </div>
          )}
        </div>

      {expenseCategoryData.length > 0 && (
        <div className="bg-surface rounded-xl border border-color p-5">
          <h3 className="text-sm font-semibold text-primary tracking-tight mb-4">Expenses by Category</h3>
          <div className="relative h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseCategoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  label={({ name, percent }) => `${name} ${percent ? `${(percent * 100).toFixed(0)}%` : ""}`}
                  labelLine={false}
                >
                  {expenseCategoryData.map((_entry, index) => (
                    <Cell key={`pl-cell-${index}`} fill={CATEGORY_COLORS[expenseCategoryData[index].rawCategory] ?? "rgb(148 163 188)"} />
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
                  formatter={(value, name) => [formatCurrencyCompact(Number(value ?? 0), currency), name]}
                  labelStyle={{ color: "rgb(var(--chart-text-secondary))", marginBottom: "4px" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: "rgb(var(--chart-text-secondary))" }}
                    iconType="circle"
                    iconSize={6}
                    verticalAlign="bottom"
                    align="center"
                  />
                </PieChart>
              </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-center">
                <span className="text-xl font-bold text-primary font-tabular-nums">
                  {formatCurrencyValue(totalCategoryValue, currency)}
                </span>
                <span className="text-xs text-secondary">total</span>
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            {expenseCategoryData
              .sort((a, b) => b.value - a.value)
              .map((entry) => (
                <div key={entry.rawCategory} className="flex items-center justify-between py-1.5 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: CATEGORY_COLORS[entry.rawCategory] ?? "rgb(148 163 188)",
                      }}
                    />
                    <span className="text-secondary truncate">{entry.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-primary font-tabular-nums">
                      {formatCurrencyCompact(entry.value, currency)}
                    </span>
                     <span className="text-xs text-secondary ml-2">
                       {entry.count} expense{entry.count !== 1 ? "s" : ""}
                     </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
