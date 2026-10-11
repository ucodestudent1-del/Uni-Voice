import { useMemo } from "react";
import { CreditCard } from "lucide-react";
import { Decimal } from "decimal.js";
import { formatCurrency } from "../utils/format";
import { getCurrencyMetadata } from "../types/currency";
import InvoicePreviewV2, {
  type PreviewInvoice,
} from "../components/InvoicePreviewV2";
import { Button } from "../components/ui/Button";
import type { CalculationResult } from "../utils/calculation";

export interface LivePreviewProps {
  calc: CalculationResult | null;
  currency: string;
  previewInvoice: PreviewInvoice | null;
  className?: string;
}

export default function LivePreview({
  calc,
  currency,
  previewInvoice,
  className,
}: LivePreviewProps) {
  const meta = useMemo(() => {
    try {
      return getCurrencyMetadata(currency);
    } catch {
      return getCurrencyMetadata("USD");
    }
  }, [currency]);

  return (
    <aside
      className={`flex flex-col overflow-y-auto bg-surface-alt ${className || ""}`}
    >
      <div className="border-b border-color bg-surface px-4 py-2 text-center text-xs text-tertiary">
        Live preview (not yet sent)
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {previewInvoice ? <InvoicePreviewV2 invoice={previewInvoice} /> : null}
      </div>

      {calc && new Decimal(calc.amountDue).toNumber() > 0 && (
        <div className="border-t border-color p-6 text-center">
          <div className="mb-4 text-center">
            <span className="text-3xl font-extrabold text-primary-brand">
              {formatCurrency(calc.total, currency)}
            </span>
            <p className="mt-1 text-sm text-tertiary">Total amount due</p>
          </div>
          <Button variant="primary" size="md" className="w-full" disabled>
            <CreditCard className="h-4 w-4" />
            Pay {formatCurrency(calc.amountDue, currency)} now
          </Button>
        </div>
      )}
    </aside>
  );
}

LivePreview.displayName = "LivePreview";
