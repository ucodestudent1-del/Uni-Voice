import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Download, RefreshCw, Copy } from "lucide-react";
import { Decimal } from "decimal.js";
import { formatCurrency, formatDateLong } from "@/utils/format";
import { getCurrencyMetadata } from "@/types/currency";
import { getPublicQuote, recordQuoteView, acceptPublicQuote, getPublicQuotePdf, getBusiness } from "@/api/client";
import type { ApiQuote } from "@/types/api";
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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-xl border border-color bg-surface shadow-sm">
        {/* Header */}
        <div className="border-b border-color-subtle p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              {businessLogo && (
                <img src={businessLogo} alt={businessName || "Business logo"} className="h-12 w-auto object-contain" />
              )}
              <div>
                {businessName && <h1 className="text-xl font-bold text-primary">{businessName}</h1>}
                {businessEmail && <p className="text-sm text-secondary">{businessEmail}</p>}
                {businessPhone && <p className="text-sm text-secondary">{businessPhone}</p>}
                {businessWebsite && <p className="text-sm text-secondary">{businessWebsite}</p>}
                {businessTaxId && <p className="text-sm text-tertiary">Tax ID: {businessTaxId}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showAcceptAction && (
                <>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}>
                    {quote.status === "accepted" ? "Accepted" : quote.status === "sent" || quote.status === "viewed" ? "Open for acceptance" : quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quote metadata */}
        <div className="border-b border-color-subtle p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <span className="block text-xs font-medium text-tertiary">Quote number</span>
              <span className="mt-1 font-medium text-primary">{quote.quote_number ?? quote.id}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-tertiary">Issue date</span>
              <span className="mt-1 font-medium text-primary">{formatDateLong(quote.issue_date ?? undefined)}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-tertiary">Due date</span>
              <span className="mt-1 font-medium text-primary">{formatDateLong(quote.due_date ?? undefined)}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-tertiary">Valid until</span>
              <span className="mt-1 font-medium text-primary">{formatDateLong(quote.expiry_date ?? undefined)}</span>
            </div>
          </div>
        </div>

        {/* Customer section */}
        {quote.customer_name && (
          <div className="border-b border-color-subtle p-6 sm:p-8">
            <h2 className="text-xs font-medium text-tertiary">Bill to</h2>
            <p className="mt-1 font-medium text-primary">{quote.customer_name}</p>
            {quote.customer_email && <p className="text-sm text-secondary">{quote.customer_email}</p>}
          </div>
        )}

        {/* Line items */}
        <div className="p-6 sm:p-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-color-subtle">
                <th className="text-left text-xs font-medium text-tertiary">Description</th>
                <th className="text-center text-xs font-medium text-tertiary">Qty</th>
                <th className="text-right text-xs font-medium text-tertiary">Rate</th>
                <th className="text-right text-xs font-medium text-tertiary">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(quote.items || []).map((item) => (
                <tr key={item.id} className="border-b border-color-subtle/50">
                  <td className="py-3 text-sm text-primary">{item.description}</td>
                  <td className="py-3 text-center text-sm text-secondary font-tabular-nums">{formatQuantity(item.quantity)}</td>
                  <td className="py-3 text-right text-sm text-secondary font-tabular-nums">
                    {formatCurrency(item.unit_price, currency, meta.decimalPlaces)}
                  </td>
                  <td className="py-3 text-right text-sm font-medium text-primary font-tabular-nums">
                    {formatCurrency(item.line_total, currency, meta.decimalPlaces)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-48 space-y-2 border-t border-color-subtle pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-tertiary">Subtotal</span>
                <span className="font-tabular-nums text-primary">{formatCurrency(subtotal, currency, meta.decimalPlaces)}</span>
              </div>
              {hasNonZero(quote.discount_total) && (
                <div className="flex justify-between text-sm">
                  <span className="text-tertiary">Discount</span>
                  <span className="font-tabular-nums text-success-text">−{formatCurrency(discountTotal, currency, meta.decimalPlaces)}</span>
                </div>
              )}
              {hasNonZero(quote.tax_total) && (
                <div className="flex justify-between text-sm">
                  <span className="text-tertiary">Tax</span>
                  <span className="font-tabular-nums text-primary">{formatCurrency(taxTotal, currency, meta.decimalPlaces)}</span>
                </div>
              )}
              {hasNonZero(quote.fee_total) && (
                <div className="flex justify-between text-sm">
                  <span className="text-tertiary">Fees</span>
                  <span className="font-tabular-nums text-primary">{formatCurrency(feeTotal, currency, meta.decimalPlaces)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-color-subtle pt-3 mt-2">
                <span className="text-base font-semibold text-secondary">Total</span>
                <span className="text-xl font-bold text-primary font-tabular-nums">
                  {formatCurrency(total, currency, meta.decimalPlaces)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scope of work */}
        {quote.scope_of_work && (
          <div className="border-t border-color-subtle p-6 sm:p-8">
            <h2 className="text-sm font-medium text-tertiary">Scope of work</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-primary">{quote.scope_of_work}</p>
          </div>
        )}

        {/* Deposit info */}
        {quote.deposit_type && quote.deposit_type !== "none" && (
          <div className="border-t border-color-subtle p-6 sm:p-8">
            <h2 className="text-sm font-medium text-tertiary">Deposit required</h2>
            <p className="mt-2 text-sm text-primary">
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
          <div className="border-t border-color-subtle p-6 sm:p-8">
            <h2 className="text-sm font-medium text-tertiary">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-primary">{quote.notes}</p>
          </div>
        )}

        {/* Terms */}
        {quote.terms && (
          <div className="border-t border-color-subtle p-6 sm:p-8">
            <h2 className="text-sm font-medium text-tertiary">Terms</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-primary">{quote.terms}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-color-subtle bg-surface-alt p-6 sm:p-8">
          {quote.payment_instructions && (
            <p className="text-sm text-secondary">{quote.payment_instructions}</p>
          )}
          {businessAddress && (
            <p className="mt-2 text-xs text-tertiary">{businessAddress}</p>
          )}
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
