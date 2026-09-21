import { forwardRef, type HTMLAttributes } from "react";
import { Decimal } from "decimal.js";
import { cn } from "@/lib/utils";

export interface MoneyProps extends HTMLAttributes<HTMLSpanElement> {
  amount: Decimal.Value | string | number;
  currency?: string;
  decimalPlaces?: number;
  signed?: boolean;
  placeholder?: string;
}

function formatMoney(value: Decimal.Value | string | number, currency = "USD", decimalPlaces = 2): string {
  const d = new Decimal(value || 0);
  const rounded = d.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(Number(rounded.toNumber()));
  } catch {
    return `$${rounded.toFixed(decimalPlaces)}`;
  }
}

export function formatMoneyValue(value: Decimal.Value | string | number, currency?: string, decimalPlaces = 2): string {
  return formatMoney(value, currency ?? "USD", decimalPlaces);
}

export const Money = forwardRef<HTMLSpanElement, MoneyProps>(function Money(
  { amount, currency = "USD", decimalPlaces = 2, signed = false, placeholder, className, ...rest },
  ref
) {
  const d = new Decimal(amount || 0);
  const formatted = formatMoney(amount, currency, decimalPlaces);
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
