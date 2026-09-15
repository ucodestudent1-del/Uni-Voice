import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSubscription } from "../contexts/SubscriptionContext";
import { getInvoices, finalizeInvoice, sendInvoice, duplicateInvoice, createInvoice, getDashboardData } from "../api/client";
import type { ApiInvoice, ApiDashboardData, ApiInvoiceListItem } from "../types/api";
import { formatCurrency } from "../utils/format";
import { Decimal } from "decimal.js";

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-800",
  sent: "bg-blue-100 text-blue-800",
  viewed: "bg-indigo-100 text-indigo-800",
  partially_paid: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-800",
  void: "bg-slate-100 text-slate-800",
};

export default function Dashboard() {
  const { plan, features } = useSubscription();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<ApiDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const data = await getDashboardData();
      setDashboard(data);
    } catch {
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Loading dashboard...</div>;

  const summary = dashboard?.summary ?? {
    totalOutstanding: "0", totalOverdue: "0", totalPaidThisMonth: "0",
    totalRevenue: "0", draftCount: 0, overdueCount: 0, sentCount: 0, paidCount: 0, totalInvoices: 0,
  };

  const currency = "USD";

  return (
    <div className="space-y-8">
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
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Create Invoice
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Outstanding"
          value={formatCurrency(summary.totalOutstanding, currency)}
          subtitle={`${summary.draftCount + summary.sentCount + (summary.overdueCount > 0 ? 1 : 0)} unpaid invoices`}
          color="slate"
        />
        <SummaryCard
          title="Overdue"
          value={formatCurrency(summary.totalOverdue, currency)}
          subtitle={`${summary.overdueCount} overdue invoices`}
          color="red"
        />
        <SummaryCard
          title="Paid This Month"
          value={formatCurrency(summary.totalPaidThisMonth, currency)}
          subtitle={`${summary.paidCount} paid invoices`}
          color="green"
        />
        <SummaryCard
          title="Total Revenue"
          value={formatCurrency(summary.totalRevenue, currency)}
          subtitle={`${summary.totalInvoices} total invoices`}
          color="primary"
        />
      </div>

      {/* Recently Paid */}
      {dashboard?.recentlyPaid && dashboard.recentlyPaid.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Recently Paid</h2>
          <InvoiceList items={dashboard.recentlyPaid} statusColors={statusColors} />
        </div>
      )}

      {/* Invoices Requiring Attention */}
      {dashboard?.requiringAttention && dashboard.requiringAttention.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Requires Attention</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Invoice</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Customer</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase py-3 px-4">Amount Due</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase py-3 px-4">Due Date</th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.requiringAttention.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <Link to={`/app/invoices/${inv.id}`} className="text-sm font-medium text-slate-900 hover:text-primary-600">
                        {inv.invoice_number || `#${inv.id.slice(0, 8)}`}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">{inv.customer_name || "—"}</td>
                    <td className="py-3 px-4 text-right text-sm font-medium text-slate-900">
                      {formatCurrency(inv.amount_due, inv.currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-slate-600">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[inv.status] || statusColors.draft}`}>
                        {inv.status}
                      </span>
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

function SummaryCard({
  title, value, subtitle, color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    primary: "bg-primary-50 text-primary-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-50 text-slate-700",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`rounded-lg p-2 ${colorClasses[color] ?? colorClasses.slate}`} role="img" aria-label={title[0]}>
          {title[0]}
        </span>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function InvoiceList({ items, statusColors }: { items: ApiInvoiceListItem[]; statusColors: Record<string, string> }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Invoice</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Customer</th>
            <th className="text-right text-xs font-medium text-slate-500 uppercase py-3 px-4">Total</th>
            <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((inv) => (
            <tr key={inv.id} className="border-b border-slate-100 last:border-b-0">
              <td className="py-3 px-4">
                <Link to={`/app/invoices/${inv.id}`} className="text-sm font-medium text-slate-900 hover:text-primary-600">
                  {inv.invoice_number || `#${inv.id.slice(0, 8)}`}
                </Link>
                <p className="text-xs text-slate-500">{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ""}</p>
              </td>
              <td className="py-3 px-4 text-sm text-slate-600">{inv.customer_name || "—"}</td>
              <td className="py-3 px-4 text-right text-sm font-medium text-slate-900">
                {formatCurrency(inv.total, inv.currency)}
              </td>
              <td className="py-3 px-4 text-center">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[inv.status] || statusColors.draft}`}>
                  {inv.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
