import { useEffect, useState, useMemo } from "react";
import { useSubscription } from "../contexts/SubscriptionContext";
import { Decimal } from "decimal.js";
import { AlertCircle, Download, RefreshCw } from "lucide-react";
import { getEnhancedDashboard, getInvoices } from "../api/client";
import { formatCurrencyValue } from "../lib/utils";
import type {
  ApiVolumeTrend,
  ApiPaymentMetrics,
  ApiAgingBucket,
  ApiInvoiceListItem,
} from "../types/api";
import ReportKPICards from "../components/dashboard/ReportKPICards";
import MonthlyTrendChart from "../components/dashboard/MonthlyTrendChart";
import PaymentStatusPie from "../components/dashboard/PaymentStatusPie";
import ReportTransactions from "../components/dashboard/ReportTransactions";
import ReportInsights from "../components/dashboard/ReportInsights";

interface ReportState {
  volumeTrend: ApiVolumeTrend[];
  paymentMetrics: ApiPaymentMetrics | null;
  agingBuckets: ApiAgingBucket[];
  dashboardSummary: {
    totalOutstanding: string;
    totalOverdue: string;
    totalPaidThisMonth: string;
    totalRevenue: string;
    draftCount: number;
    overdueCount: number;
    sentCount: number;
    paidCount: number;
    totalInvoices: number;
  } | null;
  invoices: ApiInvoiceListItem[];
  currency: string;
}

export default function ReportSection() {
  const { plan } = useSubscription();

  const [data, setData] = useState<ReportState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    loadAll();
  }, [retryKey]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, invoicesRes] = await Promise.all([
        getEnhancedDashboard().catch(() => ({
          summary: null,
          agingBuckets: [],
          paymentMetrics: null,
          volumeTrend: [],
        })),
        getInvoices({ limit: 50 }).catch(() => ({ invoices: [] })),
      ]);

      const dash = dashRes as any;
      const trendData = Array.isArray(dash.volumeTrend)
        ? dash.volumeTrend
        : Array.isArray((dashRes as any).report)
          ? (dashRes as any).report
          : [];
      const metrics = (dash.paymentMetrics ?? null) as ApiPaymentMetrics | null;
      const agingBuckets = Array.isArray(dash.agingBuckets) ? dash.agingBuckets : [];
      const dashSummary = dash.summary ?? null;
      const invoices = Array.isArray(invoicesRes.invoices) ? invoicesRes.invoices : [];

      setData({
        volumeTrend: trendData,
        paymentMetrics: metrics,
        agingBuckets,
        dashboardSummary: dashSummary,
        invoices,
        currency: dash.summary?.currency ?? "USD",
      });
    } catch (err: any) {
      setError(err.response?.data?.error || "Could not load report data");
    } finally {
      setLoading(false);
    }
  }

  const kpis = useMemo(() => {
    if (!data) return null;

    const totalRevenue = data.dashboardSummary
      ? new Decimal(data.dashboardSummary.totalRevenue)
      : new Decimal(0);

    const outstanding = new Decimal(data.dashboardSummary?.totalOutstanding ?? "0");

    const avgDays = data.paymentMetrics?.averagePaymentTimeDays ?? null;

    const churnRate = computeChurnRate(data.invoices);

    const paidThisMonth = data.dashboardSummary?.totalPaidThisMonth ?? "0";

    return { totalRevenue, outstanding, avgDays, churnRate, paidThisMonth };
  }, [data]);

  const paymentStatusData = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    data.invoices.forEach((inv) => {
      const status = inv.status || "draft";
      counts[status] = (counts[status] || 0) + 1;
    });

    const colorMap: Record<string, string> = {
      draft: "var(--color-warning)",
      sent: "var(--color-info)",
      viewed: "var(--color-info)",
      partially_paid: "var(--color-warning)",
      paid: "var(--color-success)",
      overdue: "var(--color-error)",
      cancelled: "var(--color-text-tertiary)",
      void: "var(--color-text-tertiary)",
    };

    return Object.entries(counts).map(([label, value]) => ({
      label: label.replace("_", " "),
      value,
      color: colorMap[label] || "var(--color-text-secondary)",
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-surface rounded w-56" />
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

  if (error) {
    return (
      <div className="rounded-xl border border-error-border bg-error-bg p-6 text-center">
        <AlertCircle className="w-10 h-10 text-error-text mx-auto mb-3" />
        <p className="text-sm font-medium text-error-text mb-4">{error}</p>
        <button
          onClick={() => setRetryKey((key) => key + 1)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-color bg-surface p-6 text-center">
        <p className="text-sm text-secondary">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Financial Report</h1>
          {plan && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1 ml-3 bg-primary-bg text-on-primary">
              {plan.name} Plan
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const csv = generateCSV(data);
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `financial-report-${new Date().toISOString().split("T")[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-color px-4 py-2.5 text-sm font-medium text-secondary hover:bg-hover transition-colors min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {kpis && (
        <ReportKPICards
          currency={data.currency}
          totalRevenue={kpis.totalRevenue.toFixed(2)}
          totalOutstanding={kpis.outstanding.toFixed(2)}
          avgPaymentDays={kpis.avgDays}
          churnRate={kpis.churnRate}
          volumeTrend={data.volumeTrend}
          paidThisMonth={kpis.paidThisMonth}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MonthlyTrendChart currency={data.currency} volumeTrend={data.volumeTrend} />
        </div>
        <div>
          <PaymentStatusPie data={paymentStatusData} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ReportTransactions invoices={data.invoices} title="Recent Transactions" limit={10} />
        </div>
        <div>
          <ReportInsights invoices={data.invoices} currency={data.currency} />
        </div>
      </div>
    </div>
  );
}

function computeChurnRate(invoices: ApiInvoiceListItem[]): number | null {
  if (invoices.length === 0) return null;
  const customerSet = new Set<string>();
  const churnedSet = new Set<string>();
  invoices.forEach((inv) => {
    const customerId = inv.customer_id || inv.id;
    customerSet.add(customerId);
    if (inv.status === "cancelled" || inv.status === "void") {
      churnedSet.add(customerId);
    }
  });
  if (customerSet.size === 0) return null;
  return Math.round((churnedSet.size / customerSet.size) * 1000) / 10;
}

function generateCSV(data: ReportState | null): string {
  if (!data) return "No data";
  const rows: string[] = [];
  rows.push("Financial Report");
  rows.push(`Generated,${new Date().toISOString()}`);
  rows.push("");
  rows.push("Monthly Trends");
  rows.push("Period,Invoiced,Paid");
  data.volumeTrend.forEach((d) => {
    rows.push(`${d.period},${d.invoiced},${d.paid}`);
  });
  rows.push("");
  rows.push("Recent Transactions");
  rows.push("Invoice,Customer,Status,Amount,Due Date");
  data.invoices.slice(0, 20).forEach((inv) => {
    rows.push(`"${inv.invoice_number || inv.id}","${inv.customer_name || "—"}","${inv.status}","${inv.amount_due || inv.total}","${inv.due_date || "—"}"`);
  });
  return rows.join("\n");
}
