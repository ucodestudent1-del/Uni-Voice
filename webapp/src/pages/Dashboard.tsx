import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
} from "lucide-react";
import { getDashboardData, getVolumeTrendReport, sendReminder } from "../api/client";
import type { ApiDashboardData, ApiUpcomingInvoice, ApiInvoiceListItem } from "../types/api";
import { KPICard } from "@/components/ui";
import RevenueChart from "../components/dashboard/RevenueChart";
import { formatCurrencyValue } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { InvoiceLifecycle, isOverdueStatus } from "@/components/ui";
import { cn } from "@/lib/utils";

function getGreeting(name: string | undefined): string {
  const now = new Date();
  const hour = now.getHours();
  let greeting = "Good evening";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 17) greeting = "Good afternoon";
  const firstName = name && name.split(" ")[0];
  return firstName ? `${greeting}, ${firstName}` : greeting;
}

function deriveNameFromEmail(email: string | undefined): string {
  if (!email) return "";
  const local = email.split("@")[0];
  const name = local.split(/[._-]/)[0];
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
}

interface NormalizedInvoice {
  id: string;
  invoice_number?: string | null;
  customer_name?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  status: string;
  total: string;
  amount_due?: string | null;
  currency: string;
}

function normalizeInvoice(inv: ApiInvoiceListItem | ApiUpcomingInvoice): NormalizedInvoice {
  if ("invoice_number" in inv) {
    const item = inv as ApiInvoiceListItem;
    return {
      id: item.id,
      invoice_number: item.invoice_number,
      customer_name: item.customer_name,
      due_date: item.due_date,
      created_at: item.created_at,
      status: item.status,
      total: item.total,
      amount_due: item.amount_due,
      currency: item.currency,
    };
  }
  const upcoming = inv as ApiUpcomingInvoice;
  return {
    id: upcoming.id,
    invoice_number: upcoming.invoiceNumber,
    customer_name: upcoming.customerName,
    due_date: upcoming.dueDate,
    status: upcoming.status,
    total: upcoming.total,
    amount_due: upcoming.amountDue,
    currency: upcoming.currency,
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { plan } = useSubscription();

  const [dashboard, setDashboard] = useState<ApiDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [volumeTrend, setVolumeTrend] = useState<{ period: string; invoiced: string; paid: string }[]>([]);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

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

  const overdueItems = useMemo(() => {
    return dashboard?.requiringAttention?.filter((inv) =>
      isOverdueStatus(inv.status, inv.due_date)
    ) ?? [];
  }, [dashboard?.requiringAttention]);

  const draftItems = useMemo(() => {
    return dashboard?.requiringAttention?.filter((inv) => inv.status === "draft") ?? [];
  }, [dashboard?.requiringAttention]);

  const recentInvoices = useMemo(() => {
    if (!dashboard) return [];
    const all = [...(dashboard.requiringAttention ?? []), ...(dashboard.upcoming ?? [])];
    const unique = Array.from(new Map(all.map((inv) => [inv.id, inv])).values());
    return unique.slice(0, 8);
  }, [dashboard]);

  const needsAttentionCount = overdueItems.length + draftItems.length;

  const sparklinePoints = useMemo(() => {
    return volumeTrend.slice(-7).map((d) => ({ value: Number(d.paid) }));
  }, [volumeTrend]);

  async function handleSendReminder(invoiceId: string) {
    setSendingReminderId(invoiceId);
    try {
      await sendReminder(invoiceId);
      setDashboard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          requiringAttention: prev.requiringAttention.filter((inv) => inv.id !== invoiceId),
        };
      });
    } catch (err: any) {
      console.error("Failed to send reminder", err);
    } finally {
      setSendingReminderId(null);
    }
  }

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
        <div className="bg-surface rounded-xl border border-color h-80" />
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

  const unpaidCount = summary.draftCount + summary.sentCount + summary.overdueCount;

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
        <Link
          to="/app/invoices/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Create invoice
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <KPICard
          title="Outstanding"
          value={summary.totalOutstanding}
          currency={currency}
          subtitle={`${unpaidCount} unpaid invoices`}
          icon={<DollarSign className="w-5 h-5" />}
          iconBackground="bg-info-bg text-info-text"
          variant="stat"
          state="info"
          progressPct={summary.totalInvoices > 0 ? (summary.paidCount / summary.totalInvoices) * 100 : 0}
        />
        <KPICard
          title="Overdue"
          value={summary.totalOverdue}
          currency={currency}
          subtitle={`${summary.overdueCount} overdue invoices`}
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBackground="bg-error-bg text-error-text"
          variant="tinted"
          state="error"
        />
        <KPICard
          title="Paid This Month"
          value={summary.totalPaidThisMonth}
          currency={currency}
          subtitle={`${summary.paidCount} paid invoices`}
          icon={<CheckCircle className="w-5 h-5" />}
          iconBackground="bg-success-bg text-success-text"
          variant="stat"
          state="success"
          sparkline={sparklinePoints}
          sparklineColor="rgb(var(--color-success))"
        />
      </div>

      {needsAttentionCount > 0 && (
        <section className="bg-surface rounded-xl border border-color-subtle overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning-text" />
              <h2 className="text-sm font-semibold text-primary">Needs attention</h2>
            </div>
          </div>

          <div className="divide-y divide-color-subtle">
            {overdueItems.map((inv) => {
              const daysOverdue = inv.due_date
                ? Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))
                : 0;
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-alt transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AlertTriangle className="h-4 w-4 text-error-text flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">
                        {inv.invoice_number || `#${inv.id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-tertiary">{inv.customer_name || "—"}</p>
                    </div>
                    <InvoiceLifecycle
                      status={inv.status}
                      isOverdue={isOverdueStatus(inv.status, inv.due_date)}
                      compact
                      className="hidden sm:flex"
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-error-text">
                      {formatCurrencyValue(inv.amount_due || inv.total, inv.currency)}
                    </p>
                    <p className="text-xs text-tertiary">
                      {daysOverdue > 0 ? `${daysOverdue} days overdue` : "Overdue"}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2 ml-4">
                     <button
                       type="button"
                       onClick={() => handleSendReminder(inv.id)}
                       disabled={sendingReminderId === inv.id}
                       aria-busy={sendingReminderId === inv.id || undefined}
                       className={cn(
                         "text-xs font-medium text-primary-brand hover:text-primary-hover",
                         sendingReminderId === inv.id && "opacity-50 cursor-wait",
                       )}
                    >
                      {sendingReminderId === inv.id ? "Sending…" : "Send reminder →"}
                    </button>
                    <Link
                      to={`/app/invoices/${inv.id}`}
                      className="text-xs text-tertiary hover:text-primary"
                      title="View invoice"
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })}

            {draftItems.slice(0, 3).map((inv) => (
              <Link
                key={inv.id}
                to={`/app/invoices/${inv.id}/edit`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-alt transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-warning" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">
                      {inv.invoice_number || "Draft invoice"}
                    </p>
                    <p className="text-xs text-tertiary">{inv.customer_name || "—"}</p>
                  </div>
                  <InvoiceLifecycle
                    status={inv.status}
                    compact
                    className="hidden sm:flex"
                  />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-primary">
                    {formatCurrencyValue(inv.total, inv.currency)}
                  </p>
                  <p className="text-xs text-tertiary">Not yet sent</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <section className="bg-surface rounded-xl border border-color-subtle overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-sm font-semibold text-primary">Recent invoices</h2>
              <Link
                to="/app/invoices"
                className="text-xs text-primary-brand hover:text-primary-hover font-medium"
              >
                View all →
              </Link>
            </div>

            {recentInvoices.length === 0 ? (
              <div className="px-5 pb-8 text-center">
                <p className="text-sm text-secondary mb-4">No invoices yet.</p>
                <Link
                  to="/app/invoices/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
                >
                  <Plus className="w-4 h-4" />
                  Create your first invoice
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-color-subtle">
                      <th className="text-left text-xs font-medium text-tertiary uppercase py-3.5 px-4">Invoice</th>
                      <th className="text-left text-xs font-medium text-tertiary uppercase py-3.5 px-4">Customer</th>
                      <th className="text-center text-xs font-medium text-tertiary uppercase py-3.5 px-4">Status</th>
                      <th className="text-right text-xs font-medium text-tertiary uppercase py-3.5 px-4">Amount</th>
                      <th className="text-right text-xs font-medium text-tertiary uppercase py-3.5 px-4">Due date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((rawInv) => {
                      const inv = normalizeInvoice(rawInv);
                      const isOverdue = isOverdueStatus(inv.status, inv.due_date);
                      return (
                        <tr
                          key={inv.id}
                          className="border-b border-color-subtle last:border-b-0 hover:bg-surface-alt transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <Link
                              to={`/app/invoices/${inv.id}`}
                              className="text-sm font-medium text-primary-brand hover:text-primary-hover"
                            >
                              {inv.invoice_number || `#${inv.id.slice(0, 8)}`}
                            </Link>
                            <p className="text-xs text-secondary">
                              {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ""}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 text-sm text-secondary">{inv.customer_name || "—"}</td>
                          <td className="py-3.5 px-4 text-center">
                            <InvoiceLifecycle
                              status={inv.status}
                              isOverdue={isOverdue}
                              compact
                            />
                          </td>
                          <td className="py-3.5 px-4 text-right text-sm font-medium text-primary">
                            {formatCurrencyValue(inv.amount_due || inv.total, inv.currency)}
                          </td>
                          <td className={`py-3.5 px-4 text-right text-sm ${isOverdue ? "text-error-text font-medium" : "text-secondary"}`}>
                            {inv.due_date
                              ? new Date(inv.due_date).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div>
          <RevenueChart currency={currency} />
        </div>
      </div>
    </div>
  );
}
