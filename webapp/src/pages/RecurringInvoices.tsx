import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  getRecurringInvoices,
  getRecurringInvoice,
  createRecurringInvoice,
  updateRecurringInvoice,
  pauseRecurringInvoice,
  resumeRecurringInvoice,
  deleteRecurringInvoice,
  getInvoices,
  getCustomers,
  type RecurringInvoiceCreateInput,
  type RecurringInvoiceUpdateInput,
} from "../api/client";
import FeatureGate from "../components/FeatureGate";
import UpgradePrompt from "../components/UpgradePrompt";
import InvoiceStatusBadge from "../components/InvoiceStatusBadge";
import { formatCurrency, formatDate } from "../utils/format";
import type { ApiRecurringInvoice, ApiInvoiceListItem, ApiCustomer } from "../types/api";

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export default function RecurringInvoices() {
  const { plan } = useSubscription();
  const navigate = useNavigate();
  const [recurringInvoices, setRecurringInvoices] = useState<ApiRecurringInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<ApiRecurringInvoice | null>(null);
  const [creatingRecurring, setCreatingRecurring] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      const data = await getCustomers({ limit: 500, enrich: false });
      setCustomers(data.data ?? []);
    } catch {
      setCustomers([]);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const loadRecurringInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRecurringInvoices();
      let list = data.recurringInvoices ?? [];
      
      if (searchTerm) {
        list = list.filter((r: ApiRecurringInvoice) =>
          r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      if (statusFilter !== "all") {
        const now = new Date();
        list = list.filter((r: ApiRecurringInvoice) => {
          if (statusFilter === "active") return r.is_active && (!r.end_date || new Date(r.end_date) > now);
          if (statusFilter === "paused") return !r.is_active;
          if (statusFilter === "ended") return r.end_date && new Date(r.end_date) <= now;
          return true;
        });
      }
      if (customerFilter) {
        list = list.filter((r: ApiRecurringInvoice) => r.customer_id === customerFilter);
      }

      setRecurringInvoices(list);
      setTotal(list.length);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load recurring invoices");
      setRecurringInvoices([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, customerFilter]);

  useEffect(() => {
    loadRecurringInvoices();
  }, [loadRecurringInvoices]);

  const totalPages = Math.ceil(total / pageSize);
  const paginatedInvoices = recurringInvoices.slice((page - 1) * pageSize, page * pageSize);

  async function handleCreateRecurring(data: RecurringInvoiceCreateInput | RecurringInvoiceUpdateInput) {
    setCreatingRecurring(true);
    try {
      await createRecurringInvoice(data as RecurringInvoiceCreateInput);
      setActionMessage({ type: "success", text: "Recurring invoice created successfully!" });
      setShowCreateDialog(false);
      loadRecurringInvoices();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to create recurring invoice" });
    } finally {
      setCreatingRecurring(false);
    }
  }

  async function handleUpdateRecurring(id: string, data: RecurringInvoiceUpdateInput) {
    try {
      await updateRecurringInvoice(id, data);
      setActionMessage({ type: "success", text: "Recurring invoice updated!" });
      setEditingRecurring(null);
      loadRecurringInvoices();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to update" });
    }
  }

  async function handlePause(id: string) {
    try {
      await pauseRecurringInvoice(id);
      setActionMessage({ type: "success", text: "Recurring invoice paused." });
      loadRecurringInvoices();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to pause" });
    }
  }

  async function handleResume(id: string) {
    try {
      await resumeRecurringInvoice(id);
      setActionMessage({ type: "success", text: "Recurring invoice resumed." });
      loadRecurringInvoices();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to resume" });
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this recurring invoice? This cannot be undone.")) return;
    try {
      await deleteRecurringInvoice(id);
      setActionMessage({ type: "success", text: "Recurring invoice deleted." });
      loadRecurringInvoices();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to delete" });
    }
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setCustomerFilter("");
    setPage(1);
  }

  const hasActiveFilters = searchTerm || statusFilter !== "all" || customerFilter;

  if (loading && recurringInvoices.length === 0) return <div className="text-center py-20 text-secondary">Loading recurring invoices...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Recurring Invoices</h1>
          <p className="text-sm text-secondary mt-1">{total} schedules total</p>
        </div>
        <FeatureGate feature="invoices.recurring" requiredPlan="pro" fallback={
          <UpgradePrompt feature="Recurring Invoices" requiredPlan="pro" />
        }>
          <button
            onClick={() => { setEditingRecurring(null); setShowCreateDialog(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            New Schedule
          </button>
        </FeatureGate>
      </div>

      <div className="bg-surface rounded-xl border border-color-subtle p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-primary">Filters</h3>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm font-medium text-secondary hover:text-primary"
            >
              Clear All
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-secondary mb-1">Search</label>
            <input
              type="text"
              placeholder="Name, customer..."
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
              <th className="text-left text-xs font-medium text-secondary uppercase py-3 px-4">Schedule</th>
              <th className="text-left text-xs font-medium text-secondary uppercase py-3 px-4">Customer</th>
              <th className="text-center text-xs font-medium text-secondary uppercase py-3 px-4">Frequency</th>
              <th className="text-center text-xs font-medium text-secondary uppercase py-3 px-4">Next Generation</th>
              <th className="text-center text-xs font-medium text-secondary uppercase py-3 px-4">End Date</th>
              <th className="text-right text-xs font-medium text-secondary uppercase py-3 px-4">Amount</th>
              <th className="text-center text-xs font-medium text-secondary uppercase py-3 px-4">Auto-Send</th>
              <th className="text-center text-xs font-medium text-secondary uppercase py-3 px-4">Status</th>
              <th className="text-center text-xs font-medium text-secondary uppercase py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedInvoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-secondary">
                  {hasActiveFilters ? "No schedules match your filters" : "No recurring invoices yet"}
                  {!hasActiveFilters && (
                    <FeatureGate feature="invoices.recurring" requiredPlan="pro" fallback={null}>
                      <button
                        onClick={() => { setEditingRecurring(null); setShowCreateDialog(true); }}
                        className="ml-2 inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
                      >
                        Create your first schedule
                      </button>
                    </FeatureGate>
                  )}
                </td>
              </tr>
            ) : (
              paginatedInvoices.map((r) => {
                const now = new Date();
                const isEnded = r.end_date && new Date(r.end_date) <= now;
                const status = !r.is_active ? "paused" : isEnded ? "ended" : "active";
                const statusLabel = { active: "Active", paused: "Paused", ended: "Ended" }[status];
                const statusColor = { active: "status-success-bg status-success-text", paused: "status-warning-bg status-warning-text", ended: "bg-surface-alt text-primary" }[status];

                return (
                  <tr key={r.id} className="border-b border-color-subtle last:border-b-0 hover:bg-surface-alt">
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <Link to={`/app/recurring-invoices/${r.id}`} className="text-sm font-medium text-primary hover:text-primary-brand">
                          {r.name}
                        </Link>
                        <span className="text-xs text-secondary">{r.frequency} • every {r.interval_count}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-secondary">
                      {r.customer_name || "—"}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-secondary capitalize">
                      {r.frequency} ({r.interval_count})
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-secondary">
                      {r.next_generation_at ? new Date(r.next_generation_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-secondary">
                      {r.end_date ? new Date(r.end_date).toLocaleDateString() : "Never"}
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-medium text-primary">
                      {formatCurrency(r.total || "0", r.currency)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${r.auto_send ? "status-success-bg status-success-text" : "bg-surface-alt text-primary"}`}>
                        {r.auto_send ? "On" : "Off"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingRecurring(r)}
                          className="text-xs text-secondary hover:text-primary"
                          title="Edit"
                        >
                          Edit
                        </button>
                        {status === "active" && (
                          <button
                            onClick={() => handlePause(r.id)}
                            className="text-xs status-warning-text hover:text-warning-text"
                            title="Pause"
                          >
                            Pause
                          </button>
                        )}
                        {status === "paused" && (
                          <button
                            onClick={() => handleResume(r.id)}
                            className="text-xs status-success-text hover:status-success-text"
                            title="Resume"
                          >
                            Resume
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="text-xs status-error-text hover:status-error-text"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-color-subtle flex items-center justify-between">
            <p className="text-sm text-secondary">
              Page {page} of {totalPages} • {total} schedules
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
        <RecurringInvoiceDialog
          isOpen={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSave={handleCreateRecurring}
          customers={customers}
          initialData={editingRecurring}
          isLoading={creatingRecurring}
        />
      )}

      {editingRecurring && !showCreateDialog && (
        <RecurringInvoiceDialog
          isOpen={!!editingRecurring}
          onClose={() => setEditingRecurring(null)}
          onSave={(data) => handleUpdateRecurring(editingRecurring!.id, data)}
          customers={customers}
          initialData={editingRecurring}
          isLoading={creatingRecurring}
        />
      )}
    </div>
  );
}

function RecurringInvoiceDialog({
  isOpen,
  onClose,
  onSave,
  customers,
  initialData,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: RecurringInvoiceCreateInput | RecurringInvoiceUpdateInput) => void | Promise<void>;
  customers: ApiCustomer[];
  initialData: ApiRecurringInvoice | null;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<RecurringInvoiceCreateInput>({
    customerId: "",
    name: "",
    frequency: "monthly",
    intervalCount: 1,
    nextGenerationAt: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    endDate: "",
    currency: "USD",
    notes: "",
    terms: "",
    templateId: "",
    isActive: true,
    autoSend: true,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        customerId: initialData.customer_id || "",
        name: initialData.name,
        frequency: initialData.frequency,
        intervalCount: initialData.interval_count,
        nextGenerationAt: initialData.next_generation_at?.split("T")[0] || "",
        endDate: initialData.end_date?.split("T")[0] || "",
        currency: initialData.currency,
        notes: initialData.notes || "",
        terms: initialData.terms || "",
        templateId: initialData.template_id || "",
        isActive: initialData.is_active,
        autoSend: initialData.auto_send,
      });
    } else {
      setFormData({
        customerId: "",
        name: "",
        frequency: "monthly",
        intervalCount: 1,
        nextGenerationAt: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        endDate: "",
        currency: "USD",
        notes: "",
        terms: "",
        templateId: "",
        isActive: true,
        autoSend: true,
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: RecurringInvoiceCreateInput = {
      ...formData,
      intervalCount: formData.intervalCount || 1,
      nextGenerationAt: formData.nextGenerationAt || undefined,
      endDate: formData.endDate || undefined,
      autoSend: formData.autoSend ?? true,
      isActive: formData.isActive ?? true,
    };
    onSave(data);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-color-subtle">
          <h3 className="text-lg font-semibold text-primary">
            {initialData ? "Edit Recurring Invoice" : "Create Recurring Invoice"}
          </h3>
          <p className="text-sm text-secondary mt-1">Configure the recurring schedule</p>
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
              <label className="block text-sm font-medium text-secondary mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
                placeholder="e.g. Monthly Retainer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Frequency *</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {FREQUENCY_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Interval Count</label>
              <input
                type="number"
                min="1"
                max="12"
                value={formData.intervalCount}
                onChange={(e) => setFormData({ ...formData, intervalCount: Number(e.target.value) })}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Next Generation Date *</label>
              <input
                type="date"
                value={formData.nextGenerationAt}
                onChange={(e) => setFormData({ ...formData, nextGenerationAt: e.target.value })}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">End Date (optional)</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Auto-Send Generated Invoices</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.autoSend}
                  onChange={(e) => setFormData({ ...formData, autoSend: e.target.checked })}
                  className="rounded border-input-border text-primary-brand focus:ring-primary"
                />
                <span className="text-sm text-secondary">Automatically email generated invoices to customer</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Active</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-input-border text-primary-brand focus:ring-primary"
                />
                <span className="text-sm text-secondary">Schedule is active</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Notes for generated invoices..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Terms</label>
            <textarea
              value={formData.terms}
              onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Payment terms for generated invoices..."
            />
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
              disabled={isLoading || !formData.customerId || !formData.name}
              className="px-4 py-2 text-sm font-medium text-on-primary bg-primary-action rounded-lg hover:bg-primary-hover disabled:opacity-50"
            >
              {isLoading ? "Saving..." : initialData ? "Save Changes" : "Create Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




