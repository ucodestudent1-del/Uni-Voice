import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  DollarSign,
  AlertTriangle,
  CheckCircle,
  CalendarDays,
  Clock,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import { getDashboardData, getInvoices } from "../api/client";
import type { ApiDashboardData, ApiInvoiceListItem, ApiUpcomingInvoice, ApiInvoice } from "../types/api";
import KPICard from "../components/KPICard";
import RevenueChart from "../components/dashboard/RevenueChart";
import StatusBreakdown from "../components/dashboard/StatusBreakdown";
import { formatCurrency } from "../utils/format";
import { Button } from "../components/ui/Button";
import InvoiceStatus, { isOverdueStatus } from "../components/primitives/InvoiceStatus";
import { formatCurrencyValue } from "../lib/utils";

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
  const { plan } = useSubscription();
  const navigate = useNavigate();

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
        <div className="h-8 bg-surface-alt rounded w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {Array.from({ length: 5 }).map((_, i) => (
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

  if (loadError) {
    return (
      <div className="rounded-xl border border-error-border bg-error-bg p-6 text-center">
        <p className="text-sm font-medium text-error-text">{loadError}</p>
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
  const requiringAttention = dashboard?.requiringAttention ?? [];

  const statusData = [
    { label: "Draft", value: summary.draftCount, color: "var(--color-warning-text)" },
    { label: "Sent", value: summary.sentCount, color: "var(--color-info)" },
    { label: "Paid", value: summary.paidCount, color: "var(--color-success)" },
    { label: "Overdue", value: summary.overdueCount, color: "var(--color-error)" },
    {
      label: "Other",
      value: Math.max(0, summary.totalInvoices - summary.draftCount - summary.sentCount - summary.paidCount - summary.overdueCount),
      color: "var(--color-text-secondary)",
    },
  ];

  const overdueInvoices = useMemo(() => {
    const items = dashboard?.requiringAttention ?? [];
    return items.filter((inv) =>
      isOverdueStatus(inv.status, inv.due_date)
    );
  }, [dashboard?.requiringAttention]);

  const needsAttention = useMemo(() => {
    const items = dashboard?.requiringAttention ?? [];
    return items
      .filter((inv) => !isOverdueStatus(inv.status, inv.due_date))
      .sort((a, b) => {
        const aOverdue = isOverdueStatus(a.status, a.due_date);
        const bOverdue = isOverdueStatus(b.status, b.due_date);
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [dashboard?.requiringAttention]);

  const needsAttentionCount = overdueInvoices.length + needsAttention.length + summary.draftCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
          {plan && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1 ml-3 bg-primary-bg text-on-primary">
              {plan.name} Plan
            </span>
          )}
        </div>
        <Link
          to="/app/invoices/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary focus:outline-none focus:ring-2 focus:ring-primary transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          New Invoice
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Total Outstanding"
          value={formatCurrencyValue(summary.totalOutstanding, currency)}
          subtitle={`${(summary.draftCount + summary.sentCount + summary.overdueCount)} unpaid invoices`}
          icon={<DollarSign className="w-5 h-5" />}
          iconBackground="bg-info-bg text-info-text"
        />
        <KPICard
          title="Overdue"
          value={formatCurrencyValue(summary.totalOverdue, currency)}
          subtitle={`${summary.overdueCount} overdue invoices`}
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBackground="bg-error-bg text-error-text"
        />
        <KPICard
          title="Paid This Month"
          value={formatCurrencyValue(summary.totalPaidThisMonth, currency)}
          subtitle={`${summary.paidCount} paid invoices`}
          icon={<CheckCircle className="w-5 h-5" />}
          iconBackground="bg-success-bg text-success-text"
        />
        <KPICard
          title="Revenue This Month"
          value={formatCurrencyValue(summary.totalRevenue, currency)}
          subtitle="Total revenue earned"
          icon={<DollarSign className="w-5 h-5" />}
          iconBackground="status-warning-bg status-warning-text"
        />
        <KPICard
          title="Due Next 7 Days"
          value={formatCurrencyValue(upcomingTotal, currency)}
          subtitle={`${upcoming.length} invoices due`}
          icon={<CalendarDays className="w-5 h-5" />}
          iconBackground="bg-warning-bg text-warning-text"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <section className="bg-surface rounded-xl border border-color overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-sm font-semibold text-primary">Due Next 7 Days</h3>
              <Link
                to="/app/invoices?status=sent"
                className="text-xs text-primary-brand hover:text-primary-hover font-medium"
              >
                View All
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="px-5 pb-6 text-center text-sm text-tertiary">
                Nothing due this week
              </div>
            ) : (
              <div className="divide-y divide-color-subtle">
                {upcoming.map((inv) => (
                  <Link
                    key={inv.id}
                    to={`/app/invoices/${inv.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-surface-alt transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">
                        {inv.customerName || "—"}
                      </p>
                      <p className="text-xs text-tertiary">
                        {inv.dueDate
                          ? new Date(inv.dueDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-primary">
                        {formatCurrencyValue(inv.amountDue || inv.total, inv.currency)}
                      </p>
                      <span className="text-xs text-tertiary">Invoice {inv.invoiceNumber || `#${inv.id.slice(0, 8)}`}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-2">
          <section className="bg-surface rounded-xl border border-color overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-sm font-semibold text-primary">Invoice Activity</h3>
              <Link
                to="/app/invoices"
                className="text-xs text-primary-brand hover:text-primary-hover font-medium"
              >
                View All
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-color-subtle">
                    <th className="text-left text-xs font-medium text-tertiary uppercase py-3 px-4">Invoice</th>
                    <th className="text-left text-xs font-medium text-tertiary uppercase py-3 px-4">Customer</th>
                    <th className="text-center text-xs font-medium text-tertiary uppercase py-3 px-4">Status</th>
                    <th className="text-right text-xs font-medium text-tertiary uppercase py-3 px-4">Amount</th>
                    <th className="text-right text-xs font-medium text-tertiary uppercase py-3 px-4">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                    {(requiringAttention.length > 0 ? requiringAttention : upcoming).slice(0, 10).map((rawInv) => {
                      const inv = normalizeInvoice(rawInv);
                      return (
                        <tr
                          key={inv.id}
                          className="border-b border-color-subtle last:border-b-0 hover:bg-surface-alt transition-colors"
                        >
                          <td className="py-3 px-4">
                            <Link to={`/app/invoices/${inv.id}`} className="text-sm font-medium text-primary-brand hover:text-primary-hover">
                              {inv.invoice_number || `#${inv.id.slice(0, 8)}`}
                            </Link>
                            <p className="text-xs text-tertiary">
                              {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ""}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-sm text-secondary">{inv.customer_name || "—"}</td>
                          <td className="py-3 px-4 text-center">
                            <InvoiceStatus status={inv.status} isOverdue={isOverdueStatus(inv.status, inv.due_date)} showIcon />
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-medium text-primary">
                            {formatCurrencyValue(inv.amount_due || inv.total, inv.currency)}
                          </td>
                          <td className={`py-3 px-4 text-right text-sm ${inv.status === "overdue" ? "text-error-text font-medium" : "text-secondary"}`}>
                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {requiringAttention.length === 0 && upcoming.length === 0 && (
                <div className="py-8 text-center text-sm text-tertiary">
                  No recent activity
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {needsAttentionCount > 0 && (
        <section className="bg-surface rounded-xl border border-color overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning-text" />
              <h3 className="text-sm font-semibold text-primary">Needs Attention</h3>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-warning-bg text-warning-text">
                {needsAttentionCount}
              </span>
            </div>
          </div>
          <div className="divide-y divide-color-subtle">
            {overdueInvoices.map((inv) => (
              <Link
                key={inv.id}
                to={`/app/invoices/${inv.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-surface-alt transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <InvoiceStatus status={inv.status} isOverdue showIcon />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">
                      {inv.invoice_number || `#${inv.id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-tertiary">{inv.customer_name || "—"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-error-text">
                    {formatCurrencyValue(inv.amount_due || inv.total, inv.currency)}
                  </p>
                  <p className="text-xs text-tertiary">
                    Due {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                  </p>
                </div>
              </Link>
            ))}
            {needsAttention.map((inv) => (
              <Link
                key={inv.id}
                to={`/app/invoices/${inv.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-surface-alt transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <InvoiceStatus status={inv.status} showIcon />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">
                      {inv.invoice_number || `#${inv.id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-tertiary">{inv.customer_name || "—"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-primary">
                    {formatCurrencyValue(inv.amount_due || inv.total, inv.currency)}
                  </p>
                  <p className="text-xs text-tertiary">
                    {inv.status === "draft" ? "Not yet sent" : "Needs review"}
                  </p>
                </div>
              </Link>
            ))}
            {summary.draftCount > 0 && (
              <Link
                to="/app/invoices?status=draft"
                className="flex items-center justify-between px-5 py-3 hover:bg-surface-alt transition-colors"
              >
                <div className="flex items-center gap-3">
                  <InvoiceStatus status="draft" showIcon />
                  <div>
                    <p className="text-sm font-medium text-primary truncate">
                      {summary.draftCount} draft invoice{summary.draftCount !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-tertiary">Not yet sent</p>
                  </div>
                </div>
                <div className="text-right">
                  <Link
                    to="/app/invoices/new"
                    className="text-xs text-primary-brand hover:text-primary-hover font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Continue editing →
                  </Link>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
