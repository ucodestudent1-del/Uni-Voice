import React, { useMemo } from "react";
import { Decimal } from "decimal.js";
import { CreditCard, FileText, Download, ExternalLink, Check, X, AlertCircle } from "lucide-react";
import { formatCurrency, formatDateLong, formatTaxRateWithName } from "../utils/format";
import { getCurrencyMetadata } from "../types/currency";
import type { ApiQuote, ApiQuoteItem, ApiQuoteFee, ApiBusiness, ApiCustomer } from "../types/api";

export interface PreviewQuoteLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount?: string;
  discountType?: "fixed" | "percentage";
  taxRate?: string;
  tax_name?: string | null;
  tax_amount?: string | null;
  isTaxInclusive?: boolean;
}

export interface PreviewQuoteFee {
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

export interface PreviewQuoteTaxGroup {
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

export interface PreviewQuote {
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

  // Quote metadata
  quoteNumber?: string | null;
  quoteTitle?: string | null;
  issueDate?: string;
  dueDate?: string;
  expiryDate?: string | null;
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
  items: PreviewQuoteLineItem[];
  fees: PreviewQuoteFee[];
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
  scopeOfWork?: string | null;

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

const QUOTE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "status-warning-bg status-warning-text" },
  sent: { label: "Sent", className: "status-info-bg status-info-text" },
  viewed: { label: "Viewed", className: "status-info-bg status-info-text" },
  accepted: { label: "Accepted", className: "status-success-bg status-success-text" },
  rejected: { label: "Rejected", className: "status-error-bg status-error-text" },
  expired: { label: "Expired", className: "status-error-bg status-error-text" },
  converted: { label: "Converted", className: "status-success-bg status-success-text" },
};

const QUOTE_STATUS_CONFIG_PUBLIC: Record<string, { label: string; className: string }> = {
  ...QUOTE_STATUS_CONFIG,
};

function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
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

function isExpired(expiryDate?: string | null): boolean {
  if (!expiryDate) return false;
  try {
    return new Date(expiryDate) < new Date();
  } catch {
    return false;
  }
}

function lineTotalForItem(item: PreviewQuoteLineItem): Decimal {
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const QuoteHeader: React.FC<{ quote: PreviewQuote }> = React.memo(function QuoteHeader({ quote }) {
  const hasExpiry = isExpired(quote.expiryDate);
  const hasOverdue = isPastDue(quote.dueDate);
  const baseStatus = quote.status;
  let statusKey: string;
  if (baseStatus === "sent" && hasExpiry) {
    statusKey = "expired";
  } else if (baseStatus === "sent" && hasOverdue) {
    statusKey = "expired";
  } else {
    statusKey = baseStatus;
  }
  const statusCfg = QUOTE_STATUS_CONFIG[statusKey] ?? QUOTE_STATUS_CONFIG.draft;

  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex items-start gap-4">
        {quote.businessLogo ? (
          <img
            src={quote.businessLogo}
            alt={quote.businessName}
            className="h-16 w-auto rounded-xl object-contain"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary-bg text-2xl font-bold text-primary">
            {quote.businessName?.charAt(0) ?? "?"}
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold text-primary">
            {quote.businessLegalName || quote.businessName || "Your Business"}
          </h2>
          {quote.businessName && quote.businessLegalName && (
            <p className="text-sm text-tertiary">{quote.businessName}</p>
          )}
          <div className="mt-1 space-y-0.5">
            {quote.businessEmail && <p className="text-sm text-secondary">{quote.businessEmail}</p>}
            {quote.businessPhone && <p className="text-sm text-secondary">{quote.businessPhone}</p>}
            {quote.businessWebsite && (
              <a
                href={quote.businessWebsite.startsWith("http") ? quote.businessWebsite : `https://${quote.businessWebsite}`}
                className="text-sm text-primary-brand hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {quote.businessWebsite}
              </a>
            )}
          </div>
          {(quote.businessTaxId || quote.businessRegistrationNumber) && (
            <p className="mt-2 text-xs text-tertiary">
              Tax ID: {quote.businessTaxId || quote.businessRegistrationNumber}
            </p>
          )}
          {quote.businessAddress && (
            <p className="mt-2 text-sm text-secondary whitespace-pre-line">{quote.businessAddress}</p>
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
          <p className="text-2xl font-bold text-primary">{quote.quoteTitle || "Quote"}</p>
          {quote.quoteNumber && (
            <p className="text-sm text-tertiary">#{quote.quoteNumber}</p>
          )}
        </div>
      </div>
    </div>
  );
});

const QuoteMetaGrid: React.FC<{ quote: PreviewQuote }> = React.memo(function QuoteMetaGrid({ quote }) {
  const hasExpiry = isExpired(quote.expiryDate);
  const hasOverdue = isPastDue(quote.dueDate);

  return (
    <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-color bg-surface-alt p-4 sm:grid-cols-3">
      <div>
        <span className="invoice-section-title block">Quote #</span>
        <p className="mt-0.5 text-sm font-medium text-primary">{quote.quoteNumber || "—"}</p>
      </div>

      <div>
        <span className="invoice-section-title block">Issue date</span>
        <p className="mt-0.5 text-sm font-medium text-primary">{fmtDate(quote.issueDate)}</p>
      </div>

      {quote.dueDate && (
        <div>
          <span className="invoice-section-title block">Due date</span>
          <p
            className={cn(
              "mt-0.5 text-sm font-medium",
              hasOverdue ? "text-error-text" : "text-primary"
            )}
          >
            {fmtDate(quote.dueDate)}
            {hasOverdue && <span className="ml-1 text-xs font-semibold">(overdue)</span>}
          </p>
        </div>
      )}

      {quote.expiryDate && (
        <div>
          <span className="invoice-section-title block">Expiry date</span>
          <p
            className={cn(
              "mt-0.5 text-sm font-medium",
              hasExpiry ? "text-error-text" : "text-primary"
            )}
          >
            {fmtDate(quote.expiryDate)}
            {hasExpiry && <span className="ml-1 text-xs font-semibold">(expired)</span>}
          </p>
        </div>
      )}

      <div>
        <span className="invoice-section-title block">Currency</span>
        <p className="mt-0.5 text-sm font-medium text-primary">
          {quote.currency} ({getCurrencyMetadata(quote.currency).symbol})
        </p>
      </div>

      {quote.poNumber && (
        <div>
          <span className="invoice-section-title block">P.O. #</span>
          <p className="mt-0.5 text-sm font-medium text-primary">{quote.poNumber}</p>
        </div>
      )}

      {quote.projectName && (
        <div>
          <span className="invoice-section-title block">Project</span>
          <p className="mt-0.5 text-sm font-medium text-primary">{quote.projectName}</p>
        </div>
      )}

      {quote.terms && (
        <div className="sm:col-span-3">
          <span className="invoice-section-title block">Terms</span>
          <p className="mt-0.5 text-sm font-medium text-primary">{quote.terms}</p>
        </div>
      )}
    </div>
  );
});

const BillToSection: React.FC<{ quote: PreviewQuote }> = React.memo(function BillToSection({ quote }) {
  const hasCustomer =
    quote.customerName ||
    quote.customerCompanyName ||
    quote.customerEmail ||
    quote.customerAddress ||
    quote.customerTaxId;

  return (
    <div className="mt-6">
      <h3 className="invoice-section-title mb-2">Bill To</h3>
      {hasCustomer ? (
        <div className="space-y-0.5">
          <p className="text-base font-semibold text-primary">
            {quote.customerName || "—"}
          </p>
          {quote.customerCompanyName && (
            <p className="text-sm text-secondary">{quote.customerCompanyName}</p>
          )}
          {quote.customerEmail && (
            <a
              href={`mailto:${quote.customerEmail}`}
              className="text-sm text-primary-brand hover:text-primary-hover"
            >
              {quote.customerEmail}
            </a>
          )}
          {quote.customerPhone && (
            <p className="text-sm text-secondary">{quote.customerPhone}</p>
          )}
          {quote.customerTaxId && (
            <p className="text-sm text-secondary">Tax ID: {quote.customerTaxId}</p>
          )}
          {quote.customerAddress && (
            <p className="text-sm text-secondary whitespace-pre-line">{quote.customerAddress}</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm italic text-tertiary">No customer selected</p>
      )}
    </div>
  );
});

const ScopeOfWorkSection: React.FC<{ scope: string }> = React.memo(function ScopeOfWorkSection({ scope }) {
  if (!scope) return null;
  return (
    <div className="mt-6">
      <h3 className="invoice-section-title mb-2">Scope of Work</h3>
      <p className="text-sm text-secondary whitespace-pre-line">{scope}</p>
    </div>
  );
});

const LineItemsTable: React.FC<{ quote: PreviewQuote; currency: string }> = React.memo(
  function LineItemsTable({ quote, currency }) {
    const meta = getCurrencyMetadata(currency);
    const dp = meta.decimalPlaces;
    const lineTotals = useMemo(() => {
      return quote.items.map((item) => lineTotalForItem(item).toFixed(dp));
    }, [quote.items, dp]);

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
            {quote.items.map((item, i) => {
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
            {quote.items.length === 0 && (
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

const FeesTable: React.FC<{ quote: PreviewQuote; currency: string }> = React.memo(function FeesTable({ quote, currency }) {
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
          {quote.fees.map((fee, i) => {
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

const QuoteTaxBreakdown: React.FC<{ groups: PreviewQuoteTaxGroup[]; currency: string }> = React.memo(
  function QuoteTaxBreakdown({ groups, currency }) {
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

const QuoteTotalsSummary: React.FC<{ quote: PreviewQuote }> = React.memo(function QuoteTotalsSummary({ quote }) {
  const currency = quote.currency;
  const meta = getCurrencyMetadata(currency);
  const dp = meta.decimalPlaces;

  const hasAmountPaid = hasNonZero(quote.amountPaid);
  const hasDiscount = hasNonZero(quote.discountTotal);
  const hasFees = hasNonZero(quote.feeTotal);
  const hasTax = hasNonZero(quote.taxTotal);
  const amountDue = new Decimal(quote.amountDue ?? 0);
  const total = new Decimal(quote.total ?? 0);
  const isFullyPaid = amountDue.lte(0);

  return (
    <div className="mt-6 flex justify-end">
      <div className="w-64 space-y-1 font-tabular-nums">
        <div className="flex justify-between py-2 text-sm">
          <span className="text-tertiary">Subtotal</span>
          <span className="text-primary">{fmtNumber(quote.subtotal, currency, dp)}</span>
        </div>

        {hasDiscount && (
          <div className="flex justify-between py-2 text-sm">
            <span className="text-tertiary">Discount</span>
            <span className="text-success-text">−{fmtNumber(quote.discountTotal, currency, dp)}</span>
          </div>
        )}

        {hasTax && (
          <div className="flex justify-between py-2 text-sm">
            <span className="text-tertiary">Tax</span>
            <span className="text-primary">{fmtNumber(quote.taxTotal, currency, dp)}</span>
          </div>
        )}

        {hasFees && (
          <div className="flex justify-between py-2 text-sm">
            <span className="text-tertiary">Fees</span>
            <span className="text-primary">{fmtNumber(quote.feeTotal, currency, dp)}</span>
          </div>
        )}

        <div className="border-t-2 border-color pt-3">
          <div className="flex justify-between">
            <span className="text-base font-semibold text-secondary">Estimated Total</span>
            <span className="text-xl font-bold text-primary">{fmtNumber(quote.total, currency, dp)}</span>
          </div>
        </div>

        {hasAmountPaid && (
          <div className="flex justify-between py-2 text-sm">
            <span className="text-tertiary">Deposit Paid</span>
            <span className="text-success-text">+{fmtNumber(quote.amountPaid, currency, dp)}</span>
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
              {isFullyPaid ? "✓" : fmtNumber(quote.amountDue, currency, dp)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

const QuotePaymentInfoSection: React.FC<{ quote: PreviewQuote }> = React.memo(function QuotePaymentInfoSection({ quote }) {
  const currency = quote.currency;
  const meta = getCurrencyMetadata(currency);
  const dp = meta.decimalPlaces;
  const amountDue = new Decimal(quote.amountDue ?? 0);
  const hasAmountDue = hasNonZero(quote.amountDue);
  const hasDeposit = quote.depositType && quote.depositType !== "none" && hasNonZero(quote.depositDue);
  const depositDue = new Decimal(quote.depositDue ?? 0);
  const depositPaid = new Decimal(quote.depositPaid ?? 0);
  const depositRemaining = depositDue.minus(depositPaid);

  return (
    <div className="mt-8 rounded-xl border border-color bg-surface p-6 shadow-sm">
      <h3 className="invoice-section-title mb-4">Quote Summary</h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <span className="invoice-section-title block">Currency</span>
          <p className="mt-0.5 text-sm font-medium text-primary">
            {quote.currency} ({meta.symbol})
          </p>
        </div>

        <div>
          <span className="invoice-section-title block">Total Amount Due</span>
          <p className="mt-0.5 text-2xl font-bold text-primary-brand font-tabular-nums">
            {fmtNumber(quote.amountDue, currency, dp)}
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
          {quote.depositPaymentPurpose && (
            <p className="mt-1 text-xs text-tertiary">{quote.depositPaymentPurpose}</p>
          )}
          {quote.depositDueDate && (
            <p className="mt-1 text-xs text-tertiary">
              Due: {fmtDate(quote.depositDueDate)}
            </p>
          )}
        </div>
      )}

      {quote.paymentMethods && quote.paymentMethods.length > 0 && (
        <div className="mt-4 space-y-3">
          <span className="invoice-section-title block">Accepted Payment Methods</span>
          {quote.paymentMethods.map((pm, i) => (
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

      {quote.bankDetails && (
        <div className="mt-4">
          <span className="invoice-section-title block">Bank Details</span>
          <p className="mt-0.5 text-sm text-secondary whitespace-pre-line">{quote.bankDetails}</p>
        </div>
      )}

      {quote.paymentInstructions && (
        <div className="mt-4">
          <span className="invoice-section-title block">Payment Instructions</span>
          <div className="mt-0.5 rounded-lg bg-surface-alt p-4">
            <p className="text-sm text-secondary whitespace-pre-line">{quote.paymentInstructions}</p>
          </div>
        </div>
      )}

      {hasAmountDue && quote.paymentLink && (
        <div className="mt-6 border-t border-color pt-6 text-center">
          <div className="mb-3 text-3xl font-extrabold text-primary-brand font-tabular-nums">
            {fmtNumber(quote.amountDue, currency, dp)}
          </div>
          <p className="mb-4 text-sm text-tertiary">Total amount due</p>
          <a
            href={quote.paymentLink}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-action px-8 py-3.5 text-base font-semibold text-on-primary shadow-md hover:bg-primary-hover hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <CreditCard className="h-5 w-5" />
            Pay deposit
          </a>
          <p className="mt-3 text-xs text-tertiary">Secure online payment — no account required</p>
        </div>
      )}
    </div>
  );
});

const QuoteAttachmentsSection: React.FC<{ quote: PreviewQuote }> = React.memo(function QuoteAttachmentsSection({ quote }) {
  const hasAttachments = quote.attachments && quote.attachments.length > 0;
  if (!hasAttachments) return null;

  return (
    <div className="border-t border-color px-8 py-6">
      <h4 className="invoice-section-title mb-3">Photos &amp; Attachments</h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {quote.attachments!.map((a) => (
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

const QuoteFooterSection: React.FC<{ quote: PreviewQuote }> = React.memo(function QuoteFooterSection({ quote }) {
  const hasNotes = quote.notes && quote.notes.length > 0;
  const hasTerms = quote.terms && quote.terms.length > 0;

  return (
    <>
      {hasNotes && (
        <div className="border-t border-color px-8 py-6">
          <h4 className="invoice-section-title mb-2">Notes</h4>
          <p className="text-sm text-secondary whitespace-pre-line">{quote.notes}</p>
        </div>
      )}

      {hasTerms && (
        <div className="border-t border-color px-8 py-6">
          <h4 className="invoice-section-title mb-2">Terms &amp; Conditions</h4>
          <p className="text-xs text-tertiary whitespace-pre-line">{quote.terms}</p>
        </div>
      )}

      <div className="border-t border-color px-8 py-4 text-center text-xs text-tertiary">
        {quote.isFinalized
          ? `Quote #${quote.quoteNumber || "—"}. All rights reserved.`
          : "This is a draft quote. Not yet finalized."}
      </div>
    </>
  );
});

// ---------------------------------------------------------------------------
// Tax computation
// ---------------------------------------------------------------------------

function computeQuoteTaxGroups(quote: PreviewQuote): PreviewQuoteTaxGroup[] {
  const map = new Map<string, { rate: string; name: string | null; taxableBase: Decimal; taxAmount: Decimal }>();

  quote.items.forEach((item) => {
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

// ---------------------------------------------------------------------------
// Builder: ApiQuote -> PreviewQuote
// ---------------------------------------------------------------------------

export function buildPreviewQuote(
  quote: ApiQuote,
  business: ApiBusiness | null,
  customer: ApiCustomer | null
): PreviewQuote {
  const businessAddress = [
    business?.addressLine1,
    business?.addressLine2,
    business?.city,
    business?.stateOrRegion,
    business?.postalCode,
    business?.countryCode,
  ]
    .filter(Boolean)
    .join(", ") || undefined;

  const customerAddress = customer
    ? [
        customer.address?.addressLine1,
        customer.address?.addressLine2,
        customer.address?.city,
        customer.address?.stateOrRegion,
        customer.address?.postalCode,
        customer.address?.countryCode,
      ]
      .filter(Boolean)
      .join(", ") || undefined
    : undefined;

  return {
    businessName: business?.name || "Your Business",
    businessLegalName: business?.legalName || null,
    businessEmail: business?.email || null,
    businessPhone: business?.phone || null,
    businessWebsite: business?.website || null,
    businessAddress,
    businessLogo: business?.logoUrl || null,
    businessTaxId: business?.taxId || null,
    businessRegistrationNumber: business?.registrationNumber || null,
    quoteNumber: quote.quote_number || null,
    quoteTitle: "QUOTATION",
    issueDate: quote.issue_date || null,
    dueDate: quote.due_date || null,
    expiryDate: quote.expiry_date || null,
    currency: quote.currency,
    customerName: customer?.name || quote.customer_name || null,
    customerCompanyName: customer?.companyName || null,
    customerEmail: customer?.email || quote.customer_email || null,
    customerAddress: customerAddress || null,
    customerPhone: customer?.phone || null,
    customerTaxId: customer?.taxId || customer?.address?.taxId || null,
    items: (quote.items || []).map((item: ApiQuoteItem) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit || "each",
      unitPrice: item.unit_price,
      discount: item.discount,
      discountType: item.discount_type ?? "fixed",
      taxRate: item.tax_rate || "0",
      tax_name: null,
      tax_amount: null,
      isTaxInclusive: item.is_tax_inclusive ?? false,
    })),
    fees: (quote.fees || []).map((fee: ApiQuoteFee) => ({
      description: fee.description,
      amount: fee.amount,
      taxRate: fee.tax_rate || "0",
      tax_name: null,
      tax_amount: null,
    })),
    subtotal: quote.subtotal,
    discountTotal: quote.discount_total,
    taxTotal: quote.tax_total,
    feeTotal: quote.fee_total,
    total: quote.total,
    amountPaid: quote.amount_paid,
    amountDue: quote.amount_due,
    notes: quote.notes || null,
    paymentInstructions: quote.payment_instructions || null,
    scopeOfWork: quote.scope_of_work || null,
    paymentMethods: [],
    paymentLink: undefined,
    bankDetails: business?.registrationNumber ? null : null,
    depositType: (quote.deposit_type as "none" | "fixed" | "percentage") || "none",
    depositValue: quote.deposit_value || null,
    depositDueDate: quote.deposit_due_date || null,
    depositPaymentPurpose: null,
    depositPaid: quote.deposit_paid ? "1" : "0",
    depositDue: null,
    status: quote.status,
    isFinalized: quote.is_finalized,
    attachments: [],
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface QuotePreviewV2Props {
  quote: PreviewQuote;
  onAccept?: () => void;
  onReject?: () => void;
  showActions?: boolean;
}

export default React.memo(function QuotePreviewV2({ quote, onAccept, onReject, showActions = false }: QuotePreviewV2Props) {
  const hasTax = hasNonZero(quote.taxTotal);
  const taxGroups = useMemo(() => {
    if (!hasTax) return [];
    return computeQuoteTaxGroups(quote);
  }, [quote, hasTax]);

  const hasExpiry = isExpired(quote.expiryDate);
  const canAccept = quote.status === "sent" && !hasExpiry;
  const canReject = quote.status === "sent" || quote.status === "viewed";

  return (
    <div
      className="quote-preview-v2 bg-surface border border-color rounded-xl shadow-sm font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif]"
      data-quote-preview="v2"
    >
      <div className="p-8">
        {/* === Header: business info + status === */}
        <QuoteHeader quote={quote} />

        {/* === Quote metadata grid === */}
        <QuoteMetaGrid quote={quote} />

        {/* === Bill To section === */}
        <BillToSection quote={quote} />

        {/* === Scope of work === */}
        <ScopeOfWorkSection scope={quote.scopeOfWork || ""} />

        {/* === Line items table === */}
        <LineItemsTable quote={quote} currency={quote.currency} />

        {/* === Tax Breakdown === */}
        {hasTax && taxGroups.length > 0 && (
          <QuoteTaxBreakdown groups={taxGroups} currency={quote.currency} />
        )}

        {/* === Fees table === */}
        {quote.fees.length > 0 && (
          <FeesTable quote={quote} currency={quote.currency} />
        )}

        {/* === Totals summary === */}
        <QuoteTotalsSummary quote={quote} />
      </div>

      {/* === Quote summary / payment info === */}
      <div className="border-t border-color px-8 py-6">
        <QuotePaymentInfoSection quote={quote} />
      </div>

      {/* === Footer: notes, terms, attachments === */}
      <QuoteAttachmentsSection quote={quote} />
      <QuoteFooterSection quote={quote} />
    </div>
  );
});
