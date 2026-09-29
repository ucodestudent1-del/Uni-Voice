import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  DollarSign,
  CalendarDays,
  BarChart3,
} from "lucide-react";
import { useSubscription } from "../contexts/SubscriptionContext";
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
  ExpenseFilters,
  ExpenseDataTable,
} from "../components/expenses";

export default function Expenses() {
  const { plan } = useSubscription();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<ApiExpense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ApiExpense> | null>(null);
  const [saving, setSaving] = useState(false);

  const [summary, setSummary] = useState<ApiExpenseSummary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<ApiExpenseSummary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<ApiExpenseCategoryBreakdown[] | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<ApiExpenseMonthlyTrend[] | null>(null);
  const [budgetSettings, setBudgetSettings] = useState<ApiExpenseBudgetSettings | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [customerNameFilter, setCustomerNameFilter] = useState("");
  const [projectNameFilter, setProjectNameFilter] = useState("");
  const [billableFilter, setBillableFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [activeTab, setActiveTab] = useState<"dashboard" | "transactions">("dashboard");

  const params: ExpenseSearchParams = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      search: searchTerm || undefined,
      category: categoryFilter || undefined,
      vendor: vendorFilter || undefined,
      customerName: customerNameFilter || undefined,
      projectName: projectNameFilter || undefined,
      isBillable: billableFilter === "all" ? undefined : billableFilter === "true",
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [pageSize, page, searchTerm, categoryFilter, vendorFilter, customerNameFilter, projectNameFilter, billableFilter, dateFrom, dateTo]
  );

  const resetFilters = () => {
    setSearchTerm("");
    setCategoryFilter("");
    setVendorFilter("");
    setCustomerNameFilter("");
    setProjectNameFilter("");
    setBillableFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleFiltersChange = (newParams: ExpenseSearchParams) => {
    setSearchTerm(newParams.search ?? "");
    setCategoryFilter(newParams.category ?? "");
    setVendorFilter(newParams.vendor ?? "");
    setCustomerNameFilter(newParams.customerName ?? "");
    setProjectNameFilter(newParams.projectName ?? "");
    setBillableFilter(newParams.isBillable === undefined ? "all" : newParams.isBillable ? "true" : "false");
    setDateFrom(newParams.dateFrom ?? "");
    setDateTo(newParams.dateTo ?? "");
    setPage(1);
  };

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
        setError("Expense tracking requires a Business plan. Please upgrade to continue.");
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
      loadExpensesWithSummary();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to delete expense", { type: "error" });
    }
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
        setError("Expense tracking requires a Business plan.");
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

  const summaryCurrency = summary?.currency ?? "USD";
  const totalAmount = summary?.total_amount ?? "0";

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              <ExpenseKPICard
                title="Total Expenses"
                value={totalAmount}
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
                title="Billable Expenses"
                value={summary?.billable_amount ?? "0"}
                subtitle={`${summary?.count ?? 0} expenses`}
                icon={<DollarSign className="w-5 h-5" />}
                iconBackground="status-warning-bg status-warning-text"
                isLoading={loading}
                currency={summaryCurrency}
              />
              <ExpenseKPICard
                title="Unpaid / Reimbursable"
                value={summary?.non_reimbursed_billable ?? "0"}
                subtitle="Billable, not reimbursed"
                icon={<BarChart3 className="w-5 h-5" />}
                iconBackground="status-error-bg status-error-text"
                isLoading={loading}
                currency={summaryCurrency}
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
            <ExpenseFilters
              params={params}
              onChange={handleFiltersChange}
              onReset={resetFilters}
            />

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
      </div>
    </FeatureGate>
  );
}
