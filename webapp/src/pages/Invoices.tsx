import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  getInvoices,
  duplicateInvoice,
  finalizeInvoice,
  sendInvoice,
  getCustomers,
  exportInvoicesCsv,
  exportInvoicesJson,
  type InvoiceSearchParams,
  buildInvoiceSearchParams,
} from "../api/client";
import FeatureGate from "../components/FeatureGate";
import UpgradePrompt from "../components/UpgradePrompt";
import { Plus, FileText, Send, Copy, Search } from "lucide-react";
import { formatCurrency } from "../utils/format";
import InvoiceStatusBadge from "../components/InvoiceStatusBadge";
import InvoiceStatus, { isOverdueStatus } from "../components/ui/InvoiceStatus";
import PageHeader from "../components/ui/PageHeader";
import { formatCurrencyValue } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";
import type { ApiInvoice, ApiCustomer, ApiInvoiceListItem } from "../types/api";

const STATUS_FILTERS = [
  "all", "draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled", "void",
];

const PAYMENT_STATE_FILTERS = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "deposit_due", label: "Deposit Due" },
];

const SORT_OPTIONS = [
  { value: "invoice_number", label: "Invoice #" },
  { value: "customer_name", label: "Customer" },
  { value: "issue_date", label: "Issue Date" },
  { value: "due_date", label: "Due Date" },
  { value: "total", label: "Total" },
  { value: "amount_due", label: "Amount Due" },
  { value: "created_at", label: "Created" },
  { value: "sent_at", label: "Sent" },
  { value: "paid_at", label: "Paid" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export default function Invoices() {
  const { plan } = useSubscription();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [error, setError] = useState<string | null>(null);

const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentStateFilter, setPaymentStateFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [issueDateFrom, setIssueDateFrom] = useState("");
  const [issueDateTo, setIssueDateTo] = useState("");
  const [dueDateFrom, setDueDateFrom] = useState("");
  const [dueDateTo, setDueDateTo] = useState("");
  const [sortBy, setSortBy] = useState<InvoiceSearchParams["sortBy"]>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Debounce the search term so we don't fire an API request on every keystroke.
  const debouncedSetSearchTerm = useDebouncedCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    debouncedSetSearchTerm(value);
  };

  const loadCustomers = useCallback(async () => {
    if (customers.length > 0) return;
    try {
      const data = await getCustomers({ limit: 500, enrich: false });
      setCustomers(data.data ?? []);
    } catch {
      setCustomers([]);
    }
  }, [customers.length]);

  useEffect(() => {
    if (showAdvancedFilters) {
      loadCustomers();
    }
  }, [showAdvancedFilters, loadCustomers]);

  const currentParams: InvoiceSearchParams = useMemo(() => ({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    search: searchTerm || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    paymentState: paymentStateFilter === "all" ? undefined : paymentStateFilter,
    customerId: customerFilter || undefined,
    currency: currencyFilter || undefined,
    minAmount: minAmount || undefined,
    maxAmount: maxAmount || undefined,
    issueDateFrom: issueDateFrom || undefined,
    issueDateTo: issueDateTo || undefined,
    dueDateFrom: dueDateFrom || undefined,
    dueDateTo: dueDateTo || undefined,
    sortBy,
    sortOrder,
  }), [page, pageSize, searchTerm, statusFilter, paymentStateFilter, customerFilter, currencyFilter, minAmount, maxAmount, issueDateFrom, issueDateTo, dueDateFrom, dueDateTo, sortBy, sortOrder]);

  const loadInvoices = useCallback(async (params: InvoiceSearchParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInvoices(buildInvoiceSearchParams(params));
      setInvoices(data.invoices ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load invoices");
      setInvoices([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices(currentParams);
  }, [currentParams, loadInvoices]);

  const totalPages = Math.ceil(total / pageSize);

  async function handleCreateAndEdit() {
    navigate("/app/invoices/new");
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
      loadInvoices(currentParams);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to finalize");
    }
  }

  async function handleSend(id: string) {
    try {
      await sendInvoice(id);
      alert("Invoice sent!");
      loadInvoices(currentParams);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to send");
    }
  }

  async function handleExportCsv() {
    try {
      const blob = await exportInvoicesCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setShowExportMenu(false);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to export CSV");
    }
  }

  async function handleExportJson() {
    try {
      const blob = await exportInvoicesJson();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      setShowExportMenu(false);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to export JSON");
    }
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  }

  function handleSort(column: InvoiceSearchParams["sortBy"]) {
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
    setPaymentStateFilter("all");
    setCustomerFilter("");
    setCurrencyFilter("");
    setMinAmount("");
    setMaxAmount("");
    setIssueDateFrom("");
    setIssueDateTo("");
    setDueDateFrom("");
    setDueDateTo("");
    setPage(1);
  }

  const hasActiveFilters = searchTerm || statusFilter !== "all" || paymentStateFilter !== "all" ||
    customerFilter || currencyFilter || minAmount || maxAmount ||
    issueDateFrom || issueDateTo || dueDateFrom || dueDateTo;

  const getPaymentState = (inv: ApiInvoice): string => {
    const due = Number(inv.amount_due || 0);
    const total = Number(inv.total || 0);
    const paid = Number(inv.amount_paid || 0);
    const depositDue = Number(inv.deposit_due || 0);

    if (depositDue > 0) return "deposit_due";
    if (paid >= total && total > 0) return "paid";
    if (paid > 0) return "partial";
    return "unpaid";
  };

  const getPaymentStateLabel = (state: string) => {
    const labels: Record<string, string> = {
      unpaid: "Unpaid",
      partial: "Partially Paid",
      paid: "Paid",
      deposit_due: "Deposit Due",
    };
    return labels[state] || state;
  };

  const getPaymentStateColor = (state: string) => {
    const colors: Record<string, string> = {
      unpaid: "status-error-bg status-error-text",
      partial: "status-warning-bg status-warning-text",
      paid: "status-success-bg status-success-text",
      deposit_due: "status-warning-bg status-warning-text",
    };
    return colors[state] || colors.unpaid;
  };

  if (loading && invoices.length === 0) return <div className="text-center py-20 text-secondary text-tertiary">Loading invoices…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        breadcrumbs={[{ label: "Home", to: "/app" }, { label: "Invoices" }]}
        description={`${total} invoice${total !== 1 ? "s" : ""} total`}
        primaryAction={
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleCreateAndEdit}
          >
            New Invoice
          </Button>
        }
        secondaryActions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              title="Export CSV"
              className="hidden sm:inline-flex"
            >
              CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportJson}
              title="Export JSON"
              className="hidden sm:inline-flex"
            >
              JSON
            </Button>
          </>
        }
      />

      <div className="bg-surface rounded-xl border border-color-subtle border-color p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-inverse">Filters</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`text-sm font-medium ${showAdvancedFilters ? "text-primary-brand text-primary-brand" : "text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary"}`}
            >
              {showAdvancedFilters ? "Hide" : "Show"} Advanced
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm font-medium text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
<div className="lg:col-span-2">
            <label className="block text-xs font-medium text-secondary text-tertiary mb-1">Search</label>
            <input
              type="text"
              placeholder="Invoice #, customer name, email..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary text-tertiary mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>{s === "partially_paid" ? "Partially Paid" : s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary text-tertiary mb-1">Payment State</label>
            <select
              value={paymentStateFilter}
              onChange={(e) => { setPaymentStateFilter(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {PAYMENT_STATE_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="mt-4 border-t border-color-subtle border-color pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium text-secondary text-tertiary mb-1">Customer</label>
              <select
                value={customerFilter}
                onChange={(e) => { setCustomerFilter(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.companyName ? `(${c.companyName})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary text-tertiary mb-1">Currency</label>
              <input
                type="text"
                placeholder="USD, EUR, etc."
                value={currencyFilter}
                onChange={(e) => { setCurrencyFilter(e.target.value.toUpperCase()); setPage(1); }}
                className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary text-tertiary mb-1">Min Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={minAmount}
                onChange={(e) => { setMinAmount(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary text-tertiary mb-1">Max Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="999999.99"
                value={maxAmount}
                onChange={(e) => { setMaxAmount(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary text-tertiary mb-1">Issue Date From</label>
              <input
                type="date"
                value={issueDateFrom}
                onChange={(e) => { setIssueDateFrom(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary text-tertiary mb-1">Issue Date To</label>
              <input
                type="date"
                value={issueDateTo}
                onChange={(e) => { setIssueDateTo(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary text-tertiary mb-1">Due Date From</label>
              <input
                type="date"
                value={dueDateFrom}
                onChange={(e) => { setDueDateFrom(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary text-tertiary mb-1">Due Date To</label>
              <input
                type="date"
                value={dueDateTo}
                onChange={(e) => { setDueDateTo(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 status-error-bg dark:bg-error-bg border status-error-border dark:status-error-border rounded-lg">
          <p className="text-sm status-error-text dark:status-error-text">{error}</p>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-color-subtle border-color overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-color-subtle border-color bg-surface-alt dark:bg-surface-alt">
              <th className="text-left text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4 cursor-pointer hover:bg-surface-alt hover:bg-hover"
                onClick={() => handleSort("invoice_number")}>
                Invoice
                {sortBy === "invoice_number" && (sortOrder === "asc" ? " ↑" : " ↓")}
              </th>
              <th className="text-left text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4 cursor-pointer hover:bg-surface-alt hover:bg-hover"
                onClick={() => handleSort("customer_name")}>
                Customer
                {sortBy === "customer_name" && (sortOrder === "asc" ? " ↑" : " ↓")}
              </th>
              <th className="text-center text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">
                Payment State
              </th>
              <th className="text-right text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4 cursor-pointer hover:bg-surface-alt hover:bg-hover"
                onClick={() => handleSort("total")}>
                Total
                {sortBy === "total" && (sortOrder === "asc" ? " ↑" : " ↓")}
              </th>
              <th className="text-right text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4 cursor-pointer hover:bg-surface-alt hover:bg-hover"
                onClick={() => handleSort("amount_due")}>
                Amount Due
                {sortBy === "amount_due" && (sortOrder === "asc" ? " ↑" : " ↓")}
              </th>
              <th className="text-right text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4 cursor-pointer hover:bg-surface-alt hover:bg-hover"
                onClick={() => handleSort("due_date")}>
                Due Date
                {sortBy === "due_date" && (sortOrder === "asc" ? " ↑" : " ↓")}
              </th>
              <th className="text-center text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4 cursor-pointer hover:bg-surface-alt hover:bg-hover"
                onClick={() => handleSort("issue_date")}>
                Issue Date
                {sortBy === "issue_date" && (sortOrder === "asc" ? " ↑" : " ↓")}
              </th>
              <th className="text-center text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4 cursor-pointer hover:bg-surface-alt hover:bg-hover"
                onClick={() => handleSort("status")}>
                Status
                {sortBy === "status" && (sortOrder === "asc" ? " ↑" : " ↓")}
              </th>
              <th className="text-center text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-secondary text-tertiary">
                  {hasActiveFilters ? "No invoices match your filters" : "No invoices yet"}
                  {!hasActiveFilters && (
                    <Button
                      variant="primary"
                      size="md"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={handleCreateAndEdit}
                      className="ml-2"
                    >
                      Create your first invoice
                    </Button>
                  )}
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const paymentState = getPaymentState(inv);
                return (
                  <tr key={inv.id} className="border-b border-color-subtle border-color last:border-b-0 hover:bg-surface-alt hover:bg-hover">
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <Link to={`/app/invoices/${inv.id}`} className="text-sm font-medium text-inverse hover:text-primary-brand dark:hover:text-primary-brand">
                          {inv.invoice_number || `Draft #${inv.id.slice(0, 8)}`}
                        </Link>
                        <span className="text-xs text-secondary text-tertiary">
                          {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-secondary text-tertiary">
                      {inv.customer_name || "—"}
                      {inv.customer_email && <span className="text-xs text-tertiary text-tertiary block">{inv.customer_email}</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getPaymentStateColor(paymentState)}`}>
                        {getPaymentStateLabel(paymentState)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-medium text-inverse">
                      {formatCurrency(inv.total, inv.currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-medium text-inverse">
                      {Number(inv.amount_due || 0) > 0
                        ? formatCurrency(inv.amount_due, inv.currency)
                        : <span className="status-success-text dark:status-success-text">Paid</span>}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-secondary text-tertiary">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-secondary text-tertiary">
                      {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <InvoiceStatus status={inv.status} isOverdue={isOverdueStatus(inv.status, inv.due_date)} showIcon />
                    </td>
                     <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <FeatureGate feature="invoices.duplicate" requiredPlan="pro" fallback={null}>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Copy className="w-3.5 h-3.5" />}
                            onClick={() => handleDuplicate(inv.id)}
                            title="Duplicate"
                          />
                        </FeatureGate>
                        {inv.status === "sent" && (
                          <FeatureGate feature="reminders.automated" requiredPlan="pro" fallback={null}>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Send className="w-3.5 h-3.5" />}
                              onClick={() => handleSend(inv.id)}
                              title="Send"
                            />
                          </FeatureGate>
                        )}
                        {inv.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<FileText className="w-3.5 h-3.5" />}
                            onClick={() => handleFinalize(inv.id)}
                            title="Finalize"
                            className="text-primary-brand text-primary-brand hover:text-primary-brand dark:hover:text-primary-brand"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-color-subtle border-color flex items-center justify-between">
            <p className="text-sm text-secondary text-tertiary">
              Page {page} of {totalPages} • {total} invoices
            </p>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-1 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
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
                className="px-3 py-1"
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="px-3 py-1"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}







