import { Decimal } from "decimal.js";
export function cn(...classes) {
    return classes
        .flatMap((c) => {
        if (c === null || c === undefined || c === false)
            return [];
        if (typeof c === "number")
            return [String(c)];
        if (typeof c === "string")
            return c.length > 0 ? [c] : [];
        if (typeof c === "object") {
            return Object.entries(c)
                .filter(([, v]) => Boolean(v))
                .map(([k]) => k);
        }
        return [];
    })
        .join(" ");
}
// Cache Intl.NumberFormat instances per currency/decimalPlaces to avoid
// constructing a new formatter on every formatCurrencyValue call.
const currencyFormatterCache = new Map();
export function formatCurrencyValue(amount, currency = "USD", decimalPlaces = 2) {
    const d = new Decimal(amount ?? 0);
    const rounded = d.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
    const cacheKey = `${currency}-${decimalPlaces}`;
    try {
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
        return formatter.format(Number(rounded.toNumber()));
    }
    catch {
        return `$${rounded.toFixed(decimalPlaces)}`;
    }
}
export { cn as clsx };
