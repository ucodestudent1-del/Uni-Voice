import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  FileText,
  AlertCircle,
  Check,
  Download,
  X,
} from "lucide-react";
import {
  getPublicQuote,
  recordPublicQuoteView,
  acceptPublicQuote,
  rejectPublicQuote,
  getPublicQuotePdf,
  recordQuoteDeposit,
} from "../api/client";
import { formatCurrency } from "../utils/format";
import { Decimal } from "decimal.js";
import type { ApiQuote } from "../api/client";
import EmptyState from "@/components/ui/EmptyState";

export default function PublicQuote() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [payingDeposit, setPayingDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setLoadError("Quote link is missing.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    recordPublicQuoteView(token).catch(() => {});

    getPublicQuote(token)
      .then((data) => {
        if (!cancelled) {
          setQuote(data.quote);
          setHtml(data.html || "");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setQuote(null);
          setLoadError(err.response?.data?.error || "Could not load quote");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-surface-alt text-tertiary",
      sent: "status-info-bg status-info-text",
      viewed: "status-info-bg status-info-text",
      accepted: "status-success-bg status-success-text",
      rejected: "status-error-bg status-error-text",
      expired: "status-error-bg status-error-text",
    };
    return colors[status] || colors.draft;
  };

  const isExpired = quote && quote.expiry_date && new Date(quote.expiry_date) < new Date();
  const isExpiringSoon =
    quote &&
    quote.expiry_date &&
    new Date(quote.expiry_date) > new Date() &&
    new Date(quote.expiry_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const depositRate = new Decimal(quote?.deposit_value ?? 0);
  const depositTotal =
    quote?.deposit_type === "percentage"
      ? new Decimal(quote?.total ?? 0).mul(depositRate.div(100))
      : quote?.deposit_type === "fixed"
        ? depositRate
        : new Decimal(0);
  const depositDue = depositTotal;
  const hasDeposit = quote && quote.deposit_type !== "none" && depositDue.gt(0);
  const depositPaid = Boolean(quote?.deposit_paid);
  const currency = quote?.currency ?? "USD";

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    setActionError(null);
    try {
      await acceptPublicQuote(token);
      setQuote((prev) => (prev ? { ...prev, status: "accepted" } : prev));
    } catch (err: any) {
      setActionError(err.response?.data?.error || "Could not accept quote");
    } finally {
      setAccepting(false);
    }
  }

  async function handleReject() {
    if (!token) return;
    if (!window.confirm("Are you sure you want to reject this quote? This cannot be undone.")) return;
    setRejecting(true);
    setActionError(null);
    try {
      await rejectPublicQuote(token);
      setQuote((prev) => (prev ? { ...prev, status: "rejected" } : prev));
    } catch (err: any) {
      setActionError(err.response?.data?.error || "Could not reject quote");
    } finally {
      setRejecting(false);
    }
  }

  async function handlePayDeposit() {
    if (!token || !depositAmount || Number(depositAmount) <= 0) return;
    setPayingDeposit(true);
    setDepositError(null);
    try {
      await recordQuoteDeposit(token, depositAmount, "stub", `quote-deposit:${token}:${depositAmount}`);
      setDepositSuccess(true);
      setDepositAmount("");
      setQuote((prev) =>
        prev ? { ...prev, deposit_paid: true, amount_paid: new Decimal(prev.amount_paid ?? 0).plus(depositAmount).toFixed(2) } : prev
      );
    } catch (err: any) {
      setDepositError(err.response?.data?.error || err.message || "Deposit payment failed");
    } finally {
      setPayingDeposit(false);
    }
  }

  async function handleDownloadPdf() {
    if (!token) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const blob = await getPublicQuotePdf(token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quote-${quote?.quote_number ?? token.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setPdfError(err.response?.data?.error || "Could not download PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  if (loading)
    return <EmptyState variant="loading" title="Loading quote…" className="min-h-screen py-20" />;

  if (loadError) {
    return (
      <EmptyState
        variant="error"
        title="Could not load quote"
        description={loadError}
        actionLabel="Try again"
        onAction={() => window.location.reload()}
        icon={<AlertCircle className="w-8 h-8" />}
        className="min-h-screen bg-surface-alt py-12"
      />
    );
  }

  if (!quote) return <EmptyState title="Quote not found" description="This quote link may have expired or is invalid." className="text-center py-20" />;

  const showAcceptance = !["accepted", "rejected", "expired"].includes(quote.status) && !isExpired;

  return (
    <div className="min-h-screen bg-surface-alt py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="bg-surface rounded-xl border border-color-subtle shadow-sm overflow-hidden">
          {/* Header */}
          <div className="border-b border-color-subtle px-8 py-6 bg-gradient-to-r from-primary-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-action flex items-center justify-center">
                  <FileText className="w-6 h-6 text-on-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-primary">
                    Quote #{quote.quote_number || `#${quote.id.slice(0, 8)}`}
                  </h1>
                  <p className="text-sm text-secondary">
                    {quote.customer_name
                      ? `Prepared for ${quote.customer_name}`
                      : "Professional quote from your business"}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
                  getStatusColor(quote.status)
                )}
              >
                {quote.status}
              </span>
            </div>

            {(isExpired || isExpiringSoon) && (
              <div className="mt-3 p-3 status-error-bg border status-error-border rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 status-error-text" />
                  <p className="text-sm font-medium status-error-text">
                    {isExpired
                      ? `This quote expired on ${new Date(quote.expiry_date!).toLocaleDateString()}.`
                      : `This quote expires on ${new Date(quote.expiry_date!).toLocaleDateString()}.`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Rendered HTML (from template) */}
          <div className="px-8 py-6" dangerouslySetInnerHTML={{ __html: html || "" }} />

          {/* Acceptance actions */}
          {showAcceptance && (
            <div className="border-t border-color-subtle px-8 py-6 bg-surface-alt">
              {actionError && (
                <div className="mb-4 p-3 status-error-bg border status-error-border rounded-lg">
                  <p className="text-sm status-error-text">{actionError}</p>
                </div>
              )}
              <h3 className="text-lg font-semibold text-primary mb-2">Accept or Reject This Quote</h3>
              <p className="text-sm text-secondary mb-4">
                By clicking "Accept", you authorize us to proceed with the work described above. You can also pay
                the deposit to secure your schedule slot.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-action px-6 py-3 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
                >
                  <Check className="w-5 h-5" />
                  {accepting ? "Accepting…" : "Accept Quote"}
                </button>
                <button
                  onClick={handleReject}
                  disabled={rejecting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-color-subtle bg-surface px-6 py-3 text-sm font-medium text-secondary hover:bg-surface-alt disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                  {rejecting ? "Rejecting…" : "Reject Quote"}
                </button>
              </div>
            </div>
          )}

          {/* Deposit payment */}
          {hasDeposit && !depositPaid && !isExpired && (
            <div className="border-t border-color-subtle px-8 py-6 status-warning-bg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg status-warning-bg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 status-warning-text" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold status-warning-text">Deposit Required</h3>
                  <p className="text-sm status-warning-text">
                    A {quote.deposit_type === "percentage" ? `${quote.deposit_value}%` : formatCurrency(quote.deposit_value ?? 0, currency)} deposit is required to begin work
                    {quote.deposit_due_date ? ` (due by ${new Date(quote.deposit_due_date).toLocaleDateString()})` : ""}.
                  </p>
                </div>
              </div>

              {depositSuccess ? (
                <div className="flex items-center gap-2 status-success-text">
                  <Check className="w-5 h-5" />
                  <span className="text-sm font-medium">Deposit payment received. Thank you!</span>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-secondary mb-1">
                      Deposit Amount ({currency.toUpperCase()})
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step={0.01}
                        min="0.01"
                        max={depositDue.toFixed(2)}
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder={depositDue.toFixed(2)}
                        className="flex-1 rounded-lg border border-input-border bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        onClick={handlePayDeposit}
                        disabled={payingDeposit || !depositAmount || Number(depositAmount) <= 0}
                        className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
                      >
                        {payingDeposit ? "Processing…" : "Pay Deposit"}
                      </button>
                    </div>
                  </div>
                  {depositError && (
                    <p className="text-xs status-error-text">{depositError}</p>
                  )}
                  <button
                    onClick={() => setDepositAmount(depositDue.toFixed(2))}
                    className="text-xs text-secondary hover:text-primary"
                  >
                    Pay full deposit ({formatCurrency(depositDue, currency)})
                  </button>
                </>
              )}
            </div>
          )}

          {/* Deposit paid confirmation */}
          {depositPaid && (
            <div className="border-t border-color-subtle px-8 py-4 status-success-bg">
              <div className="flex items-center gap-2 status-success-text">
                <Check className="w-5 h-5" />
                <span className="text-sm font-medium">Deposit paid — thank you!</span>
              </div>
            </div>
          )}

          {/* Quote expired confirmation */}
          {quote.status === "accepted" && (
            <div className="border-t border-color-subtle px-8 py-4 status-success-bg">
              <div className="flex items-center gap-2 status-success-text">
                <Check className="w-5 h-5" />
                <span className="text-sm font-medium">This quote has been accepted and is being processed.</span>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="border-t border-color-subtle px-8 py-4 flex justify-end gap-3">
            {pdfError && (
              <div className="flex items-center gap-2 text-sm status-error-text">
                <span>{pdfError}</span>
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfLoading}
                  className="text-sm text-primary-brand hover:text-primary underline"
                >
                  Retry
                </button>
              </div>
            )}
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="text-sm text-secondary hover:text-primary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {pdfLoading ? "Preparing…" : "Download PDF"}
            </button>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-secondary">
          <p>This quote was issued on {quote.issue_date ? new Date(quote.issue_date).toLocaleDateString() : "—"}.</p>
          {quote.expiry_date && (
            <p>
              Expires on {new Date(quote.expiry_date).toLocaleDateString()}
              {isExpired && " (expired)"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
