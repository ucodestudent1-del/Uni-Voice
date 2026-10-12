import { Decimal } from "decimal.js";

export function computeEffectiveStatus(
  status: string | null | undefined,
  dueDate: string | null | undefined,
  amountDue: string | number | Decimal.Value
): string {
  if (status === "overdue") return "overdue";
  if (status === "paid" || status === "void" || status === "cancelled") return status ?? "draft";
  if (!dueDate) return status ?? "draft";
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return status ?? "draft";
  if (due < new Date() && new Decimal(amountDue ?? 0).gt(0)) {
    return "overdue";
  }
  return status ?? "draft";
}
