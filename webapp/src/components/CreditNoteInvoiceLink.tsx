import { Link } from "react-router-dom";
import { FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { invoiceStatusConfig } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateLong } from "../utils/format";
import type { ApiCreditNote, ApiInvoiceListItem } from "../types/api";

interface CreditNoteInvoiceLinkProps {
  creditNote: ApiCreditNote;
  referenceInvoice: ApiInvoiceListItem | null | undefined;
}

export default function CreditNoteInvoiceLink({
  creditNote,
  referenceInvoice,
}: CreditNoteInvoiceLinkProps) {
  const hasReference = creditNote.reference_invoice_id && creditNote.reference_invoice_number;
  const creditTotal = Number(creditNote.total || 0);
  const invoiceTotal = referenceInvoice ? Number(referenceInvoice.total || 0) : 0;
  const invoiceAmountDue = referenceInvoice ? Number(referenceInvoice.amount_due || 0) : 0;

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 px-5 py-4 mb-6",
        hasReference
          ? "border-info-border bg-info-bg"
          : "border-warning-border bg-warning-bg"
      )}
      role="region"
      aria-label="Credit note source invoice reference"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          {hasReference ? (
            <FileText className="h-5 w-5 text-info-text" />
          ) : (
            <AlertCircle className="h-5 w-5 text-warning-text" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              hasReference ? "text-info-text" : "text-warning-text"
            )}
          >
            {hasReference ? "Credit against Invoice" : "No Reference Invoice"}
          </p>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
            {hasReference && referenceInvoice ? (
              <>
                <Link
                  to={`/app/invoices/${creditNote.reference_invoice_id}`}
                  className="text-2xl font-bold text-primary hover:text-primary-brand hover:underline"
                  aria-label={`View source invoice ${creditNote.reference_invoice_number}`}
                >
                  {creditNote.reference_invoice_number}
                </Link>
                <StatusBadge
                  status={referenceInvoice.status}
                  config={invoiceStatusConfig}
                  size="sm"
                  showLabel
                />
                <span className="text-sm text-tertiary">
                   Issued: {formatDateLong(creditNote.issue_date ?? undefined)} • Invoice date:{" "}
                   {formatDateLong(referenceInvoice.issue_date ?? undefined)}
                </span>
              </>
            ) : hasReference ? (
              <>
                <span className="text-2xl font-bold text-primary">
                  {creditNote.reference_invoice_number}
                </span>
                <span className="text-sm text-error-text font-medium">
                  (Invoice not found)
                </span>
              </>
            ) : (
              <span className="text-sm text-tertiary">
                No invoice is linked to this credit note. Link an invoice to
                establish an audit trail.
              </span>
            )}
          </div>

          {hasReference && invoiceTotal > 0 && creditTotal > 0 && (
            <div className="mt-2 grid gap-1.5 text-sm sm:grid-cols-3">
              <div>
                <span className="text-tertiary">Original total</span>
                <span className="ml-2 font-medium text-primary font-tabular-nums">
                  {formatCurrency(invoiceTotal, creditNote.currency)}
                </span>
              </div>
              <div>
                <span className="text-tertiary">Amount credited</span>
                <span className="ml-2 font-medium text-error-text font-tabular-nums">
                  −{formatCurrency(creditTotal, creditNote.currency)}
                </span>
              </div>
              <div>
                <span className="text-tertiary">
                  {Number(creditNote.applied_total) > 0
                    ? "Balance on invoice"
                    : "Remaining on invoice"}
                </span>
                <span className="ml-2 font-medium text-primary font-tabular-nums">
                  {formatCurrency(invoiceAmountDue, creditNote.currency)}
                </span>
              </div>
            </div>
          )}
        </div>

        {hasReference && referenceInvoice && (
          <div className="flex-shrink-0 self-start">
            <svg
              className="h-5 w-5 text-info-text"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H7"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
