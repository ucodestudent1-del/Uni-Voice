import React, { useMemo } from "react";
import { Decimal } from "decimal.js";
import { CreditCard, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import { getCurrencyMetadata } from "../types/currency";
import { InvoiceStatus, isOverdueStatus } from "./ui/InvoiceStatus";

export interface PreviewLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount?: string;
  discountType?: "fixed" | "percentage";
  taxRate?: string;
  isTaxInclusive?: boolean;
}

export interface PreviewFee {
  description: string;
  amount: string;
  taxRate?: string;
}

export interface PreviewAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  category?: "attachment" | "before" | "after";
}

export interface PreviewInvoice {
  businessName: string;
  businessEmail?: string;
  businessPhone?: string;
  businessWebsite?: string;
  businessAddress?: string;
  businessLogo?: string;
  customerName?: string;
  customerCompanyName?: string;
  customerEmail?: string;
  customerAddress?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  currency: string;
  notes?: string;
  terms?: string;
  paymentInstructions?: string;
  items: PreviewLineItem[];
  fees: PreviewFee[];
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  feeTotal: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  status: string;
  paymentLink?: string;
  attachments?: PreviewAttachment[];
}

function fmt(v: string | number, currency: string, dp = 2): string {
  return formatCurrency(new Decimal(v ?? 0), currency, dp);
}

function fmtNumber(v: string | number | undefined, currency: string): string {
  const meta = getCurrencyMetadata(currency);
  const dp = meta.decimalPlaces;
  return formatCurrency(new Decimal(v ?? 0), currency, dp);
}

function fmtRate(rate: string | undefined | null): string {
  const v = new Decimal(rate ?? 0).mul(100);
  if (v.isZero()) return "0%";
  return v.toFixed(2) + "%";
}

function fmtQuantity(qty: string | undefined | null): string {
  const d = new Decimal(qty ?? 0);
  if (d.isZero()) return "0";
  return d.toFixed(2).replace(/\.?0+$/, "");
}

function fmtLineTotal(item: PreviewLineItem, currency: string): string {
  const qty = new Decimal(item.quantity || 1);
  const price = new Decimal(item.unitPrice || 0);
  let total = qty.mul(price);
  if (item.discount && new Decimal(item.discount).gt(0)) {
    if (item.discountType === "percentage") {
      total = total.minus(total.mul(new Decimal(item.discount).div(100)));
    } else {
      total = total.minus(new Decimal(item.discount));
    }
  }
  return fmtNumber(total.toFixed(2), currency);
}

function isPastDue(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  try {
    return new Date(dueDate) < new Date();
  } catch {
    return false;
  }
}

