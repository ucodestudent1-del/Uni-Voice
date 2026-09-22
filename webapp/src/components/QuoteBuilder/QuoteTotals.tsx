import { formatCurrency } from "../../utils/format";
import type { CalculationResult } from "../../utils/calculation";

interface QuoteTotalsProps {
  calcResult: CalculationResult | null;
  currency: string;
}

export function QuoteTotals({ calcResult, currency }: QuoteTotalsProps) {
  if (!calcResult) {
    return (
      <div className="bg-surface rounded-xl border border-color-subtle p-6">
        <p className="text-sm text-tertiary">Incomplete data — check for validation errors</p>
      </div>
    );
  }

  const hasTax = !calcResult.taxTotal.isZero();
  const hasDiscount = !calcResult.discountTotal.isZero();
  const hasFees = calcResult.fees.length > 0;

  return (
    <div className="space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-secondary">Subtotal</span>
        <span className="text-primary">{formatCurrency(calcResult.subtotal, currency)}</span>
      </div>

      {hasDiscount && (
        <div className="flex justify-between">
          <span className="text-secondary">Discount</span>
          <span className="text-error-text">-{formatCurrency(calcResult.discountTotal, currency)}</span>
        </div>
      )}

      {hasTax && (
        <>
          <div className="border-t border-color-subtle/50 pt-1">
            <span className="text-xs text-tertiary">Tax</span>
          </div>
          {calcResult.lineItems.map((_, i) => {
            const li = calcResult.lineItems[i];
            if (!li.taxAmount || li.taxAmount.isZero()) return null;
            return (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-tertiary">
                  {li.description} ({li.taxRate.mul(100).toFixed(2)}%)
                </span>
                <span className="text-tertiary">{formatCurrency(li.taxAmount, currency)}</span>
              </div>
            );
          })}
          <div className="flex justify-between font-medium pt-1 border-t border-color-subtle/50">
            <span className="text-secondary">Tax Total</span>
            <span className="text-primary">{formatCurrency(calcResult.taxTotal, currency)}</span>
          </div>
        </>
      )}

      {hasFees && (
        <>
          <div className="border-t border-color-subtle/50 pt-1">
            <span className="text-xs text-tertiary">Fees</span>
          </div>
          {calcResult.fees.map((fee, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-tertiary">{fee.description}</span>
              <span className="text-tertiary">{formatCurrency(fee.amount, currency)}</span>
            </div>
          ))}
          <div className="flex justify-between font-medium pt-1 border-t border-color-subtle/50">
            <span className="text-secondary">Fees Total</span>
            <span className="text-primary">{formatCurrency(calcResult.feeTotal, currency)}</span>
          </div>
        </>
      )}

      <div className="flex justify-between text-lg font-bold pt-3 border-t border-color-subtle">
        <span className="text-primary">Total</span>
        <span className="text-primary-brand">{formatCurrency(calcResult.total, currency)}</span>
      </div>
    </div>
  );
}
