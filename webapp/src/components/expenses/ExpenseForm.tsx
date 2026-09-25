import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EXPENSE_CATEGORY_OPTIONS } from "./ExpenseCategoryBadge";
import type { ApiExpense } from "@/types/api";
import { useToast } from "@/components/ui/ToastProvider";

export interface ExpenseFormData {
  description: string;
  amount: string;
  category: string;
  expense_date: string;
  payment_method: string;
  receipt_url: string;
  notes: string;
  is_billable: boolean;
  is_reimbursed: boolean;
}

export interface ExpenseFormProps {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
  initialData?: Partial<ApiExpense> | null;
  saving?: boolean;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
}

const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "check", "other"];

export default function ExpenseForm({
  open,
  onClose,
  editingId,
  initialData,
  saving = false,
  onSubmit,
}: ExpenseFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<ExpenseFormData>({
    description: "",
    amount: "",
    category: "other",
    expense_date: new Date().toISOString().slice(0, 10),
    payment_method: "cash",
    receipt_url: "",
    notes: "",
    is_billable: false,
    is_reimbursed: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && initialData) {
      setFormData({
        description: initialData.description ?? "",
        amount: initialData.amount ?? "",
        category: initialData.category ?? "other",
        expense_date: initialData.expense_date
          ? new Date(initialData.expense_date).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        payment_method: initialData.payment_method ?? "cash",
        receipt_url: initialData.receipt_url ?? "",
        notes: initialData.notes ?? "",
        is_billable: initialData.is_billable ?? false,
        is_reimbursed: initialData.is_reimbursed ?? false,
      });
      setErrors({});
    }
  }, [open, initialData]);

  if (!open) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }
    if (!formData.amount || parseFloat(formData.amount) < 0) {
      newErrors.amount = "Amount must be a positive number";
    }
    if (!formData.expense_date) {
      newErrors.expense_date = "Date is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (saving) return;

    try {
      await onSubmit(formData);
    } catch (err: any) {
      const msg =
        err.response?.data?.error || "Failed to save expense";
      toast(msg, { type: "error" });
      setErrors({ submit: msg });
    }
  };

  const handleClose = () => {
    setFormData({
      description: "",
      amount: "",
      category: "other",
      expense_date: new Date().toISOString().slice(0, 10),
      payment_method: "cash",
      receipt_url: "",
      notes: "",
      is_billable: false,
      is_reimbursed: false,
    });
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-overlay flex items-center justify-center overflow-y-auto py-8">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl mx-4 my-8 border border-color">
        <div className="flex items-center justify-between p-6 border-b border-color-subtle">
          <h3 className="text-lg font-semibold text-primary">
            {editingId ? "Edit Expense" : "Add New Expense"}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-tertiary hover:text-primary hover:bg-surface-alt transition-colors"
            aria-label="Close"
            disabled={saving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errors.submit && (
            <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm text-error-text">
              {errors.submit}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className={`w-full rounded-lg border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.description ? "border-error" : "border-input-border"
              }`}
              placeholder="What was this expense for?"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-error-text">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Amount *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className={`w-full rounded-lg border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary font-tabular-nums ${
                  errors.amount ? "border-error" : "border-input-border"
                }`}
                placeholder="0.00"
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-error-text">{errors.amount}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {EXPENSE_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.icon} {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Date *
              </label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={(e) =>
                  setFormData({ ...formData, expense_date: e.target.value })
                }
                className={`w-full rounded-lg border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.expense_date ? "border-error" : "border-input-border"
                }`}
              />
              {errors.expense_date && (
                <p className="mt-1 text-xs text-error-text">{errors.expense_date}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Payment Method
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) =>
                  setFormData({ ...formData, payment_method: e.target.value })
                }
                className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.charAt(0).toUpperCase() + m.slice(1).replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Receipt URL
            </label>
            <input
              type="url"
              value={formData.receipt_url}
              onChange={(e) =>
                setFormData({ ...formData, receipt_url: e.target.value })
              }
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={2}
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Additional details..."
            />
          </div>

          <div className="flex gap-6 pt-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_billable}
                onChange={(e) =>
                  setFormData({ ...formData, is_billable: e.target.checked })
                }
                className="rounded border-input-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-secondary">Billable</span>
            </label>
            {editingId && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_reimbursed}
                  onChange={(e) =>
                    setFormData({ ...formData, is_reimbursed: e.target.checked })
                  }
                  className="rounded border-input-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-secondary">Reimbursed</span>
              </label>
            )}
          </div>
        </form>

        <div className="flex justify-end gap-3 p-6 border-t border-color-subtle">
          <Button
            variant="secondary"
            size="md"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={saving || !formData.description || !formData.amount}
            onClick={(e) => handleSubmit(e)}
          >
            {saving ? "Saving…" : editingId ? "Update" : "Save Expense"}
          </Button>
        </div>
      </div>
    </div>
  );
}
