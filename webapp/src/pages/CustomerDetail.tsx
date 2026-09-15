import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  getCustomer,
  getCustomerInvoices,
  getCustomerSummary,
  archiveCustomer,
  restoreCustomer,
  createInvoice as apiCreateInvoice,
  sendReminder,
} from "../api/client";
import FeatureGate from "../components/FeatureGate";
import CustomerStatusBadge from "../components/CustomerStatusBadge";
import InvoiceStatusBadge from "../components/InvoiceStatusBadge";
import CustomerForm from "../components/CustomerForm";
import { formatCurrency } from "../utils/format";
import { formatDate } from "../utils/format";
import { getInvoiceDisplayStatus } from "../utils/customer";
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

const REMINDABLE_STATUSES = new Set(["sent", "viewed", "partially_paid", "overdue"]);

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit
          </button>
          <FeatureGate feature="invoices.create" requiredPlan="free" fallback={null}>
            <button
              onClick={handleCreateInvoice}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              + Create Invoice
            </button>
          </FeatureGate>
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
  const [remindingInvoice, setRemindingInvoice] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSummary();
    loadInvoices();
  }, [customer.id]);

  async function loadSummary() {
    try {
      const data = await getCustomerSummary(customer.id);
      setSummary(data.summary);
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function loadInvoices() {
    try {
      const data = await getCustomerInvoices(customer.id, { limit: 100 });
      setInvoices(data.data ?? []);
    } catch {
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }

  async function handleSendReminder(invoice: ApiCustomerInvoiceSummary) {
    setRemindingInvoice(invoice.id);
    setActionMessage(null);
    try {
      await sendReminder(invoice.id);
      setActionMessage(`Reminder sent for ${invoice.invoiceNumber || invoice.id.slice(0, 8)}.`);
      loadInvoices();
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || "Failed to send reminder");
    } finally {
      setRemindingInvoice(null);
    }
  }

  const displayStatus = (inv: ApiCustomerInvoiceSummary) => getInvoiceDisplayStatus(inv);
  const isOverdueRow = (inv: ApiCustomerInvoiceSummary) =>
    displayStatus(inv) === "overdue";

  const filteredInvoices = invoiceStatusFilter === "all"
    ? invoices
    : invoices.filter((i) => displayStatus(i) === invoiceStatusFilter);

  const currency = invoices[0]?.currency || summary?.customer.defaultCurrency || customer.defaultCurrency || "USD";

  return (
    <>
      {actionMessage && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {actionMessage}
        </div>
      )}

      {renderFinancialSummary(summary, loadingSummary, currency)}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-medium text-slate-500 uppercase mb-4">Contact Information</h3>
            <dl className="space-y-3">
              <InfoRow label="Name" value={customer.name} />
              {customer.companyName && <InfoRow label="Company" value={customer.companyName} />}
              {customer.email && <InfoRow label="Email" value={customer.email} />}
              {customer.phone && <InfoRow label="Phone" value={customer.phone} />}
              {customer.taxId && <InfoRow label="Tax ID" value={customer.taxId} />}
              {customer.paymentTerms && <InfoRow label="Payment Terms" value={`${customer.paymentTerms} days`} />}
              <InfoRow
                label="Address"
                value={
                  [
                    customer.address?.addressLine1,
                    customer.address?.addressLine2,
                    customer.address?.city,
                    customer.address?.stateOrRegion,
                    customer.address?.postalCode,
                    customer.address?.countryCode,
                  ].filter(Boolean).join(", ") || "—"
                }
              />
              {customer.notes && <InfoRow label="Notes" value={customer.notes} preWrap />}
            </dl>
          </div>

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

        <div className="space-y-6">
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
                      <th className="text-right text-xs font-medium text-slate-500 uppercase py-2">Due Date</th>
                      <th className="text-center text-xs font-medium text-slate-500 uppercase py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv) => {
                      const overdue = isOverdueRow(inv);
                      const canRemind = REMINDABLE_STATUSES.has(displayStatus(inv)) && new Decimal(inv.amountDue ?? 0).gt(0);
                      return (
                        <tr
                          key={inv.id}
                          className={`border-b border-slate-100 last:border-b-0 ${overdue ? "bg-red-50" : "hover:bg-slate-50"}`}
                        >
                          <td className="py-2">
                            <Link
                              to={`/app/invoices/${inv.id}`}
                              className="text-sm font-medium text-slate-900 hover:text-primary-600"
                            >
                              {inv.invoiceNumber || `Draft #${inv.id.slice(0, 8)}`}
                            </Link>
                            <p className="text-xs text-slate-500">{formatDate(inv.createdAt)}</p>
                          </td>
                          <td className="py-2 text-center">
                            <InvoiceStatusBadge status={displayStatus(inv)} isOverdue={overdue} />
                          </td>
                          <td className="py-2 text-right text-sm font-medium text-slate-900">
                            {formatCurrency(inv.total, currency)}
                          </td>
                          <td className="py-2 text-right text-sm text-slate-600">
                            {new Decimal(inv.amountPaid ?? 0).gt(0)
                              ? formatCurrency(inv.amountPaid, currency)
                              : "-"}
                          </td>
                          <td className="py-2 text-right text-sm text-slate-600">
                            {new Decimal(inv.amountDue ?? 0).gt(0)
                              ? formatCurrency(inv.amountDue, currency)
                              : "-"}
                          </td>
                          <td className="py-2 text-right text-sm text-slate-600">
                            {inv.dueDate ? formatDate(inv.dueDate) : "-"}
                          </td>
                          <td className="py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {canRemind && (
                                <FeatureGate feature="reminders.automated" fallback={null}>
                                  <button
                                    onClick={() => handleSendReminder(inv)}
                                    disabled={remindingInvoice === inv.id}
                                    className="text-xs text-slate-600 hover:text-slate-900"
                                    title="Send reminder"
                                  >
                                    {remindingInvoice === inv.id ? "..." : "Remind"}
                                  </button>
                                </FeatureGate>
                              )}
                              <Link
                                to={`/app/invoices/${inv.id}`}
                                className="text-xs text-slate-600 hover:text-slate-900"
                                title="View invoice"
                              >
                                View
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value, preWrap }: { label: string; value: string; preWrap?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`text-sm text-slate-900 ${preWrap ? "whitespace-pre-wrap" : ""}`}>{value}</dd>
    </div>
  );
}

