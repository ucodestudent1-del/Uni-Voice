import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";
import type { ApiReceiptDetail } from "@/api/client";
import { useToast } from "@/components/ui/ToastProvider";

interface EmailReceiptModalProps {
  open: boolean;
  onClose: () => void;
  onEmailSent: () => void;
  receipt: ApiReceiptDetail;
}

export default function EmailReceiptModal({ open, onClose, onEmailSent, receipt }: EmailReceiptModalProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState(receipt.customer_email ?? "");
  const [name, setName] = useState(receipt.customer_name ?? "");
  const [subject, setSubject] = useState(
    `Receipt ${receipt.receipt_number} from ${receipt.business_name ?? "Your Business"}`
  );
  const [message, setMessage] = useState(
    `Dear ${receipt.customer_name ?? "Customer"},\n\nPlease find your receipt for payment of ${receipt.amount} ${receipt.currency} attached.\n\nThank you for your business.\n\nBest regards,\n${receipt.business_name ?? "Your Business"}`
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSend = async () => {
    if (!email) {
      setError("Email address is required");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const { emailReceipt } = await import("@/api/client");
      await emailReceipt(receipt.id, { email, name: name || undefined, subject, message });
      toast("Receipt emailed successfully", { type: "success" });
      onEmailSent();
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || "Failed to send email");
    } finally {
      setSending(false);
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
          <h2 className="text-lg font-semibold text-primary">Email Receipt</h2>
          <p className="mt-1 text-sm text-secondary">
            Receipt #{receipt.receipt_number} — {receipt.amount} {receipt.currency}
          </p>
        </div>

        <div className="px-6 pb-4 space-y-4">
          {error && (
            <div className="p-3 status-error-bg border status-error-border rounded-lg">
              <p className="text-sm status-error-text">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">To</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="customer@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Customer name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              rows={6}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-color-subtle p-6 pt-4">
          <Button variant="secondary" size="md" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSend}
            disabled={!email || sending}
          >
            {sending ? "Sending…" : "Send Email"}
          </Button>
        </div>
      </div>
    </div>
  );
}
