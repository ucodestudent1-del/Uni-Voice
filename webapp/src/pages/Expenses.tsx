import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { useSubscription } from "../contexts/SubscriptionContext";
import { getExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary, type ExpenseSearchParams } from "../api/client";
import FeatureGate from "../components/FeatureGate";
import { formatCurrency } from "../utils/format";
import type { ApiExpense, ApiExpenseSummary } from "../types/api";
import { Button } from "../components/ui/Button";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";

const CATEGORY_OPTIONS = [
  { value: "supplies", label: "Supplies" },
  { value: "software", label: "Software" },
  { value: "meals", label: "Meals" },
  { value: "travel", label: "Travel" },
  { value: "office", label: "Office" },
  { value: "marketing", label: "Marketing" },
  { value: "utilities", label: "Utilities" },
  { value: "professional_fees", label: "Professional Fees" },
  { value: "taxes", label: "Taxes" },
  { value: "insurance", label: "Insurance" },
  { value: "equipment", label: "Equipment" },
  { value: "other", label: "Other" },
];

const EXPENSE_CATEGORIES: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label])
);

export default function Expenses() {
  const { plan } = useSubscription();
  const [expenses, setExpenses] = useState<ApiExpense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ApiExpense>>({});
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<ApiExpenseSummary | null>(null);

const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // Debounce search so we don't fire an API request on every keystroke.
  const debouncedSetSearchTerm = useDebouncedCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSetSearchTerm(e.target.value);
  };

  const params: ExpenseSearchParams = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      search: searchTerm || undefined,
      category: categoryFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [pageSize, page, searchTerm, categoryFilter, dateFrom, dateTo]
  );

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getExpenses(params);
      setExpenses(data.expenses ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("Expense tracking requires a Business plan. Please upgrade to continue.");
      } else {
        setError(err.response?.data?.error || "Failed to load expenses");
      }
      setExpenses([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [params]);

  const loadSummary = useCallback(async () => {
    try {
      const dateParams: Record<string, string> = {};
      if (dateFrom) dateParams.dateFrom = dateFrom;
      if (dateTo) dateParams.dateTo = dateTo;
      const data = await getExpenseSummary(dateParams);
      setSummary(data.summary ?? null);
    } catch {
      setSummary(null);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const totalAmount = summary?.total_amount ?? expenses.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
  const currency = summary?.currency ?? "USD";

  const handleEdit = (expense: ApiExpense) => {
    setEditingId(expense.id);
    setFormData({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      expense_date: expense.expense_date,
      payment_method: expense.payment_method,
      receipt_url: expense.receipt_url,
      notes: expense.notes,
      is_billable: expense.is_billable,
      is_reimbursed: expense.is_reimbursed,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await deleteExpense(id);
      setExpenses(expenses.filter((e) => e.id !== id));
      setTotal(total - 1);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete expense");
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const res = await updateExpense(editingId, {
          description: formData.description,
          amount: formData.amount,
          category: formData.category ?? "other",
          expense_date: formData.expense_date,
          payment_method: formData.payment_method,
          receipt_url: formData.receipt_url,
          notes: formData.notes,
          is_billable: formData.is_billable,
          is_reimbursed: formData.is_reimbursed,
        });
        setExpenses(
          expenses.map((e) => (e.id === editingId ? res.expense : e))
        );
      } else {
        const res = await createExpense({
          description: formData.description,
          amount: formData.amount,
          category: formData.category ?? "other",
          expense_date: formData.expense_date ?? new Date().toISOString().split("T")[0],
          payment_method: formData.payment_method ?? "cash",
          receipt_url: formData.receipt_url ?? null,
          notes: formData.notes ?? null,
          is_billable: formData.is_billable ?? false,
        });
        setExpenses([res.expense, ...expenses]);
        setTotal(total + 1);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({});
      loadSummary();
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("Expense tracking requires a Business plan.");
      } else {
        setError(err.response?.data?.error || "Failed to save expense");
      }
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <FeatureGate feature="expenses.tracking" requiredPlan="business">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Expenses</h1>
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setFormData({});
            }}
          >
            Add Expense
          </Button>
        </div>

        {error && (
          <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text">{error}</div>
        )}

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-surface rounded-xl border border-color-subtle border-color p-4 text-center">
              <p className="text-2xl font-bold text-inverse">{formatCurrency(summary.total_amount, currency)}</p>
              <p className="text-sm text-secondary text-tertiary">Total Expenses</p>
            </div>
            <div className="bg-surface rounded-xl border border-color-subtle border-color p-4 text-center">
              <p className="text-2xl font-bold text-inverse">{summary.count}</p>
              <p className="text-sm text-secondary text-tertiary">Expenses</p>
            </div>
            <div className="bg-surface rounded-xl border border-color-subtle border-color p-4 text-center">
              <p className="text-2xl font-bold text-inverse">{formatCurrency(summary.billable_amount, currency)}</p>
              <p className="text-sm text-secondary text-tertiary">Billable</p>
            </div>
            <div className="bg-surface rounded-xl border border-color-subtle border-color p-4 text-center">
              <p className="text-2xl font-bold text-inverse">{formatCurrency(summary.reimbursed_amount, currency)}</p>
              <p className="text-sm text-secondary text-tertiary">Reimbursed</p>
            </div>
          </div>
        )}

        <div className="flex gap-4 items-end">
          <div className="flex-1">
<input
              type="text"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Categories</option>
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
            <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl mx-4 my-8">
              <div className="p-6 border-b border-color-subtle">
                <h3 className="text-lg font-semibold text-primary">
                  {editingId ? "Edit Expense" : "Add Expense"}
                </h3>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Description</label>
                  <textarea
                    value={formData.description ?? ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount ?? ""}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">Category</label>
                    <select
                      value={formData.category ?? "other"}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {CATEGORY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">Date</label>
                    <input
                      type="date"
                      value={formData.expense_date?.slice(0, 10) ?? ""}
                      onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                      className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">Payment Method</label>
                    <input
                      type="text"
                      value={formData.payment_method ?? "cash"}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                      className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Receipt URL</label>
                  <input
                    type="url"
                    value={formData.receipt_url ?? ""}
                    onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value || null })}
                    className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Notes</label>
                  <textarea
                    value={formData.notes ?? ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
                    rows={2}
                    className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_billable ?? false}
                      onChange={(e) => setFormData({ ...formData, is_billable: e.target.checked })}
                      className="rounded border-input-border text-primary-brand focus:ring-primary"
                    />
                    <span className="text-sm text-secondary">Billable</span>
                  </label>
                  {editingId && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_reimbursed ?? false}
                        onChange={(e) => setFormData({ ...formData, is_reimbursed: e.target.checked })}
                        className="rounded border-input-border text-primary-brand focus:ring-primary"
                      />
                      <span className="text-sm text-secondary">Reimbursed</span>
                    </label>
                  )}
                </div>
              </form>
            <div className="p-6 border-t border-color-subtle flex justify-end gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({});
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={(e) => handleSubmit(e)}
                disabled={saving || !formData.description || !formData.amount}
              >
                {saving ? "Saving..." : editingId ? "Update" : "Save"}
              </Button>
            </div>
            </div>
          </div>
        )}

        <div className="bg-surface rounded-xl border border-color-subtle border-color overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-color-subtle border-color">
                <th className="text-left text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">Date</th>
                <th className="text-left text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">Description</th>
                <th className="text-left text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">Category</th>
                <th className="text-right text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">Amount</th>
                <th className="text-left text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">Payment</th>
                <th className="text-center text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-tertiary text-tertiary">Loading…</td>
                </tr>
              ) : expenses.map((exp) => (
                <tr key={exp.id} className="border-b border-color-subtle border-color last:border-b-0">
                  <td className="py-3 px-4 text-sm text-secondary text-tertiary">{exp.expense_date}</td>
                  <td className="py-3 px-4 text-sm text-inverse">{exp.description}</td>
                  <td className="py-3 px-4 text-sm text-secondary text-tertiary">{EXPENSE_CATEGORIES[exp.category] ?? exp.category}</td>
                  <td className="py-3 px-4 text-right text-sm font-medium text-inverse">{formatCurrency(exp.amount, exp.currency)}</td>
                  <td className="py-3 px-4 text-sm text-secondary text-tertiary">{exp.payment_method}</td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Edit2 className="w-3.5 h-3.5" />}
                        onClick={() => handleEdit(exp)}
                        title="Edit expense"
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        onClick={() => handleDelete(exp.id)}
                        title="Delete expense"
                      />
                    </td>
                </tr>
              ))}
              {!loading && expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <p className="text-secondary text-tertiary mb-4">No expenses yet</p>
                    <Button
                      variant="primary"
                      size="md"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => {
                        setShowForm(true);
                        setEditingId(null);
                        setFormData({});
                      }}
                    >
                      Add Your First Expense
                    </Button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center text-sm text-secondary text-tertiary">
            <span>Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}</span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1"
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page * pageSize >= total}
                className="px-3 py-1"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}







