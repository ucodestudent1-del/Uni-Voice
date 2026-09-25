import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { formatCurrencyValue } from "@/lib/utils";

interface RefundReceiptModalProps {
  open: boolean;
  onClose: () => void;
  onRefundProcessed: () => void;
  receipt: {
    id: string;
    receipt_number: string | null;
    amount: string;
    currency: string;
  };
  payment: {
    id: string;
    amount: string;
    currency: string;
    status: string;
    provider: string;
  } | null;
}

export default function RefundReceiptModal({
  open,
  onClose,
  onRefundProcessed,
  receipt,
  payment,
}: RefundReceiptModalProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [fullRefund, setFullRefund] = useState(true);
  const [partialAmount, setPartialAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const paymentAmount = Number(payment?.amount ?? receipt.amount ?? 0);
  const refundAmount = fullRefund ? paymentAmount : Number(partialAmount || 0);

  const canRefund = payment && payment.status === "succeeded" && payment.provider === "stripe";

  if (!canRefund) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
        <div className="relative mx-4 w-full max-w-md rounded-xl bg-surface shadow-xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-tertiary hover:text-primary hover:bg-surface-alt"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="p-6 pb-4">
            <h2 className="text-lg font-semibold text-primary">Refund Not Available</h2>
            <p className="mt-2 text-sm text-secondary">
              Refunds are only available for payments processed through Stripe that have a status of "paid".
            </p>
          </div>
          <div className="flex justify-end border-t border-color-subtle p-6 pt-4">
            <Button variant="secondary" size="md" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleRefund = async () => {
    if (refundAmount <= 0) {
      setError("Refund amount must be greater than 0");
      return;
    }
    if (refundAmount > paymentAmount) {
      setError(`Refund amount cannot exceed the original payment of ${formatCurrencyValue(paymentAmount, receipt.currency)}`);
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const { refundReceipt } = await import("@/api/client");
      await refundReceipt(receipt.id, {
        amount: refundAmount.toString(),
        reason: reason || undefined,
      });
      toast(`Refund of ${formatCurrencyValue(refundAmount, receipt.currency)} processed`, { type: "success" });
      onRefundProcessed();
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || "Failed to process refund");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
      <div className="relative mx-4 w-full max-w-lg rounded-xl bg-surface shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-tertiary hover:text-primary hover:bg-surface-alt"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 pb-4">
          <h2 className="text-lg font-semibold text-primary">Request Refund</h2>
          <p className="mt-1 text-sm text-secondary">
            Receipt #{receipt.receipt_number} — Original amount: {formatCurrencyValue(paymentAmount, receipt.currency)}
          </p>
        </div>

        <div className="px-6 pb-4 space-y-4">
          {error && (
            <div className="p-3 status-error-bg border status-error-border rounded-lg">
              <p className="text-sm status-error-text">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="refund-type"
                checked={fullRefund}
                onChange={() => setFullRefund(true)}
                className="text-primary-action focus:ring-primary-action"
              />
              <span className="text-primary">Full refund ({formatCurrencyValue(paymentAmount, receipt.currency)})</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="refund-type"
                checked={!fullRefund}
                onChange={() => setFullRefund(false)}
                className="text-primary-action focus:ring-primary-action"
              />
              <span className="text-primary">Partial refund</span>
            </label>
          </div>

          {!fullRefund && (
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Refund Amount ({receipt.currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={paymentAmount}
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={paymentAmount.toFixed(2)}
              />
              <p className="mt-1 text-xs text-tertiary">
                Maximum: {formatCurrencyValue(paymentAmount, receipt.currency)}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="e.g. Customer requested, service not provided..."
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
            onClick={handleRefund}
            disabled={processing}
          >
            {processing ? "Processing…" : "Process Refund"}
          </Button>
        </div>
      </div>
    </div>
  );
}
