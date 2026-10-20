import { useState } from "react";
import { X, Send, Mail, MessageSquare, Copy } from "lucide-react";
import { Button, FormField } from "@/components/ui";

export interface RecipientOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface SendData {
  to: string;
  subject: string;
  body: string;
  attachPdf: boolean;
  emailCc?: string;
}

interface SendPanelProps {
  open: boolean;
  onClose: () => void;
  recipients: RecipientOption[];
  defaultSubject: string;
  defaultBody: string;
  isSending: boolean;
  onSend: (data: SendData) => void;
}

export function SendPanel({
  open,
  onClose,
  recipients,
  defaultSubject,
  defaultBody,
  isSending,
  onSend,
}: SendPanelProps) {
  const [to, setTo] = useState(recipients[0]?.email ?? "");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [attachPdf, setAttachPdf] = useState(true);
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);

  const handleSend = () => {
    onSend({ to, subject, body, attachPdf, emailCc: cc });
  };

  if (!open) return null;

  const selectedRecipient = recipients.find((r) => r.email === to);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center min-h-screen p-4">
        <div className="bg-surface border border-color rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-color">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-primary">Send Document</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-tertiary hover:text-primary rounded hover:bg-surface-alt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            <FormField label="To" helperText="Recipient email">
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-2 border border-color rounded bg-tertiary text-primary text-sm"
              >
                {recipients.map((r) => (
                  <option key={r.id} value={r.email}>
                    {r.name} ({r.email})
                  </option>
                ))}
              </select>
            </FormField>

            {selectedRecipient && (
              <div className="text-xs text-tertiary flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {selectedRecipient.role} contact
              </div>
            )}

            {!showCc ? (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Copy className="h-3 w-3" />
                Add CC
              </button>
            ) : (
              <FormField
                label="CC"
                helperText="Additional recipients"
              >
                <input
                  type="email"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  className="w-full px-3 py-2 border border-color rounded bg-tertiary text-primary text-sm"
                  placeholder="email@example.com"
                />
              </FormField>
            )}

            <FormField
              label="Subject"
              helperText="Email subject line"
            >
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-color rounded bg-tertiary text-primary text-sm"
                placeholder="Subject"
              />
            </FormField>

            <FormField
              label="Message"
              helperText="Email body"
            >
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2 border border-color rounded bg-tertiary text-primary text-sm resize-y min-h-[120px]"
                placeholder="Write your message..."
              />
            </FormField>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={attachPdf}
                onChange={(e) => setAttachPdf(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span className="text-tertiary">Attach PDF of this document</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-color bg-surface-alt">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={isSending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Send className="h-4 w-4" />}
              onClick={handleSend}
              loading={isSending}
              disabled={!to || !subject}
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
