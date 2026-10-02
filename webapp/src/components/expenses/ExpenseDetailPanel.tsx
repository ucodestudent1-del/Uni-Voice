import {
  X,
  Edit2,
  Trash2,
  Copy,
  Calendar,
  DollarSign,
  Tag,
  User,
  Folder,
  FileImage,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import ExpenseCategoryBadge from "./ExpenseCategoryBadge";
import type { ApiExpense } from "@/types/api";
import { formatDate } from "@/utils/format";
import { formatCurrencyValue } from "@/lib/utils";
import { Money } from "@/components/ui";

export interface ExpenseDetailPanelProps {
  expense: ApiExpense | null;
  open: boolean;
  onClose: () => void;
  onEdit: (expense: ApiExpense) => void;
  onDelete: (expense: ApiExpense) => void;
  onDuplicate?: (expense: ApiExpense) => void;
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

const REIMBURSEMENT_STATUS: Record<string, { label: string; className: string }> = {
  billable: {
    label: "Billable",
    className:
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium status-warning-bg status-warning-text",
  },
  reimbursable_not_submitted: {
    label: "Needs Reimbursement",
    className:
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium status-error-bg status-error-text",
  },
  submitted: {
    label: "Submitted",
    className:
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium status-info-bg status-info-text",
  },
  reimbursed: {
    label: "Reimbursed",
    className:
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium status-success-bg status-success-text",
  },
  paid: {
    label: "Paid",
    className:
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium status-tertiary-bg status-tertiary-text",
  },
};

function ExpenseStatusBadge({ expense }: { expense: ApiExpense }) {
  let key: string;
  if (expense.is_reimbursed) {
    key = "reimbursed";
  } else if (expense.is_reimbursable) {
    key = "reimbursable_not_submitted";
  } else if (expense.is_billable) {
    key = "billable";
  } else {
    key = "paid";
  }

  const config = REIMBURSEMENT_STATUS[key];
  return (
    <span className={config.className}>
      {config.label}
    </span>
  );
}

export default function ExpenseDetailPanel({
  expense,
  open,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
  loading = false,
}: ExpenseDetailPanelProps) {
  if (!open || !expense) return null;

  const currency = expense.currency ?? "USD";
  const amount = (
    <Money amount={expense.amount} currency={currency} className="text-2xl font-bold" />
  );
  const taxAmount = expense.tax_amount
    ? formatCurrencyValue(expense.tax_amount, currency)
    : null;

  const isImage = (url: string): boolean => {
    return url.match(/\.(jpg|jpeg|png|gif|webp)$/i) !== null;
  };

  const isPdf = (url: string): boolean => {
    return url.match(/\.(pdf)$/i) !== null;
  };

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
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-info-bg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-info-text" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-primary truncate">
                {expense.vendor || "Expense Details"}
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

            {taxAmount && (
              <DetailRow label="Tax Amount" icon={<DollarSign className="w-4 h-4 text-tertiary" />}>
                <p className="text-sm text-primary font-tabular-nums">
                  {taxAmount}
                </p>
              </DetailRow>
            )}

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
              <ExpenseStatusBadge expense={expense} />
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
          </div>

          {expense.receipt_url && (
            <DetailRow label="Receipt" icon={<FileImage className="w-4 h-4 text-tertiary" />}>
              <div className="border border-color-subtle rounded-lg overflow-hidden">
                {isImage(expense.receipt_url) ? (
                  <img
                    src={expense.receipt_url}
                    alt="Receipt"
                    className="w-full max-h-64 object-contain bg-surface-alt"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : isPdf(expense.receipt_url) ? (
                  <div className="p-8 text-center">
                    <FileImage className="w-16 h-16 text-tertiary mx-auto mb-4" />
                    <p className="text-sm text-secondary">PDF Receipt</p>
                  </div>
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
                  <ExternalLink className="w-4 h-4" />
                  View receipt
                </a>
              </div>
            </DetailRow>
          )}

          {expense.invoice_id && (
            <DetailRow label="Assigned Invoice" icon={<AlertCircle className="w-4 h-4 text-tertiary" />}>
              <p className="text-sm text-primary font-medium">
                {expense.invoice_number || expense.invoice_id}
              </p>
              {expense.invoice_status && (
                <p className="text-xs text-tertiary mt-0.5">
                  Status: {expense.invoice_status}
                </p>
              )}
            </DetailRow>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-color-subtle">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => onDelete(expense)}
              disabled={loading}
            >
              Delete
          </Button>
            {onDuplicate && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Copy className="w-4 h-4" />}
                onClick={() => onDuplicate(expense)}
                disabled={loading}
              >
                Duplicate
              </Button>
            )}
          </div>
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
