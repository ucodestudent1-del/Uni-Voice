import React, { useMemo } from "react";
import { Decimal } from "decimal.js";
import { formatCurrency, formatDateLong, formatTaxRate, formatTaxRateWithName } from "../utils/format";
import { getCurrencyMetadata } from "../types/currency";
import { StatusBadge, invoiceStatusConfig, InvoiceLifecycle, isOverdueStatus } from "./ui";
import { cn } from "../lib/utils";
import type { ApiInvoice } from "../types/api";

export interface InvoiceDisplayProps {
  invoice: ApiInvoice;
  businessName?: string;
  businessLogo?: string;
  businessAddress?: string;
  businessTaxId?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessWebsite?: string;
  customerCompanyName?: string;
  customerAddress?: string;
  showLifecycle?: boolean;
  compactTaxes?: boolean;
  className?: string;
}

function fmtNumber(v: Decimal.Value, currency: string, decimalPlaces?: number): string {
  const meta = getCurrencyMetadata(currency);
  return formatCurrency(v, currency, decimalPlaces ?? meta.decimalPlaces);
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

interface TaxGroup {
  rate: string;
  name: string | null;
  taxableBase: Decimal;
  taxAmount: Decimal;
}

export default React.memo(function InvoiceDisplay({
  invoice,
  businessName,
  businessLogo,
  businessAddress,
  businessTaxId,
  businessEmail,
  businessPhone,
  businessWebsite,
  customerCompanyName,
  customerAddress,
  showLifecycle = true,
  compactTaxes = false,
  className,
}: InvoiceDisplayProps) {
  const currency = invoice.currency;
  const isOverdue = isOverdueStatus(invoice.status, invoice.due_date);
  const overdue = isPastDue(invoice.due_date);
  const effectiveStatus = (overdue && !isOverdue && invoice.status !== "paid" && !["cancelled", "void"].includes(invoice.status)) ? "overdue" : invoice.status;

  const hasDiscount = hasNonZero(invoice.discount_total);
  const hasFees = hasNonZero(invoice.fee_total);
  const hasTax = hasNonZero(invoice.tax_total);
  const hasAmountPaid = hasNonZero(invoice.amount_paid);
  const amountDue = new Decimal(invoice.amount_due ?? 0);
  const total = new Decimal(invoice.total ?? 0);

  const taxGroups = useMemo(() => {
    const map = new Map<string, TaxGroup>();
    invoice.items.forEach((item) => {
      const rate = item.tax_rate ?? "0";
      if (new Decimal(rate).isZero()) return;
      const key = `${rate}-${item.tax_name ?? ""}`;
      const existing = map.get(key);
      const lineSubtotal = new Decimal(item.line_subtotal ?? 0);
      const discount = new Decimal(item.discount ?? 0);
      const taxableBase = lineSubtotal.minus(discount);
      const taxAmount = new Decimal(item.tax_amount ?? 0);
      if (existing) {
        existing.taxableBase = existing.taxableBase.plus(taxableBase);
        existing.taxAmount = existing.taxAmount.plus(taxAmount);
      } else {
        map.set(key, {
          rate,
          name: item.tax_name ?? null,
          taxableBase: taxableBase,
          taxAmount: taxAmount,
        });
      }
    });
    invoice.fees.forEach((fee) => {
      const rate = fee.tax_rate ?? "0";
      if (new Decimal(rate).isZero()) return;
      const key = `fee-${rate}-${fee.tax_name ?? ""}`;
      const existing = map.get(key);
      const taxAmount = new Decimal(fee.tax_amount ?? 0);
      const taxableBase = new Decimal(fee.amount ?? 0);
      if (existing) {
        existing.taxableBase = existing.taxableBase.plus(taxableBase);
        existing.taxAmount = existing.taxAmount.plus(taxAmount);
      } else {
        map.set(key, {
          rate,
          name: fee.tax_name ?? null,
          taxableBase: taxableBase,
          taxAmount: taxAmount,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      return new Decimal(a.rate).comparedTo(new Decimal(b.rate));
    });
  }, [invoice.items, invoice.fees]);

  return (
    <div className={cn("invoice-display", className)}>
      {/* Header: Business info + Status */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          {businessLogo ? (
            <img src={businessLogo} alt={businessName || "Business"} className="h-14 w-auto rounded-lg object-contain" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-bg text-2xl font-bold text-primary-text">
              {businessName?.charAt(0) ?? "?"}
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-primary">{businessName || "Your Business"}</h2>
            <div className="mt-1 space-y-0.5">
              {businessEmail && <p className="text-sm text-secondary">{businessEmail}</p>}
              {businessPhone && <p className="text-sm text-secondary">{businessPhone}</p>}
              {businessWebsite && (
                <a
                  href={businessWebsite.startsWith("http") ? businessWebsite : `https://${businessWebsite}`}
                  className="text-sm text-primary-brand hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {businessWebsite}
                </a>
              )}
            </div>
            {businessTaxId && <p className="mt-2 text-sm text-secondary">Tax ID: {businessTaxId}</p>}
          </div>
        </div>
        <StatusBadge
          status={invoice.status}
          isOverdue={isOverdue}
          showLabel={true}
          config={invoiceStatusConfig}
          size="md"
        />
      </div>

      {businessAddress && (
        <p className="mt-3 max-w-xs text-sm text-secondary whitespace-pre-line">{businessAddress}</p>
      )}

      {/* Invoice Details */}
      <div className="mt-6 rounded-lg border border-color bg-surface-alt p-4">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {invoice.invoice_number && (
            <div>
              <span className="invoice-section-title block">Invoice #</span>
              <p className="mt-0.5 text-sm font-medium text-primary">{invoice.invoice_number}</p>
            </div>
          )}
          {invoice.issue_date && (
            <div>
              <span className="invoice-section-title block">Issue date</span>
              <p className="mt-0.5 text-sm font-medium text-primary">{formatDateLong(invoice.issue_date)}</p>
            </div>
          )}
          {invoice.due_date && (
            <div>
              <span className="invoice-section-title block">Due date</span>
              <p className="mt-0.5 text-sm font-medium text-primary">{formatDateLong(invoice.due_date)}</p>
              {overdue && amountDue.gt(0) && (
                <span className="text-xs text-error-text">Overdue</span>
              )}
            </div>
          )}
          <div>
            <span className="invoice-section-title block">Currency</span>
            <p className="mt-0.5 text-sm font-medium text-primary">
              {currency} ({getCurrencyMetadata(currency).symbol})
            </p>
          </div>
          {invoice.po_number && (
            <div>
              <span className="invoice-section-title block">P.O. / Ref #</span>
              <p className="mt-0.5 text-sm font-medium text-primary">{invoice.po_number}</p>
            </div>
          )}
        </div>
      </div>

      {/* Customer / Billing */}
      <div className="mt-6">
        <h3 className="invoice-section-title mb-2">Bill To</h3>
        {invoice.customer_name ? (
          <div className="mt-2 space-y-0.5">
            <p className="text-base font-semibold text-primary">{invoice.customer_name}</p>
            {customerCompanyName && (
              <p className="text-sm text-secondary">{customerCompanyName}</p>
            )}
            {invoice.customer_email && (
              <a
                href={`mailto:${invoice.customer_email}`}
                className="text-sm text-primary-brand hover:underline"
              >
                {invoice.customer_email}
              </a>
            )}
            {invoice.customer_phone && <p className="text-sm text-secondary">{invoice.customer_phone}</p>}
            {customerAddress && (
              <p className="text-sm text-secondary whitespace-pre-line">{customerAddress}</p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm italic text-tertiary">No customer selected</p>
        )}
      </div>

      {/* Lifecycle (optional) */}
      {showLifecycle && (
        <div className="mt-6">
          <InvoiceLifecycle status={invoice.status} isOverdue={isOverdue} />
        </div>
      )}

      {/* Line Items */}
      <div className="mt-6 overflow-x-auto rounded-lg border border-color">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-alt">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tertiary">#</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Qty</th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Rate</th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Tax Rate</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-tertiary">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => {
              const lineTotal = new Decimal(item.line_total ?? 0);
              const hasRate = new Decimal(item.unit_price ?? 0).gt(0);
              return (
                <tr key={item.id || i} className="border-t border-color-subtle">
                  <td className="px-4 py-3 text-center font-tabular-nums text-tertiary">{i + 1}</td>
                  <td className="px-3 py-3 align-top text-sm text-primary break-words">
                    {item.description || <span className="italic text-tertiary">Untitled item</span>}
                    {item.tax_rate && Number(new Decimal(item.tax_rate).mul(100)) > 0 && (
                      <span className="mt-0.5 block text-xs text-tertiary">
                        {item.is_tax_inclusive
                          ? `incl. ${new Decimal(item.tax_rate).mul(100).toFixed(2)}% tax`
                          : `${new Decimal(item.tax_rate).mul(100).toFixed(2)}% tax`}
                        {item.tax_name && ` (${item.tax_name})`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-secondary text-right font-tabular-nums">
                    {fmtQuantity(item.quantity)} {item.unit}
                  </td>
                  <td className="px-3 py-3 text-sm text-secondary text-right font-tabular-nums">
                    {hasRate ? fmtNumber(item.unit_price, currency) : "—"}
                  </td>
                  <td className="px-3 py-3 align-top text-sm text-tertiary text-right font-tabular-nums">
                    <span className="inline-block rounded bg-surface px-1.5 py-0.5 text-xs font-medium">
                      {formatTaxRateWithName(item.tax_rate, item.tax_name)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-primary text-right font-tabular-nums">
                    {fmtNumber(lineTotal, currency)}
                  </td>
                </tr>
              );
            })}
            {invoice.items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-tertiary">
                  No line items
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Tax Breakdown */}
        {!compactTaxes && taxGroups.length > 0 && (
          <div className="border-t border-color px-4 py-3">
            <div className="text-xs text-tertiary">
              Tax rate:{" "}
              {taxGroups
                .map((g) => formatTaxRateWithName(g.rate, g.name))
                .join(", ")}
            </div>
          </div>
        )}
      </div>

      {/* Fees */}
      {invoice.fees.length > 0 && (
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
              {invoice.fees.map((fee, i) => {
                const feeAmount = new Decimal(fee.amount ?? 0);
                const feeTotal = feeAmount.plus(new Decimal(fee.tax_amount ?? 0));
                return (
                  <tr key={fee.id || i} className="border-t border-color-subtle">
                    <td className="px-4 py-3 align-top text-sm text-primary break-words">
                      {fee.description || <span className="italic text-tertiary">Untitled fee</span>}
                    </td>
                    <td className="px-3 py-3 align-top text-sm text-tertiary text-right font-tabular-nums">
                      <span className="inline-block rounded bg-surface px-1.5 py-0.5 text-xs font-medium">
                        {formatTaxRateWithName(fee.tax_rate, fee.tax_name)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-primary text-right font-tabular-nums">
                      {fmtNumber(feeTotal, currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals Summary */}
      <div className="mt-6 flex justify-end">
        <div className="w-64 space-y-1 font-tabular-nums">
          <div className="flex justify-between py-2 text-sm">
            <span className="text-tertiary">Subtotal</span>
            <span className="text-primary">{fmtNumber(invoice.subtotal, currency)}</span>
          </div>
          {hasDiscount && (
            <div className="flex justify-between py-2 text-sm">
              <span className="text-tertiary">Discount</span>
              <span className="text-success-text">−{fmtNumber(invoice.discount_total, currency)}</span>
            </div>
          )}
          {hasTax && (
            <div className="flex justify-between py-2 text-sm">
              <span className="text-tertiary">Tax</span>
              <span className="text-primary">{fmtNumber(invoice.tax_total, currency)}</span>
            </div>
          )}
          {hasFees && (
            <div className="flex justify-between py-2 text-sm">
              <span className="text-tertiary">Fees</span>
              <span className="text-primary">{fmtNumber(invoice.fee_total, currency)}</span>
            </div>
          )}
          <div className="border-t-2 border-color pt-3">
            <div className="flex justify-between">
              <span className="text-base font-semibold text-secondary">Total</span>
              <span className="text-xl font-bold text-primary">{fmtNumber(invoice.total, currency)}</span>
            </div>
          </div>
          {hasAmountPaid && (
            <div className="flex justify-between py-2 text-sm">
              <span className="text-tertiary">Paid</span>
              <span className="text-success-text">+{fmtNumber(invoice.amount_paid, currency)}</span>
            </div>
          )}
          <div className="border-t-2 border-color pt-3">
            <div className="flex justify-between">
              <span className="text-lg font-semibold text-primary-brand">
                {amountDue.lte(0) ? "Paid in Full" : "Amount Due"}
              </span>
              <span className={cn(
                "text-2xl font-extrabold",
                amountDue.lte(0) ? "text-success-text" : "text-primary-brand"
              )}>
                {amountDue.lte(0) ? "✓" : fmtNumber(amountDue, currency)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
