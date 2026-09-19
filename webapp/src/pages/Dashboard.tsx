import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Decimal } from "decimal.js";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  DollarSign,
  AlertTriangle,
  CheckCircle,
  CalendarDays,
  Plus,
} from "lucide-react";
import { getDashboardData } from "../api/client";
import type { ApiDashboardData } from "../types/api";
import KPICard from "../components/KPICard";
import RevenueChart from "../components/dashboard/RevenueChart";
import StatusBreakdown from "../components/dashboard/StatusBreakdown";
import InvoiceTable from "../components/dashboard/InvoiceTable";
import RecentActivity from "../components/dashboard/RecentActivity";
import { formatCurrency } from "../utils/format";

export default function Dashboard() {
  const { plan } = useSubscription();

  const [dashboard, setDashboard] = useState<ApiDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    loadAll();
  }, [retryKey]);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getDashboardData();
      setDashboard((data.data ?? data) as ApiDashboardData);
    } catch (err: any) {
      setDashboard(null);
      setLoadError(err.response?.data?.error || "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-800">{loadError}</p>
        <button
          onClick={() => setRetryKey((key) => key + 1)}
          className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Try again
        </button>
      </div>
    );
  }

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
  };

  const upcoming = dashboard?.upcoming ?? [];
  const moneyIn = dashboard?.moneyIn ?? { total: "0", count: 0, currency: "USD" };
  const currency = moneyIn.currency || upcoming[0]?.currency || "USD";
  const upcomingTotal = upcoming.reduce(
    (sum, invoice) => sum.plus(invoice.amountDue || 0),
    new Decimal(0)
  );
  const statusData = [
    { label: "Draft", value: summary.draftCount, color: "#94a3b8" },
    { label: "Sent", value: summary.sentCount, color: "#3b82f6" },
    { label: "Paid", value: summary.paidCount, color: "#22c55e" },
    { label: "Overdue", value: summary.overdueCount, color: "#ef4444" },
    {
      label: "Other",
      value: Math.max(0, summary.totalInvoices - summary.draftCount - summary.sentCount - summary.paidCount - summary.overdueCount),
      color: "#64748b",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          {plan && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1 ml-3 bg-primary-100 text-primary-800">
              {plan.name} Plan
            </span>
          )}
        </div>
        <Link
          to="/app/invoices/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          New Invoice
        </Link>
      </div>

      {/* Cash-Flow KPI Cards — the trader's command center */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Money Out"
          value={formatCurrency(summary.totalOutstanding, currency)}
          subtitle={`${(summary.draftCount + summary.sentCount + summary.overdueCount)} unpaid invoices`}
          icon={<DollarSign className="w-5 h-5" />}
          iconBackground="bg-blue-50 text-blue-600"
        />
        <KPICard
          title="Overdue"
          value={formatCurrency(summary.totalOverdue, currency)}
          subtitle={`${summary.overdueCount} overdue invoices`}
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBackground="bg-red-50 text-red-600"
        />
        <KPICard
          title="Money In (7d)"
          value={formatCurrency(moneyIn.total, moneyIn.currency || currency)}
          subtitle={`${moneyIn.count} payment${moneyIn.count === 1 ? "" : "s"} this week`}
          icon={<CheckCircle className="w-5 h-5" />}
          iconBackground="bg-green-50 text-green-600"
        />
        <KPICard
          title="Paid This Month"
          value={formatCurrency(summary.totalPaidThisMonth, currency)}
          subtitle={`${summary.paidCount} paid invoices`}
          icon={<CheckCircle className="w-5 h-5" />}
          iconBackground="bg-emerald-50 text-emerald-600"
        />
        <KPICard
          title="Due Next 7 Days"
          value={formatCurrency(upcomingTotal, currency)}
          subtitle={`${upcoming.length} invoices due`}
          icon={<CalendarDays className="w-5 h-5" />}
          iconBackground="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart currency={currency} />
        </div>
        <div>
          <StatusBreakdown data={statusData} />
        </div>
      </div>

      {/* Cash-Flow: Upcoming + Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">Due Next 7 Days</h3>
              <Link
                to="/app/invoices?status=sent"
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                View All
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="px-5 pb-6 text-center text-sm text-slate-400">
                Nothing due this week
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcoming.map((inv) => (
                  <Link
                    key={inv.id}
                    to={`/app/invoices/${inv.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {inv.customerName || "—"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {inv.dueDate
                          ? new Date(inv.dueDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">
                        {formatCurrency(inv.amountDue || inv.total, inv.currency)}
                      </p>
                      <span className="text-xs text-slate-500">Invoice {inv.invoiceNumber || `#${inv.id.slice(0, 8)}`}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
        <div className="lg:col-span-2">
          <InvoiceTable items={dashboard?.requiringAttention} title="Recent Invoices" />
        </div>
      </div>

      {/* Activity Feed */}
      <RecentActivity />
    </div>
  );
}
