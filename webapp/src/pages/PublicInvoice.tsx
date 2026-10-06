import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  FileText,
  AlertCircle,
  Check,
  Download,
  Paperclip,
} from "lucide-react";
import {
  getPublicInvoice,
  recordPublicView,
  payInvoicePublic,
  getPublicInvoicePdf,
  createPaymentIntentPublic,
  getStripeConfig,
} from "../api/client";
import { formatCurrency } from "../utils/format";
import { Decimal } from "decimal.js";
import { loadStripe } from "@stripe/stripe-js";
import type { Stripe, StripeElements } from "@stripe/stripe-js";
import EmptyState from "@/components/ui/EmptyState";

interface PublicInvoiceData {
  id: string;
  invoice_number?: string | null;
  status: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  currency: string;
  due_date?: string | null;
  issue_date?: string | null;
  paid_at?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  payment_instructions?: string | null;
  notes?: string | null;
  public_token?: string | null;
  deposit_type?: string | null;
  deposit_value?: string | null;
  deposit_due_date?: string | null;
  deposit_paid?: string | null;
  deposit_due?: string | null;
  late_fee_type?: string | null;
  late_fee_value?: string | null;
  late_fee_applied?: boolean | null;
  late_fee_applied_amount?: string | null;
}

interface PublicAttachment {
  id: string;
  category: "attachment" | "before" | "after";
  name: string;
  size: number;
  mime_type?: string | null;
  data_url?: string | null;
}

