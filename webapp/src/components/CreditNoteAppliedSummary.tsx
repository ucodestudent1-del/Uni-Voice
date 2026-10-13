import { cn } from "@/lib/utils";
import { Money } from "@/components/ui";
import { formatCurrencyValue } from "@/lib/utils";
import { Decimal } from "decimal.js";
import type { ApiCreditNoteApplication, ApiCreditNote } from "@/types/api";
import CreditNoteApplicationStatus, { getMethod } from "./CreditNoteApplicationStatus";

interface CreditNoteAppliedSummaryProps {
  creditNote: ApiCreditNote;
  className?: string;
}

const METHOD_LABELS: Record<string, string> = {
  invoice_offset: "Invoice Offset",
  balance_credit: "Balance Credit",
  refund: "Direct Refund",
};

export default function CreditNoteAppliedSummary({
  creditNote,
  className,
}: CreditNoteAppliedSummaryProps) {
  const currency = creditNote.currency ?? "USD";
  const applications = creditNote.applications ?? [];

  if (applications.length === 0) return null;

  const methodCounts: Record<string, number> = {};
  let totalApplied = new Decimal(0);
  const methods = new Set<string>();

  for (const app of applications) {
    const method = getMethod(app);
    methodCounts[method] = (methodCounts[method] ?? 0) + 1;
    totalApplied = totalApplied.plus(new Decimal(app.amount ?? 0));
    methods.add(method);
  }

  const dominantMethod = methods.size === 1
    ? Array.from(methods)[0]
    : "mixed";

  const hasMultipleMethods = methods.size > 1;
  const hasMultipleInvoices = applications.filter((a) => getMethod(a) === "invoice_offset").length > 1;

  let methodLabel = "";
  if (hasMultipleMethods) {
    methodLabel = `Multiple methods (${methods.size})`;
  } else if (hasMultipleInvoices) {
    methodLabel = `Applied to ${methodCounts.invoice_offset} invoices`;
  } else if (dominantMethod) {
    methodLabel = METHOD_LABELS[dominantMethod] ?? dominantMethod;
  }

  return (
    <div
      className={cn("rounded-xl border border-color bg-surface p-5 shadow-sm", className)}
      aria-label="Application summary"
    >
      <h3 className="text-sm font-semibold text-primary mb-3">Application Summary</h3>
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-tertiary">Method</span>
          <span className="text-primary font-medium">{methodLabel}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-tertiary">Total Applied</span>
          <span className="text-success-text font-medium">
            −{formatCurrencyValue(totalApplied.toFixed(), currency)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-tertiary">Remaining</span>
          <span
            className={cn(
              "font-medium",
              new Decimal(creditNote.amount_due ?? 0).isZero()
                ? "text-success-text"
                : "text-warning-text",
            )}
          >
            −{formatCurrencyValue(creditNote.amount_due ?? "0", currency)}
          </span>
        </div>
        <div className="pt-2 border-t border-color space-y-1.5">
          {applications.map((app) => (
            <CreditNoteApplicationStatus
              key={app.id}
              application={app}
              currency={currency}
              className="text-xs"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
