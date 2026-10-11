import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Download, RefreshCw, Copy } from "lucide-react";
import { Decimal } from "decimal.js";
import { formatCurrency, formatDateLong } from "@/utils/format";
import { getCurrencyMetadata } from "@/types/currency";
import { getPublicQuote, recordQuoteView, acceptPublicQuote, getPublicQuotePdf, getBusiness } from "@/api/client";
import type { ApiQuote, ApiQuoteItem, ApiQuoteFee } from "@/types/api";
import EmptyState from "@/components/ui/EmptyState";

const QUOTE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-tertiary/10 text-tertiary",
  sent: "bg-info-bg text-info-text",
  viewed: "bg-info-bg text-info-text",
  accepted: "bg-success-bg text-success-text",
  rejected: "bg-error-bg text-error-text",
  expired: "bg-tertiary/20 text-tertiary",
};

function formatQuantity(qty: string | undefined | null): string {
  const d = new Decimal(qty ?? 0);
  if (d.isZero()) return "0";
  return d.toFixed(2).replace(/\.?0+$/, "");
}

function hasNonZero(value: string | undefined | null): boolean {
  return new Decimal(value ?? 0).gt(0);
}

function formatLineItemTax(item: ApiQuoteItem): string | null {
  const taxPct = new Decimal(item.tax_rate ?? 0).mul(100);
  if (taxPct.isZero()) return null;
  const suffix = item.is_tax_inclusive ? " (incl. tax)" : "";
  const name = item.tax_name ? ` (${item.tax_name})` : "";
  return `${taxPct.toFixed(2)}%${suffix}${name}`;
}

function formatLineItemDiscount(item: ApiQuoteItem, currency: string, decimalPlaces: number): string | null {
  const discount = new Decimal(item.discount ?? 0);
  if (discount.isZero()) return null;
  if (item.discount_type === "percentage") {
    return ` −${discount.toFixed(2)}%`;
  }
  return ` −${formatCurrency(discount, currency, decimalPlaces)}`;
}

export interface QuotePreviewProps {
  quote: ApiQuote;
  businessName?: string;
  businessLogo?: string | null;
  businessAddress?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessWebsite?: string;
  businessTaxId?: string;
  onLoadPdf?: () => Promise<void>;
  onAccept?: () => void;
  showAcceptAction?: boolean;
}

