import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { ArrowLeft, BarChart3, Users, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getProprietaryInvoiceStatusReport,
  getProprietaryRevenueReport,
  getProprietaryCustomerSummary,
  getProprietaryPaymentSummary,
} from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { KPICard, Skeleton, StatusBadge, invoiceStatusConfig, DataTable, Button } from "@/components/ui";
import { formatCurrencyValue } from "@/lib/utils";
import { useMetaTags } from "@/hooks/useMetaTags";
import type { ColumnDef } from "@/types/components";

const STATUS_COLORS: Record<string, string> = {
  posted: "hsl(140 60% 40%)",
  paid: "hsl(140 60% 40%)",
  sent: "hsl(45 90% 50%)",
  viewed: "hsl(210 90% 50%)",
  partial: "hsl(45 90% 50%)",
  partially_paid: "hsl(45 90% 50%)",
  overdue: "hsl(0 80% 55%)",
  draft: "hsl(210 12% 55%)",
  void: "hsl(0 0% 40%)",
  accepted: "hsl(140 60% 45%)",
  converted: "hsl(210 90% 50%)",
  expired: "hsl(0 0% 45%)",
};

function useReport<T>(key: string, fn: () => Promise<T>) {
  return useQuery({
    queryKey: [key],
    queryFn: fn,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

interface PeriodOption {
  value: string;
  label: string;
  dateFrom: string;
  dateTo: string;
}

const PERIODS: PeriodOption[] = [
  { value: "30", label: "Last 30 days", dateFrom: "30days", dateTo: "today" },
  { value: "90", label: "Last 90 days", dateFrom: "90days", dateTo: "today" },
  { value: "365", label: "Last 12 months", dateFrom: "365days", dateTo: "today" },
];

function getRelativeDate(days: string): string {
  if (days === "today") return new Date().toISOString().slice(0, 10);
  const d = parseInt(days);
  if (isNaN(d)) return new Date().toISOString().slice(0, 10);
  const date = new Date();
  date.setDate(date.getDate() - d);
  return date.toISOString().slice(0, 10);
}

interface CustomerRow {
  id: string;
  name: string;
  email?: string;
  currency?: string;
  invoice_count: number;
  total_invoiced: string;
  total_outstanding: string;
}

export default function ProprietaryReports() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("30");

  useMetaTags({
    title: "Reports — DocForge",
    description: "Business financial reports and insights.",
    noIndex: true,
  });

  const dateFrom = getRelativeDate(period);

  const { data: revenueData, isLoading: revenueLoading } = useReport(
    "proprietary-revenue-report",
    () => getProprietaryRevenueReport({ dateFrom, groupBy: "month" }),
  );

  const { data: statusData, isLoading: statusLoading } = useReport(
    "proprietary-invoice-status-report",
    () => getProprietaryInvoiceStatusReport(),
  );

  const { data: customerData, isLoading: customerLoading } = useReport(
    "proprietary-customer-summary",
    () => getProprietaryCustomerSummary(),
  );

  const { data: paymentSummaryData } = useReport(
    "proprietary-payment-summary",
    () => getProprietaryPaymentSummary(),
  );

  const revenueByMonth = useMemo(() => {
    const rows = revenueData?.data ?? [];
    return rows.map((r: any) => ({
      period: r.period ? new Date(r.period).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—",
      revenue: parseFloat(r.revenue) || 0,
      invoice_count: parseInt(r.invoice_count) || 0,
    }));
  }, [revenueData]);

  const statusBreakdown = useMemo(() => {
    const rows = statusData?.data ?? [];
    return rows.map((r: any) => ({
      status: r.status ?? "unknown",
      count: parseInt(r.count) || 0,
      total: parseFloat(r.total) || 0,
    }));
  }, [statusData]);

  const totalRevenue = useMemo(
    () =>
      (revenueByMonth ?? []).reduce((sum, r) => sum + r.revenue, 0),
    [revenueByMonth],
  );

  const totalPayments = useMemo(() => {
    const rows = paymentSummaryData?.summary ?? [];
    return rows.reduce(
      (sum: number, r: any) =>
        sum + (r.status === "succeeded" ? parseFloat(r.amount || r.total_received || 0) : 0),
      0,
    );
  }, [paymentSummaryData]);

  const customerColumns: ColumnDef<CustomerRow>[] = [
    {
      header: "Customer",
      accessor: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.email && <div className="text-sm text-secondary">{row.email}</div>}
        </div>
      ),
    },
    {
      header: "Invoices",
      accessor: "invoice_count",
    },
    {
      header: "Total Invoiced",
      accessor: (row) => formatCurrencyValue(row.total_invoiced, row.currency || "USD"),
    },
    {
      header: "Outstanding",
      accessor: (row) => formatCurrencyValue(row.total_outstanding, row.currency || "USD"),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => navigate("/app/proprietary")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-primary">Reports</h1>
      </div>

      <div className="flex gap-3">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1.5 text-sm rounded transition-all ${
              period === p.value
                ? "bg-primary text-primary-foreground"
                : "text-secondary hover:text-primary border"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          title="Total Revenue"
          value={formatCurrencyValue(totalRevenue, "USD")}
          icon={<BarChart3 className="h-5 w-5" />}
          variant="default"
        />
        <KPICard
          title="Total Payments"
          value={formatCurrencyValue(totalPayments, "USD")}
          icon={<Receipt className="h-5 w-5" />}
          variant="default"
        />
        <KPICard
          title="Active Customers"
          value={customerData?.data?.length ?? 0}
          icon={<Users className="h-5 w-5" />}
          variant="default"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border rounded-lg p-4">
          <h2 className="font-medium text-sm text-secondary mb-3">Revenue by Month</h2>
          {revenueLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : revenueByMonth.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByMonth} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-color-subtle" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11, fill: "rgb(var(--chart-text-secondary))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "rgb(var(--chart-text-secondary))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `$${v >= 1000 ? `${v / 1000}k` : v.toFixed(0)}`}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgb(var(--color-surface))",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "12px",
                      padding: "8px 12px",
                    }}
                    formatter={(value: any) => {
                      const num = typeof value === "number" ? value : parseFloat(value);
                      return [`$${isNaN(num) ? 0 : num.toFixed(2)}`, "Revenue"];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} verticalAlign="top" align="right" iconType="circle" />
                  <Bar dataKey="revenue" fill="hsl(var(--primary-action))" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-secondary text-center py-8">No revenue data for this period.</p>
          )}
        </div>

        <div className="border rounded-lg p-4">
          <h2 className="font-medium text-sm text-secondary mb-3">Invoice Status Breakdown</h2>
          {statusLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : statusBreakdown.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      background: "rgb(var(--color-surface))",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Pie
                    data={statusBreakdown}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {statusBreakdown.map((entry) => (
                      <Cell
                        key={`cell-${entry.status}`}
                        fill={STATUS_COLORS[entry.status] ?? STATUS_COLORS.draft}
                      />
                    ))}
                  </Pie>
                  <Legend
                    wrapperStyle={{ fontSize: "12px" }}
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-secondary text-center py-8">No status data available.</p>
          )}
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="font-medium text-sm text-secondary mb-3">Invoice Status Details</h2>
        {statusLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-secondary">Status</th>
                  <th className="text-right py-2 text-secondary">Count</th>
                  <th className="text-right py-2 text-secondary">Total</th>
                </tr>
              </thead>
              <tbody>
                {statusBreakdown.map((row) => (
                  <tr key={row.status} className="border-b">
                    <td className="py-2">
                      <StatusBadge status={row.status} config={invoiceStatusConfig} />
                    </td>
                    <td className="text-right py-2">{row.count}</td>
                    <td className="text-right py-2">
                      {formatCurrencyValue(row.total, "USD")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="font-medium text-sm text-secondary mb-3">Top Customers</h2>
        {customerLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : customerData?.data && customerData.data.length > 0 ? (
          <DataTable
            columns={customerColumns}
            data={customerData.data}
            rowKey="id"
          />
        ) : (
          <p className="text-sm text-secondary text-center py-8">No customer data available.</p>
        )}
      </div>
    </div>
  );
}
