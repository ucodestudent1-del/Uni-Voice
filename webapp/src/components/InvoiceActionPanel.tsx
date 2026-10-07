import React from "react";
import { useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  Download,
  Send,
  Copy,
  Mail,
  Smartphone,
  FileText,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "./ui/Button";
import { StatusBadge, invoiceStatusConfig, isOverdueStatus } from "./ui";
import type { ApiInvoice } from "../types/api";
import { formatCurrencyValue } from "../lib/utils";
import { formatDate } from "../utils/format";

export interface InvoiceActionPanelProps {
  invoice: ApiInvoice;
  onDownloadPdf?: () => void;
  onSendReminder?: () => void;
  onRecordPayment?: () => void;
  onCopyPaymentLink?: () => void;
  onSendSms?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onCancel?: () => void;
  onVoid?: () => void;
  onGenerateReceipt?: () => void;
  className?: string;
}

function daysOverdue(dueDate: string | undefined | null): number | null {
  if (!dueDate) return null;
  return Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
}

export default React.memo(function InvoiceActionPanel({
  invoice,
  onDownloadPdf,
  onSendReminder,
  onRecordPayment,
  onCopyPaymentLink,
  onSendSms,
  onEdit,
  onDuplicate,
  onCancel,
  onVoid,
  onGenerateReceipt,
  className,
}: InvoiceActionPanelProps) {
  const navigate = useNavigate();
  const isOverdue = isOverdueStatus(invoice.status, invoice.due_date);
  const isFullyPaid = new Decimal(invoice.amount_due ?? 0).lte(0) && invoice.status === "paid";
  const canEdit = !invoice.is_finalized;
  const canCancel = ["draft", "sent", "viewed"].includes(invoice.status);
  const canVoid = ["draft", "sent", "viewed", "partially_paid", "overdue"].includes(invoice.status);
  const canSendReminder = !["draft", "paid", "cancelled", "void"].includes(invoice.status);
  const hasDepositDue = invoice.deposit_due && Number(invoice.deposit_due) > 0;

  function handleEdit() {
    onEdit?.();
    if (!onEdit) navigate(`/app/invoices/${invoice.id}/edit`);
  }

  function renderStatus() {
    if (isFullyPaid && invoice.status === "paid") {
      return (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-full status-success-bg">
            <Check className="h-5 w-5 status-success-text" />
          </span>
          <div>
            <p className="text-lg font-semibold status-success-text">Paid in full</p>
            {invoice.paid_at && (
              <p className="text-sm text-tertiary">{formatDate(invoice.paid_at)}</p>
            )}
          </div>
        </div>
      );
    }

    if (isOverdue && !isFullyPaid) {
      const overdueDays = daysOverdue(invoice.due_date);
      return (
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-error-text" />
          <div>
            <p className="text-lg font-semibold text-error-text">
              {formatCurrencyValue(invoice.amount_due, invoice.currency)} is {overdueDays ?? 0}{" "}
              {overdueDays === 1 ? "day" : "days"} overdue
            </p>
            <p className="text-sm text-tertiary">
              Due {invoice.due_date
                ? new Date(invoice.due_date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </p>
          </div>
        </div>
      );
    }

    if (!isFullyPaid && Number(invoice.amount_due ?? 0) > 0) {
      return (
        <Button
          variant="primary"
          size="md"
          onClick={onRecordPayment ?? (() => {})}
          className="w-full sm:w-auto"
        >
          Record Payment
        </Button>
      );
    }

    return null;
  }

  return (
    <div className={className}>
      <div className="rounded-xl border border-color bg-surface p-5 shadow-sm text-center">
        <StatusBadge
          status={invoice.status}
          isOverdue={isOverdue}
          showLabel={true}
          config={invoiceStatusConfig}
          size="md"
        />

        <div className="mt-4">
          {renderStatus()}
        </div>

        {!isFullyPaid && (
          <div className="mt-4 text-sm text-tertiary">
            Amount Due:{" "}
            <span className="font-medium text-primary-brand font-tabular-nums">
              {formatCurrencyValue(invoice.amount_due, invoice.currency)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-color bg-surface p-5 shadow-sm">
        <h3 className="invoice-section-title mb-4">Actions</h3>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={handleEdit}>
              Edit
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onDuplicate ?? (() => {})}>
            Duplicate
          </Button>
          <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={onDownloadPdf ?? (() => {})} disabled={!invoice.is_finalized}>
            Download PDF
          </Button>
          {canSendReminder && (
            <Button variant="secondary" size="sm" onClick={onSendReminder ?? (() => {})}>
              Send Reminder
            </Button>
          )}
          {!isFullyPaid && Number(invoice.amount_due ?? 0) > 0 && (
            <Button variant="primary" size="sm" onClick={onRecordPayment ?? (() => {})}>
              Record Payment
            </Button>
          )}
          {invoice.status === "paid" && onGenerateReceipt && (
            <Button variant="secondary" size="sm" icon={<FileText className="h-4 w-4" />} onClick={onGenerateReceipt}>
              Generate Receipt
            </Button>
          )}
          {invoice.public_token && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={onCopyPaymentLink ?? (() => {})}
              >
                Copy Link
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Smartphone className="h-4 w-4" />}
                onClick={onSendSms ?? (() => {})}
              >
                Send SMS
              </Button>
            </>
          )}
          {canCancel && (
            <Button variant="secondary" size="sm" onClick={onCancel ?? (() => {})}>
              Cancel
            </Button>
          )}
          {canVoid && (
            <Button variant="danger" size="sm" onClick={onVoid ?? (() => {})}>
              Void
            </Button>
          )}
          {hasDepositDue && invoice.status !== "draft" && invoice.status !== "cancelled" && invoice.status !== "void" && (
            <Button variant="warning" size="sm">
              Record Deposit
            </Button>
          )}
        </div>

        {invoice.public_token && !isFullyPaid && Number(invoice.amount_due ?? 0) > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="primary" size="md" className="w-full">
              <Send className="h-4 w-4" />
              Send by Email
            </Button>
            <Button variant="secondary" size="md" className="w-full">
              <Mail className="h-4 w-4" />
              Share via Text
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});
