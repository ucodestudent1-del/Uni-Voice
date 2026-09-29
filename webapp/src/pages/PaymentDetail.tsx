import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  getPayment,
  refundPayment,
  recordPaymentManually,
  type ApiPaymentDetail,
  type ApiPaymentEvent,
} from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import { Button } from "../components/ui/Button";
import {
  ArrowLeft,
  Download,
  Copy,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import PaymentStatus from "../components/ui/PaymentStatus";
import { useToast } from "../components/ui/ToastProvider";

interface RefundModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number, reason: string) => Promise<void>;
  payment: ApiPaymentDetail;
  processing: boolean;
}

function RefundModal({ open, onClose, onConfirm, payment, processing }: RefundModalProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  if (!open) return null;

  const paymentAmount = new Decimal(payment.amount || 0);
  const maxRefund = paymentAmount.toFixed(2);

  const handleConfirm = async () => {
    const amt = new Decimal(amount);
    if (amt.isNegative() || amt.gt(paymentAmount)) return;
    await onConfirm(amt.toNumber(), reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay" onClick={onClose}>
      <div
        className="bg-surface rounded-xl border border-color-subtle shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-4">
          <h2 className="text-lg font-semibold text-primary">Issue Refund</h2>
          <p className="mt-1 text-sm text-secondary">
            Refund up to {formatCurrency(maxRefund, payment.currency)} for this payment.
          </p>
        </div>

        <div className="px-6 pb-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={maxRefund}
              placeholder={maxRefund}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-tertiary">
              Maximum refundable: {formatCurrency(maxRefund, payment.currency)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter a reason for the refund..."
              rows={3}
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-color-subtle p-6 pt-4">
          <Button variant="secondary" size="md" onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={handleConfirm}
            disabled={processing || !amount}
          >
            {processing ? "Processing…" : "Issue Refund"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { amount: number; provider: string; providerPaymentId?: string }) => Promise<void>;
  payment: ApiPaymentDetail;
  processing: boolean;
}

function RecordPaymentModal({ open, onClose, onConfirm, payment, processing }: RecordPaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState("manual");
  const [providerPaymentId, setProviderPaymentId] = useState("");

  if (!open) return null;

  const handleConfirm = async () => {
    const amt = new Decimal(amount);
    if (amt.isNegative() || amt.isZero()) return;
    await onConfirm({ amount: amt.toNumber(), provider, providerPaymentId: providerPaymentId || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay" onClick={onClose}>
      <div
        className="bg-surface rounded-xl border border-color-subtle shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-4">
          <h2 className="text-lg font-semibold text-primary">Record Payment Manually</h2>
          <p className="mt-1 text-sm text-secondary">
            Record an offline payment for invoice #{payment.invoice_number || payment.invoice_id?.slice(0, 8)}.
          </p>
        </div>

        <div className="px-6 pb-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Payment Method
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="manual">Manual</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="check">Check</option>
              <option value="card">Card</option>
            </select>
          </div>

          {provider !== "manual" && (
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Reference / Transaction ID (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. TXN-12345"
                value={providerPaymentId}
                onChange={(e) => setProviderPaymentId(e.target.value)}
                className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-color-subtle p-6 pt-4">
          <Button variant="secondary" size="md" onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={handleConfirm}
            disabled={processing || !amount}
          >
            {processing ? "Recording…" : "Record Payment"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const EVENT_ICONS: Record<string, JSX.Element> = {
  payment_created: <Clock className="h-4 w-4" />,
  payment_succeeded: <CheckCircle className="h-4 w-4" />,
  payment_failed: <XCircle className="h-4 w-4" />,
  payment_refunded: <RefreshCw className="h-4 w-4" />,
  status_changed: <RefreshCw className="h-4 w-4" />,
  default: <Clock className="h-4 w-4" />,
};

function getEventIcon(eventType: string): JSX.Element {
  return EVENT_ICONS[eventType] || EVENT_ICONS.default;
}

function eventStatusColor(status: string): string {
  switch (status) {
    case "succeeded":
      return "status-success-bg status-success-text";
    case "failed":
      return "status-error-bg status-error-text";
    case "refunded":
    case "partially_refunded":
      return "status-tertiary-bg status-tertiary-text";
    default:
      return "status-info-bg status-info-text";
  }
}

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [payment, setPayment] = useState<ApiPaymentDetail | null>(null);
  const [events, setEvents] = useState<ApiPaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const canRefund = payment && payment.status === "succeeded";

  useEffect(() => {
    if (id) loadPayment();
  }, [id]);

  async function loadPayment() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { payment: payRes, events: evtRes } = await getPayment(id);
      setPayment(payRes);
      setEvents(evtRes ?? []);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string } } };
      if (e?.response?.status === 404) {
        navigate("/app/payments");
      } else {
        setError(e?.response?.data?.error || "Failed to load payment");
      }
    } finally {
      setLoading(false);
    }
  }

  const handleRefund = useCallback(async (amount: number, reason: string) => {
    if (!payment) return;
    setActionLoading(true);
    try {
      await refundPayment(payment.id, { amount, reason: reason || undefined });
      toast("Refund issued successfully", { type: "success" });
      setShowRefundModal(false);
      loadPayment();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast(e?.response?.data?.error || "Failed to issue refund", { type: "error" });
    } finally {
      setActionLoading(false);
    }
  }, [payment, toast]);

  const handleRecordPayment = useCallback(async (data: { amount: number; provider: string; providerPaymentId?: string }) => {
    if (!payment) return;
    setActionLoading(true);
    try {
      await recordPaymentManually({
        invoiceId: payment.invoice_id,
        amount: data.amount,
        provider: data.provider,
        providerPaymentId: data.providerPaymentId,
        idempotencyKey: `manual:${payment.id}:${crypto.randomUUID().slice(0, 8)}`,
      });
      toast("Payment recorded successfully", { type: "success" });
      setShowRecordModal(false);
      loadPayment();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast(e?.response?.data?.error || "Failed to record payment", { type: "error" });
    } finally {
      setActionLoading(false);
    }
  }, [payment, toast]);

  const handleViewInvoice = useCallback(() => {
    if (!payment) return;
    navigate(`/app/invoices/${payment.invoice_id}`);
  }, [payment, navigate]);

  const handleDownloadReceipt = useCallback(() => {
    if (!payment) return;
    window.open(`/api/invoices/${payment.invoice_id}/pdf`, "_blank");
  }, [payment]);

  const handleCopyPaymentId = useCallback(async () => {
    if (!payment) return;
    try {
      await navigator.clipboard.writeText(payment.id);
      toast("Payment ID copied to clipboard", { type: "success" });
    } catch {
      toast("Failed to copy payment ID", { type: "error" });
    }
  }, [payment, toast]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-surface-alt rounded w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-xl border border-color h-64" />
            ))}
          </div>
          <div className="space-y-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-xl border border-color h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="p-6 text-center text-secondary">
        {error && <p className="text-sm status-error-text">{error}</p>}
        {!error && <p>Payment not found.</p>}
      </div>
    );
  }

  const currency = payment.currency || "USD";
  const paymentAmount = new Decimal(payment.amount || 0);
  const processingFee = payment.metadata?.processing_fee
    ? new Decimal(String(payment.metadata.processing_fee))
    : new Decimal(0);
  const netAmount = paymentAmount.minus(processingFee);
  const feeDetails = payment.metadata?.fee_details
    ? String(payment.metadata.fee_details)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/payments" className="text-secondary hover:text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-primary">
            Payment {payment.id.slice(0, 8)}
          </h1>
          <PaymentStatus status={payment.status} showIcon showLabel size="sm" />
        </div>

        <div className="flex items-center gap-2">
          {canRefund && (
            <>
              <Button
                variant="danger"
                size="sm"
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={() => setShowRefundModal(true)}
              >
                Issue Refund
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={() => setShowRecordModal(true)}
              >
                Record Manually
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            onClick={handleDownloadReceipt}
          >
            Download Receipt
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileText className="h-4 w-4" />}
            onClick={handleViewInvoice}
          >
            View Invoice
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 status-error-bg border status-error-border rounded-lg">
          <p className="text-sm status-error-text">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Information */}
          <div className="bg-surface rounded-xl border border-color-subtle p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">Transaction Information</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-tertiary">Payment ID</dt>
                <dd className="text-primary mt-0.5 font-mono text-xs flex items-center gap-2">
                  {payment.id}
                  <button
                    onClick={handleCopyPaymentId}
                    className="text-xs text-tertiary hover:text-primary"
                    title="Copy payment ID"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </dd>
              </div>
              <div>
                <dt className="text-tertiary">Status</dt>
                <dd className="mt-0.5">
                  <PaymentStatus status={payment.status} showIcon showLabel size="sm" />
                </dd>
              </div>
              <div>
                <dt className="text-tertiary">Payment Method</dt>
                <dd className="text-primary mt-0.5 capitalize">
                  {payment.method || payment.provider || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-tertiary">Provider</dt>
                <dd className="text-primary mt-0.5 capitalize">{payment.provider}</dd>
              </div>
              {payment.provider_payment_id && (
                <div>
                  <dt className="text-tertiary">Transaction Reference</dt>
                  <dd className="text-primary mt-0.5 font-mono text-xs">
                    {payment.provider_payment_id}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-tertiary">Paid On</dt>
                <dd className="text-primary mt-0.5">
                  {payment.paid_at ? formatDate(payment.paid_at) : "—"}
                </dd>
              </div>
              {payment.idempotency_key && (
                <div>
                  <dt className="text-tertiary">Idempotency Key</dt>
                  <dd className="text-primary mt-0.5 font-mono text-xs">
                    {payment.idempotency_key}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-tertiary">Created At</dt>
                <dd className="text-primary mt-0.5">
                  {payment.created_at ? formatDate(payment.created_at) : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Amount Breakdown */}
          <div className="bg-surface rounded-xl border border-color-subtle p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">Amount Breakdown</h2>
            <table className="w-64 border-collapse text-sm">
              <tbody>
                <tr>
                  <td className="py-2 text-tertiary">Payment Amount</td>
                  <td className="py-2 text-right text-primary">
                    {formatCurrency(paymentAmount.toFixed(2), currency)}
                  </td>
                </tr>
                {processingFee.gt(0) && (
                  <tr>
                    <td className="py-2 text-tertiary">Processing Fees</td>
                    <td className="py-2 text-right status-error-text">
                      -{formatCurrency(processingFee.toFixed(2), currency)}
                    </td>
                  </tr>
                )}
                <tr className="border-t border-color-subtle">
                  <td className="py-3 text-lg font-semibold text-primary">Net Amount Received</td>
                  <td className="py-3 text-right text-lg font-bold text-primary">
                    {formatCurrency(netAmount.toFixed(2), currency)}
                  </td>
                </tr>
              </tbody>
            </table>
            {feeDetails && (
              <div className="mt-4 p-3 bg-surface-alt rounded-lg">
                <p className="text-xs text-tertiary whitespace-pre-line">
                  {feeDetails}
                </p>
              </div>
            )}
          </div>

          {/* Payment Timeline */}
          <div className="bg-surface rounded-xl border border-color-subtle p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">Payment Timeline</h2>
            {events.length === 0 ? (
              <p className="text-sm text-tertiary">No events recorded for this payment.</p>
            ) : (
              <div className="space-y-4">
                {events.map((event, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-secondary">
                      {getEventIcon(event.event_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-primary">
                          {event.event_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${eventStatusColor(event.status || payment.status)}`}>
                          {event.status || payment.status}
                        </span>
                      </div>
                      {event.amount && new Decimal(event.amount).gt(0) && (
                        <p className="text-xs text-secondary mt-0.5">
                          Amount: {formatCurrency(event.amount, currency)}
                        </p>
                      )}
                      <p className="text-xs text-tertiary mt-0.5">
                        {event.created_at ? formatDate(event.created_at) : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Invoice Applied To */}
          <div className="bg-surface rounded-xl border border-color-subtle p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">Invoice Applied To</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-tertiary">Invoice Number</dt>
                <dd className="text-primary mt-0.5">
                  {payment.invoice_id ? (
                    <Link
                      to={`/app/invoices/${payment.invoice_id}`}
                      className="text-primary-brand hover:underline"
                    >
                      {payment.invoice_number || `#${payment.invoice_id.slice(0, 8)}`}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-tertiary">Invoice Status</dt>
                <dd className="text-primary mt-0.5 capitalize">
                  {payment.invoice_status || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-tertiary">Invoice Total</dt>
                <dd className="text-primary mt-0.5">
                  {payment.invoice_total ? formatCurrency(payment.invoice_total, currency) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-tertiary">Invoice Balance Due</dt>
                <dd className="text-primary mt-0.5">
                  {payment.invoice_amount_due ? formatCurrency(payment.invoice_amount_due, currency) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-tertiary">Invoice Paid</dt>
                <dd className="text-primary mt-0.5">
                  {payment.invoice_amount_paid ? formatCurrency(payment.invoice_amount_paid, currency) : "—"}
                </dd>
              </div>
              {payment.invoice_due_date && (
                <div>
                  <dt className="text-tertiary">Due Date</dt>
                  <dd className="text-primary mt-0.5">
                    {formatDate(payment.invoice_due_date)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Client Details */}
          <div className="bg-surface rounded-xl border border-color-subtle p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">Client</h2>
            {payment.customer_name || payment.customer_email ? (
              <dl className="space-y-3 text-sm">
                {payment.customer_name && (
                  <div>
                    <dt className="text-tertiary">Name</dt>
                    <dd className="text-primary mt-0.5">{payment.customer_name}</dd>
                  </div>
                )}
                {payment.customer_email && (
                  <div>
                    <dt className="text-tertiary">Email</dt>
                    <dd className="text-primary mt-0.5">{payment.customer_email}</dd>
                  </div>
                )}
                {(payment.customer_address_line_1 || payment.customer_address_line_2) && (
                  <div>
                    <dt className="text-tertiary">Address</dt>
                    <dd className="text-primary mt-0.5">
                      {payment.customer_address_line_1 && <span>{payment.customer_address_line_1}<br /></span>}
                      {payment.customer_address_line_2 && <span>{payment.customer_address_line_2}<br /></span>}
                      {payment.customer_city && <span>{payment.customer_city}, </span>}
                      {payment.customer_state && <span>{payment.customer_state} </span>}
                      {payment.customer_postal_code && <span>{payment.customer_postal_code}<br /></span>}
                      {payment.customer_country_code && <span>{payment.customer_country_code}</span>}
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-tertiary">No client information available.</p>
            )}
          </div>

          {/* Business Info */}
          <div className="bg-surface rounded-xl border border-color-subtle p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">Business</h2>
            <dl className="space-y-3 text-sm">
              {payment.business_name && (
                <div>
                  <dt className="text-tertiary">Name</dt>
                  <dd className="text-primary mt-0.5">{payment.business_name}</dd>
                </div>
              )}
              {payment.business_email && (
                <div>
                  <dt className="text-tertiary">Email</dt>
                  <dd className="text-primary mt-0.5">{payment.business_email}</dd>
                </div>
              )}
              {payment.business_phone && (
                <div>
                  <dt className="text-tertiary">Phone</dt>
                  <dd className="text-primary mt-0.5">{payment.business_phone}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* Modals */}
      <RefundModal
        open={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        onConfirm={handleRefund}
        payment={payment}
        processing={actionLoading}
      />

      <RecordPaymentModal
        open={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        onConfirm={handleRecordPayment}
        payment={payment}
        processing={actionLoading}
      />
    </div>
  );
}
