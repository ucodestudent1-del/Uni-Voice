import { useMemo } from "react";
import { ShoppingCart, Download } from "lucide-react";
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
import { DataTable, type ColumnDef, KPICard } from "@/components/ui";
import { EXPENSE_CATEGORY_CONFIG } from "@/components/expenses/ExpenseCategoryBadge";
import type { ApiExpensesReport, ApiExpenseReportItem } from "@/types/api";
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

interface ExpensesReportProps {
  data: ApiExpensesReport | null;
  loading: boolean;
  currency: string;
  onExport: () => void;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  totalRows?: number;
}

export default function ExpensesReport({
  data,
  loading,
  currency,
  onExport,
  pageSize = 25,
  currentPage = 1,
  totalRows,
  onPageChange,
}: ExpensesReportProps) {
  const expenses = data?.expenses ?? [];
  const summary = data?.summary ?? null;

  const columns: ColumnDef<ApiExpenseReportItem>[] = [
    {
      header: "Date",
      accessor: "expense_date",
      cell: (_row, value) => (
        <span className="text-sm text-secondary">
          {value ? new Date(value as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
        </span>
      ),
    },
    {
      header: "Vendor",
      accessor: "vendor",
      cell: (_row, value) => (
        <span className="text-sm text-secondary truncate max-w-[120px] block">
          {value ? String(value) : "—"}
        </span>
      ),
    },
    {
      header: "Description",
      accessor: "description",
      cell: (_row, value) => (
        <span className="text-sm font-medium text-primary truncate max-w-[160px] block">
          {value ? String(value) : "—"}
        </span>
      ),
    },
    {
      header: "Category",
      accessor: "category",
      cell: (_row, value) => {
        const cat = (value as string) ?? "other";
        const config = EXPENSE_CATEGORY_CONFIG[cat as keyof typeof EXPENSE_CATEGORY_CONFIG] ?? EXPENSE_CATEGORY_CONFIG.other;
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium">
            <span aria-hidden="true">{config.icon}</span>
            <span>{config.label}</span>
          </span>
        );
      },
    },
    {
      header: "Customer",
      accessor: "customer_name",
      cell: (_row, value) => (
        <span className="text-sm text-secondary truncate max-w-[120px] block">
          {value ? String(value) : "—"}
        </span>
      ),
    },
    {
      header: "Amount",
      accessor: "amount",
      align: "right",
      cell: (_row, value) => <span className="text-sm font-tabular-nums text-primary">{formatCurrencyValue(value as string | number | null | undefined, currency)}</span>,
    },
    {
      header: "Billable",
      accessor: "is_billable",
      cell: (_row, value) => (
        <span className={`text-xs ${Number(value) === 1 ? "text-success-text" : "text-tertiary"}`}>
          {Number(value) === 1 ? "Yes" : "No"}
        </span>
      ),
      sortable: false,
    },
  ];

  const categoryChartData = useMemo(() => {
    return (summary?.category_breakdown ?? []).map((c) => ({
      category: EXPENSE_CATEGORY_CONFIG[c.category as keyof typeof EXPENSE_CATEGORY_CONFIG]?.label ?? c.category,
      value: Number(c.total),
      count: c.count,
      percentage: c.percentage,
      rawCategory: c.category,
    }));
  }, [summary?.category_breakdown]);

  const categoryTotal = categoryChartData.reduce((sum, c) => sum + c.value, 0);

  const monthlyTrendData = useMemo(() => {
    return (summary?.monthly_trend ?? []).map((m) => ({
      period: m.period,
      amount: Number(m.amount),
      count: m.count,
    }));
  }, [summary?.monthly_trend]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-color p-5 h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-surface rounded-xl border border-color" />
          <div className="h-64 bg-surface rounded-xl border border-color" />
        </div>
        <div className="h-96 bg-surface rounded-xl border border-color" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-secondary">
        <ShoppingCart className="w-12 h-12 text-tertiary mx-auto mb-3" />
        <p>No expense data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">Expenses Report</h2>
        <button
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-lg border border-color px-4 py-2.5 text-sm font-medium text-secondary hover:bg-surface-alt transition-colors min-h-[44px]"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KPICard
            title="Total Expenses"
            value={summary.total_amount}
            currency={currency}
            subtitle={`${summary.total_expenses} expenses`}
            icon={<ShoppingCart className="w-5 h-5" />}
            iconBackground="bg-error-bg text-error-text"
          />
          <KPICard
            title="Billable"
            value={summary.billable_amount}
            currency={currency}
            subtitle="Billable expenses"
            icon={<ShoppingCart className="w-5 h-5" />}
            iconBackground="bg-info-bg text-info-text"
          />
          <KPICard
            title="Reimbursable"
            value={summary.reimbursable_amount}
            currency={currency}
            subtitle="Eligible for reimbursement"
            icon={<ShoppingCart className="w-5 h-5" />}
            iconBackground="bg-warning-bg text-warning-text"
          />
          <KPICard
            title="Non-Reimbursed Billable"
            value={summary.non_reimbursed_billable}
            currency={currency}
            subtitle="Still to collect"
            icon={<ShoppingCart className="w-5 h-5" />}
            iconBackground="bg-warning-bg text-warning-text"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border border-color p-5">
          <h3 className="text-sm font-semibold text-primary mb-4">Spending Trend</h3>
          {monthlyTrendData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="expBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgb(239 68 68)" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="rgb(239 68 68)" stopOpacity={0.5} />
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
                    formatter={(value) => [formatCurrencyCompact(Number(value ?? 0), currency), ""]}
                    labelStyle={{ color: "rgb(var(--chart-text-secondary))", marginBottom: "4px" }}
                  />
                  <Bar dataKey="amount" name="Spending" fill="url(#expBar)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center border border-dashed border-color-subtle rounded-lg">
              <p className="text-sm text-tertiary">No expense data yet</p>
            </div>
          )}
        </div>

        <div className="bg-surface rounded-xl border border-color p-5">
          <h3 className="text-sm font-semibold text-primary mb-4">By Category</h3>
          {categoryChartData.length > 0 ? (
            <div className="relative h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
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
                    {categoryChartData.map((_entry, index) => (
                      <Cell key={`exp-cell-${index}`} fill={CATEGORY_COLORS[categoryChartData[index].rawCategory] ?? "rgb(148 163 188)"} />
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
                    {formatCurrencyValue(categoryTotal, currency)}
                  </span>
                  <span className="text-xs text-tertiary">total</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center border border-dashed border-color-subtle rounded-lg">
              <p className="text-sm text-tertiary">No category data</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-color overflow-hidden">
        <DataTable
          columns={columns}
          data={expenses}
          totalRows={totalRows ?? expenses.length}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={onPageChange}
          isLoading={loading}
          emptyMessage="No expenses match your filters"
          rowKey="id"
        />
      </div>
    </div>
  );
}
