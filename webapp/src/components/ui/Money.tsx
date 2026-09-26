import { forwardRef } from "react";
import { Decimal } from "decimal.js";
import { cn } from "@/lib/utils";
import { formatMoney as formatMoneyUtil, type CurrencyCode } from "@/types/currency";
import { formatCurrency } from "@/utils/format";
import type { MoneyProps } from "@/types/components";

export { MoneyProps };

function formatValue(value: Decimal.Value, currency: string, decimalPlaces: number): string {
  if (currency.length === 3) {
    try {
      return formatMoneyUtil(value, currency as CurrencyCode);
    } catch (err) {
      console.warn("Failed to format money with currency", currency, err);
    }
  }
  return formatCurrency(value, currency, decimalPlaces);
}

export function formatMoneyValue(value: Decimal.Value, currency?: string, decimalPlaces = 2): string {
  return formatValue(value, currency ?? "USD", decimalPlaces);
}

export const Money = forwardRef<HTMLSpanElement, MoneyProps>(function Money(
  { amount, currency = "USD", decimalPlaces = 2, signed = false, placeholder, className, ...rest },
  ref
) {
  const d = new Decimal(amount || 0);
  const formatted = formatValue(amount, currency, decimalPlaces);
  const display = placeholder !== undefined && d.isZero() ? placeholder : formatted;
  const isNegative = d.isNegative();

  const resolvedClassName = cn(
    "font-tabular-nums",
    {
      "text-error-text": isNegative && signed,
      "text-success-text": isNegative && !signed,
    },
    className
  );

  return (
    <span ref={ref} className={resolvedClassName} {...rest}>
      {display}
    </span>
  );
});

Money.displayName = "Money";

export default Money;
