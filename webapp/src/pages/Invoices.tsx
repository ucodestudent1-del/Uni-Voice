import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  getInvoices, createInvoice as apiCreateInvoice,
  duplicateInvoice, finalizeInvoice, sendInvoice
} from "../api/client";
import FeatureGate from "../components/FeatureGate";
import UpgradePrompt from "../components/UpgradePrompt";
import { formatCurrency } from "../utils/format";
import type { ApiInvoice } from "../types/api";
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

export default function Invoices() {
  const { plan } = useSubscription();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  async function handleCreateAndEdit() {
    try {
      const res = await apiCreateInvoice({
        currency: "USD",
        items: [{
          description: "",
          quantity: "1",
          unit: "each",
          unitPrice: "0.00",
          taxRate: "0",
          isTaxInclusive: false,
        }],
      });
      navigate(`/app/invoices/${res.invoiceId}/edit`);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create invoice");
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const res = await duplicateInvoice(id);
      navigate(`/app/invoices/${res.invoiceId}/edit`);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to duplicate");
    }
  }

  async function handleFinalize(id: string) {
    try {
      await finalizeInvoice(id);
      loadInvoices();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to finalize");
    }
  }

  async function handleSend(id: string) {
    try {
      await sendInvoice(id);
      alert("Invoice sent!");
      loadInvoices();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to send");
    }
  }

  const filtered = statusFilter === "all"
    ? invoices
    : invoices.filter((i) => i.status === statusFilter);

  if (loading) return <div className="text-center py-20 text-slate-500">Loading invoices...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-600 mt-1">{invoices.length} invoices total</p>
        </div>
        <button
          onClick={handleCreateAndEdit}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Invoice
        </button>
      </div>

      <div className="flex items-center gap-4">
        {["all", "draft", "sent", "viewed", "paid", "overdue", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-primary-100 text-primary-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m2 0a2 2 0 11-4 0 2 2 0 014 0zm3 6a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="mt-4 text-slate-500">No invoices found</p>
          <button
            onClick={handleCreateAndEdit}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Create your first invoice
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Invoice</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Customer</th>
                <th className="text-right text-xs font-medium text-slate-500 uppercase py-3 px-4">Total</th>
                <th className="text-right text-xs font-medium text-slate-500 uppercase py-3 px-4">Due</th>
                <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Status</th>
                <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <Link to={`/app/invoices/${inv.id}/edit`} className="text-sm font-medium text-slate-900 hover:text-primary-600">
                        {inv.invoice_number || `Draft #${inv.id.slice(0, 8)}`}
                      </Link>
                      <span className="text-xs text-slate-500">{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ""}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600">
                    {inv.customer_id || "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-medium text-slate-900">
                    {formatCurrency(inv.total, inv.currency)}
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-slate-600">
                    {inv.amount_due && Number(inv.amount_due) > 0
                      ? formatCurrency(inv.amount_due, inv.currency)
                      : "-"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[inv.status] || statusColors.draft}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <FeatureGate feature="invoices.duplicate" requiredPlan="pro" fallback={null}>
                        <button
                          onClick={() => handleDuplicate(inv.id)}
                          className="text-xs text-slate-600 hover:text-slate-900"
                          title="Duplicate"
                        >
                          Copy
                        </button>
                      </FeatureGate>
                      {inv.status === "sent" && (
                        <FeatureGate feature="reminders.automated" requiredPlan="pro" fallback={null}>
                          <button
                            onClick={() => handleSend(inv.id)}
                            className="text-xs text-slate-600 hover:text-slate-900"
                            title="Send"
                          >
                            Send
                          </button>
                        </FeatureGate>
                      )}
                      {inv.status === "draft" && (
                        <button
                          onClick={() => handleFinalize(inv.id)}
                          className="text-xs text-primary-600 hover:text-primary-700"
                          title="Finalize"
                        >
                          Finalize
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
