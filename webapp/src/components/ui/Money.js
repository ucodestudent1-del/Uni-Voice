import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from "react";
import { Decimal } from "decimal.js";
import { cn } from "@/lib/utils";
import { formatMoney as formatMoneyUtil } from "@/types/currency";
import { formatCurrency } from "@/utils/format";
function formatValue(value, currency, decimalPlaces) {
    if (currency.length === 3) {
        try {
            return formatMoneyUtil(value, currency);
        }
        catch (err) {
            console.warn("Failed to format money with currency", currency, err);
        }
    }
    return formatCurrency(value, currency, decimalPlaces);
}
export function formatMoneyValue(value, currency, decimalPlaces = 2) {
    return formatValue(value ?? 0, currency ?? "USD", decimalPlaces);
}
export const Money = forwardRef(function Money({ amount, currency = "USD", decimalPlaces = 2, signed = false, placeholder, className, ...rest }, ref) {
    const d = new Decimal(amount || 0);
    const formatted = formatValue(amount, currency, decimalPlaces);
    const display = placeholder !== undefined && d.isZero() ? placeholder : formatted;
    const isNegative = d.isNegative();
    const resolvedClassName = cn("font-tabular-nums", {
        "text-error-text": isNegative && signed,
        "text-success-text": isNegative && !signed,
    }, className);
    return (_jsx("span", { ref: ref, className: resolvedClassName, ...rest, children: display }));
});
Money.displayName = "Money";
export default Money;
