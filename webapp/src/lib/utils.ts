import { Decimal } from "decimal.js";

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
  decimalPlaces = 2
): string {
  const d = new Decimal(amount ?? 0);
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

export { cn as clsx };
