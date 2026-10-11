import React from "react";
import { Decimal } from "decimal.js";
import { formatCurrency, formatDateLong, formatTaxRate } from "../utils/format";
import { getCurrencyMetadata } from "../types/currency";
import { cn } from "../lib/utils";
import { Download, Share2 } from "lucide-react";

export interface CreditNoteLineItem {
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

export interface CreditNoteFee {
  description: string;
  amount: string;
  taxRate?: string;
  tax_name?: string | null;
  tax_amount?: string | null;
}

export interface CreditNoteApplication {
  amount: string;
  invoiceNumber?: string | null;
  invoiceId?: string | null;
  appliedAt?: string | null;
}

export interface CreditNoteDesign {
  businessName: string;
  businessLegalName?: string | null;
  businessEmail?: string;
  businessPhone?: string;
  businessWebsite?: string;
  businessAddress?: string;
  businessLogo?: string | null;
  businessTaxId?: string;
  businessRegistrationNumber?: string | null;

  creditNoteNumber: string;
  issueDate?: string;
  currency: string;
  status: string;

  customerName?: string | null;
  customerCompanyName?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerPhone?: string | null;
  customerTaxId?: string | null;

  referenceInvoiceNumber?: string | null;
  referenceInvoiceDate?: string | null;

  reason?: string | null;
  notes?: string | null;
  terms?: string | null;

  items: CreditNoteLineItem[];
  fees: CreditNoteFee[];
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  feeTotal: string;
  total: string;
  appliedTotal: string;
  amountDue: string;
  applications?: CreditNoteApplication[];

  authorizationName?: string | null;
  authorizationTitle?: string | null;

  notesForCustomer?: string | null;
  isFinalized?: boolean;
}

const CREDIT_NOTE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "status-warning-bg status-warning-text" },
  finalized: { label: "Finalized", className: "status-info-bg status-info-text" },
  applied: { label: "Applied", className: "status-success-bg status-success-text" },
  sent: { label: "Sent", className: "status-info-bg status-info-text" },
  refunded: { label: "Refunded", className: "status-success-bg status-success-text" },
  cancelled: { label: "Cancelled", className: "status-tertiary-bg status-tertiary-text" },
  void: { label: "Void", className: "status-tertiary-bg status-tertiary-text" },
};

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

function numberToWords(amount: number): string {
  if (amount === 0) return "zero";
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const scales = ["", "thousand", "million", "billion", "trillion"];

  function convert(num: number): string {
    let result = "";
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    if (hundreds > 0) {
      result += ones[hundreds] + " hundred ";
      if (remainder > 0) result += "and ";
    }
    if (remainder > 0) {
      if (remainder < 10) result += ones[remainder];
      else if (remainder < 20) result += teens[remainder - 10];
      else {
        const t = Math.floor(remainder / 10);
        const o = remainder % 10;
        result += tens[t];
        if (o > 0) result += "-" + ones[o];
      }
    }
    return result.trim();
  }

  if (amount < 1) return "zero";

  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  let words = "";
  let temp = integerPart;
  const groups: number[] = [];
  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const scaleWords: string[] = [];
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] > 0) {
      let part = convert(groups[i]);
      if (i > 0 && scales[i]) part += " " + scales[i];
      scaleWords.unshift(part);
    }
  }

  words = scaleWords.join(" ").trim();
  if (decimalPart > 0) {
    words += " and " + decimalPart + "/100";
  }
  return words;
}

