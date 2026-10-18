import { forwardRef, useMemo } from "react";
import { Decimal } from "decimal.js";
import { cn } from "@/lib/utils";
import { formatMoney as formatMoneyUtil, type CurrencyCode, getCurrencyMetadata } from "@/types/currency";
import { formatCurrency } from "@/utils/format";
import type { MoneyProps } from "@/types/components";

const currencyMetaCache = new Map<string, ReturnType<typeof getCurrencyMetadata>>();

function getCachedCurrencyMetadata(code: string) {
  if (code.length !== 3) {
    const meta = getCurrencyMetadata("USD");
    currencyMetaCache.set(code, meta);
    return meta;
  }
  let meta = currencyMetaCache.get(code);
  if (!meta) {
    try {
      meta = getCurrencyMetadata(code);
    } catch {
      meta = getCurrencyMetadata("USD");
    }
    currencyMetaCache.set(code, meta);
  }
  return meta;
}

export type { MoneyProps };

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

export function formatMoneyValue(value: Decimal.Value | null | undefined, currency?: string, decimalPlaces?: number): string {
  const curr = currency ?? "USD";
  const dp = decimalPlaces ?? getCachedCurrencyMetadata(curr).decimalPlaces;
  return formatValue(value ?? 0, curr, dp);
}

export const Money = forwardRef<HTMLSpanElement, MoneyProps>(function Money(
   { amount, currency = "USD", decimalPlaces, signed = false, placeholder, className, ...rest },
   ref
) {
   const effectiveDp = decimalPlaces ?? getCachedCurrencyMetadata(currency).decimalPlaces;
   const d = new Decimal(amount ?? 0);
   const formatted = useMemo(() => formatValue(amount, currency, effectiveDp), [amount, currency, effectiveDp]);
   const isNegative = d.isNegative();
   const isZero = d.isZero() && !d.isNeg();
   const display = isZero && placeholder !== undefined ? placeholder : formatted;

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
