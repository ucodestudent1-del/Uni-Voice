import type { ApiCustomer, ApiCustomerInvoiceSummary } from "../types/api";
import { Decimal } from "decimal.js";

export interface OverdueCheckInput {
  status: string;
  dueDate: string | null;
  amountDue: string;
  now?: Date;
}

/**
 * Returns true when an invoice is open, past its due date, and still has a
 * balance outstanding. Mirrors the server-side state-machine overtime logic.
 */
export function isInvoiceOverdue(input: OverdueCheckInput): boolean {
  const now = input.now ?? new Date();
  if (
    input.status === "paid" ||
    input.status === "cancelled" ||
    input.status === "void"
  ) {
    return false;
  }
  if (input.status === "overdue") return true;
  if (new Decimal(input.amountDue ?? 0).lte(0)) return false;
  if (!input.dueDate) return false;
  return now >= new Date(input.dueDate);
}

/**
 * Determines the effective display status for an invoice line item in the
 * customer context. Open invoices that are past due are shown as "overdue"
 * even when the stored status is still "sent"/"viewed"/etc.
 */
export function getInvoiceDisplayStatus(invoice: Pick<ApiCustomerInvoiceSummary, "status" | "dueDate" | "amountDue">): string {
  if (invoice.status === "overdue") return "overdue";
  if (isInvoiceOverdue({ status: invoice.status, dueDate: invoice.dueDate, amountDue: invoice.amountDue })) {
    return "overdue";
  }
  return invoice.status;
}

/**
 * Returns the primary contact string for a customer (email then phone).
 */
export function getCustomerPrimaryContact(customer: ApiCustomer): string | null {
  const parts = [customer.email, customer.phone].filter(Boolean);
  return parts.length ? parts.join(" • ") : null;
}

/**
 * Returns whether a customer has an outstanding (unpaid) balance.
 */
export function customerHasBalance(customer: Pick<ApiCustomer, "totalOutstanding">): boolean {
  return new Decimal(customer.totalOutstanding ?? 0).gt(0);
}
