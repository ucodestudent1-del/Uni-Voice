import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
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
import { Button } from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { formatCurrency, formatDate } from "../utils/format";
import { getCurrencyMetadata } from "../types/currency";
import { LINE_ITEM_UNITS } from "../types/quote-builder";
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
      const data = await getCustomers({ limit: 100, enrich: false });
      setCustomers(data.data ?? []);
    } catch {
      setCustomers([]);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    try {
      const data = await getInvoices({ limit: 100, status: "finalized" });
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
      navigate("/app/credit-notes");
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
        <Button
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setShowCreateDialog(true)}
        >
          New Credit Note
        </Button>
      </div>

      <div className="filter-container">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-primary">Filters</h3>
          <div className="flex items-center gap-3">
            <Button
              variant={showAdvancedFilters ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              {showAdvancedFilters ? "Hide" : "Show"} Advanced
            </Button>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                Clear All
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-5">
            <label className="filter-label">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Credit #, customer name..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="filter-input pl-4"
              />
            </div>
          </div>
          <div className="lg:col-span-3">
            <label className="filter-label">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="filter-select"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-4">
            <label className="filter-label">Currency</label>
            <input
              type="text"
              placeholder="USD, EUR, etc."
              value={currencyFilter}
              onChange={(e) => { setCurrencyFilter(e.target.value.toUpperCase()); setPage(1); }}
              className="filter-input"
            />
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="mt-4 border-t border-color-subtle pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-4">
              <label className="filter-label">Customer</label>
              <select
                value={customerFilter}
                onChange={(e) => { setCustomerFilter(e.target.value); setPage(1); }}
                className="filter-select"
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
                <td colSpan={7} className="py-4">
                  <EmptyState
                    title={hasActiveFilters ? "No credit notes match your filters" : "No credit notes yet"}
                    description={hasActiveFilters ? "Try adjusting your search or filter criteria." : "Create a credit note to issue refunds, correct invoices, or apply adjustments."}
                    actionLabel={hasActiveFilters ? "Clear Filters" : "New Credit Note"}
                    onAction={hasActiveFilters ? clearFilters : () => setShowCreateDialog(true)}
                  />
                </td>
              </tr>
            ) : (
              creditNotes.map((cn) => (
                <tr key={cn.id} className="border-b border-color-subtle last:border-b-0 hover:bg-surface-alt">
                  <td className="py-3 px-4">
                     <div className="flex flex-col">
                       <span className="text-sm font-medium text-primary">
                         {cn.credit_number || `Draft #${cn.id.slice(0, 8)}`}
                       </span>
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
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => handleFinalize(cn.id)}
                           title="Finalize"
                         >
                           Finalize
                         </Button>
                       )}
                       {cn.status === "finalized" && Number(cn.amount_remaining || 0) > 0 && (
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => handleApply(cn.id)}
                           title="Apply to Invoice"
                           className="status-success-text"
                         >
                           Apply
                         </Button>
                       )}
                       {["finalized", "applied"].includes(cn.status) && (
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => handleCancel(cn.id)}
                           title="Cancel"
                           className="status-error-text"
                         >
                           Cancel
                         </Button>
                       )}
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => handleDownloadPdf(cn.id)}
                         title="Download PDF"
                       >
                         PDF
                       </Button>
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
                className="form-control-sm"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </Button>
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

  const meta = getCurrencyMetadata(formData.currency);
  const step = meta.decimalPlaces === 0 ? "1" : "0.01";

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

  const lineTotal = useMemo(() => {
    return formData.items.map((item) => {
      try {
        const q = new Decimal(item.quantity || 0);
        const p = new Decimal(item.unitPrice || 0);
        const tax = new Decimal(item.taxRate || 0);
        const sub = q.mul(p);
        const taxAmt = sub.mul(tax.div(100));
        return sub.plus(taxAmt).toDecimalPlaces(meta.decimalPlaces, Decimal.ROUND_HALF_UP);
      } catch {
        return new Decimal(0);
      }
    });
  }, [formData.items, meta.decimalPlaces]);

  const subtotal = useMemo(() => {
    return lineTotal.reduce((sum, lt) => sum.plus(lt), new Decimal(0));
  }, [lineTotal]);

  const formattedDate = useMemo(() => {
    if (!formData.issueDate) return "";
    return formatDate(new Date(formData.issueDate + "T00:00:00"));
  }, [formData.issueDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-color-subtle">
          <h2 className="text-2xl font-bold text-primary">Create Credit Note</h2>
          <p className="text-sm text-secondary mt-1">Fill in the details below</p>
        </div>
         <form onSubmit={handleSubmit} className="p-6 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Customer *</label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="form-select"
                required
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.companyName ? `(${c.companyName})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="form-select"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
            <div>
              <label className="form-label">Issue Date</label>
              <input
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                className="form-control"
              />
              {formattedDate && (
                <p className="mt-1 text-xs text-secondary">{formattedDate}</p>
              )}
            </div>
          </div>

          <div>
            <label className="form-label">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="form-control"
              placeholder="Internal notes..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-primary">Line Items</h4>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={addItem}
              >
                Add Item
              </Button>
            </div>

            <div className="border border-color-subtle rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-alt">
                  <tr>
                     <th className="text-left text-xs font-semibold text-secondary uppercase tracking-wider py-3.5 px-3">Description</th>
                     <th className="text-right text-xs font-semibold text-secondary uppercase tracking-wider py-3.5 px-2">Qty</th>
                     <th className="text-left text-xs font-semibold text-secondary uppercase tracking-wider py-3.5 px-2">Unit</th>
                     <th className="text-right text-xs font-semibold text-secondary uppercase tracking-wider py-3.5 px-2">Rate</th>
                     <th className="text-right text-xs font-semibold text-secondary uppercase tracking-wider py-3.5 px-2">Tax %</th>
                     <th className="text-right text-xs font-semibold text-secondary uppercase tracking-wider py-3.5 px-2">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => (
                    <tr key={index} className="border-t border-color-subtle">
                      <td className="py-2.5 px-3">
                           <input
                           type="text"
                           placeholder="Product or service..."
                           value={item.description}
                           onChange={(e) => updateItem(index, "description", e.target.value)}
                           className="w-full rounded-md border border-input-border bg-input px-2.5 py-1.5 text-sm text-primary placeholder-input placeholder-target focus:outline-none focus:ring-1 focus:ring-primary"
                         />
                       </td>
                       <td className="py-2.5 px-2">
                         <input
                           type="number"
                           step={step}
                           min="0"
                           placeholder="1"
                           value={item.quantity}
                           onChange={(e) => updateItem(index, "quantity", e.target.value)}
                           className="w-full rounded-md border border-input-border bg-input px-2 py-1.25 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary font-tabular-nums"
                         />
                       </td>
                       <td className="py-2.5 px-2">
                         <select
                           value={item.unit}
                           onChange={(e) => updateItem(index, "unit", e.target.value)}
                           className="w-full rounded-md border border-input-border bg-input px-2 py-1.25 text-sm text-primary capitalize focus:outline-none focus:ring-1 focus:ring-primary"
                         >
                          {LINE_ITEM_UNITS.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-tertiary text-sm">{meta.symbol}</span>
                          <input
                            type="number"
                            step={step}
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                            className="w-full rounded-md border border-input-border bg-input px-7 py-1.5 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary font-tabular-nums"
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={item.taxRate}
                          onChange={(e) => updateItem(index, "taxRate", e.target.value)}
                          className="w-full rounded-md border border-input-border bg-input px-2.5 py-1.5 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary font-tabular-nums"
                        />
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="block text-sm text-primary font-tabular-nums text-right">
                          {formatCurrency(lineTotal[index]?.toString() ?? "0", formData.currency)}
                        </span>
                      </td>
                      <td className="py-2.5 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={formData.items.length <= 1}
                          className="p-1 text-tertiary hover:text-error-text hover:bg-error-bg rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          aria-label="Remove line item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="w-48 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary">Subtotal</span>
                  <span className="text-primary font-tabular-nums">{formatCurrency(subtotal.toString(), formData.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-5 border-t border-color-subtle mt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              type="submit"
              icon={<Plus className="h-5 w-5" />}
              iconPosition="right"
              disabled={isLoading || !formData.customerId}
            >
              {isLoading ? "Creating..." : "Create Credit Note"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}




