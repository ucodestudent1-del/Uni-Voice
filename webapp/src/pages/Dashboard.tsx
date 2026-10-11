import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  DollarSign,
  CheckCircle,
  Clock,
} from "lucide-react";
import { getDashboardData, getVolumeTrendReport } from "../api/client";
import type { ApiDashboardData } from "../types/api";
import { KPICard } from "@/components/ui";
import RevenueChart from "../components/dashboard/RevenueChart";
import { formatCurrencyValue } from "@/lib/utils";
import { Button } from "../components/ui/Button";

function getGreeting(name: string | undefined): string {
  if (!name) return "Good day";
  const hour = new Date().getHours();
  let greeting = "Good evening";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 18) greeting = "Good afternoon";
  return `${greeting}, ${name}`;
}

function deriveNameFromEmail(email: string | undefined): string {
  if (!email) return "";
  const local = email.split("@")[0];
  const name = local.split(/[._-]/)[0];
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { plan } = useSubscription();

  const [dashboard, setDashboard] = useState<ApiDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [volumeTrend, setVolumeTrend] = useState<{ period: string; invoiced: string; paid: string }[]>([]);

  useEffect(() => {
    loadAll();
  }, [retryKey]);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [dashRes, trendRes] = await Promise.all([
        getDashboardData(),
        getVolumeTrendReport({ period: "day", months: 1 }).catch(() => []),
      ]);
      setDashboard((dashRes.data ?? dashRes) as ApiDashboardData);
      const trendData = Array.isArray(trendRes) ? trendRes : trendRes?.data ?? [];
      setVolumeTrend(Array.isArray(trendData) ? trendData : []);
    } catch (err: any) {
      setDashboard(null);
      setLoadError(err.response?.data?.error || "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }

  const displayName = deriveNameFromEmail(user?.email);
  const greeting = useMemo(() => getGreeting(displayName), [displayName]);

  const summary = dashboard?.summary ?? {
    totalOutstanding: "0",
    totalOverdue: "0",
    totalPaidThisMonth: "0",
    totalRevenue: "0",
    draftCount: 0,
    overdueCount: 0,
    sentCount: 0,
    paidCount: 0,
    totalInvoices: 0,
    currency: "USD",
  };

  const currency = summary.currency || "USD";

  const sparklinePoints = useMemo(() => {
    return volumeTrend.slice(-7).map((d) => ({ value: Number(d.paid) }));
  }, [volumeTrend]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-surface-alt rounded w-48" />
        <div className="h-4 bg-surface-alt rounded w-64 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-color p-5 h-28" />
          ))}
        </div>
        <div className="bg-surface rounded-xl border border-color h-64" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-error-border bg-error-bg p-6 text-center">
        <p className="text-sm font-medium text-error-text mb-4">{loadError}</p>
        <Button
          variant="primary"
          size="md"
          onClick={() => setRetryKey((key) => key + 1)}
        >
          Try again
        </Button>
      </div>
    );
  }

  const paidCount = summary.paidCount ?? 0;
  const totalInvoices = summary.totalInvoices ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">{greeting}</h1>
          <p className="text-sm text-secondary mt-1">
            Here's what's happening with your business.
          </p>
          {plan && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1 ml-3 bg-primary-bg text-on-primary">
              {plan.name} Plan
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <KPICard
          title="Outstanding"
          value={summary.totalOutstanding}
          currency={currency}
          subtitle={`${summary.overdueCount} overdue items`}
          icon={<DollarSign className="w-5 h-5" />}
          iconBackground="bg-info-bg text-info-text"
          variant="stat"
          state="info"
          progressPct={totalInvoices > 0 ? (paidCount / totalInvoices) * 100 : 0}
        />
        <KPICard
          title="Overdue"
          value={summary.totalOverdue}
          currency={currency}
          subtitle={`${summary.overdueCount} overdue items`}
          icon={<Clock className="w-5 h-5" />}
          iconBackground="bg-error-bg text-error-text"
          variant="tinted"
          state="error"
        />
        <KPICard
          title="Paid This Month"
          value={summary.totalPaidThisMonth}
          currency={currency}
          subtitle={`${paidCount} payments processed`}
          icon={<CheckCircle className="w-5 h-5" />}
          iconBackground="bg-success-bg text-success-text"
          variant="stat"
          state="success"
          sparkline={sparklinePoints}
          sparklineColor="rgb(var(--color-success))"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart currency={currency} />
        </div>
      </div>
    </div>
  );
}
