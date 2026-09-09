import { Decimal } from "decimal.js";

export function formatCurrency(amount: Decimal.Value, currency: string, decimalPlaces = 2): string {
  const d = new Decimal(amount || 0);
  const rounded = d.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
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
