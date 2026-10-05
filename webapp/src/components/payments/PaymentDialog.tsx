import { type ChangeEvent } from "react";
import { Decimal } from "decimal.js";
import { Button } from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { FormField } from "@/components/ui/FormField";
import StripePaymentElement from "@/components/StripePaymentElement";
import type { ApiInvoice, ApiPaymentIntent } from "@/types/api";
import { formatCurrency } from "@/utils/format";

export interface PaymentDialogProps {
  open: boolean;
  invoice: ApiInvoice;
  amountDue: Decimal;
  payAmount: string;
  onAmountChange: (value: string) => void;
  paymentIntent: ApiPaymentIntent | null;
  onCreatePaymentIntent: () => void;
  onPaymentSuccess: () => void;
  onPaymentError: (error: string) => void;
  onCancel: () => void;
}

export default function PaymentDialog({
  open,
  invoice,
  amountDue,
  payAmount,
  onAmountChange,
  paymentIntent,
  onCreatePaymentIntent,
  onPaymentSuccess,
  onPaymentError,
  onCancel,
}: PaymentDialogProps) {
  const isFull = new Decimal(payAmount || 0).eq(amountDue);
  const isStripeAvailable =
    paymentIntent?.provider === "stripe" && !!paymentIntent?.clientSecret;

  if (!open) return null;

  if (paymentIntent && isStripeAvailable) {
    return (
      <Dialog
        open={open}
        onClose={onCancel}
        title={`Pay Invoice #${invoice.invoice_number || invoice.id.slice(0, 8)}`}
        size="lg"
      >
        <div className="space-y-3">
          <p className="text-sm text-secondary">
            Amount:{" "}
            <span className="font-medium text-primary">
              {formatCurrency(payAmount || amountDue, invoice.currency)}
            </span>
          </p>
          <div className="space-y-3">
            <StripePaymentElement
              clientSecret={paymentIntent.clientSecret!}
              onPaymentSuccess={onPaymentSuccess}
              onPaymentError={onPaymentError}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="secondary" size="md" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Dialog>
    );
  }

  const isCreatingIntent = paymentIntent && !isStripeAvailable;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Record Payment"
      description={`Amount due: ${formatCurrency(amountDue, invoice.currency)}`}
      size="md"
    >
      <div className="space-y-4">
        <FormField
          id="pay-amount-input"
          label="Amount"
          type="number"
          step="0.01"
          value={payAmount}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onAmountChange(e.target.value)}
          placeholder={amountDue.toFixed(2)}
        />
        <button
          type="button"
          onClick={() => onAmountChange(amountDue.toFixed(2))}
          className="text-sm text-primary-brand hover:text-primary-hover font-medium"
        >
          Pay full amount ({formatCurrency(amountDue, invoice.currency)})
        </button>
        {isFull && (
          <p className="text-xs status-success-text">
            This will fully pay the invoice.
          </p>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-color-subtle pt-4">
        <Button variant="secondary" size="md" onClick={onCancel}>
          Cancel
        </Button>
        {!paymentIntent ? (
          <Button
            variant="primary"
            size="md"
            onClick={onCreatePaymentIntent}
            disabled={!payAmount || Number(payAmount) <= 0}
          >
            {isCreatingIntent ? "Processing…" : "Pay with Card"}
          </Button>
        ) : (
          <Button variant="primary" size="md" onClick={onPaymentSuccess}>
            Complete Stub Payment
          </Button>
        )}
      </div>
    </Dialog>
  );
}