export default function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<PublicInvoiceData | null>(null);
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payAmount, setPayAmount] = useState<string>("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [payingDeposit, setPayingDeposit] = useState(false);
  const [showDepositPayment, setShowDepositPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [stripeElements, setStripeElements] = useState<StripeElements | null>(null);
  const [paymentElementReady, setPaymentElementReady] = useState(false);
  const [stripeAvailable, setStripeAvailable] = useState(false);
  const [attachments, setAttachments] = useState<PublicAttachment[]>([]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setLoadError("Invoice link is missing.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    recordPublicView(token).catch(() => {});

    getPublicInvoice(token)
      .then((data) => {
        if (!cancelled) {
          setInvoice(data.invoice);
          setHtml(data.html || "");
          setAttachments(data.attachments ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setInvoice(null);
          setLoadError(err.response?.data?.error || "Could not load invoice");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

if (loading) return <EmptyState variant="loading" title="Loading invoice..." className="min-h-screen py-20" />;
  if (loadError) {
    return (
      <EmptyState
        variant="error"
        title="Could not load invoice"
        description={loadError}
        actionLabel="Try again"
        onAction={() => window.location.reload()}
        icon={<AlertCircle className="w-8 h-8" />}
        className="min-h-screen bg-surface-alt py-12"
      />
    );
  }
  if (!invoice) return <EmptyState title="Invoice not found" description="This invoice link may have expired or is invalid." className="text-center py-20" />;

  const paid = new Decimal(invoice.amount_paid || 0);
  const due = new Decimal(invoice.amount_due || 0);
  const isFullyPaid = paid.gte(new Decimal(invoice.total || 0));

  const depositType = invoice.deposit_type || "none";
  const depositValue = invoice.deposit_value || "0";
  const depositPaid = new Decimal(invoice.deposit_paid || "0");
  const depositDue = new Decimal(invoice.deposit_due || "0");
  const hasDeposit = depositType !== "none" && depositDue.gt(0);

  const lateFeeApplied = invoice.late_fee_applied === true;
  const lateFeeAppliedAmount = new Decimal(invoice.late_fee_applied_amount || "0");
  const hasLateFee = lateFeeApplied && lateFeeAppliedAmount.gt(0);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-surface-alt text-tertiary",
      sent: "status-info-bg status-info-text",
      viewed: "status-info-bg status-info-text",
      partially_paid: "status-warning-bg status-warning-text",
      paid: "status-success-bg status-success-text",
      overdue: "status-error-bg status-error-text",
      cancelled: "bg-surface-alt text-tertiary",
      void: "bg-surface-alt text-tertiary",
    };
    return colors[status] || colors.draft;
  };

  async function handlePay(isDeposit = false) {
    if (!token || !payAmount || Number(payAmount) <= 0) return;
    if (isDeposit) setPayingDeposit(true);
    else setPaying(true);
    setPaymentError(null);

    try {
      const intent = await createPaymentIntentPublic(token);

      if (intent.provider === "stripe" && intent.clientSecret) {
        const config = await getStripeConfig();
        if (config?.publishableKey) {
          const s = await loadStripe(config.publishableKey);
          if (s) {
            setStripe(s);
            const els = s.elements({
              clientSecret: intent.clientSecret,
              appearance: { theme: "stripe" },
            });
            const paymentElement = els.create("payment", { layout: "tabs" });
            paymentElement.mount("#public-payment-element");
            setStripeElements(els);
            setClientSecret(intent.clientSecret);
            setStripeAvailable(true);
            setPaymentElementReady(true);
            return;
          }
        }
        setPaymentError("Stripe is not configured. Please try again later.");
      } else {
        await payInvoicePublic(token, {
          amount: Number(payAmount),
          provider: intent.provider ?? "stub",
        });
        setPaymentSuccess(true);
        if (invoice) {
          setInvoice({ ...invoice, amount_paid: new Decimal(invoice.amount_paid || 0).plus(payAmount).toFixed(2) });
        }
        setPayAmount("");
        if (isDeposit) setShowDepositPayment(false);
      }
    } catch (err: any) {
      setPaymentError(err.response?.data?.error || err.message || "Payment failed");
    } finally {
      setPaying(false);
      setPayingDeposit(false);
    }
  }

  async function handleConfirmStripePayment() {
    if (!stripe || !stripeElements || !payAmount) return;
    setPaying(true);
    setPaymentError(null);
    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements: stripeElements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (stripeError) {
        setPaymentError(stripeError.message || "Payment failed");
        return;
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        setPaymentSuccess(true);
        if (invoice) {
          setInvoice({ ...invoice, amount_paid: new Decimal(invoice.amount_paid || 0).plus(payAmount).toFixed(2) });
        }
        setPayAmount("");
        setShowDepositPayment(false);
      }
    } catch (err: any) {
      setPaymentError(err.message || "Payment failed");
    } finally {
      setPaying(false);
      setStripe(null);
      setStripeElements(null);
      setClientSecret(null);
      setPaymentElementReady(false);
      setStripeAvailable(false);
    }
  }

  async function handleDownloadPdf() {
    if (!token) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const blob = await getPublicInvoicePdf(token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoice?.invoice_number ?? invoice?.id ?? "invoice"}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setPdfError(err.response?.data?.error || "Could not download PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-alt py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="bg-surface rounded-xl border border-color-subtle shadow-sm overflow-hidden">
          <div className="border-b border-color-subtle px-8 py-6 bg-gradient-to-r from-primary-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-lg bg-primary-action flex items-center justify-center">
                  <FileText className="w-6 h-6 text-on-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-primary">
                    Invoice #{invoice.invoice_number || invoice.id}
                  </h1>
                  <p className="text-sm text-secondary">Professional invoice from your business</p>
                </div>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(invoice.status)}`}>
                {invoice.status}
              </span>
            </div>
          </div>

          <div className="px-8 py-6" dangerouslySetInnerHTML={{ __html: html }} />

          {attachments.length > 0 && (
            <AttachmentsSection attachments={attachments} />
          )}

          {hasDeposit && (
            <div className="border-t border-color-subtle px-8 py-6 status-warning-bg">
              <div className="flex items-center gap-3 mb-4">
<div className="w-8 h-8 rounded-lg status-warning-bg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 status-warning-text" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold status-warning-text">Deposit Required</h3>
                  <p className="text-sm status-warning-text">
                    This invoice requires a {depositType === "percentage" ? `${depositValue}%` : `fixed amount of ${formatCurrency(depositValue, invoice.currency)}`} deposit
                    {invoice.deposit_due_date ? ` due by ${new Date(invoice.deposit_due_date).toLocaleDateString()}` : ""}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-surface rounded-lg p-3">
                  <p className="status-warning-text font-medium">Deposit Due</p>
                  <p className="text-2xl font-bold status-warning-text">{formatCurrency(depositDue, invoice.currency)}</p>
                </div>
                <div className="bg-surface rounded-lg p-3">
                  <p className="status-success-text font-medium">Deposit Paid</p>
                  <p className="text-2xl font-bold status-success-text">{formatCurrency(depositPaid, invoice.currency)}</p>
                </div>
              </div>
              {!isFullyPaid && depositDue.gt(0) && !showDepositPayment && (
                <button
                  onClick={() => {
                    setPayAmount(depositDue.toFixed(2));
                    setShowDepositPayment(true);
                  }}
                  className="mt-4 w-full sm:w-auto rounded-lg bg-primary-action px-6 py-3 text-sm font-medium text-on-primary hover-bg-primary-action"
                >
                  Pay Deposit Now
                </button>
              )}
            </div>
          )}

          {!isFullyPaid && due.gt(0) && (
            <div className="border-t border-color-subtle px-8 py-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="text-center sm:text-left">
                  <p className="text-sm text-secondary">Amount Due</p>
                  <p className="text-3xl font-bold text-primary-brand">{formatCurrency(due, invoice.currency)}</p>
                  {invoice.due_date && (
                    <p className="text-xs text-secondary mt-1">
                      Due: {new Date(invoice.due_date).toLocaleDateString()}
                      {new Date() > new Date(invoice.due_date) && (
                        <span className="ml-2 status-error-text font-medium">(Overdue)</span>
                      )}
                    </p>
                  )}
                  {hasLateFee && (
                    <div className="mt-2 text-xs text-secondary">
                      <div className="flex items-center gap-1 status-error-text">
                        <AlertCircle className="w-3 h-3" />
                        Late fee applied: {formatCurrency(lateFeeAppliedAmount, invoice.currency)}
                      </div>
                    </div>
                  )}
                </div>

                {paymentSuccess ? (
                  <div className="text-center">
                    <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium status-success-bg status-success-text">
                      Payment Successful!
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setPayAmount(invoice.amount_due || invoice.total);
                      setShowDepositPayment(false);
                    }}
                    className="rounded-lg bg-primary-action px-6 py-3 text-sm font-medium text-on-primary hover:bg-primary-hover"
                  >
                    Pay Now
                  </button>
                )}
              </div>

              {(payAmount || showDepositPayment) && !stripeAvailable && (
                <div className="mt-6 border-t border-color-subtle pt-6">
                  <div className="max-w-sm">
                    <label className="block text-sm font-medium text-secondary mb-2">
                      Payment Amount ({invoice.currency.toUpperCase()})
                      {showDepositPayment && <span className="ml-2 text-xs status-warning-text">(Deposit Payment)</span>}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={showDepositPayment ? (invoice.deposit_due || invoice.amount_due || invoice.total) : (invoice.amount_due || invoice.total)}
                        value={payAmount}
                        onChange={(e) => {
                          setPayAmount(e.target.value);
                          setPaymentError(null);
                        }}
                        className="flex-1 text-sm border border-input-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder={showDepositPayment ? (invoice.deposit_due || invoice.amount_due || invoice.total) : (invoice.amount_due || invoice.total)}
                      />
                      <button
                        onClick={() => handlePay(showDepositPayment)}
                        disabled={paying || payingDeposit || !payAmount || Number(payAmount) <= 0}
                        className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
                      >
                        {paying || payingDeposit ? "Processing..." : "Confirm"}
                      </button>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setPayAmount(showDepositPayment ? (invoice.deposit_due || invoice.amount_due || invoice.total) : (invoice.amount_due || invoice.total))}
                        className="text-xs text-secondary hover:text-primary"
                      >
                        Pay full {showDepositPayment ? "deposit" : "amount"}
                      </button>
                      <button
                        onClick={() => { setPayAmount(""); setShowDepositPayment(false); }}
                        className="text-xs text-secondary hover:text-primary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  {paymentError && (
                    <p className="mt-2 text-xs status-error-text">{paymentError}</p>
                  )}
                </div>
              )}

              {stripeAvailable && paymentElementReady && (
                <div className="mt-6 border-t border-color-subtle pt-6">
                  <div className="max-w-lg">
                    <label className="block text-sm font-medium text-secondary mb-2">
                      Secure Card Payment ({invoice.currency.toUpperCase()})
                    </label>
                    <div id="public-payment-element" className="w-full min-h-[160px] mb-3" />
                    <button
                      onClick={handleConfirmStripePayment}
                      disabled={paying}
                      className="w-full rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
                    >
                      {paying ? "Processing..." : `Pay ${formatCurrency(payAmount || invoice.amount_due || invoice.total, invoice.currency)}`}
                    </button>
                    <button
                      onClick={() => {
                        setStripe(null);
                        setStripeElements(null);
                        setClientSecret(null);
                        setPaymentElementReady(false);
                        setStripeAvailable(false);
                        setPayAmount("");
                        setShowDepositPayment(false);
                      }}
                      className="w-full mt-2 text-xs text-secondary hover:text-primary"
                    >
                      Cancel Payment
                    </button>
                  </div>
                  {paymentError && (
                    <p className="mt-2 text-xs status-error-text">{paymentError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {isFullyPaid && (
            <div className="border-t border-color-subtle px-8 py-6 status-success-bg">
              <div className="text-center">
<div className="w-16 h-16 rounded-full status-success-bg flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 status-success-text" />
              </div>
                <span className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium status-success-bg status-success-text">
                  Fully Paid
                </span>
                {invoice.paid_at && (
                  <p className="text-xs text-secondary mt-1">
                    Paid on {new Date(invoice.paid_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-color-subtle px-8 py-4 flex justify-end gap-3">
            {pdfError && (
              <div className="flex items-center gap-2 text-sm status-error-text">
                <span>{pdfError}</span>
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfLoading}
                  className="text-sm text-primary-brand hover:text-primary-brand underline"
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
              {pdfLoading ? "Preparing..." : "Download PDF"}
            </button>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-secondary">
          <p>Powered by InvoiceFlow</p>
        </div>
      </div>
    </div>
  );
}

function formatAttachmentSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(a: PublicAttachment): boolean {
  const mime = a.mime_type ?? "";
  const name = a.name.toLowerCase();
  return (
    mime.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)
  );
}

function AttachmentsSection({ attachments }: { attachments: PublicAttachment[] }) {
  const labelFor = (category: string) =>
    category === "before" ? "Before photos" : category === "after" ? "After photos" : "Attachments";

  const grouped: Array<{ label: string; items: PublicAttachment[] }> = [];
  for (const category of ["before", "after", "attachment"] as const) {
    const items = attachments.filter((a) => a.category === category);
    if (items.length > 0) grouped.push({ label: labelFor(category), items });
  }

  return (
    <div className="border-t border-color-subtle px-8 py-6">
      <div className="flex items-center gap-2 mb-4">
        <Paperclip className="w-4 h-4 text-secondary" />
        <h3 className="text-base font-semibold text-primary">
          Attachments ({attachments.length})
        </h3>
      </div>
      <div className="space-y-6">
        {grouped.map((group) => (
          <div key={group.label}>
            <p className="text-sm font-medium text-secondary mb-2">{group.label}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.items.map((a) => {
                const image = isImageAttachment(a);
                const src = a.data_url ?? "";
                if (image && src) {
                  return (
                    <a
                      key={a.id}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative overflow-hidden rounded-lg border border-color-subtle bg-surface-alt"
                    >
                      <img
                        src={src}
                        alt={a.name}
                        className="h-32 w-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-overlay px-2 py-1 text-left text-[11px] text-primary">
                        {a.name}
                      </span>
                    </a>
                  );
                }
                return (
                  <a
                    key={a.id}
                    href={src || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-color-subtle bg-surface-alt px-3 py-3 hover:bg-hover"
                  >
                    <Paperclip className="h-5 w-5 shrink-0 text-secondary" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-primary">{a.name}</span>
                      <span className="block text-xs text-tertiary">{formatAttachmentSize(a.size)}</span>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}





