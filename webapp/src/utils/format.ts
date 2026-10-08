import { Decimal } from "decimal.js";
import { getCurrencyMetadata } from "@/types/currency";

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

function isSupportedCurrency(currency: string): boolean {
  try {
    getCurrencyMetadata(currency);
    return true;
  } catch {
    return false;
  }
}

export function formatCurrency(amount: Decimal.Value, currency: string, decimalPlaces = 2): string {
  const d = new Decimal(amount || 0);
  const rounded = d.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
  const safeCurrency = currency && currency.length >= 3 && isSupportedCurrency(currency) ? currency : "USD";
  const formatter = getCurrencyFormatter(safeCurrency, decimalPlaces);
  return formatter.format(Number(rounded.toNumber()));
}

export function formatDate(dateString: string | Date | undefined): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDateLong(dateString: string | Date | undefined): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Formats a decimal tax rate (e.g. "0.085") as a display string (e.g. "8.50%").
 * Returns "-" when the rate is zero.
 */
export function formatTaxRate(rate: string | number | undefined | null): string {
  const d = new Decimal(rate ?? 0);
  const pct = d.mul(100);
  if (pct.isZero()) return "-";
  return `${pct.toFixed(2)}%`;
}

/**
 * Formats a tax rate with an optional name, e.g. "8.50% (GST)".
 * If the name is empty/null, only the rate percentage is returned.
 */
export function formatTaxRateWithName(rate: string | number | undefined | null, name?: string | null): string {
  const rateStr = formatTaxRate(rate);
  if (!name) return rateStr;
  return `${rateStr} (${name})`;
}

export function parseDecimal(value: string | number | undefined | null): Decimal {
  return new Decimal(value ?? 0);
}

export function decimalToString(d: Decimal): string {
  return d.toFixed(2);
}

export function fromPercentage(pct: string): string {
  if (pct === "") return "0";
  return new Decimal(pct).div(100).toFixed(6);
}

export function toPercent(rate: string | undefined | null): string {
  const v = new Decimal(rate ?? 0).mul(100);
  return v.isZero() ? "" : v.toFixed(2);
}

export function toPercentDisplay(rate: string | undefined | null): string {
  return formatTaxRate(rate);
}
