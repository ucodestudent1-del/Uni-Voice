import { useMemo } from "react";
import { DollarSign, Users } from "lucide-react";
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
import { KPICard, DataTable, type ColumnDef } from "@/components/ui";
import type {
  ApiRevenueReport,
  ApiRevenueByStatus,
  ApiRevenueByPeriod,
  ApiRevenueByCustomer,
} from "@/types/api";
import { formatCurrencyValue } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  draft: "rgb(148 163 188)",
  sent: "rgb(59 130 246)",
  viewed: "rgb(59 130 246)",
  partially_paid: "rgb(245 158 11)",
  paid: "rgb(34 197 94)",
  overdue: "rgb(239 68 68)",
  cancelled: "rgb(148 163 188)",
  void: "rgb(148 163 188)",
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

interface RevenueReportProps {
  data: ApiRevenueReport | null;
  loading: boolean;
  currency: string;
  onExport: () => void;
}

export default function RevenueReport({ data, loading, currency, onExport }: RevenueReportProps) {
  const summary = data?.summary ?? null;
  const byStatus = data?.byStatus ?? [];
  const byPeriod = data?.byPeriod ?? [];
  const byCustomer = data?.byCustomer ?? [];

  const statusChartData = useMemo(() => {
    return byStatus
      .filter((s) => Number(s.total_amount) > 0)
      .map((s) => ({
        status: s.status.replace("_", " "),
        value: Number(s.total_amount),
        count: s.count,
        color: STATUS_COLORS[s.status] ?? "rgb(148 163 188)",
      }));
  }, [byStatus]);

  const statusTotal = statusChartData.reduce((sum, s) => sum + s.value, 0);

  const periodChartData = useMemo(() => {
    return byPeriod.map((p) => ({
      period: p.period,
      invoiced: Number(p.invoiced),
      paid: Number(p.paid),
    }));
  }, [byPeriod]);

  const revenueTrend = useMemo(() => {
    if (periodChartData.length < 2) return undefined;
    const current = periodChartData[periodChartData.length - 1]?.invoiced ?? 0;
    const prev = periodChartData[periodChartData.length - 2]?.invoiced ?? 0;
    if (prev === 0) return undefined;
    const pct = ((current - prev) / prev) * 100;
    return { value: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, direction: (pct >= 0 ? "up" : "down") as "up" | "down" };
  }, [periodChartData]);

  const paidTrend = useMemo(() => {
    if (periodChartData.length < 2) return undefined;
    const current = periodChartData[periodChartData.length - 1]?.paid ?? 0;
    const prev = periodChartData[periodChartData.length - 2]?.paid ?? 0;
    if (prev === 0) return undefined;
    const pct = ((current - prev) / prev) * 100;
    return { value: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, direction: (pct >= 0 ? "up" : "down") as "up" | "down" };
  }, [periodChartData]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-color p-5 h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-surface rounded-xl border border-color" />
          <div className="h-80 bg-surface rounded-xl border border-color" />
        </div>
        <div className="h-64 bg-surface rounded-xl border border-color" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-secondary">
        <DollarSign className="w-12 h-12 text-tertiary mx-auto mb-3" />
        <p>No revenue data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">Revenue Report</h2>
        <button
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-lg border border-color px-4 py-2.5 text-sm font-medium text-secondary hover:bg-surface-alt transition-colors min-h-[44px]"
        >
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="Total Revenue"
          value={summary?.totalRevenue ?? "0"}
          currency={currency}
          subtitle="Gross revenue earned"
          icon={<DollarSign className="w-5 h-5" />}
          iconBackground="bg-success-bg text-success-text"
          trend={revenueTrend}
        />
        <KPICard
          title="Payments Received"
          value={summary?.paymentsReceived ?? "0"}
          currency={currency}
          subtitle="Payments this period"
          icon={<DollarSign className="w-5 h-5" />}
          iconBackground="bg-info-bg text-info-text"
          trend={paidTrend}
        />
        <KPICard
          title="Outstanding"
          value={summary?.totalOutstanding ?? "0"}
          currency={currency}
          subtitle="Unpaid invoices total"
          icon={<DollarSign className="w-5 h-5" />}
          iconBackground="bg-warning-bg text-warning-text"
        />
        <KPICard
          title="Overdue"
          value={summary?.totalOverdue ?? "0"}
          currency={currency}
          subtitle="Past due amounts"
          icon={<DollarSign className="w-5 h-5" />}
          iconBackground="bg-error-bg text-error-text"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-surface rounded-xl border border-color p-5">
            <h3 className="text-sm font-semibold text-primary tracking-tight mb-4">Revenue Trend</h3>
            {periodChartData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={periodChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revInvoiced" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="rgb(59 130 246)" stopOpacity={0.9} />
                        <stop offset="95%" stopColor="rgb(59 130 246)" stopOpacity={0.5} />
                      </linearGradient>
                      <linearGradient id="revPaid" x1="0" y1="0" x2="0" y2="1">
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
                      minTickGap={20}
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
                    <Legend
                      wrapperStyle={{ fontSize: "12px", paddingTop: "8px", color: "rgb(var(--chart-text-secondary))" }}
                      iconType="circle"
                      iconSize={8}
                      verticalAlign="top"
                      align="right"
                    />
                    <Bar dataKey="invoiced" name="Invoiced" fill="url(#revInvoiced)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="paid" name="Paid" fill="url(#revPaid)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center border border-dashed border-color-subtle rounded-lg">
                <p className="text-sm text-secondary">No revenue data</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-surface rounded-xl border border-color p-5">
            <h3 className="text-sm font-semibold text-primary tracking-tight mb-4">Revenue by Status</h3>
            {statusChartData.length > 0 ? (
              <div className="relative h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
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
                      {statusChartData.map((_entry, index) => (
                        <Cell key={`rev-cell-${index}`} fill={statusChartData[index].color} />
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
                      {formatCurrencyValue(statusTotal, currency)}
                    </span>
                    <span className="text-xs text-secondary">total</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center border border-dashed border-color-subtle rounded-lg">
                <p className="text-sm text-secondary">No status data</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {byCustomer.length > 0 && (
        <div className="bg-surface rounded-xl border border-color overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-sm font-semibold text-primary">Top Customers by Revenue</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-alt border-b border-color">
                 <th className="text-left text-xs font-medium text-secondary uppercase py-3.5 px-4">Customer</th>
                 <th className="text-right text-xs font-medium text-secondary uppercase py-3.5 px-4">Invoices</th>
                 <th className="text-right text-xs font-medium text-secondary uppercase py-3.5 px-4">Invoiced</th>
                 <th className="text-right text-xs font-medium text-secondary uppercase py-3.5 px-4">Paid</th>
                 <th className="text-right text-xs font-medium text-secondary uppercase py-3.5 px-4">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {byCustomer.map((c) => (
                  <tr key={c.customerId} className="border-b border-color-subtle last:border-b-0 hover:bg-surface-alt">
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-primary truncate max-w-[160px] block">
                        {c.customerName || "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-secondary">{c.invoiceCount}</td>
                    <td className="py-3 px-4 text-right text-sm font-tabular-nums text-primary">
                      {formatCurrencyValue(c.invoiced, currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-tabular-nums text-success-text">
                      {formatCurrencyValue(c.paid, currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-tabular-nums text-warning-text">
                      {formatCurrencyValue(c.outstanding, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
