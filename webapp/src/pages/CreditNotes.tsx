import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  getCreditNotes,
  getCreditNote,
  createCreditNote,
  updateCreditNote,
  finalizeCreditNote,
  cancelCreditNote,
  applyCreditNote,
  getCreditNotePdf,
  getCreditNoteEvents,
  getInvoices,
  getCustomers,
  type CreditNoteSearchParams,
  buildCreditNoteSearchParams,
} from "../api/client";
import FeatureGate from "../components/FeatureGate";
import InvoiceStatusBadge from "../components/InvoiceStatusBadge";
import { formatCurrency, formatDate } from "../utils/format";
import { Decimal } from "decimal.js";
import type { ApiCreditNote, ApiCreditNoteItem, ApiCreditNoteListItem, ApiInvoiceListItem, ApiCustomer } from "../types/api";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "finalized", label: "Finalized" },
  { value: "applied", label: "Applied" },
  { value: "cancelled", label: "Cancelled" },
];

const SORT_OPTIONS = [
  { value: "credit_number", label: "Credit #" },
  { value: "customer_name", label: "Customer" },
  { value: "issue_date", label: "Issue Date" },
  { value: "total", label: "Total" },
  { value: "amount_remaining", label: "Remaining" },
  { value: "created_at", label: "Created" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export default function CreditNotes() {
  const { plan } = useSubscription();
  const navigate = useNavigate();
  const [creditNotes, setCreditNotes] = useState<ApiCreditNote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [invoices, setInvoices] = useState<ApiInvoiceListItem[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [sortBy, setSortBy] = useState<CreditNoteSearchParams["sortBy"]>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creatingCreditNote, setCreatingCreditNote] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const loadCustomers = useCallback(async () => {
    try {
      const data = await getCustomers({ limit: 500, enrich: false });
      setCustomers(data.data ?? []);
    } catch {
      setCustomers([]);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    try {
      const data = await getInvoices({ limit: 500, status: "finalized" });
      setInvoices(data.invoices ?? []);
    } catch {
      setInvoices([]);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
    loadInvoices();
  }, [loadCustomers, loadInvoices]);

  const currentParams: CreditNoteSearchParams = useMemo(() => ({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    search: searchTerm || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    customerId: customerFilter || undefined,
    currency: currencyFilter || undefined,
    sortBy,
    sortOrder,
  }), [page, pageSize, searchTerm, statusFilter, customerFilter, currencyFilter, sortBy, sortOrder]);

  const loadCreditNotes = useCallback(async (params: CreditNoteSearchParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCreditNotes(buildCreditNoteSearchParams(params));
      setCreditNotes(data.creditNotes ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load credit notes");
      setCreditNotes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCreditNotes(currentParams);
  }, [currentParams, loadCreditNotes]);

  const totalPages = Math.ceil(total / pageSize);

  async function handleCreateCreditNote(data: any) {
    setCreatingCreditNote(true);
    try {
      const res = await createCreditNote(data);
      setActionMessage({ type: "success", text: "Credit note created successfully!" });
      setShowCreateDialog(false);
      loadCreditNotes(currentParams);
      navigate(`/app/credit-notes/${res.creditNoteId}`);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to create credit note" });
    } finally {
      setCreatingCreditNote(false);
    }
  }

  async function handleFinalize(id: string) {
    try {
      await finalizeCreditNote(id);
      setActionMessage({ type: "success", text: "Credit note finalized!" });
      loadCreditNotes(currentParams);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to finalize" });
    }
  }

  async function handleCancel(id: string) {
    const reason = window.confirm("Cancel this credit note? This cannot be undone.");
    if (!reason) return;
    try {
      await cancelCreditNote(id, { reason: "Cancelled by user" });
      setActionMessage({ type: "success", text: "Credit note cancelled." });
      loadCreditNotes(currentParams);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to cancel" });
    }
  }

  async function handleApply(id: string) {
    const invoiceId = window.prompt("Enter invoice ID to apply this credit note to:");
    if (!invoiceId) return;
    const amount = window.prompt("Enter amount to apply (leave empty for full amount):");
    try {
      await applyCreditNote(id, invoiceId, amount || undefined);
      setActionMessage({ type: "success", text: "Credit note applied successfully!" });
      loadCreditNotes(currentParams);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to apply credit note" });
    }
  }

  async function handleDownloadPdf(id: string) {
    try {
      const blob = await getCreditNotePdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `credit-note-${creditNotes.find(c => c.id === id)?.credit_number ?? id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to download PDF" });
    }
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  }

  function handleSort(column: CreditNoteSearchParams["sortBy"]) {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setPage(1);
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setCustomerFilter("");
    setCurrencyFilter("");
    setPage(1);
  }

  const hasActiveFilters = searchTerm || statusFilter !== "all" || customerFilter || currencyFilter;

  if (loading && creditNotes.length === 0) return <div className="text-center py-20 text-secondary">Loading credit notes...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Credit Notes</h1>
          <p className="text-sm text-secondary mt-1">{total} credit notes total</p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
        >
          New Credit Note
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-color-subtle p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-primary">Filters</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`text-sm font-medium ${showAdvancedFilters ? "text-primary-brand" : "text-secondary hover:text-primary"}`}
            >
              {showAdvancedFilters ? "Hide" : "Show"} Advanced
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm font-medium text-secondary hover:text-primary"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-secondary mb-1">Search</label>
            <input
              type="text"
              placeholder="Credit #, customer name..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Currency</label>
            <input
              type="text"
              placeholder="USD, EUR, etc."
              value={currencyFilter}
              onChange={(e) => { setCurrencyFilter(e.target.value.toUpperCase()); setPage(1); }}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="mt-4 border-t border-color-subtle pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Customer</label>
              <select
                value={customerFilter}
                onChange={(e) => { setCustomerFilter(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.companyName ? `(${c.companyName})` : ""}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 status-error-bg border status-error-border rounded-lg">
          <p className="text-sm status-error-text">{error}</p>
        </div>
      )}

      {actionMessage && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${
          actionMessage.type === "success"
            ? "status-success-border status-success-bg status-success-text"
            : actionMessage.type === "error"
            ? "status-error-border status-error-bg status-error-text"
            : "status-info-border status-info-bg status-info-text"
        }`}>
          {actionMessage.text}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-color-subtle overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-color-subtle bg-surface-alt">
              <th className="text-left text-xs font-medium text-secondary uppercase py-3 px-4 cursor-pointer hover:bg-surface-alt"
                  onClick={() => handleSort("credit_number")}>
                Credit Note
                {sortBy === "credit_number" && (sortOrder === "asc" ? " ↑" : " ↓")}
              </th>
              <th className="text-left text-xs font-medium text-secondary uppercase py-3 px-4 cursor-pointer hover:bg-surface-alt"
                  onClick={() => handleSort("customer_name")}>
                Customer
                {sortBy === "customer_name" && (sortOrder === "asc" ? " ↑" : " ↓")}
              </th>
              <th className="text-center text-xs font-medium text-secondary uppercase py-3 px-4 cursor-pointer hover:bg-surface-alt"
                  onClick={() => handleSort("issue_date")}>
                Issue Date
                {sortBy === "issue_date" && (sortOrder === "asc" ? " ↑" : " ↓")}
              </th>
              <th className="text-right text-xs font-medium text-secondary uppercase py-3 px-4 cursor-pointer hover:bg-surface-alt"
                  onClick={() => handleSort("total")}>
                Total
                {sortBy === "total" && (sortOrder === "asc" ? " ↑" : " ↓")}
              </th>
              <th className="text-right text-xs font-medium text-secondary uppercase py-3 px-4 cursor-pointer hover:bg-surface-alt"
                  onClick={() => handleSort("amount_remaining")}>
                Remaining
                {sortBy === "amount_remaining" && (sortOrder === "asc" ? " ↑" : " ↓")}
              </th>
              <th className="text-center text-xs font-medium text-secondary uppercase py-3 px-4">Status</th>
              <th className="text-center text-xs font-medium text-secondary uppercase py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {creditNotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-secondary">
                  {hasActiveFilters ? "No credit notes match your filters" : "No credit notes yet"}
                  {!hasActiveFilters && (
                    <button
                      onClick={() => setShowCreateDialog(true)}
                      className="ml-2 inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
                    >
                      Create your first credit note
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              creditNotes.map((cn) => (
                <tr key={cn.id} className="border-b border-color-subtle last:border-b-0 hover:bg-surface-alt">
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <Link to={`/app/credit-notes/${cn.id}`} className="text-sm font-medium text-primary hover:text-primary-brand">
                        {cn.credit_number || `Draft #${cn.id.slice(0, 8)}`}
                      </Link>
                      <span className="text-xs text-secondary">
                        {cn.issue_date ? new Date(cn.issue_date).toLocaleDateString() : "—"}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-secondary">
                    {cn.customer_name || "—"}
                    {cn.customer_email && <span className="text-xs text-tertiary block">{cn.customer_email}</span>}
                  </td>
                  <td className="py-3 px-4 text-center text-sm text-secondary">
                    {cn.issue_date ? new Date(cn.issue_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-medium text-primary">
                    {formatCurrency(cn.total, cn.currency)}
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-medium text-primary">
                    {Number(cn.amount_remaining || 0) > 0
                      ? formatCurrency(cn.amount_remaining, cn.currency)
                      : <span className="status-success-text">Fully Applied</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <InvoiceStatusBadge status={cn.status} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {cn.status === "draft" && (
                        <button
                          onClick={() => handleFinalize(cn.id)}
                          className="text-xs text-primary-brand hover:text-primary-brand"
                          title="Finalize"
                        >
                          Finalize
                        </button>
                      )}
                      {cn.status === "finalized" && Number(cn.amount_remaining || 0) > 0 && (
                        <button
                          onClick={() => handleApply(cn.id)}
                          className="text-xs status-success-text hover:status-success-text"
                          title="Apply to Invoice"
                        >
                          Apply
                        </button>
                      )}
                      {["finalized", "applied"].includes(cn.status) && (
                        <button
                          onClick={() => handleCancel(cn.id)}
                          className="text-xs status-error-text hover:status-error-text"
                          title="Cancel"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => handleDownloadPdf(cn.id)}
                        className="text-xs text-secondary hover:text-primary"
                        title="Download PDF"
                      >
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-color-subtle flex items-center justify-between">
            <p className="text-sm text-secondary">
              Page {page} of {totalPages} • {total} credit notes
            </p>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="rounded-lg border border-input-border px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="rounded-lg border border-input-border px-3 py-1 text-sm font-medium text-secondary hover:bg-surface-alt disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="rounded-lg border border-input-border px-3 py-1 text-sm font-medium text-secondary hover:bg-surface-alt disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreateDialog && (
        <CreateCreditNoteDialog
          isOpen={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onCreate={handleCreateCreditNote}
          customers={customers}
          invoices={invoices}
          isLoading={creatingCreditNote}
        />
      )}
    </div>
  );
}

function CreateCreditNoteDialog({
  isOpen,
  onClose,
  onCreate,
  customers,
  invoices,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: any) => void;
  customers: ApiCustomer[];
  invoices: ApiInvoiceListItem[];
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    customerId: "",
    currency: "USD",
    issueDate: new Date().toISOString().split("T")[0],
    notes: "",
    templateId: "",
    items: [{ description: "", quantity: "1", unit: "each", unitPrice: "0.00", taxRate: "0" }],
  });

  if (!isOpen) return null;

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: "1", unit: "each", unitPrice: "0.00", taxRate: "0" }],
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index: number, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-color-subtle">
          <h3 className="text-lg font-semibold text-primary">Create Credit Note</h3>
          <p className="text-sm text-secondary mt-1">Fill in the details below</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Customer *</label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.companyName ? `(${c.companyName})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Issue Date</label>
              <input
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Internal notes..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-primary">Line Items</h4>
              <button type="button" onClick={addItem} className="text-xs text-primary-brand hover:text-primary-brand">+ Add Item</button>
            </div>
            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_80px_80px_100px_80px_auto] gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    className="rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    className="rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    value={item.unit}
                    onChange={(e) => updateItem(index, "unit", e.target.value)}
                    className="rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Rate"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                    className="rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Tax %"
                    value={item.taxRate}
                    onChange={(e) => updateItem(index, "taxRate", e.target.value)}
                    className="rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={formData.items.length <= 1}
                    className="status-error-text hover:status-error-text disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-color-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.customerId}
              className="px-4 py-2 text-sm font-medium text-on-primary bg-primary-action rounded-lg hover:bg-primary-hover disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Credit Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




