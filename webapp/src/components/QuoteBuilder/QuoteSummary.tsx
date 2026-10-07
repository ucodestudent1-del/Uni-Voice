import { formatCurrency } from "@/utils/format";
import type { CalculationResult } from "@/utils/calculation";
import { Button } from "@/components/ui/Button";
import { FileText } from "lucide-react";

interface QuoteSummaryProps {
  calcResult: CalculationResult | null;
  currency: string;
  itemsCount: number;
  onSaveDraft: () => void;
  saveState: "saved" | "saving" | "unsaved" | "error";
}

export function QuoteSummary({ calcResult, currency, itemsCount, onSaveDraft, saveState }: QuoteSummaryProps) {
  if (!calcResult) {
    return (
      <div className="bg-surface rounded-xl border border-color-subtle p-6 shadow">
        <h3 className="text-xs font-semibold text-tertiary uppercase mb-3">Quote Summary</h3>
        <p className="text-sm text-tertiary">Add line items to see quote totals.</p>
      </div>
    );
  }

  const hasTax = !calcResult.taxTotal.isZero();
  const hasDiscount = !calcResult.discountTotal.isZero();
  const hasFees = calcResult.feeTotal.isZero() === false;
  const hasItems = itemsCount > 0;

  if (!hasItems) {
    return (
      <div className="bg-surface rounded-xl border border-color-subtle p-6 shadow">
        <h3 className="text-xs font-semibold text-tertiary uppercase mb-3">Quote Summary</h3>
        <p className="text-sm text-tertiary">Add line items to see quote totals.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-color-subtle p-6 shadow">
      <h3 className="text-xs font-semibold text-tertiary uppercase mb-4">Quote Summary</h3>

      <div className="space-y-0 text-sm">
        <div className="flex justify-between py-2">
          <span className="text-secondary">Subtotal</span>
          <span className="text-primary font-tabular-nums">{formatCurrency(calcResult.subtotal, currency)}</span>
        </div>

        {hasDiscount && (
          <div className="flex justify-between py-2">
            <span className="text-secondary">Discount</span>
            <span className="text-error-text font-tabular-nums">−{formatCurrency(calcResult.discountTotal, currency)}</span>
          </div>
        )}

        {hasTax && (
          <>
            <div className="border-t border-color-subtle pt-2 mt-2">
              <span className="text-xs text-tertiary">Tax</span>
            </div>
            {calcResult.lineItems.map((li, i) => {
              if (!li.taxAmount || li.taxAmount.isZero()) return null;
              return (
                <div key={i} className="flex justify-between py-1 text-xs">
                  <span className="text-tertiary">
                    {li.description} ({li.taxRate.mul(100).toFixed(2)}%)
                  </span>
                  <span className="text-tertiary font-tabular-nums">{formatCurrency(li.taxAmount, currency)}</span>
                </div>
              );
            })}
            <div className="flex justify-between py-2 border-t border-color-subtle/50">
              <span className="text-secondary">Tax Total</span>
              <span className="text-primary font-tabular-nums">{formatCurrency(calcResult.taxTotal, currency)}</span>
            </div>
          </>
        )}

        {hasFees && (
          <>
            <div className="border-t border-color-subtle pt-2 mt-2">
              <span className="text-xs text-tertiary">Fees</span>
            </div>
            {calcResult.fees.map((fee, i) => {
              if (fee.amount.isZero() && fee.taxAmount.isZero()) return null;
              return (
                <div key={i} className="flex justify-between py-1 text-xs">
                  <span className="text-tertiary">{fee.description}</span>
                  <span className="text-tertiary font-tabular-nums">{formatCurrency(fee.feeTotal, currency)}</span>
                </div>
              );
            })}
            <div className="flex justify-between py-2 border-t border-color-subtle/50">
              <span className="text-secondary">Fees Total</span>
              <span className="text-primary font-tabular-nums">{formatCurrency(calcResult.feeTotal, currency)}</span>
            </div>
          </>
        )}

        <div className="flex justify-between pt-4 border-t-2 border-color-strong mt-2">
          <span className="text-secondary font-medium">Estimated Total</span>
          <span className="text-primary-brand text-xl font-bold font-tabular-nums">{formatCurrency(calcResult.total, currency)}</span>
        </div>
      </div>

      {saveState !== "saved" && (
        <div className="mt-4 pt-4 border-t border-color-subtle">
          <Button
            variant="secondary"
            size="md"
            icon={<FileText className="h-4 w-4" />}
            onClick={onSaveDraft}
            disabled={saveState === "saving"}
            className="w-full"
          >
            {saveState === "saving" ? "Saving…" : "Save Draft"}
          </Button>
        </div>
      )}
    </div>
  );
}
