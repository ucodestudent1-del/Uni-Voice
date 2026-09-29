import { useMemo } from "react";
import { CreditCard, DollarSign, CheckCircle, Clock, XCircle, Download } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Decimal } from "decimal.js";
import { DataTable, type ColumnDef, StatusBadge, paymentStatusConfig } from "@/components/ui";
import type { ApiPaymentsReport, ApiPaymentReportItem } from "@/types/api";
import { formatCurrencyValue } from "@/lib/utils";

interface PaymentsReportProps {
  data: ApiPaymentsReport | null;
  loading: boolean;
  currency: string;
  onExport: () => void;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  totalRows?: number;
}

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

export default function PaymentsReport({
  data,
  loading,
  currency,
  onExport,
  pageSize = 25,
  currentPage = 1,
  totalRows,
  onPageChange,
}: PaymentsReportProps) {
  const payments = data?.payments ?? [];
  const summary = data?.summary ?? null;

  const columns: ColumnDef<ApiPaymentReportItem>[] = [
    {
      header: "Date",
      accessor: "created_at",
      cell: (_row, value) => (
        <span className="text-sm text-secondary">
          {value ? new Date(value as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
        </span>
      ),
    },
    {
      header: "Invoice",
      accessor: "invoice_number",
      cell: (row) => {
        const p = row as ApiPaymentReportItem;
        return (
          <span className="text-sm font-medium text-primary truncate max-w-[120px] block">
            {p.invoice_number || `—`}
          </span>
        );
      },
    },
    {
      header: "Customer",
      accessor: "customer_name",
      cell: (_row, value) => (
        <span className="text-sm text-secondary truncate max-w-[140px] block">
          {value ? String(value) : "—"}
        </span>
      ),
    },
    {
      header: "Status",
      accessor: "status",
      cell: (_row, value) => <StatusBadge status={value as string} config={paymentStatusConfig} showLabel size="sm" />,
      sortable: false,
    },
    {
      header: "Method",
      accessor: "method",
      cell: (_row, value) => (
        <span className="text-sm text-secondary">{value ? String(value) : "—"}</span>
      ),
    },
    {
      header: "Provider",
      accessor: "provider",
      cell: (_row, value) => (
        <span className="text-sm text-secondary truncate max-w-[90px] block">
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
  ];

  const dailyTrendData = useMemo(() => {
    return (summary?.dailyTrend ?? []).map((d) => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount: Number(d.amount),
      count: d.count,
    }));
  }, [summary?.dailyTrend]);

  const providerData = useMemo(() => {
    return (summary?.providerBreakdown ?? []).map((p) => ({
      provider: p.provider,
      count: p.count,
      amount: Number(p.amount),
    }));
  }, [summary?.providerBreakdown]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {Array.from({ length: 5 }).map((_, i) => (
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
        <CreditCard className="w-12 h-12 text-tertiary mx-auto mb-3" />
        <p>No payment data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">Payments Report</h2>
          <button
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-lg border border-color px-4 py-2.5 text-sm font-medium text-secondary hover:bg-surface-alt transition-colors min-h-[44px]"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          <ReportStatCard title="Total Payments" value={summary.totalPayments.toString()} icon={<DollarSign className="w-5 h-5" />} iconBg="bg-info-bg text-info-text" />
          <ReportStatCard title="Total Amount" value={formatCurrencyValue(summary.totalAmount, currency)} icon={<DollarSign className="w-5 h-5" />} iconBg="bg-success-bg text-success-text" subtitle={currency} />
          <ReportStatCard title="Paid" value={formatCurrencyValue(summary.totalPaid, currency)} icon={<CheckCircle className="w-5 h-5" />} iconBg="bg-success-bg text-success-text" subtitle={currency} />
          <ReportStatCard title="Pending" value={formatCurrencyValue(summary.totalPending, currency)} icon={<Clock className="w-5 h-5" />} iconBg="bg-info-bg text-info-text" subtitle={currency} />
          <ReportStatCard title="Failed/Refunded" value={formatCurrencyValue(new Decimal(summary.totalFailed).plus(new Decimal(summary.totalRefunded)), currency)} icon={<XCircle className="w-5 h-5" />} iconBg="bg-error-bg text-error-text" subtitle={currency} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border border-color p-5">
          <h3 className="text-sm font-semibold text-primary mb-4">Payments This Month</h3>
          {dailyTrendData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-color-subtle" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "rgb(var(--chart-text))" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgb(var(--chart-border))" }}
                    minTickGap={10}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "rgb(var(--chart-text))" }}
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
                    formatter={(value) => [formatCurrencyCompact(Number(value ?? 0), currency), "Amount"]}
                    labelStyle={{ color: "rgb(var(--chart-text-secondary))", marginBottom: "4px" }}
                  />
                  <Bar dataKey="amount" name="Amount" fill="rgb(59 130 246)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center border border-dashed border-color-subtle rounded-lg">
              <p className="text-sm text-tertiary">No payment data</p>
            </div>
          )}
        </div>

        {providerData.length > 0 && (
          <div className="bg-surface rounded-xl border border-color p-5">
            <h3 className="text-sm font-semibold text-primary mb-4">By Provider</h3>
            <div className="space-y-3">
              {providerData
                .sort((a, b) => b.amount - a.amount)
                .map((p) => (
                  <div key={p.provider} className="flex items-center justify-between">
                    <span className="text-sm text-secondary truncate max-w-[100px]">{p.provider}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-tertiary">{p.count} payments</span>
                      <span className="text-sm font-tabular-nums text-primary w-24 text-right">
                        {formatCurrencyValue(p.amount, currency)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-surface rounded-xl border border-color overflow-hidden">
        <DataTable
          columns={columns}
          data={payments}
          totalRows={totalRows ?? payments.length}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={onPageChange}
          isLoading={loading}
          emptyMessage="No payments match your filters"
          rowKey="id"
        />
      </div>
    </div>
  );
}

function ReportStatCard({
  title,
  value,
  subtitle,
  icon,
  iconBg,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-color p-4">
      <div className="flex items-center gap-2">
        <span className={`rounded-lg p-1.5 flex-shrink-0 ${iconBg}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-tertiary uppercase">{title}</p>
          <p className="text-lg font-bold text-primary truncate font-tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-tertiary">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
