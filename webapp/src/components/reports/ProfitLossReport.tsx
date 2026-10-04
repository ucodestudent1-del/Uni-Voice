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
} from "recharts";
import { KPICard } from "@/components/ui";
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
    return (revenue?.byMonth ?? []).map((m) => ({
      period: m.period,
      revenue: Number(m.amount ?? 0),
      count: m.count,
    }));
  }, [revenue?.byMonth]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-color p-5 h-24" />
          ))}
        </div>
        <div className="h-64 bg-surface rounded-xl border border-color" />
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
          subtitle={`${expenses?.count ?? 0} items`}
          icon={<DollarSign className="w-5 h-5" />}
          iconBackground="bg-error-bg text-error-text"
        />
        <KPICard
          title="Net Income"
          value={netIncome}
          currency={currency}
          subtitle="Revenue minus expenses"
          icon={<TrendingUp className="w-5 h-5" />}
          iconBackground={Number(netIncome) >= 0 ? "bg-success-bg text-success-text" : "bg-error-bg text-error-text"}
        />
        <KPICard
          title="Gross Margin"
          value={grossMargin.toFixed(1)}
          currency={currency}
          subtitle="Share of revenue retained"
          icon={<TrendingUp className="w-5 h-5" />}
          iconBackground="bg-info-bg text-info-text"
        />
      </div>

      <div className="bg-surface rounded-xl border border-color p-5">
        <h3 className="text-sm font-semibold text-primary tracking-tight mb-4">Revenue by Month</h3>
        {monthlyData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="plRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(34 197 94)" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="rgb(34 197 94)" stopOpacity={0.5} />
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
                  formatter={(value) => [formatCurrencyCompact(Number(value ?? 0), currency), "Revenue"]}
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
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center border border-dashed border-color-subtle rounded-lg">
            <p className="text-sm text-secondary">No data for this period</p>
          </div>
        )}
      </div>

      {monthlyData.length > 0 && (
        <div className="bg-surface rounded-xl border border-color p-5">
          <h3 className="text-sm font-semibold text-primary tracking-tight mb-4">Revenue Breakdown</h3>
          <div className="space-y-1.5">
            {monthlyData
              .slice()
              .sort((a, b) => a.period.localeCompare(b.period))
              .map((entry) => (
                <div
                  key={entry.period}
                  className="flex items-center justify-between py-1.5 text-sm border-b border-color-subtle last:border-b-0"
                >
                  <span className="text-secondary truncate">{entry.period}</span>
                  <div className="text-right">
                    <span className="font-medium text-primary font-tabular-nums">
                      {formatCurrencyCompact(entry.revenue, currency)}
                    </span>
                    <span className="text-xs text-secondary ml-2">
                      {entry.count} invoice{entry.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-color p-5">
        <h3 className="text-sm font-semibold text-primary tracking-tight mb-1">Net Income</h3>
        <p className="text-3xl font-bold text-primary font-tabular-nums">
          {formatCurrencyValue(Number(netIncome ?? 0), currency)}
        </p>
      </div>
    </div>
  );
}
