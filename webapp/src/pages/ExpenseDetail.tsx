import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  X,
  FileText,
  Download,
  Share2,
  Calendar,
  DollarSign,
  CheckCircle,
  Tag,
  User,
  Folder,
  FileImage,
} from "lucide-react";
import { getExpense, updateExpense, deleteExpense, assignExpenseToInvoice, getExpenseInvoiceOptions } from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/ToastProvider";
import {
  KPICard,
  ExpenseCategoryBadge,
  ExpenseForm,
  type ExpenseFormData,
} from "../components/expenses";
import CustomerSelector from "../components/CustomerSelector";
import ProjectSelector from "../components/ProjectSelector";
import { ConfirmationDialog } from "../components/ui";
import type { ApiExpense } from "../types/api";

interface ApiInvoiceOption {
  id: string;
  invoice_number: string;
  customer_name?: string | null;
  total: string;
  status: string;
}

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [expense, setExpense] = useState<ApiExpense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceOptions, setInvoiceOptions] = useState<ApiInvoiceOption[]>([]);
  const [loadingInvoiceOptions, setLoadingInvoiceOptions] = useState(false);
  const [assigningInvoice, setAssigningInvoice] = useState(false);

  const fetchExpense = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getExpense(id);
      setExpense(res.expense);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("Expense tracking requires a Pro plan. Please upgrade to continue.");
      } else {
        setError(err.response?.data?.error || "Failed to load expense");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchInvoiceOptions = useCallback(async () => {
    setLoadingInvoiceOptions(true);
    try {
      const res = await getExpenseInvoiceOptions();
      setInvoiceOptions(res.invoices ?? []);
    } catch (err: any) {
      console.error("Failed to load invoice options", err);
      setInvoiceOptions([]);
    } finally {
      setLoadingInvoiceOptions(false);
    }
  }, []);

  useEffect(() => {
    fetchExpense();
  }, [fetchExpense]);

  useEffect(() => {
    if (editMode) {
      fetchInvoiceOptions();
    }
  }, [editMode, fetchInvoiceOptions]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-lg bg-surface-alt animate-pulse" />
          <div className="h-7 w-48 bg-surface-alt rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-color p-5 animate-pulse">
              <div className="h-4 w-20 bg-surface-alt rounded mb-3" />
              <div className="h-8 w-32 bg-surface-alt rounded mb-2" />
              <div className="h-3 w-16 bg-surface-alt rounded" />
            </div>
          ))}
        </div>
        <div className="bg-surface rounded-xl border border-color p-6 animate-pulse">
          <div className="h-4 w-24 bg-surface-alt rounded mb-4" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-surface-alt rounded" />
            <div className="h-4 w-3/4 bg-surface-alt rounded" />
            <div className="h-4 w-1/2 bg-surface-alt rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-error-bg p-4 mb-4">
          <FileText className="w-8 h-8 text-error-text" />
        </div>
        <h3 className="text-lg font-medium text-primary mb-2">Error Loading Expense</h3>
        <p className="text-sm text-tertiary max-w-sm mb-4">{error}</p>
        <Button variant="primary" size="md" onClick={() => navigate("/app/expenses")}>
          Back to Expenses
        </Button>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="w-12 h-12 text-tertiary mb-4" />
        <h3 className="text-lg font-medium text-primary mb-2">Expense not found</h3>
        <p className="text-sm text-tertiary mb-4">The expense you're looking for doesn't exist.</p>
        <Button variant="primary" size="md" onClick={() => navigate("/app/expenses")}>
          Back to Expenses
        </Button>
      </div>
    );
  }

  const handleFormSubmit = async (formData: ExpenseFormData) => {
    if (!expense) return;
    setSaving(true);
    try {
      const updated = await updateExpense(expense.id, {
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
      setExpense(updated.expense);
      setEditMode(false);
      toast("Expense updated", { type: "success" });
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to update expense", { type: "error" });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!expense) return;
    try {
      await deleteExpense(expense.id);
      toast("Expense deleted", { type: "success" });
      navigate("/app/expenses");
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to delete expense", { type: "error" });
    }
  };

  const handleAssignInvoice = async (invoiceId: string) => {
    if (!expense) return;
    setAssigningInvoice(true);
    try {
      const res = await assignExpenseToInvoice(expense.id, invoiceId);
      setExpense(res.expense);
      toast("Expense assigned to invoice", { type: "success" });
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to assign expense to invoice", { type: "error" });
    } finally {
      setAssigningInvoice(false);
    }
  };

  const handleUnassignInvoice = async () => {
    if (!expense) return;
    setAssigningInvoice(true);
    try {
      const res = await assignExpenseToInvoice(expense.id, null);
      setExpense(res.expense);
      toast("Expense unassigned from invoice", { type: "success" });
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to unassign expense", { type: "error" });
    } finally {
      setAssigningInvoice(false);
    }
  };

  const handleBillableToggle = async () => {
    if (!expense) return;
    setSaving(true);
    try {
      const res = await updateExpense(expense.id, { isBillable: !expense.is_billable });
      setExpense(res.expense);
      toast(expense.is_billable ? "Marked as not billable" : "Marked as billable", { type: "success" });
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to update expense", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const summary = {
    totalAmount: expense.amount ?? "0",
    billableAmount: expense.is_billable ? (expense.amount ?? "0") : "0",
    reimbursedAmount: expense.is_reimbursed ? (expense.amount ?? "0") : "0",
    nonReimbursedBillable: expense.is_billable && !expense.is_reimbursed
      ? (expense.amount ?? "0")
      : "0",
    count: 1,
    currency: expense.currency ?? "USD",
    periodStart: null,
    periodEnd: null,
  };

  const isAssignedToInvoice = !!expense.invoice_id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/app/expenses">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-primary">Expense Details</h1>
            <p className="text-sm text-tertiary mt-0.5">
              {expense.description}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<Edit2 className="w-4 h-4" />}
                onClick={() => setEditMode(true)}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => setDeleteDialogOpen(true)}
              >
                Delete
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              icon={<X className="w-4 h-4" />}
              onClick={() => setEditMode(false)}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      <ExpenseForm
        open={editMode}
        onClose={() => setEditMode(false)}
        editingId={expense.id}
        initialData={expense}
        saving={saving}
        onSubmit={handleFormSubmit}
      />

      {!editMode && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <KPICard
              title="Total Amount"
              value={summary.totalAmount}
              icon={<DollarSign className="w-5 h-5" />}
              iconBackground="status-info-bg status-info-text"
              currency={summary.currency}
            />
            <KPICard
              title="Billable Amount"
              value={summary.billableAmount}
              icon={<DollarSign className="w-5 h-5" />}
              iconBackground="status-warning-bg status-warning-text"
              currency={summary.currency}
              subtitle={expense.is_billable ? "Billable" : "Not billable"}
            />
            <KPICard
              title="Reimbursed"
              value={summary.reimbursedAmount}
              icon={<CheckCircle className="w-5 h-5" />}
              iconBackground="status-success-bg status-success-text"
              currency={summary.currency}
              subtitle={expense.is_reimbursed ? "Reimbursed" : "Not reimbursed"}
            />
            <KPICard
              title="Outstanding"
              value={summary.nonReimbursedBillable}
              icon={<Tag className="w-5 h-5" />}
              iconBackground="status-error-bg status-error-text"
              currency={summary.currency}
              subtitle="Billable, not reimbursed"
            />
          </div>

          <div className="bg-surface rounded-xl border border-color">
            <div className="px-6 py-4 border-b border-color-subtle">
              <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                <FileText className="w-5 h-5 text-tertiary" />
                Expense Details
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-tertiary uppercase tracking-wide mb-1.5">
                    Expense Date
                  </label>
                  <p className="text-sm text-primary flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-tertiary" />
                    {formatDate(expense.expense_date)}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-tertiary uppercase tracking-wide mb-1.5">
                    Vendor
                  </label>
                  <p className="text-sm text-primary flex items-center gap-2">
                    <Tag className="w-4 h-4 text-tertiary" />
                    {expense.vendor || "—"}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-tertiary uppercase tracking-wide mb-1.5">
                    Category
                  </label>
                  <ExpenseCategoryBadge category={expense.category} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-tertiary uppercase tracking-wide mb-1.5">
                    Payment Method
                  </label>
                  <p className="text-sm text-primary">
                    {expense.payment_method
                      ? expense.payment_method.charAt(0).toUpperCase() + expense.payment_method.slice(1).replace("_", " ")
                      : "—"}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-tertiary uppercase tracking-wide mb-1.5">
                    Billable
                  </label>
                  <span
                    className={
                      expense.is_billable
                        ? "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium status-success-bg status-success-text"
                        : "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium status-tertiary-bg status-tertiary-text"
                    }
                  >
                    {expense.is_billable ? "Yes" : "No"}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-tertiary uppercase tracking-wide mb-1.5">
                    Reimbursed
                  </label>
                  <span
                    className={
                      expense.is_reimbursed
                        ? "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium status-success-bg status-success-text"
                        : "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium status-tertiary-bg status-tertiary-text"
                    }
                  >
                    {expense.is_reimbursed ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-tertiary uppercase tracking-wide mb-1.5">
                  Description
                </label>
                <p className="text-sm text-primary">{expense.description}</p>
              </div>

              {expense.notes && (
                <div>
                  <label className="block text-xs font-medium text-tertiary uppercase tracking-wide mb-1.5">
                    Notes
                  </label>
                  <p className="text-sm text-primary whitespace-pre-wrap">{expense.notes}</p>
                </div>
              )}

              {expense.customer_id && (
                <div>
                  <label className="block text-xs font-medium text-tertiary uppercase tracking-wide mb-1.5">
                    Customer
                  </label>
                  <p className="text-sm text-primary flex items-center gap-2">
                    <User className="w-4 h-4 text-tertiary" />
                    {expense.customer_name || expense.customer_id}
                  </p>
                </div>
              )}

              {expense.project_id && (
                <div>
                  <label className="block text-xs font-medium text-tertiary uppercase tracking-wide mb-1.5">
                    Project
                  </label>
                  <p className="text-sm text-primary flex items-center gap-2">
                    <Folder className="w-4 h-4 text-tertiary" />
                    {expense.project_name || expense.project_id}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-color">
            <div className="px-6 py-4 border-b border-color-subtle">
              <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                <FileImage className="w-5 h-5 text-tertiary" />
                Receipt
              </h2>
            </div>
            <div className="p-6">
              {expense.receipt_url ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <a
                      href={expense.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-brand hover:underline flex items-center gap-2"
                    >
                      <FileImage className="w-4 h-4" />
                      View receipt
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Download className="w-4 h-4" />}
                      onClick={() => window.open(expense.receipt_url!, "_blank")}
                    >
                      Download
                    </Button>
                  </div>
                  <div className="border border-color-subtle rounded-lg overflow-hidden">
                    {expense.receipt_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img
                        src={expense.receipt_url}
                        alt="Receipt"
                        className="w-full h-64 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "";
                        }}
                      />
                    ) : (
                      <iframe
                        src={expense.receipt_url}
                        title="Receipt"
                        className="w-full h-64"
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-tertiary">
                  <FileImage className="w-12 h-12 mx-auto mb-3 text-tertiary" />
                  <p className="text-sm font-medium text-secondary mb-1">No receipt uploaded</p>
                  <p className="text-xs text-tertiary mb-4">
                    You can upload a receipt when editing this expense.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-color">
            <div className="px-6 py-4 border-b border-color-subtle">
              <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                <Share2 className="w-5 h-5 text-tertiary" />
                Invoice Assignment
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {expense.is_billable && (
                <div className="flex items-center justify-between p-4 bg-surface-alt rounded-lg border border-color-subtle">
                  <div>
                    <p className="text-xs font-medium text-tertiary uppercase">Billable Status</p>
                    <p className="text-sm text-primary mt-0.5">
                      {expense.is_billable ? "This expense is marked as billable" : "Not billable"}
                    </p>
                    <p className="text-xs text-tertiary mt-1">
                      {expense.is_reimbursed
                        ? "Already reimbursed"
                        : "Will be billed to the customer"}
                    </p>
                  </div>
                  <Button
                    variant={expense.is_billable ? "secondary" : "primary"}
                    size="sm"
                    onClick={handleBillableToggle}
                    disabled={saving}
                  >
                    {expense.is_billable ? "Mark Not Billable" : "Mark Billable"}
                  </Button>
                </div>
              )}

              {isAssignedToInvoice ? (
                <div className="flex items-center justify-between p-4 bg-surface-alt rounded-lg border border-color-subtle">
                  <div>
                    <p className="text-xs font-medium text-tertiary uppercase">Assigned to Invoice</p>
                    <p className="text-sm text-primary mt-0.5 font-medium">
                      {expense.invoice_number || expense.invoice_id}
                    </p>
                    {expense.invoice_status && (
                      <p className="text-xs text-tertiary mt-0.5">Status: {expense.invoice_status}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/app/invoices/${expense.invoice_id}`}>
                      <Button variant="secondary" size="sm">
                        View Invoice
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUnassignInvoice}
                      disabled={assigningInvoice}
                    >
                      Unassign
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-color-subtle border-dashed rounded-lg">
                  <p className="text-xs font-medium text-tertiary uppercase mb-3">
                    Assign to Invoice
                  </p>
                  {loadingInvoiceOptions ? (
                    <p className="text-sm text-tertiary">Loading invoices…</p>
                  ) : invoiceOptions.length === 0 ? (
                    <p className="text-sm text-tertiary">
                      No draft or sent invoices available for assignment.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {invoiceOptions.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-color-subtle hover:bg-surface-alt transition-colors cursor-pointer"
                          onClick={() => handleAssignInvoice(inv.id)}
                        >
                          <div>
                            <p className="text-sm font-medium text-primary">
                              {inv.invoice_number}
                            </p>
                            {inv.customer_name && (
                              <p className="text-xs text-tertiary">{inv.customer_name}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-tabular-nums text-primary">
                              {formatCurrency(inv.total, expense.currency ?? "USD")}
                            </p>
                            <p className="text-xs text-tertiary">{inv.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {assigningInvoice && (
                    <p className="text-xs text-tertiary mt-2">Assigning…</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-color">
            <div className="px-6 py-4 border-b border-color-subtle">
              <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                <User className="w-5 h-5 text-tertiary" />
                Client & Project
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <CustomerSelector
                value={expense.customer_id ?? undefined}
                onChange={async (customerId) => {
                  setSaving(true);
                  try {
                    const res = await updateExpense(expense.id, {
                      customerId: customerId ?? null,
                    });
                    setExpense(res.expense);
                    toast("Customer assigned", { type: "success" });
                  } catch (err: any) {
                    toast(err.response?.data?.error || "Failed to update customer", { type: "error" });
                  } finally {
                    setSaving(false);
                  }
                }}
                placeholder="Select a customer"
              />
              <ProjectSelector
                value={expense.project_id ?? undefined}
                onChange={async (projectId) => {
                  setSaving(true);
                  try {
                    const res = await updateExpense(expense.id, {
                      projectId: projectId ?? null,
                    });
                    setExpense(res.expense);
                    toast("Project assigned", { type: "success" });
                  } catch (err: any) {
                    toast(err.response?.data?.error || "Failed to update project", { type: "error" });
                  } finally {
                    setSaving(false);
                  }
                }}
                placeholder="Select a project"
              />
            </div>
          </div>
        </>
      )}

      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => handleDelete()}
        title="Delete Expense"
        message={`Are you sure you want to delete "${expense.description}"? This action cannot be undone.`}
        confirmLabel="Delete Expense"
        cancelLabel="Cancel"
        destructive
      />
    </div>
  );
}