function amountInWords(amount: string | number, currency: string): string {
  const d = new Decimal(amount || 0);
  const num = Number(d.toFixed(2));
  const words = numberToWords(num);
  const currencyName = currency.toUpperCase();
  return `${words} ${currencyName}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const CreditNoteHeader: React.FC<{ design: CreditNoteDesign }> = React.memo(function CreditNoteHeader({ design }) {
  const statusKey = design.status in CREDIT_NOTE_STATUS_CONFIG ? design.status : "draft";
  const statusCfg = CREDIT_NOTE_STATUS_CONFIG[statusKey] ?? CREDIT_NOTE_STATUS_CONFIG.draft;

  return (
    <div className="flex items-start justify-between gap-6">
      {/* Branding area */}
      <div className="flex items-start gap-4">
        {design.businessLogo ? (
          <img
            src={design.businessLogo}
            alt={design.businessName}
            className="h-14 w-auto rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-bg text-2xl font-bold text-primary">
            {design.businessName?.charAt(0) ?? "B"}
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold text-primary">
            {design.businessLegalName || design.businessName || "Your Business"}
          </h2>
          {design.businessName && design.businessLegalName && (
            <p className="text-sm text-tertiary">{design.businessName}</p>
          )}
          <div className="mt-1 space-y-0.5">
            {design.businessEmail && <p className="text-sm text-secondary">{design.businessEmail}</p>}
            {design.businessPhone && <p className="text-sm text-secondary">{design.businessPhone}</p>}
            {design.businessWebsite && (
              <a
                href={design.businessWebsite.startsWith("http") ? design.businessWebsite : `https://${design.businessWebsite}`}
                className="text-sm text-primary-brand hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {design.businessWebsite}
              </a>
            )}
          </div>
          {(design.businessTaxId || design.businessRegistrationNumber) && (
            <p className="mt-1 text-xs text-tertiary">
              Tax ID: {design.businessTaxId || design.businessRegistrationNumber}
            </p>
          )}
          {design.businessAddress && (
            <p className="mt-1 max-w-xs text-sm text-secondary whitespace-pre-line">{design.businessAddress}</p>
          )}
        </div>
      </div>

      {/* Document title + status */}
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
          <p className="invoice-title text-2xl font-bold leading-tight text-primary">CREDIT NOTE</p>
        </div>
      </div>
    </div>
  );
});

