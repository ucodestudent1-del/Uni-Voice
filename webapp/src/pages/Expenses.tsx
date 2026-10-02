import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  CalendarDays,
  DollarSign,
  BarChart3,
  FileText,
  Download,
  X,
} from "lucide-react";
import {
  getExpensesWithSummary,
  getExpenseSummary,
  getExpenseCategoryBreakdown,
  getExpenseMonthlyTrend,
  getExpenseBudgetSettings,
  createExpense,
  updateExpense,
  deleteExpense,
  type ExpenseSearchParams,
} from "../api/client";
import FeatureGate from "../components/FeatureGate";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/ToastProvider";
import type { ApiExpense, ApiExpenseSummary } from "../types/api";
import type { ApiExpenseCategoryBreakdown, ApiExpenseMonthlyTrend, ApiExpenseBudgetSettings } from "../types/expenses";
import {
  KPICard as ExpenseKPICard,
  ExpenseCategoryChart,
  ExpenseTrendChart,
  BudgetProgress,
  ExpenseForm,
  type ExpenseFormData,
  ExpenseDataTable,
  ExpenseDetailPanel,
} from "../components/expenses";
import { EXPENSE_CATEGORY_OPTIONS } from "../components/expenses/ExpenseCategoryBadge";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";

const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "check", "other"];

