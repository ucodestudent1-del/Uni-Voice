import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getCustomer,
  getCustomerInvoices,
  getCustomerSummary,
  getCustomerEvents,
  archiveCustomer,
  restoreCustomer,
  createInvoice as apiCreateInvoice,
} from "../api/client";
import CustomerStatusBadge from "../components/CustomerStatusBadge";
import InvoiceStatusBadge from "../components/InvoiceStatusBadge";
import CustomerForm from "../components/CustomerForm";
import { formatCurrency } from "../utils/format";
import { formatDate } from "../utils/format";
import type { ApiCustomer, ApiCustomerInvoiceSummary, ApiCustomerSummary } from "../types/api";

const INVOICE_STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<ApiCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadCustomer();
  }, [id]);

  async function loadCustomer() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomer(id);
      setCustomer(data.customer);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive() {
    if (!customer || !confirm(`Archive ${customer.name}? This is reversible.`)) return;
    try {
      await archiveCustomer(customer.id);
      await loadCustomer();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to archive customer");
    }
  }

  async function handleRestore() {
    if (!customer) return;
    try {
      await restoreCustomer(customer.id);
      await loadCustomer();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to restore customer");
    }
  }

  async function handleCreateInvoice() {
    if (!customer) return;
    try {
      const res = await apiCreateInvoice({
        customerId: customer.id,
        currency: customer.defaultCurrency || "USD",
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

  if (loading) {
    return <div className="text-center py-20 text-slate-500">Loading customer...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => navigate("/app/customers")}
          className="mt-4 text-sm text-primary-600 hover:text-primary-700"
        >
          Back to Customers
        </button>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/app/customers")}
            className="text-slate-500 hover:text-slate-700"
          >
            &larr; Customers
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
          <CustomerStatusBadge status={customer.status} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit
          </button>
          <button
            onClick={handleCreateInvoice}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            + Create Invoice
          </button>
          {customer.status === "archived" ? (
            <button
              onClick={handleRestore}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Restore
            </button>
          ) : (
            <button
              onClick={handleArchive}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <CustomerForm
          customer={customer}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadCustomer(); }}
        />
      )}

      <CustomerDetailContent customer={customer} />
    </div>
  );
}