const CreditNoteMetaGrid: React.FC<{ design: CreditNoteDesign }> = React.memo(function CreditNoteMetaGrid({ design }) {
  return (
    <div className="mt-6 rounded-xl border border-color bg-surface-alt p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <div>
          <span className="invoice-section-title block">Credit Note #</span>
          <p className="mt-0.5 text-sm font-medium text-primary">{design.creditNoteNumber || "—"}</p>
        </div>
        <div>
          <span className="invoice-section-title block">Date of Issue</span>
          <p className="mt-0.5 text-sm font-medium text-primary">{fmtDate(design.issueDate)}</p>
        </div>
        <div>
          <span className="invoice-section-title block">Currency</span>
          <p className="mt-0.5 text-sm font-medium text-primary">
            {design.currency} ({getCurrencyMetadata(design.currency).symbol})
          </p>
        </div>

        {design.referenceInvoiceNumber && (
          <div className="sm:col-span-3">
            <span className="invoice-section-title block">Original Invoice</span>
            <p className="mt-0.5 text-sm font-medium text-primary">{design.referenceInvoiceNumber}</p>
            {design.referenceInvoiceDate && (
              <p className="text-xs text-tertiary">Dated: {fmtDate(design.referenceInvoiceDate)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

const CustomerInfoSection: React.FC<{ design: CreditNoteDesign }> = React.memo(function CustomerInfoSection({ design }) {
  const hasCustomer =
    design.customerName ||
    design.customerCompanyName ||
    design.customerEmail ||
    design.customerAddress ||
    design.customerTaxId ||
    design.customerPhone;

  return (
    <div className="mt-6">
      <h3 className="invoice-section-title mb-2">Bill To</h3>
      {hasCustomer ? (
        <div className="space-y-0.5">
          <p className="text-base font-semibold text-primary">
            {design.customerName || "—"}
          </p>
          {design.customerCompanyName && (
            <p className="text-sm text-secondary">{design.customerCompanyName}</p>
          )}
          {design.customerEmail && (
            <a
              href={`mailto:${design.customerEmail}`}
              className="text-sm text-primary-brand hover:text-primary-hover"
            >
              {design.customerEmail}
            </a>
          )}
          {design.customerPhone && (
            <p className="text-sm text-secondary">{design.customerPhone}</p>
          )}
          {design.customerTaxId && (
            <p className="text-sm text-secondary">Tax ID: {design.customerTaxId}</p>
          )}
          {design.customerAddress && (
            <p className="text-sm text-secondary whitespace-pre-line">{design.customerAddress}</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm italic text-tertiary">No customer selected</p>
      )}
    </div>
  );
});

const ReasonSection: React.FC<{ design: CreditNoteDesign }> = React.memo(function ReasonSection({ design }) {
  if (!design.reason) return null;
  return (
    <div className="mt-6 rounded-xl border border-color bg-surface-alt p-4">
      <h3 className="invoice-section-title mb-1.5">Reason for Credit</h3>
      <p className="text-sm text-secondary whitespace-pre-line">{design.reason}</p>
    </div>
  );
});

const CreditNoteLineItemsTable: React.FC<{ design: CreditNoteDesign; currency: string }> = React.memo(
  function CreditNoteLineItemsTable({ design, currency }) {
    return (
      <div className="mt-6 overflow-x-auto rounded-xl border border-color">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-alt">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-tertiary">#</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
              <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Qty</th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold uppercase text-tertiary">Unit</th>
              <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Unit Price</th>
              <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Tax Rate</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Amount</th>
            </tr>
          </thead>
          <tbody>
            {design.items.map((item, i) => {
              const lineTotal = new Decimal(item.unitPrice || 0).mul(new Decimal(item.quantity || 1));
              let discountDisplay = "";
              if (item.discount && Number(item.discount) > 0) {
                if (item.discountType === "percentage") {
                  discountDisplay = ` −${item.discount}%`;
                } else {
                  discountDisplay = ` −${fmtNumber(item.discount, currency)}`;
                }
              }
              const taxPct = new Decimal(item.taxRate ?? 0).mul(100);
              const showTaxNote = !taxPct.isZero() || item.isTaxInclusive;

              return (
                <tr key={i} className="border-t border-color-subtle">
                  <td className="px-4 py-3 text-center font-tabular-nums text-tertiary">{i + 1}</td>
                  <td className="px-3 py-3 align-top text-sm text-primary break-words">
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
                    {fmtQuantity(item.quantity)}
                  </td>
                  <td className="px-2 py-3 text-sm text-tertiary font-tabular-nums">
                    {item.unit || "—"}
                  </td>
                  <td className="px-2 py-3 text-sm text-secondary text-right font-tabular-nums">
                    {new Decimal(item.unitPrice || 0).gt(0) ? fmtNumber(item.unitPrice, currency) : "—"}
                  </td>
                  <td className="px-2 py-3 align-top text-sm text-tertiary text-right font-tabular-nums">
                    <span className="inline-block rounded bg-surface px-1.5 py-0.5 text-xs font-medium">
                      {formatTaxRate(item.taxRate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-primary text-right font-tabular-nums">
                    {fmtNumber(lineTotal, currency)}
                  </td>
                </tr>
              );
            })}
            {design.items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-tertiary">
                  No line items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }
);

const CreditNoteFeesTable: React.FC<{ design: CreditNoteDesign; currency: string }> = React.memo(
  function CreditNoteFeesTable({ design, currency }) {
    if (design.fees.length === 0) return null;

    return (
      <div className="mt-2 overflow-x-auto rounded-xl border border-color">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-alt">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
              <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Rate</th>
              <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Tax</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Amount</th>
            </tr>
          </thead>
          <tbody>
            {design.fees.map((fee, i) => {
              const feeBase = new Decimal(fee.amount ?? 0);
              const feeTax = new Decimal(fee.tax_amount ?? 0);
              const feeTotal = feeBase.plus(feeTax);

              return (
                <tr key={i} className="border-t border-color-subtle">
                  <td className="px-4 py-3 align-top text-sm text-primary break-words">
                    {fee.description || <span className="italic text-tertiary">Untitled fee</span>}
                  </td>
                  <td className="px-2 py-3 text-sm text-tertiary text-right font-tabular-nums">
                    {fmtNumber(fee.amount, currency)}
                  </td>
                  <td className="px-2 py-3 text-sm text-tertiary text-right font-tabular-nums">
                    {fmtNumber(feeTax, currency)}
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
    );
  }
);

const CreditNoteTotalsSummary: React.FC<{ design: CreditNoteDesign }> = React.memo(function CreditNoteTotalsSummary({ design }) {
  const currency = design.currency;
  const meta = getCurrencyMetadata(currency);
  const dp = meta.decimalPlaces;

  const hasDiscount = hasNonZero(design.discountTotal);
  const hasTax = hasNonZero(design.taxTotal);
  const hasFees = hasNonZero(design.feeTotal);
  const hasApplied = hasNonZero(design.appliedTotal);
  const total = new Decimal(design.total || 0);

  return (
    <div className="mt-6 flex justify-end">
      <div className="w-56 space-y-1 font-tabular-nums">
        <div className="flex justify-between py-2 text-sm">
          <span className="text-tertiary">Subtotal</span>
          <span className="text-primary">{fmtNumber(design.subtotal, currency, dp)}</span>
        </div>

        {hasDiscount && (
          <div className="flex justify-between py-2 text-sm">
            <span className="text-tertiary">Discount</span>
            <span className="text-success-text">−{fmtNumber(design.discountTotal, currency, dp)}</span>
          </div>
        )}

        {hasTax && (
          <div className="flex justify-between py-2 text-sm">
            <span className="text-tertiary">Tax</span>
            <span className="text-primary">{fmtNumber(design.taxTotal, currency, dp)}</span>
          </div>
        )}

        {hasFees && (
          <div className="flex justify-between py-2 text-sm">
            <span className="text-tertiary">Fees</span>
            <span className="text-primary">{fmtNumber(design.feeTotal, currency, dp)}</span>
          </div>
        )}

        <div className="border-t-2 border-color pt-3">
          <div className="flex justify-between">
            <span className="text-base font-semibold text-secondary">Total Credit</span>
            <span className="text-xl font-bold text-primary">{fmtNumber(design.total, currency, dp)}</span>
          </div>
        </div>

        {hasApplied && (
          <>
            <div className="flex justify-between py-2 text-sm">
              <span className="text-tertiary">Amount Applied</span>
              <span className="text-success-text">−{fmtNumber(design.appliedTotal, currency, dp)}</span>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <span className="text-tertiary">Amount Remaining</span>
              <span className="text-primary">{fmtNumber(design.amountDue, currency, dp)}</span>
            </div>
          </>
        )}

        <div className="border-t-2 border-color pt-3">
          <div className="flex justify-between">
            <span className="text-lg font-semibold text-primary-brand">Total Credit</span>
            <span className="text-2xl font-extrabold text-primary-brand font-tabular-nums">
              {fmtNumber(total, currency, dp)}
            </span>
          </div>
          <p className="text-right text-xs text-tertiary">
            ({amountInWords(design.total, currency)})
          </p>
        </div>
      </div>
    </div>
  );
});

const ApplicationsSection: React.FC<{ design: CreditNoteDesign; currency: string }> = React.memo(
  function ApplicationsSection({ design, currency }) {
    if (!design.applications || design.applications.length === 0) return null;

    return (
      <div className="mt-6">
        <h3 className="invoice-section-title mb-2">Applied to Invoices</h3>
        <div className="overflow-x-auto rounded-xl border border-color">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-alt">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-tertiary">Invoice</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Amount</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Date</th>
              </tr>
            </thead>
            <tbody>
              {design.applications.map((app, i) => (
                <tr key={i} className="border-t border-color-subtle">
                  <td className="px-4 py-3 text-sm text-primary">
                    {app.invoiceNumber || app.invoiceId || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-primary text-right font-tabular-nums">
                    {fmtNumber(app.amount, currency)}
                  </td>
                  <td className="px-4 py-3 text-sm text-tertiary text-right font-tabular-nums">
                    {fmtDate(app.appliedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
);

const TermsAndAuthorization: React.FC<{ design: CreditNoteDesign }> = React.memo(function TermsAndAuthorization({ design }) {
  const hasTerms = design.terms && design.terms.length > 0;
  const hasCustomerNotes = design.notesForCustomer && design.notesForCustomer.length > 0;
  const hasSignature = design.authorizationName && design.authorizationName.length > 0;

  return (
    <div className="mt-8 border-t border-color pt-6">
      {/* Terms & Conditions */}
      {hasTerms && (
        <div className="mb-6">
          <h3 className="invoice-section-title mb-2">Terms &amp; Conditions</h3>
          <p className="whitespace-pre-line text-xs text-tertiary">{design.terms}</p>
        </div>
      )}

      {/* Notes for customer */}
      {hasCustomerNotes && (
        <div className="mb-6">
          <h3 className="invoice-section-title mb-2">Notes</h3>
          <p className="whitespace-pre-line text-sm text-secondary">{design.notesForCustomer}</p>
        </div>
      )}

      {/* Authorization / Signature */}
      {hasSignature && (
        <div className="mb-6">
          <h3 className="invoice-section-title mb-2">Authorization</h3>
          <div className="mt-4 flex items-end gap-6">
            <div className="flex-1">
              <p className="text-sm text-secondary">
                This credit note authorizes the adjustment of the customer's account balance in the amount of{" "}
                <strong className="font-tabular-nums text-primary">
                  {fmtNumber(design.total, design.currency)}
                </strong>
                .
              </p>
              {design.authorizationTitle && (
                <p className="mt-1 text-xs text-tertiary">{design.authorizationTitle}</p>
              )}
            </div>
            <div className="flex min-w-[180px] flex-col items-end">
              <div className="border-b-2 border-color-subtle pb-8 pt-12 mb-1 w-full">
                <span className="block text-center text-xs text-tertiary mb-1">Signed</span>
              </div>
              <p className="text-sm font-medium text-primary">{design.authorizationName}</p>
              {design.authorizationTitle && (
                <p className="text-xs text-tertiary">{design.authorizationTitle}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const CreditNoteFooter: React.FC<{ design: CreditNoteDesign }> = React.memo(function CreditNoteFooter({ design }) {
  const hasNotes = design.notes && design.notes.length > 0;

  return (
    <>
      {hasNotes && (
        <div className="border-t border-color px-8 py-6">
          <h3 className="invoice-section-title mb-1.5">Notes</h3>
          <p className="whitespace-pre-line text-sm text-secondary">{design.notes}</p>
        </div>
      )}

      <div className="border-t border-color px-8 py-4 text-center text-xs text-tertiary">
        {design.isFinalized
          ? `Credit Note #${design.creditNoteNumber}. All rights reserved.`
          : "This is a draft credit note. Not yet finalized."}
      </div>
    </>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface CreditNoteDisplayProps {
  design: CreditNoteDesign;
  businessLogo?: string | null;
  businessLegalName?: string | null;
  businessTaxId?: string;
  businessRegistrationNumber?: string | null;
  businessAddress?: string;
  businessWebsite?: string;
  onDownloadPdf?: () => void;
  onShare?: () => void;
  showActions?: boolean;
  className?: string;
}

function CreditNoteDisplayBase({
  design,
  businessLogo,
  businessLegalName,
  businessTaxId,
  businessRegistrationNumber,
  businessAddress,
  businessWebsite,
  onDownloadPdf,
  onShare,
  showActions = true,
  className,
}: CreditNoteDisplayProps) {
  const currency = design.currency || "USD";
  const effectiveLogo = businessLogo ?? design.businessLogo;
  const effectiveLegalName = businessLegalName ?? design.businessLegalName;
  const effectiveTaxId = businessTaxId ?? design.businessTaxId;
  const effectiveRegNumber = businessRegistrationNumber ?? design.businessRegistrationNumber;
  const effectiveAddress = businessAddress ?? design.businessAddress;
  const effectiveWebsite = businessWebsite ?? design.businessWebsite;

  const displayDesign: CreditNoteDesign = {
    ...design,
    businessLogo: effectiveLogo,
    businessLegalName: effectiveLegalName,
    businessTaxId: effectiveTaxId,
    businessRegistrationNumber: effectiveRegNumber,
    businessAddress: effectiveAddress,
    businessWebsite: effectiveWebsite,
  };

  return (
    <div
      className={cn(
        "credit-note-display bg-surface border border-color rounded-xl shadow-sm font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif]",
        className
      )}
      data-credit-note-display="true"
    >
      <div className="p-8">
        {/* === Header: business info + status === */}
        <CreditNoteHeader design={displayDesign} />

        {/* === Document metadata grid === */}
        <CreditNoteMetaGrid design={displayDesign} />

        {/* === Customer / Bill To === */}
        <CustomerInfoSection design={displayDesign} />

        {/* === Reason for credit === */}
        <ReasonSection design={displayDesign} />

        {/* === Applied to invoices (if any) === */}
        <ApplicationsSection design={displayDesign} currency={currency} />

        {/* === Line items table === */}
        <CreditNoteLineItemsTable design={displayDesign} currency={currency} />

        {/* === Fees table === */}
        <CreditNoteFeesTable design={displayDesign} currency={currency} />

        {/* === Totals summary === */}
        <CreditNoteTotalsSummary design={displayDesign} />
      </div>

      {/* === Footer: terms, notes, authorization === */}
      <div className="border-t border-color px-8 py-6">
        <TermsAndAuthorization design={displayDesign} />
        <CreditNoteFooter design={displayDesign} />
      </div>

      {/* === Action bar (print-hidden) === */}
      {showActions && (onDownloadPdf || onShare) && (
        <div className="border-t border-color px-8 py-4 flex justify-end gap-3 print:hidden">
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="btn btn-secondary btn-sm"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          )}
          {onDownloadPdf && (
            <button
              type="button"
              onClick={onDownloadPdf}
              className="btn btn-secondary btn-sm"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(CreditNoteDisplayBase);
