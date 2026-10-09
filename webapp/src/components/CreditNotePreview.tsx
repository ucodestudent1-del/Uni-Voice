import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Decimal } from "decimal.js";
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

export interface PreviewApplication {
  amount: string;
  invoiceNumber?: string;
  invoiceId?: string;
  appliedAt?: string;
  applicationMethod?: string | null;
}

export interface PreviewCreditNote {
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
  customerPhone?: string;
  customerAddress?: string;
  creditNoteNumber?: string;
  issueDate?: string;
  currency: string;
  reason?: string;
  notes?: string;
  terms?: string;
  referenceInvoiceNumber?: string;
  referenceInvoiceId?: string | null;
  items: PreviewLineItem[];
  fees: PreviewFee[];
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  feeTotal: string;
  total: string;
  appliedTotal: string;
  amountDue: string;
  status: string;
  applications: PreviewApplication[];
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
  finalized: { label: "Finalized", className: "status-info-bg status-info-text" },
  applied: { label: "Applied", className: "status-success-bg status-success-text" },
  cancelled: { label: "Cancelled", className: "status-tertiary-bg status-tertiary-text" },
  void: { label: "Void", className: "status-tertiary-bg status-tertiary-text" },
};

const APPLICATION_METHOD_LABELS: Record<string, string> = {
  refund: "Refunded to customer",
  balance_credit: "Credit held on account",
  invoice_offset: "Applied to invoice",
  default: "Applied",
};

function applicationMethodLabel(method?: string | null): string {
  if (!method) return "Applied";
  return APPLICATION_METHOD_LABELS[method] ?? APPLICATION_METHOD_LABELS.default;
}

