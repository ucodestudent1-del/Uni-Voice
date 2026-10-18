import { Decimal } from "decimal.js";
import { formatCurrency } from "@/utils/format";

type ClassValue = string | number | null | undefined | false | Record<string, boolean>;

export function cn(...classes: ClassValue[]): string {
  return classes
    .flatMap((c) => {
      if (c === null || c === undefined || c === false) return [];
      if (typeof c === "number") return [String(c)];
      if (typeof c === "string") return c.length > 0 ? [c] : [];
      if (typeof c === "object") {
        return Object.entries(c)
          .filter(([, v]) => Boolean(v))
          .map(([k]) => k);
      }
      return [];
    })
    .join(" ");
}

export function formatCurrencyValue(
  amount: Decimal.Value | string | number | undefined | null,
  currency = "USD",
  decimalPlaces?: number
): string {
  return formatCurrency(amount ?? 0, currency, decimalPlaces);
}

export { cn as clsx };
