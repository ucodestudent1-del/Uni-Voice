import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSubscription } from "../contexts/SubscriptionContext";
import { getInvoices, finalizeInvoice, sendInvoice, duplicateInvoice, createInvoice } from "../api/client";
import type { ApiInvoice } from "../types/api";
import { formatCurrency } from "../utils/format";
import { Decimal } from "decimal.js";

export default function Dashboard() {
  const { plan, features } = useSubscription();
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    try {
      const data = await getInvoices({ limit: 200 });
      setInvoices(data.invoices ?? []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  const summary = invoices.reduce(
    (acc, inv) => {
      const total = new Decimal(inv.total || 0);
      const amountDue = new Decimal(inv.amount_due || 0);
      const amountPaid = new Decimal(inv.amount_paid || 0);
      acc.totalRevenue = acc.totalRevenue.plus(total);
      if (amountDue.gt(0) && inv.status !== "draft" && inv.status !== "cancelled" && inv.status !== "void") {
        acc.outstanding = acc.outstanding.plus(amountDue);
        if (inv.status === "overdue" || (inv.due_date && new Date(inv.due_date) < new Date() && amountDue.gt(0))) {
          acc.overdue = acc.overdue.plus(amountDue);
        }
      }
      acc.paid = acc.paid.plus(amountPaid);
      acc.count += 1;
      return acc;
    },
    { totalRevenue: new Decimal(0), outstanding: new Decimal(0), overdue: new Decimal(0), paid: new Decimal(0), count: 0 }
  );

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      draft: "bg-slate-100 text-slate-800",
      sent: "bg-blue-100 text-blue-800",
      viewed: "bg-indigo-100 text-indigo-800",
      partially_paid: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
      cancelled: "bg-slate-100 text-slate-800",
      void: "bg-slate-100 text-slate-800",
    };
    return colors[status] || "bg-slate-100 text-slate-800";
  }

  const recentInvoices = invoices.slice(0, 5);
  const currency = invoices[0]?.currency || "USD";

  if (loading) {
    return <div className="text-center py-20 text-slate-500">Loading dashboard...</div>;
  }

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
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Invoice
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Outstanding"
          value={formatCurrency(summary.outstanding, currency)}
          subtitle={`${invoices.filter((i) => new Decimal(i.amount_due || 0).gt(0)).length} unpaid invoices`}
          icon="trending-up"
          color="slate"
        />
        <SummaryCard
          title="Paid"
          value={formatCurrency(summary.paid, currency)}
          subtitle="Total received"
          icon="check-circle"
          color="green"
        />
        <SummaryCard
          title="Overdue"
          value={formatCurrency(summary.overdue, currency)}
          subtitle={`${invoices.filter((i) => i.status === "overdue" || new Date(i.due_date || "") < new Date()).length} overdue`}
          icon="alert-triangle"
          color="red"
        />
        <SummaryCard
          title="This Month"
          value={formatCurrency(summary.totalRevenue, currency)}
          subtitle={`${summary.count} total invoices`}
          icon="bar-chart-3"
          color="primary"
        />
      </div>

      {/* Recent invoices */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent Invoices</h2>
          <Link to="/app/invoices" className="text-sm text-primary-600 hover:text-primary-700">
            View all →
          </Link>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m2 0a2 2 0 11-4 0 2 2 0 014 0zm3 6a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="mt-4 text-sm text-slate-500">No invoices yet</p>
            <Link
              to="/app/invoices/new"
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Create your first invoice
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Invoice</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Customer</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase py-3 px-4">Total</th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Status</th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 px-4">
                      <Link to={`/app/invoices/${inv.id}/edit`} className="text-sm font-medium text-slate-900 hover:text-primary-600">
                        {inv.invoice_number || `Draft #${inv.id.slice(0, 8)}`}
                      </Link>
                      <p className="text-xs text-slate-500">{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ""}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">{inv.customer_id || "—"}</td>
                    <td className="py-3 px-4 text-right text-sm font-medium text-slate-900">
                      {formatCurrency(inv.total, inv.currency)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {inv.status === "draft" && (
                        <button
                          onClick={async () => {
                            await finalizeInvoice(inv.id);
                            loadInvoices();
                          }}
                          className="text-xs text-primary-600 hover:text-primary-700"
                          title="Finalize"
                        >
                          Finalize
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  title, value, subtitle, icon, color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  color: string;
}) {
  const iconPaths: Record<string, JSX.Element> = {
    "trending-up": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12v6h6l9-9-3-3-6 6H9" />,
    "check-circle": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m0 0l4-4 4 4-4 4m-4-4" />,
    "alert-triangle": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M12 4v4m0 0l3 3m-3-3L9 11" />,
    "bar-chart-3": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-2 2l2-2m0 0l2-2m-2 2l-2-2" />,
  };

  const colorClasses: Record<string, string> = {
    primary: "bg-primary-50 text-primary-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-50 text-slate-700",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${colorClasses[color] ?? colorClasses.slate}`}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {iconPaths[icon] ?? iconPaths["trending-up"]}
          </svg>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
