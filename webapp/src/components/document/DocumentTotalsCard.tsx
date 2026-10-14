import { Money, FormField } from "@/components/ui";
import { formatTaxRate } from "@/utils/format";
import type { CalculationResult } from "@/types/calculation";
import type { Decimal } from "decimal.js";

interface DocumentTotalsCardProps {
  calcResult: CalculationResult | null;
  currency: string;
  invoiceDiscount?: string;
  invoiceDiscountType?: "fixed" | "percentage";
  onDiscountChange?: (value: string) => void;
  onDiscountTypeChange?: (value: "fixed" | "percentage") => void;
  isFinalized?: boolean;
}

export function DocumentTotalsCard({
  calcResult,
  currency,
  invoiceDiscount,
  invoiceDiscountType,
  onDiscountChange,
  onDiscountTypeChange,
  isFinalized = false,
}: DocumentTotalsCardProps) {
  if (!calcResult) return null;

  const discountValue = invoiceDiscount !== undefined && Number(invoiceDiscount) > 0;

  return (
    <div className="border border-color rounded-lg p-3 bg-surface-alt">
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-tertiary">Subtotal</span>
          <Money amount={calcResult.subtotal} currency={currency} />
        </div>

        {discountValue && (
          <div className="flex justify-between">
            <span className="text-tertiary">Discount</span>
            <Money
              amount={calcResult.discountTotal.negated()}
              currency={currency}
            />
          </div>
        )}

        {!calcResult.taxTotal.isZero() && calcResult.taxBreakdown.length > 1 && (
          <div className="flex justify-between">
            <span className="text-tertiary">Tax</span>
            <Money amount={calcResult.taxTotal} currency={currency} />
          </div>
        )}

        {!calcResult.taxTotal.isZero() && calcResult.taxBreakdown.length === 1 && (
          <div className="flex justify-between text-xs">
            <span className="text-tertiary">
              {formatTaxRate(calcResult.taxBreakdown[0].rate.toFixed())}{" "}
              {calcResult.taxBreakdown[0].name || ""}
            </span>
            <Money amount={calcResult.taxTotal} currency={currency} />
          </div>
        )}

        {calcResult.fees.length > 0 && !calcResult.feeTotal.isZero() && (
          <div className="flex justify-between">
            <span className="text-tertiary">Fees</span>
            <Money amount={calcResult.feeTotal} currency={currency} />
          </div>
        )}

        <div className="flex justify-between font-bold text-lg text-primary pt-1 border-t border-color">
          <span>Total</span>
          <Money amount={calcResult.total} currency={currency} />
        </div>
      </div>

      {onDiscountChange !== undefined && (
        <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-color">
          <FormField
            label="Invoice Discount"
            value={invoiceDiscount ?? "0"}
            onChange={(e) => onDiscountChange(e.target.value)}
            disabled={isFinalized}
          />
          <FormField
            label="Discount Type"
            select
            value={invoiceDiscountType ?? "fixed"}
            onChange={(e) =>
              onDiscountTypeChange?.(e.target.value as "fixed" | "percentage")
            }
            disabled={isFinalized}
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount</option>
          </FormField>
        </div>
      )}
    </div>
  );
}