function FinancialSummaryCard({
  title, value, subtitle, color,
}: {
  title: string; value: string; subtitle?: string; color?: "primary" | "green" | "red" | "slate";
}) {
  const colorClasses: Record<string, string> = {
    primary: "bg-primary-50 text-primary-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-50 text-slate-700",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color === "red" ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

function renderFinancialSummary(summary: ApiCustomerSummary | null, loading: boolean, currency: string) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
            <div className="h-3 w-20 bg-slate-200 rounded mb-2" />
            <div className="h-7 w-24 bg-slate-200 rounded mb-1" />
            <div className="h-3 w-16 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-sm text-slate-500">Financial summary unavailable.</p>
      </div>
    );
  }

  const hasOutstanding = new Decimal(summary.totalOutstanding ?? 0).gt(0);
  const hasOverdue = new Decimal(summary.totalOverdue ?? 0).gt(0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <FinancialSummaryCard
        title="Total Invoiced"
        value={formatCurrency(summary.totalBilled, currency)}
        subtitle={`${summary.totalInvoiceCount} invoice${summary.totalInvoiceCount !== 1 ? "s" : ""}`}
        color="primary"
      />
      <FinancialSummaryCard
        title="Total Paid"
        value={formatCurrency(summary.totalPaid, currency)}
        subtitle={`${summary.finalizedInvoiceCount} finalized invoices`}
        color="green"
      />
      <FinancialSummaryCard
        title="Outstanding Balance"
        value={formatCurrency(summary.totalOutstanding || "0", currency)}
        subtitle={hasOutstanding ? `${summary.totalInvoiceCount - summary.finalizedInvoiceCount} unpaid invoices` : "All paid"}
        color={hasOutstanding ? "red" : "slate"}
      />
      <FinancialSummaryCard
        title="Overdue Balance"
        value={hasOverdue ? formatCurrency(summary.totalOverdue || "0", currency) : "—"}
        subtitle={hasOverdue ? "Past due" : "None overdue"}
        color={hasOverdue ? "red" : "slate"}
      />
    </div>
  );
}
