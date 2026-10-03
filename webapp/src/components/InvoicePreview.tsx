import React, { useMemo } from "react";
import { Decimal } from "decimal.js";
import { CreditCard, FileText } from "lucide-react";
import { formatCurrency, formatDateLong } from "../utils/format";
import { getCurrencyMetadata } from "../types/currency";
import { cn } from "../lib/utils";

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
  businessTaxId?: string;
  businessRegistrationNumber?: string;
  customerName?: string;
  customerCompanyName?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerPhone?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  currency: string;
  notes?: string;
  terms?: string;
  paymentInstructions?: string;
  poNumber?: string;
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
  isFinalized?: boolean;
}

function fmtNumber(v: string | number | undefined, currency: string): string {
  const meta = getCurrencyMetadata(currency);
  const dp = meta.decimalPlaces;
  return formatCurrency(new Decimal(v ?? 0), currency, dp);
}

function fmtRate(rate: string | undefined | null): string {
  const v = new Decimal(rate ?? 0).mul(100);
  if (v.isZero()) return "0.00%";
  return `${v.toFixed(2)}%`;
}

function fmtQuantity(qty: string | undefined | null): string {
  const d = new Decimal(qty ?? 0);
  if (d.isZero()) return "0";
  return d.toFixed(2).replace(/\.?0+$/, "");
}

function hasNonZero(value: string | undefined | null): boolean {
  return new Decimal(value ?? 0).gt(0);
}

function isPastDue(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  try {
    return new Date(dueDate) < new Date();
  } catch {
    return false;
  }
}

function lineTotalForItem(item: PreviewLineItem): Decimal {
  const qty = new Decimal(item.quantity || 1);
  const price = new Decimal(item.unitPrice || 0);
  let total = qty.mul(price);
  if (item.discount && Number(item.discount) > 0) {
    if (item.discountType === "percentage") {
      total = total.minus(total.mul(new Decimal(item.discount).div(100)));
    } else {
      total = total.minus(new Decimal(item.discount));
    }
  }
  return total;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "status-warning-bg status-warning-text" },
  sent: { label: "Sent", className: "status-info-bg status-info-text" },
  viewed: { label: "Viewed", className: "status-info-bg status-info-text" },
  partially_paid: { label: "Partially Paid", className: "status-warning-bg status-warning-text" },
  paid: { label: "Paid", className: "status-success-bg status-success-text" },
  overdue: { label: "Overdue", className: "status-error-bg status-error-text" },
  cancelled: { label: "Cancelled", className: "status-tertiary-bg status-tertiary-text" },
  void: { label: "Void", className: "status-tertiary-bg status-tertiary-text" },
  pending: { label: "Pending", className: "status-info-bg status-info-text" },
  failed: { label: "Failed", className: "status-error-bg status-error-text" },
  refunded: { label: "Refunded", className: "status-tertiary-bg status-tertiary-text" },
};

