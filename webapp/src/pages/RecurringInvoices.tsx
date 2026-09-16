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

  if (loading && recurringInvoices.length === 0) return <div className="text-center py-20 text-slate-500">Loading recurring invoices...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recurring Invoices</h1>
          <p className="text-sm text-slate-600 mt-1">{total} schedules total</p>
        </div>
        <FeatureGate feature="invoices.recurring" requiredPlan="pro" fallback={
          <UpgradePrompt feature="Recurring Invoices" requiredPlan="pro" />
        }>
          <button
            onClick={() => { setEditingRecurring(null); setShowCreateDialog(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            New Schedule
          </button>
        </FeatureGate>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Clear All
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
            <input
              type="text"
              placeholder="Name, customer..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
            <select
              value={customerFilter}
              onChange={(e) => { setCustomerFilter(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {actionMessage && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${
          actionMessage.type === "success"
            ? "border-green-200 bg-green-50 text-green-800"
            : actionMessage.type === "error"
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-blue-200 bg-blue-50 text-blue-800"
        }`}>
          {actionMessage.text}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Schedule</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Customer</th>
              <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Frequency</th>
              <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Next Generation</th>
              <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">End Date</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase py-3 px-4">Amount</th>
              <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Auto-Send</th>
              <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Status</th>
              <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedInvoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-slate-500">
                  {hasActiveFilters ? "No schedules match your filters" : "No recurring invoices yet"}
                  {!hasActiveFilters && (
                    <FeatureGate feature="invoices.recurring" requiredPlan="pro" fallback={null}>
                      <button
                        onClick={() => { setEditingRecurring(null); setShowCreateDialog(true); }}
                        className="ml-2 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
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
                const statusColor = { active: "bg-green-100 text-green-800", paused: "bg-amber-100 text-amber-800", ended: "bg-slate-100 text-slate-800" }[status];

                return (
                  <tr key={r.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <Link to={`/app/recurring-invoices/${r.id}`} className="text-sm font-medium text-slate-900 hover:text-primary-600">
                          {r.name}
                        </Link>
                        <span className="text-xs text-slate-500">{r.frequency} • every {r.interval_count}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {r.customer_name || "—"}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-slate-600 capitalize">
                      {r.frequency} ({r.interval_count})
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-slate-600">
                      {r.next_generation_at ? new Date(r.next_generation_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-slate-600">
                      {r.end_date ? new Date(r.end_date).toLocaleDateString() : "Never"}
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-medium text-slate-900">
                      {formatCurrency(r.total || "0", r.currency)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${r.auto_send ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"}`}>
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
                          className="text-xs text-slate-600 hover:text-slate-900"
                          title="Edit"
                        >
                          Edit
                        </button>
                        {status === "active" && (
                          <button
                            onClick={() => handlePause(r.id)}
                            className="text-xs text-amber-600 hover:text-amber-700"
                            title="Pause"
                          >
                            Pause
                          </button>
                        )}
                        {status === "paused" && (
                          <button
                            onClick={() => handleResume(r.id)}
                            className="text-xs text-green-600 hover:text-green-700"
                            title="Resume"
                          >
                            Resume
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="text-xs text-red-600 hover:text-red-700"
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
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Page {page} of {totalPages} • {total} schedules
            </p>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            {initialData ? "Edit Recurring Invoice" : "Create Recurring Invoice"}
          </h3>
          <p className="text-sm text-slate-500 mt-1">Configure the recurring schedule</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.companyName ? `(${c.companyName})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                placeholder="e.g. Monthly Retainer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Frequency *</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {FREQUENCY_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Interval Count</label>
              <input
                type="number"
                min="1"
                max="12"
                value={formData.intervalCount}
                onChange={(e) => setFormData({ ...formData, intervalCount: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Next Generation Date *</label>
              <input
                type="date"
                value={formData.nextGenerationAt}
                onChange={(e) => setFormData({ ...formData, nextGenerationAt: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date (optional)</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Auto-Send Generated Invoices</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.autoSend}
                  onChange={(e) => setFormData({ ...formData, autoSend: e.target.checked })}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Automatically email generated invoices to customer</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Active</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Schedule is active</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Notes for generated invoices..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Terms</label>
            <textarea
              value={formData.terms}
              onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Payment terms for generated invoices..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.customerId || !formData.name}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {isLoading ? "Saving..." : initialData ? "Save Changes" : "Create Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}