import {
  Link,
} from "react-router-dom";
import {
  Receipt,
  Wallet,
  FileText,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateLong } from "../utils/format";
import type { ApiCreditNoteApplication } from "../types/api";

const METHOD_ICONS: Record<string, React.ElementType> = {
  refund: Receipt,
  balance_credit: Wallet,
  invoice_offset: FileText,
};

const METHOD_LABELS: Record<string, string> = {
  refund: "Refunded to customer",
  balance_credit: "Credit held on account",
  invoice_offset: "Applied to invoice",
};

const METHOD_BG: Record<string, string> = {
  refund: "status-info-bg status-info-text status-info-border",
  balance_credit: "bg-primary/10 text-primary-brand border-primary/30",
  invoice_offset: "status-success-bg status-success-text status-success-border",
};

const METHOD_TEXT: Record<string, string> = {
  refund: "status-info-text",
  balance_credit: "text-primary-brand",
  invoice_offset: "status-success-text",
};

export type ApplicationMethod = "refund" | "balance_credit" | "invoice_offset";

export function getApplicationMethod(
  application: ApiCreditNoteApplication
): ApplicationMethod {
  if (application.application_method) {
    return application.application_method as ApplicationMethod;
  }
  const meta = application.metadata;
  if (meta && typeof meta.application_method === "string") {
    return meta.application_method as ApplicationMethod;
  }
  if (application.invoice_id) {
    return "invoice_offset";
  }
  return "balance_credit";
}

const METHODS_LABELS_FALLBACK: Record<string, string> = { default: "Applied" };

export function getApplicationLabel(method: ApplicationMethod): string {
  return METHOD_LABELS[method] ?? METHODS_LABELS_FALLBACK.default;
}

export interface CreditNoteApplicationStatusProps {
  application: ApiCreditNoteApplication;
  currency: string;
  showInvoiceLink?: boolean;
  referenceInvoiceNumber?: string | null;
}

export default function CreditNoteApplicationStatus({
  application,
  currency,
  showInvoiceLink = true,
  referenceInvoiceNumber = null,
}: CreditNoteApplicationStatusProps) {
  const method = getApplicationMethod(application);
  const Icon = METHOD_ICONS[method] ?? HelpCircle;
  const label = METHOD_LABELS[method] ?? "Applied";
  const badgeClass = METHOD_BG[method] ?? "status-tertiary-bg status-tertiary-text";
  const textColor = METHOD_TEXT[method] ?? "text-tertiary";

  const isInvoiceOffset = method === "invoice_offset";
  const invoiceNum = referenceInvoiceNumber;
  const hasInvoice = isInvoiceOffset && application.invoice_id && showInvoiceLink;

  return (
    <div className="flex items-center justify-between rounded-lg border border-color bg-surface-alt px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            "inline-flex items-center justify-center h-6 w-6 rounded-full flex-shrink-0",
            method === "refund"
              ? "status-info-bg text-info-text"
              : method === "balance_credit"
              ? "bg-primary/10 text-primary-brand"
              : "status-success-bg text-success-text"
          )}
          aria-hidden="true"
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <span className={cn("text-xs font-semibold", textColor)}>{label}</span>
          {hasInvoice && invoiceNum && (
            <span className="mt-0.5 block text-sm text-secondary">
              to Invoice{" "}
              <Link
                to={`/app/invoices/${application.invoice_id}`}
                className="font-medium text-primary-brand hover:underline"
              >
                {invoiceNum}
              </Link>
            </span>
          )}
          {isInvoiceOffset && !invoiceNum && application.invoice_id && (
            <span className="mt-0.5 block text-sm text-tertiary">
              Invoice ID: {application.invoice_id.slice(0, 8)}…
            </span>
          )}
          {method === "refund" &&
            application.metadata &&
            typeof application.metadata.provider === "string" && (() => {
              const provider = application.metadata!.provider as string;
              const txId =
                typeof application.metadata.transaction_id === "string"
                  ? (application.metadata.transaction_id as string)
                  : null;
              return (
                <span className="mt-0.5 block text-sm text-tertiary">
                  via {provider}
                  {txId && (
                    <span className="text-xs">
                      {" "}
                      (Ref #{txId.slice(0, 10)})
                    </span>
                  )}
                </span>
              );
            })()}
        </div>
      </div>

      <div className="flex-shrink-0 text-right font-tabular-nums">
        <span className="text-sm font-medium text-primary">
          −{formatCurrency(application.amount, currency)}
        </span>
        <span className="block text-xs text-tertiary">
          {formatDateLong(application.applied_at)}
        </span>
      </div>
    </div>
  );
}
