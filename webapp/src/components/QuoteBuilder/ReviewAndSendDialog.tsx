import { useState } from "react";
import { Decimal } from "decimal.js";
import { Send, X, Download } from "lucide-react";
import type { QuoteBuilderData } from "./types";
import type { CalculationResult } from "../../utils/calculation";
import { formatCurrency } from "../../utils/format";

interface ReviewAndSendDialogProps {
  open: boolean;
  data: QuoteBuilderData;
  calcResult: CalculationResult | null;
  onClose: () => void;
  onSend: () => Promise<void>;
  onDownloadPdf: () => Promise<void>;
}

export function ReviewAndSendDialog({
  open,
  data,
  calcResult,
  onClose,
  onSend,
  onDownloadPdf,
}: ReviewAndSendDialogProps) {
  const [sending, setSending] = useState(false);
  const [emailSubject, setEmailSubject] = useState(`Quote from ${data.customer?.name || "your business"}`);
  const [emailMessage, setEmailMessage] = useState(
    `Hi${data.customer?.name ? ` ${data.customer.name}` : ""},

Please find attached your quote. You can accept it online or reply with any questions.

Best regards`
  );

  if (!open) return null;

  const customerName = data.customer?.name || data.customer?.companyName || "—";
  const customerEmail = data.customer?.email || "—";

  async function handleSend() {
    setSending(true);
    try {
      await onSend();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-xl bg-surface shadow-xl">
        <div className="border-b border-color-subtle p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary">Review &amp; Send Quote</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-tertiary hover:text-primary"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 text-sm text-secondary">
            Review the quote details and send it to your customer.
          </p>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Customer info */}
          <div className="bg-surface-alt rounded-lg border border-color-subtle p-4">
            <h3 className="text-xs font-medium text-secondary uppercase mb-2">Customer</h3>
            <div className="text-sm">
              <div className="font-medium text-primary">{customerName}</div>
              <div className="text-tertiary">{customerEmail}</div>
            </div>
          </div>

          {/* Line items */}
          <div>
            <h3 className="text-xs font-medium text-secondary uppercase mb-2">Line Items</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-color-subtle text-left">
                  <th className="pb-1 text-secondary">Description</th>
                  <th className="pb-1 text-right text-secondary">Qty</th>
                  <th className="pb-1 text-right text-secondary">Rate</th>
                  <th className="pb-1 text-right text-secondary">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(item => (
                  <tr key={item.id} className="border-b border-color-subtle/50">
                    <td className="py-1 text-secondary">{item.description || "(no description)"}</td>
                    <td className="py-1 text-right">{item.quantity}</td>
                    <td className="py-1 text-right">{formatCurrency(item.unitPrice, data.currency)}</td>
                    <td className="py-1 text-right font-medium">{formatCurrency(
                      new Decimal(item.quantity).mul(item.unitPrice).minus(
                        item.discount && Number(item.discount) > 0
                          ? item.discountType === "percentage"
                            ? new Decimal(item.quantity).mul(item.unitPrice).mul(item.discount).div(100)
                            : new Decimal(item.discount)
                          : 0
                      ),
                      data.currency
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          {calcResult && (
            <div className="bg-surface-alt rounded-lg border border-color-subtle p-4">
              <h3 className="text-xs font-medium text-secondary uppercase mb-2">Totals</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-tertiary">Subtotal</span>
                  <span className="text-primary">{formatCurrency(calcResult.subtotal, data.currency)}</span>
                </div>
                {!calcResult.discountTotal.isZero() && (
                  <div className="flex justify-between">
                    <span className="text-tertiary">Discount</span>
                    <span className="text-error-text">-{formatCurrency(calcResult.discountTotal, data.currency)}</span>
                  </div>
                )}
                {!calcResult.taxTotal.isZero() && (
                  <div className="flex justify-between">
                    <span className="text-tertiary">Tax</span>
                    <span className="text-primary">{formatCurrency(calcResult.taxTotal, data.currency)}</span>
                  </div>
                )}
                {!calcResult.feeTotal.isZero() && (
                  <div className="flex justify-between">
                    <span className="text-tertiary">Fees</span>
                    <span className="text-primary">{formatCurrency(calcResult.feeTotal, data.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-color-subtle">
                  <span className="text-primary">Total</span>
                  <span className="text-primary">{formatCurrency(calcResult.total, data.currency)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Email composition */}
          <div>
            <h3 className="text-xs font-medium text-secondary uppercase mb-2">Email to customer</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-tertiary mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-tertiary mb-1">Message</label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-color-subtle p-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-input-border px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            className="inline-flex items-center gap-2 rounded-lg border border-input-border px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-5 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-60"
          >
            {sending ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-on-primary border-t-transparent rounded-full" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Finalize &amp; Send
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
