import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSubscription } from "../contexts/SubscriptionContext";
import { getInvoices, createInvoice as apiCreateInvoice, duplicateInvoice, finalizeInvoice, sendInvoice } from "../api/client";
import FeatureGate from "../components/FeatureGate";
import UpgradePrompt from "../components/UpgradePrompt";

interface Invoice {
  id: string;
  invoice_number?: string;
  status: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  currency: string;
  created_at: string;
}

export default function Invoices() {
  const { plan } = useSubscription();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ customerId: "", currency: "USD" });

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    try {
      const data = await getInvoices({ limit: 200 });
      setInvoices(data.invoices ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiCreateInvoice({
        currency: newInvoice.currency,
        customerId: newInvoice.customerId || null,
        items: [{ description: "Sample item", quantity: 1, unit: "each", unitPrice: 100, taxRate: 0.1, isTaxInclusive: false }],
      });
      setShowForm(false);
      setNewInvoice({ customerId: "", currency: "USD" });
      loadInvoices();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create invoice");
    }
  }

  async function handleDuplicate(id: string) {
    try {
      await duplicateInvoice(id);
      loadInvoices();
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
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to send");
    }
  }

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      viewed: "bg-indigo-100 text-indigo-800",
      partially_paid: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800",
      void: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  }

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? "Cancel" : "New Invoice"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Currency</label>
              <select
                value={newInvoice.currency}
                onChange={(e) => setNewInvoice({ ...newInvoice, currency: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer ID (optional)</label>
              <input
                type="text"
                value={newInvoice.customerId}
                onChange={(e) => setNewInvoice({ ...newInvoice, customerId: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                placeholder="Customer UUID"
              />
            </div>
            <button type="submit" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
              Create Invoice
            </button>
          </form>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <p className="text-sm font-medium text-blue-600 truncate">
                      {inv.invoice_number || `Draft ${inv.id.slice(0, 8)}`}
                    </p>
                    <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(inv.status)}`}>
                      {inv.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {inv.currency} {Number(inv.total).toFixed(2)} · Paid: {Number(inv.amount_paid).toFixed(2)} · Due: {Number(inv.amount_due).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {inv.status === "draft" && (
                    <button onClick={() => handleFinalize(inv.id)} className="text-sm text-blue-600 hover:text-blue-500">Finalize</button>
                  )}
                  {inv.status === "draft" && (
                    <FeatureGate feature="invoices.duplicate" requiredPlan="pro" fallback={<UpgradePrompt feature="invoices.duplicate" requiredPlan="pro" />}>
                      <button onClick={() => handleDuplicate(inv.id)} className="text-sm text-gray-600 hover:text-gray-500">Duplicate</button>
                    </FeatureGate>
                  )}
                  {inv.status === "sent" && (
                    <FeatureGate feature="reminders.automated" requiredPlan="pro" fallback={<UpgradePrompt feature="reminders.automated" requiredPlan="pro" />}>
                      <button onClick={() => handleSend(inv.id)} className="text-sm text-gray-600 hover:text-gray-500">Send</button>
                    </FeatureGate>
                  )}
                </div>
              </div>
            </li>
          ))}
          {invoices.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">No invoices yet. Create your first invoice above.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
