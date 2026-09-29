import type { ApiCustomer, ApiCustomerInvoiceSummary, ApiCustomerSummary } from "../types/api";
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

export type BillingState = "never_invoiced" | "settled" | "outstanding" | "overdue";

export interface CustomerBillingSnapshot {
  state: BillingState;
  /** Short, human-readable explanation of the billing position. */
  label: string;
  outstanding: string;
  overdue: string;
  paid: string;
  billed: string;
  openInvoiceCount: number;
}

/**
 * Formats a customer's address into display lines, combining the locality into
 * a single "City, ST 00000" line and dropping blank components. Returns an
 * empty array when no address information is present.
 */
export function formatAddressLines(
  address: ApiCustomer["address"] | null | undefined
): string[] {
  if (!address) return [];
  const lines: string[] = [];

  if (address.addressLine1) lines.push(address.addressLine1);
  if (address.addressLine2) lines.push(address.addressLine2);

  const locality = [
    address.city,
    [address.stateOrRegion, address.postalCode].filter(Boolean).join(" ").trim() || null,
  ]
    .filter(Boolean)
    .join(", ");

  if (locality) lines.push(locality);
  if (address.countryCode) lines.push(address.countryCode);

  return lines;
}

/**
 * Builds a two-letter monogram for the customer avatar, falling back through
 * company name, contact name, and finally a generic marker.
 */
export function getCustomerInitials(customer: Pick<ApiCustomer, "name" | "companyName">): string {
  const source = (customer.companyName?.trim() || customer.name?.trim() || "").replace(
    /[^\p{L}\p{N}\s]/gu,
    ""
  );
  if (!source) return "?";

  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Derives the customer's billing position and a plain-language label so the
 * panel can explain what a set of amounts means instead of showing bare zeros.
 */
export function getCustomerBillingSnapshot(
  summary: Pick<
    ApiCustomerSummary,
    "totalInvoiceCount" | "finalizedInvoiceCount" | "totalBilled" | "totalPaid" | "totalOutstanding" | "totalOverdue"
  >
): CustomerBillingSnapshot {
  const billed = new Decimal(summary.totalBilled ?? 0);
  const paid = new Decimal(summary.totalPaid ?? 0);
  const outstanding = new Decimal(summary.totalOutstanding ?? 0);
  const overdue = new Decimal(summary.totalOverdue ?? 0);
  const openInvoiceCount = Math.max(
    0,
    (summary.totalInvoiceCount ?? 0) - (summary.finalizedInvoiceCount ?? 0)
  );

  const snapshot: CustomerBillingSnapshot = {
    state: "settled",
    label: "All invoices paid",
    outstanding: outstanding.toFixed(2),
    overdue: overdue.toFixed(2),
    paid: paid.toFixed(2),
    billed: billed.toFixed(2),
    openInvoiceCount,
  };

  if ((summary.totalInvoiceCount ?? 0) === 0) {
    return { ...snapshot, state: "never_invoiced", label: "No invoices issued yet" };
  }
  if (overdue.gt(0)) {
    return { ...snapshot, state: "overdue", label: `${formatInvoiceCount(openInvoiceCount)} unpaid` };
  }
  if (outstanding.gt(0)) {
    return { ...snapshot, state: "outstanding", label: `${formatInvoiceCount(openInvoiceCount)} awaiting payment` };
  }
  return snapshot;
}

function formatInvoiceCount(count: number): string {
  return count === 1 ? "1 invoice" : `${count} invoices`;
}

/**
 * Returns the label a customer should be addressed by: the company when one is
 * on file, otherwise the contact name.
 */
export function getCustomerDisplayName(
  customer: Pick<ApiCustomer, "name" | "companyName">
): string {
  return customer.companyName?.trim() || customer.name?.trim() || "Unnamed customer";
}

/**
 * Returns the amount still collectable on an invoice, preferring the explicit
 * amountDue and falling back to the total when it is missing.
 */
export function getInvoiceAmountDue(invoice: Pick<ApiCustomerInvoiceSummary, "amountDue" | "total">): string {
  const due = new Decimal(invoice.amountDue ?? 0);
  return (due.gt(0) ? due : new Decimal(invoice.total ?? 0)).toFixed(2);
}

/**
 * Returns a stable reference label for an invoice, e.g. "INV-1042" or
 * "Draft #a1b2c3d4" when the invoice has not been numbered yet.
 */
export function getInvoiceReference(invoice: Pick<ApiCustomerInvoiceSummary, "id" | "invoiceNumber">): string {
  if (invoice.invoiceNumber) return invoice.invoiceNumber;
  return `Draft #${invoice.id.slice(0, 8)}`;
}
