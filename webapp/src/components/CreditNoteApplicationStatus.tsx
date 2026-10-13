import { cn } from "@/lib/utils";
import { FileText, Banknote, Wallet } from "lucide-react";
import type { ApiCreditNoteApplication } from "@/types/api";

interface CreditNoteApplicationStatusProps {
  application: ApiCreditNoteApplication;
  currency: string;
  referenceInvoiceNumber?: string | null;
  className?: string;
}

const methodConfig: Record<string, { label: string; className: string; icon: typeof FileText; description: string }> = {
  invoice_offset: {
    label: "Invoice Offset",
    className: "status-success-bg status-success-text",
    icon: FileText,
    description: "Applied to reduce the outstanding balance of a specific invoice.",
  },
  balance_credit: {
    label: "Balance Credit",
    className: "status-info-bg status-info-text",
    icon: Wallet,
    description: "Credit held on the customer's account for future invoices.",
  },
  refund: {
    label: "Direct Refund",
    className: "status-tertiary-bg status-tertiary-text",
    icon: Banknote,
    description: "Money returned to the customer's original payment method.",
  },
};

function getMethod(application: ApiCreditNoteApplication): string {
  return application.application_method
    ?? (application.metadata?.method as string | undefined)
    ?? (application.metadata?.application_method as string | undefined)
    ?? "invoice_offset";
}

export default function CreditNoteApplicationStatus({
  application,
  referenceInvoiceNumber,
  className,
}: CreditNoteApplicationStatusProps) {
  const method = getMethod(application);
  const config = methodConfig[method] ?? methodConfig.invoice_offset;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium",
        config.className,
        className,
      )}
      aria-label={`Applied via ${config.label}`}
      title={config.description}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{config.label}</span>
      {method === "invoice_offset" && referenceInvoiceNumber && (
        <span className="text-xs opacity-75" aria-hidden="true">
          — #{referenceInvoiceNumber}
        </span>
      )}
    </div>
  );
}

export { methodConfig, getMethod };