function CustomerDetailContent({ customer }: { customer: ApiCustomer }) {
  const [summary, setSummary] = useState<ApiCustomerSummary | null>(null);
  const [invoices, setInvoices] = useState<ApiCustomerInvoiceSummary[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await getCustomerSummary(customer.id);
        setSummary(data.summary);
      } catch {
        setSummary(null);
      } finally {
        setLoadingSummary(false);
      }
    };
    const loadInvoices = async () => {
      try {
        const data = await getCustomerInvoices(customer.id, { limit: 100 });
        setInvoices(data.data ?? []);
      } catch {
        setInvoices([]);
      } finally {
        setLoadingInvoices(false);
      }
    };
    loadSummary();
    loadInvoices();
  }, [customer.id]);

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

  function getDisplayStatus(inv: ApiCustomerInvoiceSummary): string {
    if (inv.status === "paid") return "paid";
    if (Number(inv.amountDue) > 0) {
      const now = new Date();
      const due = inv.dueDate ? new Date(inv.dueDate) : null;
      if (due && now >= due) return "overdue";
    }
    return inv.status;
  }

  const filteredInvoices = invoiceStatusFilter === "all"
    ? invoices
    : invoices.filter((i) => getDisplayStatus(i) === invoiceStatusFilter);

  function renderInvoiceStatus(status: string, inv: ApiCustomerInvoiceSummary) {
    const displayStatus = getDisplayStatus(inv);
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        statusColors[displayStatus] || statusColors.draft
      }`}>
        {displayStatus === "partially_paid" ? "Partially Paid" : displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
      </span>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-medium text-slate-500 uppercase mb-4">Contact Information</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-slate-500">Name</dt>
              <dd className="text-sm text-slate-900">{customer.name}</dd>
            </div>
            {customer.companyName && (
              <div>
                <dt className="text-xs text-slate-500">Company</dt>
                <dd className="text-sm text-slate-900">{customer.companyName}</dd>
              </div>
            )}
            {customer.email && (
              <div>
                <dt className="text-xs text-slate-500">Email</dt>
                <dd className="text-sm text-slate-900">{customer.email}</dd>
              </div>
            )}
            {customer.phone && (
              <div>
                <dt className="text-xs text-slate-500">Phone</dt>
                <dd className="text-sm text-slate-900">{customer.phone}</dd>
              </div>
            )}
            {customer.taxId && (
              <div>
                <dt className="text-xs text-slate-500">Tax ID</dt>
                <dd className="text-sm text-slate-900">{customer.taxId}</dd>
              </div>
            )}
            {customer.paymentTerms && (
              <div>
                <dt className="text-xs text-slate-500">Payment Terms</dt>
                <dd className="text-sm text-slate-900">{customer.paymentTerms} days</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-slate-500">Address</dt>
              <dd className="text-sm text-slate-900">
                {[
                  customer.address?.addressLine1,
                  customer.address?.addressLine2,
                  customer.address?.city,
                  customer.address?.stateOrRegion,
                  customer.address?.postalCode,
                  customer.address?.countryCode,
                ].filter(Boolean).join(", ")}
              </dd>
            </div>
            {customer.notes && (
              <div>
                <dt className="text-xs text-slate-500">Notes</dt>
                <dd className="text-sm text-slate-900 whitespace-pre-wrap">{customer.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        {!loadingSummary && summary && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-medium text-slate-500 uppercase mb-4">Financial Summary</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-xs text-slate-500">Total Invoiced</dt>
                <dd className="text-lg font-medium text-slate-900">
                  {formatCurrency(summary.totalBilled, summary.invoices[0]?.currency || "USD")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Total Paid</dt>
                <dd className="text-sm text-slate-900">
                  {formatCurrency(summary.totalPaid, summary.invoices[0]?.currency || "USD")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Outstanding Balance</dt>
                <dd className={`text-lg font-medium ${Number(summary.totalOutstanding || 0) > 0 ? "text-red-600" : "text-slate-900"}`}>
                  {formatCurrency(summary.totalOutstanding || "0", summary.invoices[0]?.currency || "USD")}
                </dd>
              </div>
              {Number(summary.totalOverdue || 0) > 0 && (
                <div>
                  <dt className="text-xs text-slate-500">Overdue Balance</dt>
                  <dd className="text-lg font-medium text-red-600">
                    {formatCurrency(summary.totalOverdue || "0", summary.invoices[0]?.currency || "USD")}
                  </dd>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex justify-between">
                  <dt className="text-xs text-slate-500">Total Invoices</dt>
                  <dd className="text-sm font-medium text-slate-900">{summary.totalInvoiceCount}</dd>
                </div>
                <div className="flex justify-between mt-1">
                  <dt className="text-xs text-slate-500">Finalized Invoices</dt>
                  <dd className="text-sm font-medium text-slate-900">{summary.finalizedInvoiceCount}</dd>
                </div>
              </div>
            </dl>
          </div>
        )}

        {customer.taxIdentifiers && customer.taxIdentifiers.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-medium text-slate-500 uppercase mb-4">Tax Identifiers</h3>
            <ul className="space-y-2">
              {customer.taxIdentifiers.map((ti) => (
                <li key={ti.id} className="flex justify-between">
                  <span className="text-sm text-slate-900">{ti.type}: {ti.value}</span>
                  {ti.isDefault && <span className="text-xs text-slate-500">Default</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500 uppercase">Invoice History</h3>
            <div className="flex gap-1 flex-wrap">
              {INVOICE_STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setInvoiceStatusFilter(f.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    invoiceStatusFilter === f.value
                      ? "bg-primary-100 text-primary-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loadingInvoices ? (
            <div className="text-center py-8 text-slate-500">Loading invoices...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {invoiceStatusFilter !== "all"
                ? "No invoices match the selected filter"
                : "No invoices for this customer yet"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase py-2">Invoice</th>
                    <th className="text-center text-xs font-medium text-slate-500 uppercase py-2">Status</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase py-2">Total</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase py-2">Paid</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase py-2">Due</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                      <td className="py-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900">
                            {inv.invoiceNumber || `Draft #${inv.id.slice(0, 8)}`}
                          </span>
                          <span className="text-xs text-slate-500">{formatDate(inv.createdAt)}</span>
                        </div>
                      </td>
                      <td className="py-2 text-center">
                        {renderInvoiceStatus(inv.status, inv)}
                      </td>
                      <td className="py-2 text-right text-sm font-medium text-slate-900">
                        {formatCurrency(inv.total, inv.currency)}
                      </td>
                      <td className="py-2 text-right text-sm text-slate-600">
                        {Number(inv.amountPaid) > 0
                          ? formatCurrency(inv.amountPaid, inv.currency)
                          : "-"}
                      </td>
                      <td className="py-2 text-right text-sm text-slate-600">
                        {Number(inv.amountDue) > 0
                          ? formatCurrency(inv.amountDue, inv.currency)
                          : "-"}
                      </td>
                      <td className="py-2 text-right text-xs text-slate-500">
                        {inv.dueDate ? formatDate(inv.dueDate) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
