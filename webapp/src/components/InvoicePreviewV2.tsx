import React, { useMemo } from "react";
import { Decimal } from "decimal.js";
import { CreditCard, FileText, Download, ExternalLink } from "lucide-react";
import { formatCurrency, formatDateLong, formatTaxRateWithName } from "../utils/format";
import { getCurrencyMetadata } from "../types/currency";

export interface PreviewLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount?: string;
  discountType?: "fixed" | "percentage";
  taxRate?: string;
  tax_name?: string | null;
  isTaxInclusive?: boolean;
}

export interface PreviewFee {
  description: string;
  amount: string;
  taxRate?: string;
  tax_name?: string | null;
  tax_amount?: string | null;
}

export interface PreviewAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  category?: "attachment" | "before" | "after";
}

export interface PreviewTaxGroup {
  rate: string;
  name: string | null;
  taxableBase: string;
  taxAmount: string;
}

export interface PaymentMethod {
  type: "bank" | "card" | "paypal" | "stripe" | "custom";
  label: string;
  details?: string;
  url?: string;
}

export interface PreviewInvoice {
  // Business / Header
  businessName: string;
  businessLegalName?: string | null;
  businessEmail?: string;
  businessPhone?: string;
  businessWebsite?: string;
  businessAddress?: string;
  businessLogo?: string;
  businessTaxId?: string;
  businessRegistrationNumber?: string;

  // Invoice metadata
  invoiceNumber?: string | null;
  invoiceTitle?: string | null;
  issueDate?: string;
  dueDate?: string;
  currency: string;
  poNumber?: string | null;
  projectName?: string | null;
  terms?: string | null;

  // Customer / Bill To
  customerName?: string | null;
  customerCompanyName?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerPhone?: string | null;
  customerTaxId?: string | null;

  // Line items & fees
  items: PreviewLineItem[];
  fees: PreviewFee[];
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  feeTotal: string;
  total: string;
  amountPaid: string;
  amountDue: string;

  // Notes & instructions
  notes?: string | null;
  paymentInstructions?: string | null;

  // Payment
  paymentMethods?: PaymentMethod[];
  paymentLink?: string;
  bankDetails?: string | null;

  // Deposit
  depositType?: "none" | "fixed" | "percentage" | null;
  depositValue?: string | null;
  depositDueDate?: string | null;
  depositPaymentPurpose?: string | null;
  depositPaid?: string | null;
  depositDue?: string | null;

  // Status & lifecycle
  status: string;
  isFinalized?: boolean;

  // Attachments
  attachments?: PreviewAttachment[];
}

function fmtNumber(v: string | number | Decimal.Value | undefined | null, currency: string, dp?: number): string {
  const meta = getCurrencyMetadata(currency);
  const decimals = dp ?? meta.decimalPlaces;
  const d = new Decimal(v ?? 0);
  return formatCurrency(d, currency, decimals);
}

function fmtQuantity(qty: string | undefined | null): string {
  const d = new Decimal(qty ?? 0);
  if (d.isZero()) return "0";
  return d.toFixed(2).replace(/\.?0+$/, "");
}

