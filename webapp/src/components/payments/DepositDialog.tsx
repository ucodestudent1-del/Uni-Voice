import { Decimal } from "decimal.js";
import { Button } from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import type { ApiInvoice } from "@/types/api";
import { formatCurrency } from "@/utils/format";

export interface DepositDialogProps {
  open: boolean;
  invoice: ApiInvoice;
  depositDue: Decimal;
  depositAmount: string;
  onAmountChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DepositDialog({
  open,
  invoice,
  depositDue,
  depositAmount,
  onAmountChange,
  onConfirm,
  onCancel,
}: DepositDialogProps) {
  const isFull = new Decimal(depositAmount || 0).eq(depositDue);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Record Deposit Payment"
      description={`Deposit due: ${formatCurrency(depositDue, invoice.currency)}`}
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className="form-label" htmlFor="deposit-amount-input">
            Amount
          </label>
          <input
            id="deposit-amount-input"
            type="number"
            step="0.01"
            value={depositAmount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="form-control w-full"
            placeholder={depositDue.toFixed(2)}
          />
        </div>
        <button
          type="button"
          onClick={() => onAmountChange(depositDue.toFixed(2))}
          className="text-sm text-primary-brand hover:text-primary-hover font-medium"
        >
          Pay full deposit ({formatCurrency(depositDue, invoice.currency)})
        </button>
        {isFull && (
          <p className="text-xs status-success-text">
            This will fully pay the deposit.
          </p>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-color-subtle pt-4">
        <Button variant="secondary" size="md" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="warning"
          size="md"
          onClick={onConfirm}
          disabled={!depositAmount || Number(depositAmount) <= 0}
        >
          Record Deposit
        </Button>
      </div>
    </Dialog>
  );
}
