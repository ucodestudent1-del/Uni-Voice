import { useMemo, lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
   DollarSign,
   CheckCircle,
   Clock,
} from "lucide-react";
import { getDashboardData, getVolumeTrendReport } from "../api/client";
import type { ApiDashboardData } from "../types/api";
import { KPICard, Skeleton } from "@/components/ui";
import { useQuery } from "@tanstack/react-query";
const RevenueChart = lazy(() => import("../components/dashboard/RevenueChart"));
import { Button } from "../components/ui/Button";
import { useMetaTags } from "@/hooks/useMetaTags";

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
  useMetaTags({
    title: "Dashboard — DocForge",
    description: "Overview of your invoices, payments, and revenue. Track outstanding balances, overdue items, and monthly trends.",
    noIndex: true,
  });

  const { user } = useAuth();
  const { plan } = useSubscription();

  const {
    data: dashboard,
    isLoading: loading,
    isError: loadError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () =>
      getDashboardData().then((res) => (res.data ?? res) as ApiDashboardData),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: volumeTrend = [] } = useQuery({
    queryKey: ["volume-trend-day-1"],
    queryFn: () =>
      getVolumeTrendReport({ period: "day", months: 1 })
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? [])) as Array<{ period: string; invoiced: string; paid: string }>)
        .catch(() => []),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

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
      <div className="space-y-6">
        <Skeleton variant="text" width="12rem" height="1.5rem" />
        <Skeleton variant="text" width="20rem" height="1rem" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-error-border bg-error-bg p-6 text-center">
        <p className="text-sm font-medium text-error-text mb-4">
          {error instanceof Error ? error.message : "Could not load dashboard"}
        </p>
        <Button variant="primary" size="md" onClick={() => refetch()}>
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
          <Suspense fallback={<Skeleton className="h-80 w-full" />}>
            <RevenueChart currency={currency} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
