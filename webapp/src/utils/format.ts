import { Decimal } from "decimal.js";

// Cache Intl.NumberFormat instances per currency/locale to avoid the overhead
// of constructing a new formatter on every formatCurrency call.
const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string, decimalPlaces = 2): Intl.NumberFormat {
  const cacheKey = `${currency}-${decimalPlaces}`;
  let formatter = currencyFormatterCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
    currencyFormatterCache.set(cacheKey, formatter);
  }
  return formatter;
}

export function formatCurrency(amount: Decimal.Value, currency: string, decimalPlaces = 2): string {
  const d = new Decimal(amount || 0);
  const rounded = d.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
  const formatter = getCurrencyFormatter(currency, decimalPlaces);
  return formatter.format(Number(rounded.toNumber()));
}

export function formatDate(dateString: string | Date | undefined): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function parseDecimal(value: string | number | undefined | null): Decimal {
  return new Decimal(value ?? 0);
}

export function decimalToString(d: Decimal): string {
  return d.toFixed(2);
}