export default function Expenses() {
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<ApiExpense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ApiExpense> | null>(null);
  const [saving, setSaving] = useState(false);

  const [panelExpense, setPanelExpense] = useState<ApiExpense | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [summary, setSummary] = useState<ApiExpenseSummary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<ApiExpenseSummary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<ApiExpenseCategoryBreakdown[] | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<ApiExpenseMonthlyTrend[] | null>(null);
  const [budgetSettings, setBudgetSettings] = useState<ApiExpenseBudgetSettings | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [activeTab, setActiveTab] = useState<"dashboard" | "transactions">("transactions");

  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSetSearch(e.target.value);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(e.target.value);
    setPage(1);
  };

  const handlePaymentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPaymentFilter(e.target.value);
    setPage(1);
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateFrom(e.target.value);
    setPage(1);
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateTo(e.target.value);
    setPage(1);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setCategoryFilter("");
    setPaymentFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const params: ExpenseSearchParams = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      search: searchTerm || undefined,
      category: categoryFilter || undefined,
      paymentMethod: paymentFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [pageSize, page, searchTerm, categoryFilter, paymentFilter, dateFrom, dateTo]
  );

  const loadExpensesWithSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getExpensesWithSummary(params);
      setExpenses(data.expenses ?? []);
      setTotal(data.total ?? 0);
      setSummary(data.summary ?? null);

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date();
      monthEnd.setHours(23, 59, 59, 999);

      const monthlyRes = await getExpenseSummary({
        dateFrom: monthStart.toISOString().split("T")[0],
        dateTo: monthEnd.toISOString().split("T")[0],
      });
      setMonthlySummary(monthlyRes.summary ?? null);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("Expense tracking requires a Pro plan. Please upgrade to continue.");
      } else {
        setError(err.response?.data?.error || "Failed to load expenses");
      }
      setExpenses([]);
      setTotal(0);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  const loadAnalytics = useCallback(async () => {
    try {
      const [categoryRes, trendRes, budgetRes] = await Promise.all([
        getExpenseCategoryBreakdown({ dateFrom, dateTo }).catch(() => ({ breakdown: [] })),
        getExpenseMonthlyTrend({ months: 12, dateFrom, dateTo }).catch(() => ({ trend: [] })),
        getExpenseBudgetSettings().catch(() => ({ budget: null })),
      ]);
      setCategoryBreakdown(categoryRes.breakdown ?? []);
      setMonthlyTrend(trendRes.trend ?? []);
      setBudgetSettings(budgetRes.budget ?? null);
    } catch {
      // Individual errors are already caught above
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadExpensesWithSummary();
  }, [loadExpensesWithSummary]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const summaryCurrency = summary?.currency ?? "USD";

  const handleEdit = (expense: ApiExpense) => {
    setEditingId(expense.id);
    setFormData({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      expense_date: expense.expense_date,
      payment_method: expense.payment_method,
      vendor: expense.vendor ?? "",
      customer_id: expense.customer_id ?? null,
      project_id: expense.project_id ?? null,
      receipt_url: expense.receipt_url ?? "",
      notes: expense.notes ?? "",
      is_billable: expense.is_billable,
      is_reimbursed: expense.is_reimbursed,
    });
    setShowForm(true);
  };

  const handleDelete = async (expense: ApiExpense) => {
    if (!confirm(`Delete "${expense.description}"?`)) return;
    try {
      await deleteExpense(expense.id);
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
      setTotal((prev) => prev - 1);
      toast("Expense deleted", { type: "info" });
      setPanelOpen(false);
      setPanelExpense(null);
      loadExpensesWithSummary();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to delete expense", { type: "error" });
    }
  };

  const handleRowClick = (expense: ApiExpense) => {
    setPanelExpense(expense);
    setPanelOpen(true);
  };

  const handlePanelClose = () => {
    setPanelOpen(false);
    setPanelExpense(null);
  };

  const handlePanelEdit = (expense: ApiExpense) => {
    handleEdit(expense);
    handlePanelClose();
  };

  const handlePanelDelete = (expense: ApiExpense) => {
    handleDelete(expense);
  };

  const handleFormSubmit = async (formData: ExpenseFormData) => {
    if (!formData.description || !formData.amount) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateExpense(editingId, {
          description: formData.description,
          amount: formData.amount,
          category: (formData.category ?? "other") as ApiExpense["category"],
          expenseDate: formData.expense_date,
          paymentMethod: formData.payment_method,
          vendor: formData.vendor || null,
          customerId: formData.customer_id,
          projectId: formData.project_id,
          receiptUrl: formData.receipt_url || null,
          notes: formData.notes || null,
          isBillable: formData.is_billable,
          isReimbursed: formData.is_reimbursed,
        });
        toast("Expense updated", { type: "success" });
      } else {
        await createExpense({
          description: formData.description,
          amount: formData.amount,
          category: (formData.category ?? "other") as ApiExpense["category"],
          expenseDate: formData.expense_date ?? new Date().toISOString().split("T")[0],
          paymentMethod: formData.payment_method ?? "cash",
          vendor: formData.vendor || null,
          customerId: formData.customer_id,
          projectId: formData.project_id,
          receiptUrl: formData.receipt_url || null,
          notes: formData.notes || null,
          isBillable: formData.is_billable,
        });
        toast("Expense added", { type: "success" });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData(null);
      loadExpensesWithSummary();
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("Expense tracking requires a Pro plan.");
      } else {
        setError(err.response?.data?.error || "Failed to save expense");
      }
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(null);
  };

  const exportToCsv = () => {
    if (!expenses.length) return;
    const headers = ["Date", "Description", "Category", "Vendor", "Payment Method", "Amount", "Billable", "Reimbursed"];
    const rows = expenses.map((e) => [
      e.expense_date,
      e.description,
      e.category,
      e.vendor ?? "",
      e.payment_method,
      e.amount,
      e.is_billable ? "Yes" : "No",
      e.is_reimbursed ? "Yes" : "No",
    ]);
    const csvContent = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `expenses-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <FeatureGate feature="expenses.tracking" requiredPlan="pro">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Expenses</h1>
            <p className="text-sm text-secondary mt-0.5">
              Track, categorize, and manage your business spending.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setFormData(null);
            }}
          >
            Add Expense
          </Button>
        </div>

        {error && (
          <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text">{error}</div>
        )}

        <div className="flex gap-2 border-b border-color-subtle">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "dashboard"
                ? "border-primary text-primary"
                : "border-transparent text-tertiary hover:text-primary"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "transactions"
                ? "border-primary text-primary"
                : "border-transparent text-tertiary hover:text-primary"
            }`}
          >
            Transactions
          </button>
        </div>

        {activeTab === "dashboard" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <ExpenseKPICard
                title="Total Expenses"
                value={summary?.total_amount ?? "0"}
                icon={<DollarSign className="w-5 h-5" />}
                iconBackground="status-info-bg status-info-text"
                isLoading={loading}
                currency={summaryCurrency}
              />
              <ExpenseKPICard
                title="This Month"
                value={monthlySummary?.total_amount ?? "0"}
                subtitle={`${monthlySummary?.count ?? 0} expenses`}
                icon={<CalendarDays className="w-5 h-5" />}
                iconBackground="status-primary-bg text-on-primary"
                isLoading={loading}
                currency={summaryCurrency}
              />
              <ExpenseKPICard
                title="Outstanding"
                value={summary?.non_reimbursed_billable ?? "0"}
                subtitle="Billable, not reimbursed"
                icon={<BarChart3 className="w-5 h-5" />}
                iconBackground="status-error-bg status-error-text"
                isLoading={loading}
                currency={summaryCurrency}
              />
              <ExpenseKPICard
                title="Expenses"
                value={summary?.count ?? 0}
                icon={<FileText className="w-5 h-5" />}
                iconBackground="status-tertiary-bg status-tertiary-text"
                isLoading={loading}
              />
            </div>

            <BudgetProgress summary={summary} budget={budgetSettings} loading={loading} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ExpenseCategoryChart
                data={categoryBreakdown}
                currency={summaryCurrency}
                loading={loading}
              />
              <ExpenseTrendChart
                data={monthlyTrend}
                currency={summaryCurrency}
                loading={loading}
              />
            </div>
          </>
        )}

        {activeTab === "transactions" && (
          <>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-tertiary mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
                  <input
                    type="text"
                    placeholder="Search description or notes..."
                    defaultValue={searchTerm}
                    onChange={handleSearchChange}
                    className="search-input"
                  />
                </div>
              </div>

              <div className="min-w-[160px]">
                <label className="block text-xs font-medium text-tertiary mb-1">
                  Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={handleCategoryChange}
                  className="form-select"
                >
                  <option value="">All Categories</option>
                  {EXPENSE_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[160px]">
                <label className="block text-xs font-medium text-tertiary mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentFilter}
                  onChange={handlePaymentChange}
                  className="form-select"
                >
                  <option value="">All Methods</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m.charAt(0).toUpperCase() + m.slice(1).replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[140px]">
                <label className="block text-xs font-medium text-tertiary mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={handleDateFromChange}
                  className="form-control"
                />
              </div>

              <div className="min-w-[140px]">
                <label className="block text-xs font-medium text-tertiary mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={handleDateToChange}
                  className="form-control"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  icon={<Download className="w-4 h-4" />}
                  onClick={exportToCsv}
                  disabled={!expenses.length}
                >
                  Export
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<X className="w-4 h-4" />}
                  onClick={resetFilters}
                  disabled={!searchTerm && !categoryFilter && !paymentFilter && !dateFrom && !dateTo}
                >
                  Clear
                </Button>
              </div>
            </div>

            <ExpenseDataTable
              expenses={expenses}
              total={total}
              pageSize={pageSize}
              currentPage={page}
              loading={loading}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRowClick={handleRowClick}
            />
          </>
        )}

        <ExpenseForm
          open={showForm}
          onClose={handleFormClose}
          editingId={editingId}
          initialData={formData}
          saving={saving}
          onSubmit={handleFormSubmit}
        />

        <ExpenseDetailPanel
          expense={panelExpense}
          open={panelOpen}
          onClose={handlePanelClose}
          onEdit={handlePanelEdit}
          onDelete={handlePanelDelete}
          loading={saving}
        />
      </div>
    </FeatureGate>
  );
}