function fmtDate(d: string | undefined | null): string {
  if (!d) return "—";
  return formatDateLong(d);
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

function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const InvoiceHeader: React.FC<{ invoice: PreviewInvoice }> = React.memo(function InvoiceHeader({ invoice }) {
  const hasOverdue = isPastDue(invoice.dueDate) && !["paid", "cancelled", "void"].includes(invoice.status);
  const statusKey = hasOverdue ? "overdue" : invoice.status;
  const statusCfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.draft;

  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex items-start gap-4">
        {invoice.businessLogo ? (
          <img
            src={invoice.businessLogo}
            alt={invoice.businessName}
            className="h-16 w-auto rounded-xl object-contain"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary-bg text-2xl font-bold text-primary">
            {invoice.businessName?.charAt(0) ?? "?"}
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold text-primary">
            {invoice.businessLegalName || invoice.businessName || "Your Business"}
          </h2>
          {invoice.businessName && invoice.businessLegalName && (
            <p className="text-sm text-tertiary">{invoice.businessName}</p>
          )}
          <div className="mt-1 space-y-0.5">
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
          </div>
          {(invoice.businessTaxId || invoice.businessRegistrationNumber) && (
            <p className="mt-2 text-xs text-tertiary">
              Tax ID: {invoice.businessTaxId || invoice.businessRegistrationNumber}
            </p>
          )}
          {invoice.businessAddress && (
            <p className="mt-2 text-sm text-secondary whitespace-pre-line">{invoice.businessAddress}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
            statusCfg.className
          )}
        >
          {statusCfg.label}
        </span>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">{invoice.invoiceTitle || "Invoice"}</p>
          {invoice.invoiceNumber && (
            <p className="text-sm text-tertiary">#{invoice.invoiceNumber}</p>
          )}
        </div>
      </div>
    </div>
  );
});

const InvoiceMetaGrid: React.FC<{ invoice: PreviewInvoice }> = React.memo(function InvoiceMetaGrid({ invoice }) {
  const hasOverdue = isPastDue(invoice.dueDate) && !["paid", "cancelled", "void"].includes(invoice.status);

  return (
    <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-color bg-surface-alt p-4 sm:grid-cols-3">
      <div>
        <span className="invoice-section-title block">Invoice #</span>
        <p className="mt-0.5 text-sm font-medium text-primary">{invoice.invoiceNumber || "—"}</p>
      </div>

      <div>
        <span className="invoice-section-title block">Issue date</span>
        <p className="mt-0.5 text-sm font-medium text-primary">{fmtDate(invoice.issueDate)}</p>
      </div>

      <div>
        <span className="invoice-section-title block">Due date</span>
        <p className={cn("mt-0.5 text-sm font-medium", hasOverdue ? "text-error-text" : "text-primary")}>
          {fmtDate(invoice.dueDate)}
          {hasOverdue && <span className="ml-1 text-xs font-semibold">(overdue)</span>}
        </p>
      </div>

      <div>
        <span className="invoice-section-title block">Currency</span>
        <p className="mt-0.5 text-sm font-medium text-primary">
          {invoice.currency} ({getCurrencyMetadata(invoice.currency).symbol})
        </p>
      </div>

      {invoice.poNumber && (
        <div>
          <span className="invoice-section-title block">P.O. #</span>
          <p className="mt-0.5 text-sm font-medium text-primary">{invoice.poNumber}</p>
        </div>
      )}

      {invoice.projectName && (
        <div>
          <span className="invoice-section-title block">Project</span>
          <p className="mt-0.5 text-sm font-medium text-primary">{invoice.projectName}</p>
        </div>
      )}

      {invoice.terms && (
        <div className="sm:col-span-3">
          <span className="invoice-section-title block">Payment terms</span>
          <p className="mt-0.5 text-sm font-medium text-primary">{invoice.terms}</p>
        </div>
      )}
    </div>
  );
});

const BillToSection: React.FC<{ invoice: PreviewInvoice }> = React.memo(function BillToSection({ invoice }) {
  const hasCustomer =
    invoice.customerName ||
    invoice.customerCompanyName ||
    invoice.customerEmail ||
    invoice.customerAddress ||
    invoice.customerTaxId;

  return (
    <div className="mt-6">
      <h3 className="invoice-section-title mb-2">Bill To</h3>
      {hasCustomer ? (
        <div className="space-y-0.5">
          <p className="text-base font-semibold text-primary">
            {invoice.customerName || "—"}
          </p>
          {invoice.customerCompanyName && (
            <p className="text-sm text-secondary">{invoice.customerCompanyName}</p>
          )}
          {invoice.customerEmail && (
            <a
              href={`mailto:${invoice.customerEmail}`}
              className="text-sm text-primary-brand hover:text-primary-hover"
            >
              {invoice.customerEmail}
            </a>
          )}
          {invoice.customerPhone && (
            <p className="text-sm text-secondary">{invoice.customerPhone}</p>
          )}
          {invoice.customerTaxId && (
            <p className="text-sm text-secondary">Tax ID: {invoice.customerTaxId}</p>
          )}
          {invoice.customerAddress && (
            <p className="text-sm text-secondary whitespace-pre-line">{invoice.customerAddress}</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm italic text-tertiary">No customer selected</p>
      )}
    </div>
  );
});

const LineItemsTable: React.FC<{ invoice: PreviewInvoice; currency: string }> = React.memo(
  function LineItemsTable({ invoice, currency }) {
    const meta = getCurrencyMetadata(currency);
    const dp = meta.decimalPlaces;
    const lineTotals = useMemo(() => {
      return invoice.items.map((item) => lineTotalForItem(item).toFixed(dp));
    }, [invoice.items, dp]);

    return (
      <div className="mt-6 overflow-x-auto rounded-xl border border-color">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-surface-alt">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
              <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Qty</th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold uppercase text-tertiary">Unit</th>
              <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Rate</th>
              <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => {
              const lineTotal = lineTotals[i];
              const hasRate = new Decimal(item.unitPrice || 0).gt(0);
              const taxPct = new Decimal(item.taxRate ?? 0).mul(100);
              const showTaxNote = !taxPct.isZero() || item.isTaxInclusive;
              const hasDiscount = item.discount && Number(item.discount) > 0;

              let discountDisplay = "";
              if (hasDiscount) {
                if (item.discountType === "percentage") {
                  discountDisplay = ` −${item.discount}%`;
                } else {
                  discountDisplay = ` −${fmtNumber(item.discount, currency)}`;
                }
              }

              return (
                <tr key={i} className="border-t border-color-subtle">
                  <td className="px-4 py-3 align-top text-sm text-primary break-words">
                    {item.description || <span className="italic text-tertiary">Untitled item</span>}
                    {showTaxNote && (
                      <span className="mt-0.5 block text-xs text-tertiary">
                        {item.isTaxInclusive
                          ? `incl. ${taxPct.toFixed(2)}% tax`
                          : `${taxPct.toFixed(2)}% tax`}
                        {item.tax_name && ` (${item.tax_name})`}
                      </span>
                    )}
                    {discountDisplay && (
                      <span className="mt-0.5 block text-xs text-success-text">
                        Discount{discountDisplay}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-sm text-tertiary text-right font-tabular-nums">
                    {fmtQuantity(item.quantity)} {item.unit}
                  </td>
                  <td className="px-2 py-3 text-sm text-tertiary font-tabular-nums">
                    {item.unit}
                  </td>
                  <td className="px-2 py-3 text-sm text-secondary text-right font-tabular-nums">
                    {hasRate ? fmtNumber(item.unitPrice, currency) : "—"}
                  </td>
                  <td className="px-2 py-3 text-sm font-medium text-primary text-right font-tabular-nums">
                    {lineTotal}
                  </td>
                </tr>
              );
            })}
            {invoice.items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-tertiary">
                  No line items added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }
);

const FeesTable: React.FC<{ invoice: PreviewInvoice; currency: string }> = React.memo(function FeesTable({ invoice, currency }) {
  const meta = getCurrencyMetadata(currency);
  const dp = meta.decimalPlaces;

  return (
    <div className="mt-2 overflow-x-auto rounded-xl border border-color">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="bg-surface-alt">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
            <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Rate</th>
            <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Tax</th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Fee</th>
          </tr>
        </thead>
        <tbody>
          {invoice.fees.map((fee, i) => {
            const feeBase = new Decimal(fee.amount ?? 0);
            const feeTax = new Decimal(fee.tax_amount ?? 0);
            const feeTotal = feeBase.plus(feeTax);

            return (
              <tr key={i} className="border-t border-color-subtle">
                <td className="px-4 py-3 align-top text-sm text-primary break-words">
                  {fee.description || <span className="italic text-tertiary">Untitled fee</span>}
                </td>
                <td className="px-2 py-3 text-sm text-tertiary text-right font-tabular-nums">
                  {fee.taxRate ? fmtNumber(fee.amount, currency) : "—"}
                </td>
                <td className="px-2 py-3 text-sm text-tertiary text-right font-tabular-nums">
                  {fmtNumber(feeTax.toFixed(), currency)}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-primary text-right font-tabular-nums">
                  {fmtNumber(feeTotal.toFixed(), currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

const TaxBreakdown: React.FC<{ groups: PreviewTaxGroup[]; currency: string }> = React.memo(
  function TaxBreakdown({ groups, currency }) {
    const meta = getCurrencyMetadata(currency);
    const dp = meta.decimalPlaces;

    return (
      <div className="mt-2 rounded-xl border border-color-subtle bg-surface-alt p-4">
        <div className="text-xs font-medium text-tertiary uppercase">Tax Breakdown</div>
        <div className="mt-2 space-y-1.5">
          {groups.map((group, idx) => {
            const label =
              group.name && group.name.length > 0
                ? formatTaxRateWithName(group.rate, group.name)
                : formatTaxRateWithName(group.rate, null);
            return (
              <div key={idx} className="flex justify-between">
                <span className="text-sm text-secondary">{label}</span>
                <div className="text-right font-tabular-nums">
                  <span className="text-sm text-tertiary">
                    {fmtNumber(group.taxableBase, currency, dp)} /{" "}
                  </span>
                  <span className="text-sm text-primary">{fmtNumber(group.taxAmount, currency, dp)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

const TotalsSummary: React.FC<{ invoice: PreviewInvoice }> = React.memo(function TotalsSummary({ invoice }) {
  const currency = invoice.currency;
  const meta = getCurrencyMetadata(currency);
  const dp = meta.decimalPlaces;

  const hasAmountPaid = hasNonZero(invoice.amountPaid);
  const hasDiscount = hasNonZero(invoice.discountTotal);
  const hasFees = hasNonZero(invoice.feeTotal);
  const hasTax = hasNonZero(invoice.taxTotal);
  const amountDue = new Decimal(invoice.amountDue ?? 0);
  const total = new Decimal(invoice.total ?? 0);
  const isFullyPaid = amountDue.lte(0);

  return (
    <div className="mt-6 flex justify-end">
      <div className="w-64 space-y-1 font-tabular-nums">
        <div className="flex justify-between py-2 text-sm">
          <span className="text-tertiary">Subtotal</span>
          <span className="text-primary">{fmtNumber(invoice.subtotal, currency, dp)}</span>
        </div>

        {hasDiscount && (
          <div className="flex justify-between py-2 text-sm">
            <span className="text-tertiary">Discount</span>
            <span className="text-success-text">−{fmtNumber(invoice.discountTotal, currency, dp)}</span>
          </div>
        )}

        {hasTax && (
          <div className="flex justify-between py-2 text-sm">
            <span className="text-tertiary">Tax</span>
            <span className="text-primary">{fmtNumber(invoice.taxTotal, currency, dp)}</span>
          </div>
        )}

        {hasFees && (
          <div className="flex justify-between py-2 text-sm">
            <span className="text-tertiary">Fees</span>
            <span className="text-primary">{fmtNumber(invoice.feeTotal, currency, dp)}</span>
          </div>
        )}

        <div className="border-t-2 border-color pt-3">
          <div className="flex justify-between">
            <span className="text-base font-semibold text-secondary">Total</span>
            <span className="text-xl font-bold text-primary">{fmtNumber(invoice.total, currency, dp)}</span>
          </div>
        </div>

        {hasAmountPaid && (
          <div className="flex justify-between py-2 text-sm">
            <span className="text-tertiary">Paid</span>
            <span className="text-success-text">+{fmtNumber(invoice.amountPaid, currency, dp)}</span>
          </div>
        )}

        <div className="border-t-2 border-color pt-3">
          <div className="flex justify-between">
            <span className="text-lg font-semibold text-secondary">
              {isFullyPaid ? "Paid in Full" : "Amount Due"}
            </span>
            <span
              className={cn(
                "text-2xl font-extrabold",
                isFullyPaid ? "text-success-text" : "text-primary-brand"
              )}
            >
              {isFullyPaid ? "✓" : fmtNumber(invoice.amountDue, currency, dp)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

const PaymentInfoSection: React.FC<{ invoice: PreviewInvoice }> = React.memo(function PaymentInfoSection({ invoice }) {
  const currency = invoice.currency;
  const meta = getCurrencyMetadata(currency);
  const dp = meta.decimalPlaces;
  const amountDue = new Decimal(invoice.amountDue ?? 0);
  const hasAmountDue = hasNonZero(invoice.amountDue);
  const hasDeposit = invoice.depositType && invoice.depositType !== "none" && hasNonZero(invoice.depositDue);
  const depositDue = new Decimal(invoice.depositDue ?? 0);
  const depositPaid = new Decimal(invoice.depositPaid ?? 0);
  const depositRemaining = depositDue.minus(depositPaid);

  return (
    <div className="mt-8 rounded-xl border border-color bg-surface p-6 shadow-sm">
      <h3 className="invoice-section-title mb-4">Payment Information</h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <span className="invoice-section-title block">Currency</span>
          <p className="mt-0.5 text-sm font-medium text-primary">
            {invoice.currency} ({meta.symbol})
          </p>
        </div>

        <div>
          <span className="invoice-section-title block">Total Amount Due</span>
          <p className="mt-0.5 text-2xl font-bold text-primary-brand font-tabular-nums">
            {fmtNumber(invoice.amountDue, currency, dp)}
          </p>
        </div>
      </div>

      {hasDeposit && (
        <div className="mt-4 rounded-lg border border-color-subtle bg-surface-alt p-4">
          <div className="flex justify-between">
            <span className="text-sm text-tertiary">Deposit</span>
            <div className="text-right font-tabular-nums">
              <span className="text-sm text-primary">
                {fmtNumber(depositDue, currency, dp)}
              </span>
              {depositPaid.gt(0) && (
                <span className="ml-2 text-xs text-success-text">
                  (paid: {fmtNumber(depositPaid, currency, dp)})
                </span>
              )}
              {depositRemaining.gt(0) && (
                <span className="ml-2 text-xs text-tertiary">
                  (remaining: {fmtNumber(depositRemaining, currency, dp)})
                </span>
              )}
            </div>
          </div>
          {invoice.depositPaymentPurpose && (
            <p className="mt-1 text-xs text-tertiary">{invoice.depositPaymentPurpose}</p>
          )}
          {invoice.depositDueDate && (
            <p className="mt-1 text-xs text-tertiary">
              Due: {fmtDate(invoice.depositDueDate)}
            </p>
          )}
        </div>
      )}

      {invoice.paymentMethods && invoice.paymentMethods.length > 0 && (
        <div className="mt-4 space-y-3">
          <span className="invoice-section-title block">Accepted Payment Methods</span>
          {invoice.paymentMethods.map((pm, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="mt-0.5 text-tertiary">
                {pm.type === "bank" && "🏦"}
                {pm.type === "card" && "💳"}
                {pm.type === "paypal" && "🅿️"}
                {pm.type === "stripe" && "💳"}
                {pm.type === "custom" && "💰"}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-primary">{pm.label}</p>
                {pm.details && (
                  <p className="mt-0.5 text-xs text-tertiary whitespace-pre-line">{pm.details}</p>
                )}
                {pm.url && (
                  <a
                    href={pm.url}
                    className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary-brand hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Pay online <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {invoice.bankDetails && (
        <div className="mt-4">
          <span className="invoice-section-title block">Bank Details</span>
          <p className="mt-0.5 text-sm text-secondary whitespace-pre-line">{invoice.bankDetails}</p>
        </div>
      )}

      {invoice.paymentInstructions && (
        <div className="mt-4">
          <span className="invoice-section-title block">Payment Instructions</span>
          <div className="mt-0.5 rounded-lg bg-surface-alt p-4">
            <p className="text-sm text-secondary whitespace-pre-line">{invoice.paymentInstructions}</p>
          </div>
        </div>
      )}

      {hasAmountDue && invoice.paymentLink && (
        <div className="mt-6 border-t border-color pt-6 text-center">
          <div className="mb-3 text-3xl font-extrabold text-primary-brand font-tabular-nums">
            {fmtNumber(invoice.amountDue, currency, dp)}
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
    </div>
  );
});

const AttachmentsSection: React.FC<{ invoice: PreviewInvoice }> = React.memo(function AttachmentsSection({ invoice }) {
  const hasAttachments = invoice.attachments && invoice.attachments.length > 0;
  if (!hasAttachments) return null;

  return (
    <div className="border-t border-color px-8 py-6">
      <h4 className="invoice-section-title mb-3">Photos &amp; Attachments</h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {invoice.attachments!.map((a) => (
          <div key={a.id} className="group">
            {a.type.startsWith("image/") ? (
              <img
                src={a.url}
                alt={a.name}
                className={cn(
                  "w-full h-24 object-cover rounded-lg border border-color",
                  a.category === "before" && "ring-2 ring-offset-2 ring-warning-text",
                  a.category === "after" && "ring-2 ring-offset-2 ring-success-text"
                )}
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
  );
});

const FooterSection: React.FC<{ invoice: PreviewInvoice }> = React.memo(function FooterSection({ invoice }) {
  const hasNotes = invoice.notes && invoice.notes.length > 0;
  const hasTerms = invoice.terms && invoice.terms.length > 0;

  return (
    <>
      {hasNotes && (
        <div className="border-t border-color px-8 py-6">
          <h4 className="invoice-section-title mb-2">Notes</h4>
          <p className="text-sm text-secondary whitespace-pre-line">{invoice.notes}</p>
        </div>
      )}

      {hasTerms && (
        <div className="border-t border-color px-8 py-6">
          <h4 className="invoice-section-title mb-2">Terms &amp; Conditions</h4>
          <p className="text-xs text-tertiary whitespace-pre-line">{invoice.terms}</p>
        </div>
      )}

      <div className="border-t border-color px-8 py-4 text-center text-xs text-tertiary">
        {invoice.isFinalized
          ? `Invoice #${invoice.invoiceNumber || "—"}. All rights reserved.`
          : "This is a draft invoice. Not yet finalized."}
      </div>
    </>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface InvoicePreviewV2Props {
  invoice: PreviewInvoice;
}

function computeTaxGroups(invoice: PreviewInvoice): PreviewTaxGroup[] {
  const map = new Map<string, { rate: string; name: string | null; taxableBase: Decimal; taxAmount: Decimal }>();

  invoice.items.forEach((item) => {
    const rate = item.taxRate ?? "0";
    if (new Decimal(rate).isZero()) return;
    const key = `${rate}-${item.tax_name ?? ""}`;
    const qty = new Decimal(item.quantity || 1);
    const price = new Decimal(item.unitPrice || 0);
    let lineSubtotal = qty.mul(price);
    if (item.discount && Number(item.discount) > 0) {
      if (item.discountType === "percentage") {
        lineSubtotal = lineSubtotal.minus(lineSubtotal.mul(new Decimal(item.discount).div(100)));
      } else {
        lineSubtotal = lineSubtotal.minus(new Decimal(item.discount));
      }
    }
    const taxable = item.isTaxInclusive
      ? lineSubtotal.minus(lineSubtotal.mul(new Decimal(rate).div(new Decimal(1).plus(new Decimal(rate)))))
      : lineSubtotal;
    const taxAmount = new Decimal(lineTotalForItem(item).toFixed(2)).minus(taxable.toFixed(2));
    const existing = map.get(key);
    if (existing) {
      existing.taxableBase = existing.taxableBase.plus(taxable.toFixed(2));
      existing.taxAmount = existing.taxAmount.plus(taxAmount.toFixed(2));
    } else {
      map.set(key, {
        rate,
        name: item.tax_name ?? null,
        taxableBase: new Decimal(taxable.toFixed(2)),
        taxAmount: new Decimal(taxAmount.toFixed(2)),
      });
    }
  });

  return Array.from(map.values()).map((g) => ({
    rate: g.rate,
    name: g.name,
    taxableBase: g.taxableBase.toFixed(2),
    taxAmount: g.taxAmount.toFixed(2),
  })).sort((a, b) => {
    return new Decimal(a.rate).comparedTo(new Decimal(b.rate));
  });
}

export default React.memo(function InvoicePreviewV2({ invoice }: InvoicePreviewV2Props) {
  const hasTax = hasNonZero(invoice.taxTotal);
  const taxGroups = useMemo(() => {
    if (!hasTax) return [];
    return computeTaxGroups(invoice);
  }, [invoice, hasTax]);

  return (
    <div
      className="invoice-preview-v2 bg-surface border border-color rounded-xl shadow-sm font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif]"
      data-invoice-preview="v2"
    >
      <div className="p-8">
        {/* === Header: business info + status === */}
        <InvoiceHeader invoice={invoice} />

        {/* === Invoice metadata grid === */}
        <InvoiceMetaGrid invoice={invoice} />

        {/* === Bill To section === */}
        <BillToSection invoice={invoice} />

        {/* === Line items table === */}
        <LineItemsTable invoice={invoice} currency={invoice.currency} />

        {/* === Tax Breakdown === */}
        {hasTax && taxGroups.length > 0 && (
          <TaxBreakdown groups={taxGroups} currency={invoice.currency} />
        )}

        {/* === Fees table === */}
        {invoice.fees.length > 0 && (
          <FeesTable invoice={invoice} currency={invoice.currency} />
        )}

        {/* === Totals summary === */}
        <TotalsSummary invoice={invoice} />
      </div>

      {/* === Payment information === */}
      <div className="border-t border-color px-8 py-6">
        <PaymentInfoSection invoice={invoice} />
      </div>

      {/* === Footer: notes, terms, attachments === */}
      <AttachmentsSection invoice={invoice} />
      <FooterSection invoice={invoice} />
    </div>
  );
});