export default React.memo(function CreditNotePreview({ creditNote }: { creditNote: PreviewCreditNote }) {
  const cur = creditNote.currency;
  const meta = useMemo(() => getCurrencyMetadata(cur), [cur]);

  const lineTotals = useMemo(() => {
    return creditNote.items.map((item) => fmtNumber(lineTotalForItem(item).toFixed(2), cur));
  }, [creditNote.items, cur]);

  const hasDiscount = hasNonZero(creditNote.discountTotal);
  const hasFees = hasNonZero(creditNote.feeTotal);
  const hasTax = hasNonZero(creditNote.taxTotal);
  const hasApplications = creditNote.applications && creditNote.applications.length > 0;

  const itemTaxRates = useMemo(() => {
    const set = new Set<string>();
    creditNote.items.forEach((item) => {
      if (!new Decimal(item.taxRate ?? 0).isZero()) {
        set.add(fmtRate(item.taxRate));
      }
    });
    return Array.from(set);
  }, [creditNote.items]);

  const statusCfg = STATUS_CONFIG[creditNote.status] ?? STATUS_CONFIG.draft;

  return (
    <div className="credit-note-preview bg-surface border border-color rounded-xl shadow-sm font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif]">
      <div className="p-8">
        {/* === Header: CREDIT NOTE + business info === */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-warning-bg text-2xl font-bold text-warning-text">
              {creditNote.businessLogo ? null : (creditNote.businessName?.charAt(0) ?? "?")}
            </div>
            {creditNote.businessLogo ? (
              <img src={creditNote.businessLogo} alt={creditNote.businessName} className="h-14 w-auto rounded-lg object-contain" />
            ) : null}
            <div>
              <h1 className="text-3xl font-bold text-primary-brand">CREDIT NOTE</h1>
              <h2 className="text-xl font-semibold text-primary mt-1">{creditNote.creditNoteNumber || "Draft"}</h2>
            </div>
          </div>
          <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", statusCfg.className)}>
            {statusCfg.label}
          </span>
        </div>

        {(creditNote.businessAddress || creditNote.businessEmail || creditNote.businessPhone || creditNote.businessWebsite) && (
          <p className="mt-3 max-w-xs text-sm text-secondary whitespace-pre-line">
            {creditNote.businessAddress}
            {creditNote.businessEmail ? `\n${creditNote.businessEmail}` : ""}
            {creditNote.businessPhone ? `\n${creditNote.businessPhone}` : ""}
            {creditNote.businessWebsite ? `\n${creditNote.businessWebsite}` : ""}
          </p>
        )}

        {(creditNote.businessTaxId || creditNote.businessRegistrationNumber) && (
          <p className="mt-2 text-sm text-secondary">
            Tax ID: {creditNote.businessTaxId || creditNote.businessRegistrationNumber}
          </p>
        )}

        {/* === Credit note metadata panel === */}
        <div className="mt-6 rounded-lg border border-color bg-surface-alt p-4">
          <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {creditNote.creditNoteNumber && (
              <div>
                <span className="invoice-section-title block">Credit Note #</span>
                <p className="mt-0.5 text-sm font-medium text-primary">{creditNote.creditNoteNumber}</p>
              </div>
            )}
            {creditNote.issueDate && (
              <div>
                <span className="invoice-section-title block">Date</span>
                <p className="mt-0.5 text-sm font-medium text-primary">{formatDateLong(creditNote.issueDate)}</p>
              </div>
            )}
            {creditNote.referenceInvoiceId ? (
              <div>
                <span className="invoice-section-title block">Reference Invoice</span>
                <p className="mt-0.5 text-sm font-medium text-primary">
                  <Link
                    to={`/app/invoices/${creditNote.referenceInvoiceId}`}
                    className="text-primary-brand hover:underline"
                  >
                    {creditNote.referenceInvoiceNumber || "View invoice"}
                  </Link>
                </p>
              </div>
            ) : creditNote.referenceInvoiceNumber ? (
              <div>
                <span className="invoice-section-title block">Original Invoice #</span>
                <p className="mt-0.5 text-sm font-medium text-primary">{creditNote.referenceInvoiceNumber}</p>
              </div>
            ) : null}
            <div>
              <span className="invoice-section-title block">Currency</span>
              <p className="mt-0.5 text-sm font-medium text-primary">{cur} ({meta.symbol})</p>
            </div>
          </div>
        </div>

        {/* === Reason for credit === */}
        {creditNote.reason && (
          <div className="mt-4 rounded-lg bg-warning-bg border border-warning-border p-3">
            <span className="invoice-section-title block">Reason for Credit</span>
            <p className="mt-1 text-sm text-warning-text">{creditNote.reason}</p>
          </div>
        )}

        {/* === Credit To section === */}
        <div className="mt-6">
          <h3 className="invoice-section-title">Credit To</h3>
          {creditNote.customerName ? (
            <div className="mt-2 space-y-0.5">
              <p className="text-base font-semibold text-primary">{creditNote.customerName}</p>
              {creditNote.customerCompanyName && (
                <p className="text-sm text-secondary">{creditNote.customerCompanyName}</p>
              )}
              {creditNote.customerEmail && (
                <a
                  href={`mailto:${creditNote.customerEmail}`}
                  className="text-sm text-secondary hover:text-primary-brand"
                >
                  {creditNote.customerEmail}
                </a>
              )}
              {creditNote.customerPhone && <p className="text-sm text-secondary">{creditNote.customerPhone}</p>}
              {creditNote.customerAddress && (
                <p className="text-sm text-secondary whitespace-pre-line">{creditNote.customerAddress}</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm italic text-tertiary">No customer selected</p>
          )}
        </div>

        {/* === Line items table === */}
        <div className="mt-6 overflow-x-auto rounded-lg border border-color">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-alt">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tertiary">#</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Qty</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Unit Price</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Tax Rate</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-tertiary">Credit</th>
              </tr>
            </thead>
            <tbody>
              {creditNote.items.map((item, i) => {
                const lineTotal = lineTotals[i];
                const hasRate = new Decimal(item.unitPrice || 0).gt(0);
                const taxPct = new Decimal(item.taxRate ?? 0).mul(100);
                const showTaxNote = !taxPct.isZero() || item.isTaxInclusive;
                return (
                  <tr key={i} className="border-t border-color-subtle">
                    <td className="px-4 py-3 text-center font-tabular-nums text-tertiary">{i + 1}</td>
                    <td className="px-3 py-3 align-top text-sm text-primary break-words">
                      {item.description || <span className="italic text-tertiary">Untitled item</span>}
                      {showTaxNote && (
                        <span className="mt-0.5 block text-xs text-tertiary">
                          {item.isTaxInclusive ? `incl. ${taxPct.toFixed(2)}% tax` : `${taxPct.toFixed(2)}% tax`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary text-right font-tabular-nums">
                      {fmtQuantity(item.quantity)}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary text-right font-tabular-nums">
                      {hasRate ? fmtNumber(item.unitPrice, cur) : "—"}
                    </td>
                    <td className="px-3 py-3 align-top text-sm text-tertiary text-right font-tabular-nums">
                      <span className="inline-block rounded bg-surface px-1.5 py-0.5 text-xs font-medium">
                        {fmtRate(item.taxRate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-primary text-right font-tabular-nums">
                      -{lineTotal}
                    </td>
                  </tr>
                );
              })}
              {creditNote.items.length === 0 && (
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
        {creditNote.fees.length > 0 && (
          <div className="mt-2 overflow-x-auto rounded-lg border border-color">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-alt">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Tax Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-tertiary">Fee</th>
                </tr>
              </thead>
              <tbody>
                {creditNote.fees.map((fee, i) => (
                  <tr key={i} className="border-t border-color-subtle">
                    <td className="px-4 py-3 align-top text-sm text-primary break-words">
                      {fee.description || <span className="italic text-tertiary">Untitled fee</span>}
                    </td>
                    <td className="px-3 py-3 text-sm text-tertiary text-right font-tabular-nums">
                      <span className="inline-block rounded bg-surface px-1.5 py-0.5 text-xs font-medium">
                        {fmtRate(fee.taxRate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-primary text-right font-tabular-nums">
                      -{fmtNumber(fee.amount, cur)}
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
              <span className="text-primary">{fmtNumber(creditNote.subtotal, cur)}</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between py-2 text-sm">
                <span className="text-tertiary">Discount</span>
                <span className="text-success-text">−{fmtNumber(creditNote.discountTotal, cur)}</span>
              </div>
            )}
            {hasTax && (
              <div className="flex justify-between py-2 text-sm">
                <span className="text-tertiary">Tax</span>
                <span className="text-primary">{fmtNumber(creditNote.taxTotal, cur)}</span>
              </div>
            )}
            {hasFees && (
              <div className="flex justify-between py-2 text-sm">
                <span className="text-tertiary">Fees</span>
                <span className="text-primary">{fmtNumber(creditNote.feeTotal, cur)}</span>
              </div>
            )}
            <div className="border-t-2 border-color pt-3">
              <div className="flex justify-between">
                <span className="text-base font-semibold text-secondary">Total Credit</span>
                <span className="text-2xl font-bold text-primary-brand">
                  -{fmtNumber(creditNote.total, cur)}
                </span>
              </div>
            </div>
            {hasNonZero(creditNote.appliedTotal) && (
              <>
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-tertiary">Amount Applied</span>
                  <span className="text-success-text">−{fmtNumber(creditNote.appliedTotal, cur)}</span>
                </div>
                <div className="border-t-2 border-color pt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-secondary">Amount Remaining</span>
                    <span className="text-xl font-bold text-primary-brand">
                      -{fmtNumber(creditNote.amountDue, cur)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* === Credit Application === */}
        <div className="mt-6 rounded-lg border border-color bg-surface-alt p-4">
          <h3 className="invoice-section-title">Credit Application</h3>
          <p className="mt-1 text-sm text-secondary">
            Credit Amount: <span className="font-medium text-primary">{fmtNumber(creditNote.total, cur)}</span>
          </p>
          <p className="mt-2 text-sm text-secondary">
            This credit will be:
          </p>
          <ul className="mt-1 text-sm text-secondary space-y-0.5">
            <li>• Applied to the customer's outstanding balance, <strong>or</strong></li>
            <li>• Refunded to the customer, <strong>or</strong></li>
            <li>• Held as a credit toward a future invoice.</li>
          </ul>
        </div>

        {/* === Applications table === */}
        {hasApplications && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-color">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-alt">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tertiary">Invoice</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Amount Applied</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-tertiary">Method</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Date</th>
                </tr>
              </thead>
              <tbody>
                {creditNote.applications.map((app, i) => (
                  <tr key={i} className="border-t border-color-subtle">
                    <td className="px-4 py-3 text-sm text-primary">
                      {app.invoiceNumber || "—"}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary text-right font-tabular-nums">
                      {fmtNumber(app.amount, cur)}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {applicationMethodLabel(app.applicationMethod)}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary text-right font-tabular-nums">
                      {app.appliedAt ? formatDateLong(app.appliedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* === Notes, terms, reference === */}
        {creditNote.notes && (
          <div className="border-t border-color px-8 py-6">
            <h4 className="invoice-section-title">Notes</h4>
            <p className="mt-2 text-sm text-secondary whitespace-pre-line">{creditNote.notes}</p>
          </div>
        )}

        {creditNote.terms && (
          <div className="border-t border-color px-8 py-6">
            <h4 className="invoice-section-title">Terms &amp; Conditions</h4>
            <p className="mt-2 text-xs text-tertiary whitespace-pre-line">{creditNote.terms}</p>
          </div>
        )}

        {creditNote.referenceInvoiceNumber && (
          <div className="border-t border-color px-8 py-6">
            <p className="text-sm text-tertiary">
              This credit note relates to Invoice <strong>{creditNote.referenceInvoiceNumber}</strong>
              {hasNonZero(creditNote.total) && (
                <span> and reduces the amount originally invoiced by <strong>-{fmtNumber(creditNote.total, cur)}</strong>.</span>
              )}
            </p>
          </div>
        )}

        <div className="border-t border-color px-8 py-6 text-center">
          <p className="text-sm text-tertiary">
            Credit Note #{creditNote.creditNoteNumber || "—"}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
});