export default function QuotePreview({
  quote,
  businessName,
  businessLogo,
  businessAddress,
  businessEmail,
  businessPhone,
  businessWebsite,
  businessTaxId,
  onLoadPdf,
  onAccept,
  showAcceptAction = false,
}: QuotePreviewProps) {
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currency = quote.currency || "USD";
  const meta = getCurrencyMetadata(currency);

  const statusColor = QUOTE_STATUS_COLORS[quote.status] || "bg-tertiary/10 text-tertiary";

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      await acceptPublicQuote(quote.public_token!);
      onAccept?.();
    } catch (err: any) {
      setAcceptError(err.message || "Could not accept quote");
    } finally {
      setAccepting(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.href}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (onLoadPdf) {
      await onLoadPdf();
    }
  };

  const subtotal = new Decimal(quote.subtotal || 0);
  const discountTotal = new Decimal(quote.discount_total || 0);
  const taxTotal = new Decimal(quote.tax_total || 0);
  const feeTotal = new Decimal(quote.fee_total || 0);
  const total = new Decimal(quote.total || 0);
  const amountPaid = new Decimal(quote.amount_paid || 0);
  const amountDue = new Decimal(quote.amount_due || 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div
        className="quote-preview bg-surface border border-color rounded-xl shadow-sm font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif]"
        data-quote-preview="true"
      >
        <div className="p-8">
          {/* Header: business info + status + title */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              {businessLogo && (
                <img src={businessLogo} alt={businessName || "Business logo"} className="h-16 w-auto rounded-xl object-contain" />
              )}
              <div>
                {businessName && <h1 className="text-2xl font-bold text-primary">{businessName}</h1>}
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
                {businessTaxId && <p className="mt-1 text-xs text-tertiary">Tax ID: {businessTaxId}</p>}
                {businessAddress && <p className="mt-1 whitespace-pre-line text-sm text-secondary">{businessAddress}</p>}
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              {showAcceptAction && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>
                  {quote.status === "accepted"
                    ? "Accepted"
                    : quote.status === "sent" || quote.status === "viewed"
                      ? "Open for acceptance"
                      : quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                </span>
              )}
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">QUOTE</p>
                {quote.quote_number && <p className="text-sm text-tertiary">#{quote.quote_number}</p>}
              </div>
            </div>
          </div>

          {/* Quote metadata grid */}
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-color bg-surface-alt p-4 sm:grid-cols-4">
            <div>
              <span className="invoice-section-title block">Quote #</span>
              <p className="mt-0.5 text-sm font-medium text-primary">{quote.quote_number ?? quote.id}</p>
            </div>
            <div>
              <span className="invoice-section-title block">Issue date</span>
              <p className="mt-0.5 text-sm font-medium text-primary">{formatDateLong(quote.issue_date ?? undefined)}</p>
            </div>
            <div>
              <span className="invoice-section-title block">Due date</span>
              <p className="mt-0.5 text-sm font-medium text-primary">{formatDateLong(quote.due_date ?? undefined)}</p>
            </div>
            <div>
              <span className="invoice-section-title block">Valid until</span>
              <p className="mt-0.5 text-sm font-medium text-primary">{formatDateLong(quote.expiry_date ?? undefined)}</p>
            </div>
          </div>

          {/* Customer section */}
          {quote.customer_name && (
            <div className="mt-6">
              <h2 className="invoice-section-title mb-2">Bill To</h2>
              <div className="space-y-0.5">
                <p className="text-base font-semibold text-primary">{quote.customer_name}</p>
                {quote.customer_email && (
                  <a href={`mailto:${quote.customer_email}`} className="text-sm text-primary-brand hover:text-primary">
                    {quote.customer_email}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Line items */}
          <div className="mt-6 overflow-x-auto rounded-xl border border-color">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="bg-surface-alt">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
                  <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase text-tertiary">Qty</th>
                  <th className="px-2 py-2.5 text-left text-xs font-semibold uppercase text-tertiary">Unit</th>
                  <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Rate</th>
                  <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Tax Rate</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(quote.items || []).map((item) => {
                  const taxNote = formatLineItemTax(item);
                  const discountNote = formatLineItemDiscount(item, currency, meta.decimalPlaces);
                  return (
                    <tr key={item.id} className="border-t border-color-subtle">
                      <td className="px-4 py-3 align-top text-sm text-primary break-words">
                        {item.description || <span className="italic text-tertiary">Untitled item</span>}
                        {taxNote && (
                          <span className="mt-0.5 block text-xs text-tertiary">
                            {taxNote}
                          </span>
                        )}
                        {discountNote && (
                          <span className="mt-0.5 block text-xs text-success-text">
                            Discount{discountNote}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center text-sm text-tertiary font-tabular-nums">{formatQuantity(item.quantity)}</td>
                      <td className="px-2 py-3 text-sm text-tertiary">{item.unit || "—"}</td>
                      <td className="px-2 py-3 text-sm text-secondary text-right font-tabular-nums">
                        {formatCurrency(item.unit_price, currency, meta.decimalPlaces)}
                      </td>
                      <td className="px-2 py-3 text-sm text-tertiary text-right font-tabular-nums">
                        {taxNote || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-primary text-right font-tabular-nums">
                        {formatCurrency(item.line_total, currency, meta.decimalPlaces)}
                      </td>
                    </tr>
                  );
                })}
                {(quote.items || []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-tertiary">
                      No line items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Fees breakdown */}
          {(quote.fees || []).length > 0 && (
            <div className="mt-2 overflow-x-auto rounded-xl border border-color">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-alt">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
                    <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Amount</th>
                    <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Tax</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-tertiary">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(quote.fees || []).map((fee: ApiQuoteFee, i: number) => {
                    const feeBase = new Decimal(fee.amount ?? 0);
                    const feeTax = new Decimal(fee.tax_amount ?? 0);
                    const feeTotal = feeBase.plus(feeTax);
                    return (
                      <tr key={fee.id ?? `fee_${i}`} className="border-t border-color-subtle">
                        <td className="px-4 py-3 text-sm text-primary">{fee.description}</td>
                        <td className="px-2 py-3 text-right text-sm text-secondary font-tabular-nums">
                          {formatCurrency(feeBase, currency, meta.decimalPlaces)}
                        </td>
                        <td className="px-2 py-3 text-right text-sm text-tertiary font-tabular-nums">
                          {formatCurrency(feeTax, currency, meta.decimalPlaces)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-primary text-right font-tabular-nums">
                          {formatCurrency(feeTotal, currency, meta.decimalPlaces)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-56 space-y-1 font-tabular-nums">
              <div className="flex justify-between py-2 text-sm">
                <span className="text-tertiary">Subtotal</span>
                <span className="text-primary">{formatCurrency(subtotal, currency, meta.decimalPlaces)}</span>
              </div>
              {hasNonZero(quote.discount_total) && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-tertiary">Discount</span>
                  <span className="text-success-text">−{formatCurrency(discountTotal, currency, meta.decimalPlaces)}</span>
                </div>
              )}
              {hasNonZero(quote.tax_total) && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-tertiary">Tax</span>
                  <span className="text-primary">{formatCurrency(taxTotal, currency, meta.decimalPlaces)}</span>
                </div>
              )}
              {hasNonZero(quote.fee_total) && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-tertiary">Fees</span>
                  <span className="text-primary">{formatCurrency(feeTotal, currency, meta.decimalPlaces)}</span>
                </div>
              )}
              <div className="border-t-2 border-color pt-3">
                <div className="flex justify-between">
                  <span className="text-base font-semibold text-secondary">Total</span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(total, currency, meta.decimalPlaces)}
                  </span>
                </div>
              </div>
              {amountPaid.gt(0) && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-tertiary">Amount Paid</span>
                  <span className="text-success-text">−{formatCurrency(amountPaid, currency, meta.decimalPlaces)}</span>
                </div>
              )}
              {hasNonZero(quote.amount_due) && (
                <div className="flex justify-between border-t border-color-subtle pt-2">
                  <span className="text-base font-semibold text-secondary">Amount Due</span>
                  <span className="text-xl font-bold text-primary-brand font-tabular-nums">
                    {formatCurrency(amountDue, currency, meta.decimalPlaces)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scope of work */}
        {quote.scope_of_work && (
          <div className="border-t border-color px-8 py-6">
            <h2 className="invoice-section-title mb-1.5">Scope of work</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-primary">{quote.scope_of_work}</p>
          </div>
        )}

        {/* Deposit info */}
        {quote.deposit_type && quote.deposit_type !== "none" && (
          <div className="border-t border-color px-8 py-6">
            <h2 className="invoice-section-title mb-1.5">Deposit required</h2>
            <p className="mt-1 text-sm text-primary">
              {quote.deposit_type === "percentage"
                ? `${formatCurrency(new Decimal(quote.total || 0).mul(new Decimal(quote.deposit_value || 0).div(100)).toFixed(2), currency, meta.decimalPlaces)} (${new Decimal(quote.deposit_value || 0).mul(100).toFixed(2)}%)`
                : formatCurrency(quote.deposit_value, currency, meta.decimalPlaces)}
            </p>
            {quote.deposit_due_date && (
              <p className="mt-1 text-xs text-tertiary">Due: {formatDateLong(quote.deposit_due_date)}</p>
            )}
          </div>
        )}

        {/* Notes */}
        {quote.notes && (
          <div className="border-t border-color px-8 py-6">
            <h2 className="invoice-section-title mb-1.5">Notes</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-primary">{quote.notes}</p>
          </div>
        )}

        {/* Terms & Conditions */}
        {quote.terms && (
          <div className="border-t border-color px-8 py-6">
            <h2 className="invoice-section-title mb-1.5">Terms &amp; Conditions</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-primary">{quote.terms}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-color-subtle px-8 py-4 text-center text-xs text-tertiary">
          {quote.is_finalized
            ? `Quote #${quote.quote_number || "—"}. All rights reserved.`
            : "This is a draft quote. Not yet finalized."}
        </div>
      </div>

      {/* Action bar - Accept / Download / Share */}
      {showAcceptAction && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {(quote.status === "sent" || quote.status === "viewed") && (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="flex items-center justify-center gap-2 rounded-lg bg-success-bg px-6 py-3 text-sm font-semibold text-success-text hover:bg-success-bg/80 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              {accepting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {accepting ? "Accepting..." : "Accept Quote"}
            </button>
          )}
          {onLoadPdf && (
            <button
              onClick={handleDownloadPdf}
              className="flex items-center justify-center gap-2 rounded-lg border border-input-border px-6 py-3 text-sm font-medium text-secondary hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          )}
          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 rounded-lg border border-input-border px-6 py-3 text-sm font-medium text-secondary hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {copied ? <span className="text-success-text">Copied!</span> : <Copy className="h-4 w-4" />}
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      )}

      {acceptError && (
        <div className="mt-4 rounded-lg border status-error-border status-error-bg px-4 py-3 text-sm status-error-text">
          {acceptError}
        </div>
      )}
    </div>
  );
}

// Page-level wrapper that loads the quote from the public token route
export function PublicQuotePage() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [businessInfo, setBusinessInfo] = useState<{ name?: string; logo?: string | null; address?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    recordQuoteView(token).catch(() => {});
    Promise.all([
      getPublicQuote(token),
      getBusiness().catch(() => null),
    ])
      .then(([res, businessRes]: [any, any]) => {
        setQuote(res.quote);
        if (businessRes?.business) {
          const b = businessRes.business;
          const addressParts = [b.addressLine1, b.addressLine2, b.city, b.stateOrRegion, [b.postalCode, b.countryCode].filter(Boolean).join(" ")];
          setBusinessInfo({
            name: b.name,
            logo: b.logoUrl,
            address: addressParts.filter(Boolean).join(", "),
            email: b.email,
          });
        }
        setError(null);
      })
      .catch((err: any) => {
        setError(err.response?.data?.error || "Quote not found or link has expired");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <EmptyState variant="loading" title="Loading quote..." description="Please wait" className="mx-auto max-w-2xl p-4 sm:p-6" />;
  }

  if (error || !quote) {
    return (
      <EmptyState
        variant="error"
        title="Quote not found"
        description={error || "This quote link is no longer available."}
        className="mx-auto max-w-md p-4"
      />
    );
  }

  const handleDownloadPdf = async () => {
    if (!token) return;
    const blob = await getPublicQuotePdf(token);
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `quote-${quote.quote_number ?? quote.id}.pdf`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <QuotePreview
      quote={quote}
      businessName={businessInfo?.name}
      businessLogo={businessInfo?.logo}
      businessAddress={businessInfo?.address}
      businessEmail={businessInfo?.email}
      showAcceptAction
      onLoadPdf={handleDownloadPdf}
    />
  );
}