export default React.memo(function InvoicePreview({ invoice }: { invoice: PreviewInvoice }) {
  const cur = invoice.currency;
  const overdue = isPastDue(invoice.dueDate);

  const lineTotals = useMemo(() => {
    return invoice.items.map((item) => fmtLineTotal(item, cur));
  }, [invoice.items, cur]);

  const hasAmountPaid = new Decimal(invoice.amountPaid ?? 0).gt(0);

  return (
    <div className="invoice-preview bg-surface border border-color rounded-xl shadow-sm font-[system-ui,-apple-system,BlinkMacSystemFont,Segoe_UI,Roboto,Helvetica,Arial,sans-serif]">
      {/* Header: business + status */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {invoice.businessLogo ? (
            <img src={invoice.businessLogo} alt={invoice.businessName} className="h-10 w-auto" />
          ) : (
            <h2 className="text-2xl font-bold text-primary">{invoice.businessName || "Your Business"}</h2>
          )}
          {invoice.businessEmail && <p className="mt-1 text-sm text-secondary">{invoice.businessEmail}</p>}
          {invoice.businessPhone && <p className="text-sm text-secondary">{invoice.businessPhone}</p>}
          {invoice.businessWebsite && <p className="text-sm text-tertiary">{invoice.businessWebsite}</p>}
          {invoice.businessAddress && (
            <p className="mt-1 text-sm text-tertiary whitespace-pre-line">{invoice.businessAddress}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <InvoiceStatus
            status={invoice.status ?? "draft"}
            isOverdue={overdue}
            showIcon={invoice.status !== "draft"}
            size="sm"
          />
          {invoice.invoiceNumber && (
            <p className="text-xl font-bold text-primary">#{invoice.invoiceNumber}</p>
          )}
        </div>
      </div>

      {/* Invoice details + bill to */}
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold text-tertiary uppercase tracking-wider">Bill To</h3>
          {invoice.customerName ? (
            <div className="mt-2 space-y-0.5">
              <p className="font-semibold text-primary">{invoice.customerName}</p>
              {invoice.customerCompanyName && <p className="text-sm text-secondary">{invoice.customerCompanyName}</p>}
              {invoice.customerEmail && <p className="text-sm text-secondary">{invoice.customerEmail}</p>}
              {invoice.customerAddress && (
                <p className="text-sm text-secondary whitespace-pre-line">{invoice.customerAddress}</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm italic text-tertiary">No customer selected</p>
          )}
        </div>
        <div>
          <h3 className="text-xs font-semibold text-tertiary uppercase tracking-wider">Invoice Details</h3>
          <div className="mt-2 space-y-1.5 text-sm">
            {invoice.invoiceNumber && (
              <div className="flex justify-between gap-4">
                <span className="text-tertiary">Invoice #:</span>
                <span className="font-medium text-primary">{invoice.invoiceNumber}</span>
              </div>
            )}
            {invoice.issueDate && (
              <div className="flex justify-between gap-4">
                <span className="text-tertiary">Issue date:</span>
                <span className="font-medium text-primary">{formatDate(invoice.issueDate)}</span>
              </div>
            )}
            {invoice.dueDate && (
              <div className="flex justify-between gap-4">
                <span className="text-tertiary">Due date:</span>
                <span className="font-medium text-primary">{formatDate(invoice.dueDate)}</span>
              </div>
            )}
            {invoice.terms && (
              <div className="flex justify-between gap-4">
                <span className="text-tertiary">Terms:</span>
                <span className="font-medium text-primary">{invoice.terms}</span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-tertiary">Currency:</span>
              <span className="font-medium text-primary">{cur}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Line items table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-color">
              <th className="text-left text-xs font-semibold text-tertiary uppercase py-3 px-3">#</th>
              <th className="text-left text-xs font-semibold text-tertiary uppercase py-3 px-3">Description</th>
              <th className="text-right text-xs font-semibold text-tertiary uppercase py-3 px-3">Qty</th>
              <th className="text-right text-xs font-semibold text-tertiary uppercase py-3 px-3">Unit Price</th>
              <th className="text-right text-xs font-semibold text-tertiary uppercase py-3 px-3">Tax Rate</th>
              <th className="text-right text-xs font-semibold text-tertiary uppercase py-3 px-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => {
              const lineTotal = lineTotals[i];
              const hasRate = new Decimal(item.unitPrice || 0).gt(0);
              return (
                <tr key={i} className="border-b border-color-subtle">
                  <td className="py-3 px-3 text-sm text-tertiary font-tabular-nums">{i + 1}</td>
                  <td className="py-3 px-3 text-sm text-primary max-w-xs break-words">
                    {item.description || <span className="italic text-tertiary">Untitled item</span>}
                  </td>
                  <td className="py-3 px-3 text-sm text-secondary text-right font-tabular-nums">
                    {fmtQuantity(item.quantity)} {item.unit}
                  </td>
                  <td className="py-3 px-3 text-sm text-secondary text-right font-tabular-nums">
                    {hasRate ? fmtNumber(item.unitPrice, cur) : ""}
                  </td>
                  <td className="py-3 px-3 text-sm text-tertiary text-right font-tabular-nums">
                    {fmtRate(item.taxRate)}
                  </td>
                  <td className="py-3 px-3 text-right text-sm font-medium text-primary font-tabular-nums">{lineTotal}</td>
                </tr>
              );
            })}
            {invoice.items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-tertiary">
                  No line items added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Fees */}
      {invoice.fees.length > 0 && (
        <table className="mt-2 w-full border-collapse">
          <tbody>
            {invoice.fees.map((fee, i) => (
              <tr key={i} className="border-b border-color-subtle">
                <td colSpan={5} className="py-2 text-sm text-secondary pl-4">{fee.description}</td>
                <td className="py-2 text-right text-sm font-medium text-primary font-tabular-nums">
                  {fmtNumber(fee.amount, cur)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Totals */}
      <div className="mt-8 flex justify-end">
        <table className="w-72 border-collapse font-tabular-nums">
          <tbody>
            <tr>
              <td className="py-2.5 text-sm text-secondary">Subtotal</td>
              <td className="py-2.5 text-right text-sm text-primary">{fmtNumber(invoice.subtotal, cur)}</td>
            </tr>
            {Number(invoice.discountTotal) > 0 && (
              <tr>
                <td className="py-2.5 text-sm text-secondary">Discount</td>
                <td className="py-2.5 text-right text-sm text-success-text">−{fmtNumber(invoice.discountTotal, cur)}</td>
              </tr>
            )}
            <tr>
              <td className="py-2.5 text-sm text-secondary">Tax</td>
              <td className="py-2.5 text-right text-sm text-primary">
                {Number(invoice.taxTotal) > 0
                  ? fmtNumber(invoice.taxTotal, cur)
                  : fmtNumber(0, cur)}
              </td>
            </tr>
            {Number(invoice.feeTotal) > 0 && (
              <tr>
                <td className="py-2.5 text-sm text-secondary">Fees</td>
                <td className="py-2.5 text-right text-sm text-primary">{fmtNumber(invoice.feeTotal, cur)}</td>
              </tr>
            )}
            <tr className="border-t-2 border-color pt-3">
              <td className="pt-3 text-lg font-semibold text-secondary">Total</td>
              <td className="pt-3 text-right text-2xl font-bold text-primary">{fmtNumber(invoice.total, cur)}</td>
            </tr>
            {hasAmountPaid && (
              <>
                <tr>
                  <td className="py-2.5 text-sm text-secondary">Paid</td>
                  <td className="py-2.5 text-right text-sm text-success-text font-tabular-nums">
                    +{fmtNumber(invoice.amountPaid, cur)}
                  </td>
                </tr>
                <tr className="border-t border-color pt-2.5">
                  <td className="pt-2.5 text-base font-semibold text-primary-brand">Amount Due</td>
                  <td className="pt-2.5 text-right text-2xl font-bold text-primary-brand">
                    {fmtNumber(invoice.amountDue, cur)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Notes, terms, payment instructions */}
      {invoice.notes && (
        <p className="mt-6 text-sm text-secondary whitespace-pre-line">{invoice.notes}</p>
      )}
      {invoice.terms && (
        <p className="mt-2 text-xs text-tertiary whitespace-pre-line">{invoice.terms}</p>
      )}
      {invoice.paymentInstructions && (
        <div className="mt-6 rounded-lg bg-surface-alt p-4">
          <h4 className="text-xs font-semibold text-tertiary uppercase mb-2">Payment Instructions</h4>
          <p className="text-sm text-secondary whitespace-pre-line">{invoice.paymentInstructions}</p>
        </div>
      )}

      {/* Attachments */}
      {invoice.attachments && invoice.attachments.length > 0 && (
        <div className="mt-8">
          <h4 className="text-xs font-semibold text-tertiary uppercase tracking-wider mb-3">
            Photos &amp; Attachments
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {invoice.attachments.map((a) => (
              <div key={a.id} className="group">
                {a.type.startsWith("image/") ? (
                  <img
                    src={a.url}
                    alt={a.name}
                    className={`w-full h-24 object-cover rounded-lg border border-color ${
                      a.category === "before"
                        ? "ring-2 ring-offset-2 ring-warning-text"
                        : a.category === "after"
                        ? "ring-2 ring-offset-2 ring-success-text"
                        : ""
                    }`}
                  />
                ) : (
                  <div className="flex h-24 w-full items-center justify-center rounded-lg border border-color bg-surface-alt">
                    <FileText className="h-6 w-6 text-tertiary" />
                  </div>
                )}
                <p className="mt-1 text-xs text-tertiary truncate">{a.name}</p>
                {a.category && a.category !== "attachment" && (
                  <span className="text-[10px] font-medium capitalize text-secondary">
                    {a.category}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment link / CTA */}
      {invoice.paymentLink && (
        <div className="mt-10 border-t border-color pt-6 text-center">
          <div className="mb-2 text-2xl font-bold text-primary">{fmtNumber(invoice.amountDue, cur)}</div>
          <p className="mb-4 text-sm text-tertiary">Total amount due</p>
          <a
            href={invoice.paymentLink}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-action px-8 py-3.5 text-base font-semibold text-on-primary shadow-md hover:bg-primary-hover hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          >
            <CreditCard className="h-5 w-5" />
            Pay now
          </a>
          <p className="mt-3 text-xs text-tertiary">
            Secure online payment — no account required
          </p>
        </div>
      )}
    </div>
  );
});
