import { useEffect, useState, useMemo } from "react";
import { useSubscription } from "../contexts/SubscriptionContext";
import { Decimal } from "decimal.js";
import { AlertCircle, Download, RefreshCw } from "lucide-react";
import { getEnhancedDashboard, getAgingReport, getPaymentMetricsReport } from "../api/client";
import { formatCurrencyValue } from "../lib/utils";
import EmptyState from "@/components/ui/EmptyState";
import type {
  ApiVolumeTrend,
  ApiPaymentMetrics,
  ApiAgingBucket,
} from "../types/api";
import ReportKPICards from "../components/dashboard/ReportKPICards";
import MonthlyTrendChart from "../components/dashboard/MonthlyTrendChart";
import PaymentStatusPie from "../components/dashboard/PaymentStatusPie";

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
    currency: string;
  } | null;
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
      const dashRes = await loadDashboardWithFallback();

      const dash = dashRes;
      setData({
        volumeTrend: dash.volumeTrend,
        paymentMetrics: dash.paymentMetrics,
        agingBuckets: dash.agingBuckets,
        dashboardSummary: dash.summary,
        currency: dash.summary?.currency ?? "USD",
      });
    } catch (err: any) {
      setError(err.response?.data?.error || "Could not load report data");
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboardWithFallback() {
    try {
      const dash = await getEnhancedDashboard();
      return {
        summary: dash.summary ?? null,
        agingBuckets: Array.isArray(dash.agingBuckets) ? dash.agingBuckets : [],
        paymentMetrics: dash.paymentMetrics ?? null,
        volumeTrend: Array.isArray(dash.volumeTrend) ? dash.volumeTrend : [],
      };
    } catch (dashErr: any) {
      const status = dashErr?.response?.status;
      if (status === 403 || status === 404) {
        const [aging, metrics] = await Promise.allSettled([
          getAgingReport(),
          getPaymentMetricsReport(),
        ]);
        const agingData = aging.status === "fulfilled" ? aging.value : null;
        const metricsData = metrics.status === "fulfilled" ? metrics.value : null;
        return {
          summary: agingData?.summary ?? null,
          agingBuckets: agingData?.buckets ?? [],
          paymentMetrics: metricsData,
          volumeTrend: [],
        };
      }
      throw dashErr;
    }
  }

  const kpis = useMemo(() => {
    if (!data) return null;

    const totalRevenue = data.dashboardSummary
      ? new Decimal(data.dashboardSummary.totalRevenue)
      : new Decimal(0);

    const outstanding = new Decimal(data.dashboardSummary?.totalOutstanding ?? "0");

    const avgDays = data.paymentMetrics?.averagePaymentTimeDays ?? null;

    const paidThisMonth = data.dashboardSummary?.totalPaidThisMonth ?? "0";

    return { totalRevenue, outstanding, avgDays, paidThisMonth };
  }, [data]);

  const paymentStatusData = useMemo(() => {
    return [];
  }, [data]);

  const reportPdf = async () => {
    try {
      const res = await fetch("/api/reports/dashboard?format=pdf", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "report.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      console.error("Failed to export PDF", e);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-surface-alt rounded w-48" />
        <div className="h-4 bg-surface-alt rounded w-64 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-color p-5 h-24" />
          ))}
        </div>
        <div className="bg-surface rounded-xl border border-color h-64" />
        <div className="bg-surface rounded-xl border border-color h-48" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-error-border bg-error-bg p-6 text-center">
        <AlertCircle className="h-8 w-8 text-error-text mx-auto mb-3" />
        <p className="text-sm font-medium text-error-text mb-4">{error}</p>
        <button
          onClick={() => setRetryKey((k) => k + 1)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Reports</h1>
          <p className="text-sm text-secondary mt-1">
            Business performance and analytics
          </p>
        </div>
        {plan && (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary-bg text-on-primary">
            {plan.name} Plan
          </span>
        )}
      </div>

      {kpis && (
        <ReportKPICards
          currency={data!.currency}
          totalRevenue={kpis.totalRevenue.toFixed(2)}
          totalOutstanding={kpis.outstanding.toFixed(2)}
          avgPaymentDays={kpis.avgDays}
          paidThisMonth={kpis.paidThisMonth}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyTrendChart currency={data!.currency} />
        <PaymentStatusPie data={paymentStatusData} />
      </div>

      {data && data.agingBuckets.length > 0 && (
        <div className="bg-surface rounded-xl border border-color-subtle p-5">
          <h2 className="text-sm font-semibold text-primary mb-4">Aging Report</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-color-subtle">
                  <th className="text-left text-xs font-medium text-tertiary uppercase py-2">Period</th>
                  <th className="text-right text-xs font-medium text-tertiary uppercase py-2">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {data.agingBuckets.map((bucket, i) => (
                  <tr key={i} className="border-b border-color-subtle last:border-b-0">
                    <td className="py-2 text-primary">{bucket.bucket}</td>
                    <td className="py-2 text-right font-medium">
                      {formatCurrencyValue(bucket.amount, data.currency)}
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