export default React.memo(function InvoicePreview({ invoice }: { invoice: PreviewInvoice }) {
  const cur = invoice.currency;
  const overdue = isPastDue(invoice.dueDate);
  const meta = useMemo(() => getCurrencyMetadata(cur), [cur]);

  const lineTotals = useMemo(() => {
    return invoice.items.map((item) => fmtNumber(lineTotalForItem(item).toFixed(2), cur));
  }, [invoice.items, cur]);

  const hasAmountPaid = hasNonZero(invoice.amountPaid);
  const hasDiscount = hasNonZero(invoice.discountTotal);
  const hasFees = hasNonZero(invoice.feeTotal);
  const hasTax = hasNonZero(invoice.taxTotal);

  const itemTaxRates = useMemo(() => {
    const set = new Set<string>();
    invoice.items.forEach((item) => {
      if (!new Decimal(item.taxRate ?? 0).isZero()) {
        set.add(fmtRate(item.taxRate));
      }
    });
    return Array.from(set);
  }, [invoice.items]);

  const effectiveStatus = overdue && invoice.status !== "paid" ? "overdue" : invoice.status;
  const statusCfg = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.draft;

  return (
    <div className="invoice-preview bg-surface border border-color rounded-xl shadow-sm font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif]">
      <div className="p-8">
        {/* === Header: business info + status === */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            {invoice.businessLogo ? (
              <img src={invoice.businessLogo} alt={invoice.businessName} className="h-14 w-auto rounded-lg object-contain" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-bg text-2xl font-bold text-primary-text">
                {invoice.businessName?.charAt(0) ?? "?"}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-primary">{invoice.businessName || "Your Business"}</h2>
              {invoice.businessEmail && <p className="text-sm text-secondary">{invoice.businessEmail}</p>}
              {invoice.businessPhone && <p className="text-sm text-secondary">{invoice.businessPhone}</p>}
              {invoice.businessWebsite && (
                <a
                  href={invoice.businessWebsite.startsWith("http") ? invoice.businessWebsite : `https://${invoice.businessWebsite}`}
                  className="text-sm text-primary-brand hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {invoice.businessWebsite}
                </a>
              )}
              {(invoice.businessTaxId || invoice.businessRegistrationNumber) && (
                <p className="mt-1 text-sm text-secondary">
                  Tax ID: {invoice.businessTaxId || invoice.businessRegistrationNumber}
                </p>
              )}
            </div>
          </div>
          <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", statusCfg.className)}>
            {statusCfg.label}
          </span>
        </div>

        {invoice.businessAddress && (
          <p className="mt-3 max-w-xs text-sm text-secondary whitespace-pre-line">{invoice.businessAddress}</p>
        )}

        {/* === Invoice metadata panel === */}
        <div className="mt-6 rounded-lg border border-color bg-surface-alt p-4">
          <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {invoice.invoiceNumber && (
              <div>
                <span className="block text-xs font-semibold uppercase text-tertiary">Invoice #</span>
                <p className="mt-0.5 text-sm font-medium text-primary">{invoice.invoiceNumber}</p>
              </div>
            )}
            {invoice.issueDate && (
              <div>
                <span className="block text-xs font-semibold uppercase text-tertiary">Issue date</span>
                <p className="mt-0.5 text-sm font-medium text-primary">{formatDateLong(invoice.issueDate)}</p>
              </div>
            )}
            {invoice.dueDate && (
              <div>
                <span className="block text-xs font-semibold uppercase text-tertiary">Due date</span>
                <p className="mt-0.5 text-sm font-medium text-primary">{formatDateLong(invoice.dueDate)}</p>
              </div>
            )}
            <div>
              <span className="block text-xs font-semibold uppercase text-tertiary">Currency</span>
              <p className="mt-0.5 text-sm font-medium text-primary">{cur} ({meta.symbol})</p>
            </div>
            {invoice.poNumber && (
              <div>
                <span className="block text-xs font-semibold uppercase text-tertiary">P.O. / Ref #</span>
                <p className="mt-0.5 text-sm font-medium text-primary">{invoice.poNumber}</p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <span className="block text-xs font-semibold uppercase text-tertiary">Payment terms</span>
                <p className="mt-0.5 text-sm font-medium text-primary">{invoice.terms}</p>
              </div>
            )}
          </div>
        </div>

        {/* === Bill To section === */}
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-tertiary">Bill To</h3>
          {invoice.customerName ? (
            <div className="mt-2 space-y-0.5">
              <p className="text-base font-semibold text-primary">{invoice.customerName}</p>
              {invoice.customerCompanyName && (
                <p className="text-sm text-secondary">{invoice.customerCompanyName}</p>
              )}
              {invoice.customerEmail && (
                <a
                  href={`mailto:${invoice.customerEmail}`}
                  className="text-sm text-secondary hover:text-primary-brand"
                >
                  {invoice.customerEmail}
                </a>
              )}
              {invoice.customerPhone && <p className="text-sm text-secondary">{invoice.customerPhone}</p>}
              {invoice.customerAddress && (
                <p className="text-sm text-secondary whitespace-pre-line">{invoice.customerAddress}</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm italic text-tertiary">No customer selected</p>
          )}
        </div>

        {/* === Line items table === */}
        <div className="mt-6 overflow-x-auto rounded-lg border border-color">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="bg-surface-alt">
                <th className="py-3 pl-4 pr-2 text-left text-xs font-semibold uppercase text-tertiary">#</th>
                <th className="py-3 pl-3 pr-2 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
                <th className="py-3 pl-2 pr-2 text-right text-xs font-semibold uppercase text-tertiary">Qty</th>
                <th className="py-3 pl-2 pr-2 text-right text-xs font-semibold uppercase text-tertiary">Unit Price</th>
                <th className="py-3 pl-2 pr-2 text-right text-xs font-semibold uppercase text-tertiary">Tax Rate</th>
                <th className="py-3 pl-2 pr-4 text-right text-xs font-semibold uppercase text-tertiary">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => {
                const lineTotal = lineTotals[i];
                const hasRate = new Decimal(item.unitPrice || 0).gt(0);
                const taxPct = new Decimal(item.taxRate ?? 0).mul(100);
                const showTaxNote = !taxPct.isZero() || item.isTaxInclusive;
                return (
                  <tr key={i} className="border-t border-color-subtle">
                    <td className="py-3 pl-4 pr-2 text-sm text-tertiary font-tabular-nums">{i + 1}</td>
                    <td className="py-3 pl-3 pr-2 align-top text-sm text-primary break-words">
                      {item.description || <span className="italic text-tertiary">Untitled item</span>}
                      {showTaxNote && (
                        <span className="mt-0.5 block text-xs text-tertiary">
                          {item.isTaxInclusive ? `incl. ${taxPct.toFixed(2)}% tax` : `${taxPct.toFixed(2)}% tax`}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pl-2 pr-2 text-sm text-secondary text-right font-tabular-nums">
                      {fmtQuantity(item.quantity)}
                    </td>
                    <td className="py-3 pl-2 pr-2 text-sm text-secondary text-right font-tabular-nums">
                      {hasRate ? fmtNumber(item.unitPrice, cur) : "—"}
                    </td>
                    <td className="py-3 pl-2 pr-2 align-top text-sm text-tertiary text-right font-tabular-nums">
                      <span className="inline-block rounded bg-surface px-1.5 py-0.5 text-xs font-medium">
                        {fmtRate(item.taxRate)}
                      </span>
                    </td>
                    <td className="py-3 pl-2 pr-4 text-sm font-medium text-primary text-right font-tabular-nums">
                      {lineTotal}
                    </td>
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

          {itemTaxRates.length > 0 && (
            <div className="px-4 pb-3 text-xs text-tertiary">
              Tax rate: {itemTaxRates.join(", ")}
            </div>
          )}
        </div>

        {/* === Fees table === */}
        {invoice.fees.length > 0 && (
          <div className="mt-2 overflow-x-auto rounded-lg border border-color">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="bg-surface-alt">
                  <th className="py-3 pl-4 pr-2 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
                  <th className="py-3 pl-2 pr-2 text-right text-xs font-semibold uppercase text-tertiary">Tax Rate</th>
                  <th className="py-3 pl-2 pr-4 text-right text-xs font-semibold uppercase text-tertiary">Fee</th>
                </tr>
              </thead>
              <tbody>
                {invoice.fees.map((fee, i) => (
                  <tr key={i} className="border-t border-color-subtle">
                    <td className="py-3 pl-4 pr-2 align-top text-sm text-primary break-words">
                      {fee.description || <span className="italic text-tertiary">Untitled fee</span>}
                    </td>
                    <td className="py-3 pl-2 pr-2 text-sm text-tertiary text-right font-tabular-nums">
                      <span className="inline-block rounded bg-surface px-1.5 py-0.5 text-xs font-medium">
                        {fmtRate(fee.taxRate)}
                      </span>
                    </td>
                    <td className="py-3 pl-2 pr-4 text-sm font-medium text-primary text-right font-tabular-nums">
                      {fmtNumber(fee.amount, cur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* === Totals === */}
        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-1 font-tabular-nums">
            <div className="flex justify-between py-2 text-sm">
              <span className="text-tertiary">Subtotal</span>
              <span className="text-primary">{fmtNumber(invoice.subtotal, cur)}</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between py-2 text-sm">
                <span className="text-tertiary">Discount</span>
                <span className="text-success-text">−{fmtNumber(invoice.discountTotal, cur)}</span>
              </div>
            )}
            {hasTax && (
              <div className="flex justify-between py-2 text-sm">
                <span className="text-tertiary">Tax</span>
                <span className="text-primary">{fmtNumber(invoice.taxTotal, cur)}</span>
              </div>
            )}
            {hasFees && (
              <div className="flex justify-between py-2 text-sm">
                <span className="text-tertiary">Fees</span>
                <span className="text-primary">{fmtNumber(invoice.feeTotal, cur)}</span>
              </div>
            )}
            <div className="border-t-2 border-color pt-3">
              <div className="flex justify-between">
                <span className="text-base font-semibold text-secondary">Total</span>
                <span className="text-xl font-bold text-primary">{fmtNumber(invoice.total, cur)}</span>
              </div>
            </div>
            {hasAmountPaid && (
              <div className="flex justify-between py-2 text-sm">
                <span className="text-tertiary">Paid</span>
                <span className="text-success-text">+{fmtNumber(invoice.amountPaid, cur)}</span>
              </div>
            )}
            <div className="border-t-2 border-color pt-3">
              <div className="flex justify-between">
                <span className="text-lg font-semibold text-secondary">Amount Due</span>
                <span className="text-2xl font-extrabold text-primary-brand">
                  {fmtNumber(invoice.amountDue, cur)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === Footer: notes, payment instructions, terms, attachments, payment CTA === */}
      {invoice.notes && invoice.notes.length > 0 && (
        <div className="border-t border-color px-8 py-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-tertiary">Notes</h4>
          <p className="mt-2 text-sm text-secondary whitespace-pre-line">{invoice.notes}</p>
        </div>
      )}

      {invoice.paymentInstructions && invoice.paymentInstructions.length > 0 && (
        <div className="border-t border-color px-8 py-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-tertiary">Payment Instructions</h4>
          <div className="mt-2 rounded-lg bg-surface-alt p-4">
            <p className="text-sm text-secondary whitespace-pre-line">{invoice.paymentInstructions}</p>
          </div>
        </div>
      )}

      {invoice.terms && invoice.terms.length > 0 && (
        <div className="border-t border-color px-8 py-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-tertiary">Terms &amp; Conditions</h4>
          <p className="mt-2 text-xs text-tertiary whitespace-pre-line">{invoice.terms}</p>
        </div>
      )}

      {invoice.attachments && invoice.attachments.length > 0 && (
        <div className="border-t border-color px-8 py-6">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-tertiary">Photos &amp; Attachments</h4>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                <p className="mt-1 text-xs text-tertiary truncate" title={a.name}>
                  {a.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {invoice.paymentLink && hasNonZero(invoice.amountDue) && (
        <div className="border-t border-color px-8 py-8 text-center">
          <div className="mb-3 text-3xl font-extrabold text-primary-brand">
            {fmtNumber(invoice.amountDue, cur)}
          </div>
          <p className="mb-4 text-sm text-tertiary">Total amount due</p>
          <a
            href={invoice.paymentLink}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-action px-8 py-3.5 text-base font-semibold text-on-primary shadow-md hover:bg-primary-hover hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <CreditCard className="h-5 w-5" />
            Pay now
          </a>
          <p className="mt-3 text-xs text-tertiary">Secure online payment — no account required</p>
        </div>
      )}

      <div className="border-t border-color px-8 py-4 text-center text-xs text-tertiary">
        Invoice #{invoice.invoiceNumber || "—"}. All rights reserved.
      </div>
    </div>
  );
});