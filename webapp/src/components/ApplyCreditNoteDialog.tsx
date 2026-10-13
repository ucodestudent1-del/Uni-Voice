import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Money, Button, Dialog } from "@/components/ui";
import { CheckCircle, FileText, Wallet, Banknote } from "lucide-react";
import { Decimal } from "decimal.js";
import { formatCurrencyValue } from "@/lib/utils";
import type { ApiInvoiceListItem, ApiCreditNote, ApiCreditNoteApplyInput } from "@/types/api";

interface ApplyCreditNoteDialogProps {
  open: boolean;
  onClose: () => void;
  creditNote: ApiCreditNote;
  onSuccess: (result: { ok: boolean; remaining: string; status: string }) => void;
  availableInvoices: ApiInvoiceListItem[];
}

const APPLICATION_METHODS = [
  {
    value: "invoice_offset",
    label: "Apply to an existing invoice",
    description: "Reduce the outstanding balance of a specific invoice.",
    icon: FileText,
  },
  {
    value: "balance_credit",
    label: "Credit to customer's balance",
    description: "Hold the credit on the customer's account for future invoices.",
    icon: Wallet,
  },
  {
    value: "refund",
    label: "Issue a refund",
    description: "Return the money to the customer's original payment method.",
    icon: Banknote,
  },
];

export default function ApplyCreditNoteDialog({
  open,
  onClose,
  creditNote,
  onSuccess,
  availableInvoices,
}: ApplyCreditNoteDialogProps) {
  const [method, setMethod] = useState<Exclude<ApiCreditNoteApplyInput["applicationMethod"], undefined>>("invoice_offset");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [applyAmount, setApplyAmount] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const currency = creditNote.currency ?? "USD";
  const total = new Decimal(creditNote.total ?? 0);
  const applied = new Decimal(creditNote.applied_total ?? 0);
  const remaining = total.minus(applied);

  useEffect(() => {
    if (!applyAmount) {
      if (selectedInvoiceId) {
        const inv = availableInvoices.find((i) => i.id === selectedInvoiceId);
        const invDue = new Decimal(inv?.amount_due ?? 0);
        const maxApply = Decimal.min(remaining, invDue);
        setApplyAmount(maxApply.toFixed(2));
      } else if (method === "invoice_offset") {
        setApplyAmount(remaining.toFixed(2));
      }
    }
  }, [selectedInvoiceId, method, remaining, availableInvoices, applyAmount]);

  const selectedInvoice = selectedInvoiceId
    ? availableInvoices.find((i) => i.id === selectedInvoiceId)
    : null;

  const handleApply = async () => {
    if (!remaining.gt(0) || new Decimal(applyAmount).lte(0)) return;
    if (method === "invoice_offset" && !selectedInvoiceId) return;

    setIsApplying(true);
    try {
      const res = await import("@/api/client").then((m) =>
        m.applyCreditNote(creditNote.id, {
          invoiceId: selectedInvoiceId,
          amount: applyAmount,
          applicationMethod: method,
        }),
      );
      onSuccess(res);
      onClose();
    } catch (err: unknown) {
      console.error("Apply failed:", err);
    } finally {
      setIsApplying(false);
    }
  };

  const canApply =
    method !== "invoice_offset" || (selectedInvoiceId && selectedInvoiceId !== "");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Apply Credit Note"
      description="Choose how to consume this credit."
      size="lg"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-xs text-tertiary uppercase">Total Credit</p>
            <p className="text-lg font-bold text-error-text">
              −{formatCurrencyValue(total.toFixed(), currency)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-tertiary uppercase">Applied</p>
            <p className="text-lg font-bold text-success-text">
              −{formatCurrencyValue(applied.toFixed(), currency)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-tertiary uppercase">Remaining</p>
            <p className="text-lg font-bold text-warning-text">
              −{formatCurrencyValue(remaining.toFixed(), currency)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-secondary uppercase">
            Application Method
          </p>
          {APPLICATION_METHODS.map((opt) => {
            const Icon = opt.icon;
            const disabled =
              opt.value === "refund" ||
              (opt.value === "invoice_offset" &&
                availableInvoices.length === 0);
            return (
              <label
                key={opt.value}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                  method === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-color hover:bg-surface-alt",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
              >
                <input
                  type="radio"
                  name="method"
                  value={opt.value}
                  checked={method === opt.value}
                  onChange={() => {
                    if (!disabled) setMethod(opt.value as Exclude<ApiCreditNoteApplyInput["applicationMethod"], undefined>);
                  }}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <Icon className="h-5 w-5 text-tertiary shrink-0" aria-hidden="true" />
                <div className="flex-1">
                  <p className="font-medium text-primary">{opt.label}</p>
                  <p className="text-xs text-secondary mt-0.5">
                    {opt.description}
                  </p>
                  {opt.value === "invoice_offset" && selectedInvoice && (
                    <p className="text-xs text-info-text mt-1">
                      Balance due on {selectedInvoice.invoice_number ?? "—"}:{" "}
                      <Money
                        amount={selectedInvoice.amount_due ?? 0}
                        currency={selectedInvoice.currency}
                      />
                    </p>
                  )}
                </div>
                {method === opt.value && (
                  <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                )}
              </label>
            );
          })}
        </div>

        {method === "invoice_offset" && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-secondary">
              Target Invoice
            </label>
            <select
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
            >
              <option value="">Select an invoice</option>
              {availableInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number ?? inv.id} —{" "}
                  {new Decimal(inv.amount_due ?? 0).toFixed(2)} due
                </option>
              ))}
            </select>

            {selectedInvoiceId && (
              <>
                <label className="block text-xs font-medium text-secondary">
                  Amount to Apply
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary">
                    −{currency}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={remaining.toFixed(2)}
                    className="w-full rounded-lg border border-input-border bg-input pl-16 pr-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary placeholder-target font-tabular-nums"
                    placeholder={remaining.toFixed(2)}
                    value={applyAmount}
                    onChange={(e) => setApplyAmount(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-color pt-4">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={isApplying}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleApply}
          disabled={
            isApplying || !canApply || !applyAmount || remaining.lte(0)
          }
          loading={isApplying}
        >
          {isApplying ? "Applying…" : "Apply Credit"}
        </Button>
      </div>
    </Dialog>
  );
}
