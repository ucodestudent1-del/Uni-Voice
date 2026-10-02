import {
  X,
  Edit2,
  Trash2,
  Calendar,
  DollarSign,
  Tag,
  User,
  Folder,
  FileImage,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import ExpenseCategoryBadge from "./ExpenseCategoryBadge";
import type { ApiExpense } from "@/types/api";
import { formatDate } from "@/utils/format";
import { Money } from "@/components/ui";

export interface ExpenseDetailPanelProps {
  expense: ApiExpense | null;
  open: boolean;
  onClose: () => void;
  onEdit: (expense: ApiExpense) => void;
  onDelete: (expense: ApiExpense) => void;
  onSave?: (expense: ApiExpense) => void;
  loading?: boolean;
}

function DetailRow({
  label,
  children,
  icon,
}: {
  label: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-tertiary uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusBadge({
  isBillable,
  isReimbursed,
}: {
  isBillable: boolean;
  isReimbursed: boolean;
}) {
  let label: string;
  let className: string;

  if (isReimbursed) {
    label = "Reimbursed";
    className =
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium status-success-bg status-success-text";
  } else if (isBillable) {
    label = "Billable";
    className =
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium status-warning-bg status-warning-text";
  } else {
    label = "Paid";
    className =
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium status-tertiary-bg status-tertiary-text";
  }

  return <span className={className}>{label}</span>;
}

export default function ExpenseDetailPanel({
  expense,
  open,
  onClose,
  onEdit,
  onDelete,
  loading = false,
}: ExpenseDetailPanelProps) {
  if (!open || !expense) return null;

  const currency = expense.currency ?? "USD";
  const amount = <Money amount={expense.amount} currency={currency} className="text-2xl font-bold" />;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-surface border-l border-color shadow-xl flex flex-col overflow-y-auto transition-transform duration-200 ease-in-out"
        aria-label="Expense detail panel"
      >
        <div className="flex items-center justify-between p-6 border-b border-color-subtle">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-info-bg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-info-text" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">
                Expense Details
              </h2>
              <p className="text-sm text-tertiary mt-0.5 line-clamp-1">
                {expense.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-tertiary hover:text-primary hover:bg-surface-alt transition-colors"
            aria-label="Close panel"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <DetailRow label="Amount" icon={<DollarSign className="w-4 h-4 text-tertiary" />}>
              <p className="text-sm text-primary font-tabular-nums">
                {amount}
              </p>
            </DetailRow>

            <DetailRow label="Date" icon={<Calendar className="w-4 h-4 text-tertiary" />}>
              <p className="text-sm text-primary">
                {formatDate(expense.expense_date) || "—"}
              </p>
            </DetailRow>

            <DetailRow label="Vendor" icon={<Tag className="w-4 h-4 text-tertiary" />}>
              <p className="text-sm text-primary">
                {expense.vendor || "—"}
              </p>
            </DetailRow>

            <DetailRow label="Category" icon={<Tag className="w-4 h-4 text-tertiary" />}>
              <ExpenseCategoryBadge category={expense.category} />
            </DetailRow>

            <DetailRow label="Payment Method" icon={<DollarSign className="w-4 h-4 text-tertiary" />}>
              <p className="text-sm text-primary">
                {expense.payment_method
                  ? expense.payment_method
                      .charAt(0)
                      .toUpperCase() +
                    expense.payment_method.slice(1).replace("_", " ")
                  : "—"}
              </p>
            </DetailRow>

            <DetailRow label="Status" icon={<CheckCircle className="w-4 h-4 text-tertiary" />}>
              <StatusBadge
                isBillable={expense.is_billable}
                isReimbursed={expense.is_reimbursed}
              />
            </DetailRow>
          </div>

          <DetailRow label="Description">
            <p className="text-sm text-primary break-words">
              {expense.description || "—"}
            </p>
          </DetailRow>

          {expense.notes && (
            <DetailRow label="Notes">
              <p className="text-sm text-primary whitespace-pre-wrap break-words">
                {expense.notes}
              </p>
            </DetailRow>
          )}

          {expense.receipt_url && (
            <DetailRow label="Receipt" icon={<FileImage className="w-4 h-4 text-tertiary" />}>
              <div className="border border-color-subtle rounded-lg overflow-hidden">
                {expense.receipt_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img
                    src={expense.receipt_url}
                    alt="Receipt"
                    className="w-full max-h-64 object-contain bg-surface-alt"
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
              <div className="mt-2">
                <a
                  href={expense.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-brand hover:underline flex items-center gap-2"
                >
                  <FileImage className="w-4 h-4" />
                  View receipt
                </a>
              </div>
            </DetailRow>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {expense.customer_id && (
              <DetailRow label="Customer" icon={<User className="w-4 h-4 text-tertiary" />}>
                <p className="text-sm text-primary flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-tertiary" />
                  {expense.customer_name || expense.customer_id}
                </p>
              </DetailRow>
            )}

            {expense.project_id && (
              <DetailRow label="Project" icon={<Folder className="w-4 h-4 text-tertiary" />}>
                <p className="text-sm text-primary flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-tertiary" />
                  {expense.project_name || expense.project_id}
                </p>
              </DetailRow>
            )}

            {expense.invoice_id && (
              <DetailRow label="Assigned Invoice" icon={<AlertCircle className="w-4 h-4 text-tertiary" />}>
                <p className="text-sm text-primary font-medium">
                  {expense.invoice_number || expense.invoice_id}
                </p>
              </DetailRow>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-color-subtle">
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={() => onDelete(expense)}
            disabled={loading}
          >
            Delete
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={loading}
            >
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Edit2 className="w-4 h-4" />}
              onClick={() => onEdit(expense)}
              disabled={loading}
            >
              Edit
          </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
