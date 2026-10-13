import { Link } from "react-router-dom";
import { FileText, Link as LinkIcon, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge, creditNoteStatusConfig, Money } from "@/components/ui";
import { formatDateLong } from "@/utils/format";
import type { ApiCreditNote, ApiCreditNoteListItem } from "@/types/api";
import { Decimal } from "decimal.js";

interface CreditNoteInvoiceLinkProps {
  creditNote: ApiCreditNote | ApiCreditNoteListItem;
  referenceInvoice?: {
    id: string;
    invoice_number: string | null;
    issue_date?: string | null;
    total?: string;
    status: string;
    currency: string;
  } | null;
  onNavigateToInvoice?: (invoiceId: string) => void;
  className?: string;
}

export default function CreditNoteInvoiceLink({
  creditNote,
  referenceInvoice = null,
  onNavigateToInvoice,
  className,
}: CreditNoteInvoiceLinkProps) {
  const hasReference = creditNote.reference_invoice_id && referenceInvoice;
  const isBroken = creditNote.reference_invoice_id && !referenceInvoice;

  const totalAmount = new Decimal(creditNote.total ?? 0);
  const appliedAmount = new Decimal(creditNote.applied_total ?? 0);
  const remainingOnInvoice = totalAmount.minus(appliedAmount);

  return (
    <div
      className={cn(
        "rounded-xl border-2 bg-info-bg p-5",
        "border-info-border",
        className,
      )}
      role="region"
      aria-label="Credit note source invoice reference"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <FileText
          className="h-5 w-5 text-info-text shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-info-text">
            Credit Against Invoice
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            {hasReference ? (
              <>
                {onNavigateToInvoice ? (
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateToInvoice(referenceInvoice!.id)
                    }
                    className="text-xl font-bold text-primary hover:underline focus:outline-none focus:underline"
                  >
                    {referenceInvoice!.invoice_number ?? "—"}
                  </button>
                ) : (
                  <Link
                    to={`/app/invoices/${referenceInvoice!.id}`}
                    className="text-xl font-bold text-primary hover:underline focus:outline-none focus:underline"
                  >
                    {referenceInvoice!.invoice_number ?? "—"}
                  </Link>
                )}
                <span className="text-sm text-tertiary">
                  issued {referenceInvoice!.issue_date ? formatDateLong(referenceInvoice!.issue_date) : "—"}
                </span>
                <StatusBadge
                  status={referenceInvoice!.status}
                  config={creditNoteStatusConfig}
                  size="sm"
                />
              </>
            ) : isBroken ? (
              <>
                <FileWarning
                  className="h-4 w-4 text-warning-text"
                  aria-hidden="true"
                />
                <span className="text-sm text-warning-text">
                  Reference invoice not found
                </span>
              </>
            ) : (
              <span className="text-sm text-tertiary">No reference invoice</span>
            )}
          </div>
          {hasReference && (
            <p className="mt-1 text-sm text-secondary">
              Original total:{" "}
              <Money
                amount={referenceInvoice!.total ?? 0}
                currency={referenceInvoice!.currency ?? creditNote.currency}
              />{" "}
              · Amount credited:{" "}
              <span className="text-error-text font-medium">
                −<Money amount={totalAmount.toFixed()} currency={creditNote.currency} />
              </span>
              {" "}· Remaining on invoice:{" "}
              <span className="text-warning-text font-medium">
                {remainingOnInvoice.isZero()
                  ? "Fully credited"
                  : `−${remainingOnInvoice.toFixed(2)}`}
              </span>
            </p>
          )}
          {!hasReference && !isBroken && "reason" in creditNote && creditNote.reason && (
            <p className="mt-1 text-sm text-tertiary">
              Reason: {creditNote.reason}
            </p>
          )}
        </div>
        {hasReference && onNavigateToInvoice && (
          <LinkIcon className="h-4 w-4 text-tertiary shrink-0 mt-3 sm:mt-0" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
