import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  getCreditNote,
  getCreditNotePdf,
  getCreditNoteEvents,
  finalizeCreditNote,
  cancelCreditNote,
  sendCreditNote,
} from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import type { ApiCreditNote, ApiCreditNoteItem, ApiCreditNoteFee } from "../types/api";
import { CreditNoteLifecycle } from "@/components/ui";
import { ConfirmationDialog } from "../components/ui/ConfirmationDialog";
import { Download, Send } from "lucide-react";

export interface ApiCreditNoteEvent {
  id?: string;
  credit_note_id?: string;
  event_type: string;
  actor_type?: string | null;
  actor_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export default function CreditNoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [creditNote, setCreditNote] = useState<ApiCreditNote | null>(null);
  const [events, setEvents] = useState<ApiCreditNoteEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);

  useEffect(() => {
    if (id) loadCreditNote();
  }, [id]);

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  async function loadCreditNote() {
    if (!id) return;
    setLoading(true);
    try {
      const [cnRes, evRes] = await Promise.allSettled([
        getCreditNote(id),
        getCreditNoteEvents(id),
      ]);
      if (cnRes.status === "fulfilled") setCreditNote(cnRes.value.creditNote);
      if (evRes.status === "fulfilled") setEvents(evRes.value.events ?? []);
    } catch (err: any) {
      if (err.response?.status === 404) {
        navigate("/app/credit-notes");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalize() {
    if (!id) return;
    setFinalizeLoading(true);
    try {
      const res = await finalizeCreditNote(id);
      setCreditNote((prev) =>
        prev
          ? {
              ...prev,
              is_finalized: true,
              status: "finalized",
              credit_note_number: res.creditNoteNumber ?? prev.credit_note_number ?? null,
            }
          : prev
      );
      setActionMessage("Credit note finalized!");
      loadCreditNote();
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || "Failed to finalize credit note");
    } finally {
      setFinalizeLoading(false);
    }
  }

  async function handleCancel(reason: string) {
    if (!id) return;
    try {
      await cancelCreditNote(id, { reason });
      setCreditNote((prev) =>
        prev ? { ...prev, status: "cancelled" } : prev
      );
      setShowCancelDialog(false);
      setActionMessage("Credit note cancelled.");
      loadCreditNote();
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || "Failed to cancel credit note");
    }
  }

  async function handleSend() {
    if (!id) return;
    setSendLoading(true);
    try {
      const res = await sendCreditNote(id);
      setCreditNote((prev) =>
        prev ? { ...prev, status: res.status ?? "sent" } : prev
      );
      setActionMessage("Credit note sent successfully!");
      loadCreditNote();
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || "Failed to send credit note");
    } finally {
      setSendLoading(false);
    }
  }

  async function handleDownloadPdf() {
    if (!id) return;
    try {
      const blob = await getCreditNotePdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `credit-note-${creditNote?.credit_note_number ?? id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || "Failed to download PDF");
    }
  }

  const canEdit = creditNote && !creditNote.is_finalized;
  const canFinalize = creditNote && !creditNote.is_finalized;
  const canCancel = creditNote && ["finalized", "applied"].includes(creditNote.status);
  const isCancelled = creditNote && creditNote.status === "cancelled";
  const isVoid = creditNote && creditNote.status === "void";
  const canSend = creditNote && creditNote.is_finalized && !isCancelled && !isVoid && creditNote.status !== "sent";

  if (loading) return <div className="text-center py-20 text-secondary">Loading credit note…</div>;
  if (!creditNote) return <div className="text-center py-20 text-secondary">Credit note not found</div>;


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/app/credit-notes" className="text-tertiary hover:text-primary flex-shrink-0">
            &larr; Credit Notes
          </Link>
          <h1 className="text-2xl font-bold text-primary truncate">
            {creditNote.credit_note_number || `Draft #${creditNote.id.slice(0, 8)}`}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Link
              to={`/app/credit-notes/${creditNote.id}/edit`}
              className="rounded-lg border border-input-border px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
            >
              Edit
            </Link>
          )}
          <button
            onClick={handleDownloadPdf}
            className="rounded-lg border border-input-border px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
          >
            <Download className="h-4 w-4 inline mr-1" />
            Download PDF
          </button>
          {canSend && (
            <button
              onClick={handleSend}
              disabled={sendLoading}
              className="rounded-lg border border-input-border px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-alt disabled:opacity-50"
            >
              <Send className="h-4 w-4 inline mr-1" />
              {sendLoading ? "Sending…" : "Send"}
            </button>
          )}
          {canCancel && !isCancelled && !isVoid && (
            <button
              onClick={() => setShowCancelDialog(true)}
              className="rounded-lg border border-input-border px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div
          className="rounded-lg border status-info-border status-info-bg px-3 py-2 text-sm status-info-text"
          role="alert"
          aria-live="polite"
        >
          {actionMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CreditNoteDetailView creditNote={creditNote} />
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-color bg-surface p-5 text-center shadow-sm">
            {!creditNote.is_finalized && canFinalize && (
              <button
                onClick={handleFinalize}
                disabled={finalizeLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
              >
                {finalizeLoading ? "Finalizing…" : "Finalize Credit Note"}
              </button>
            )}
            {creditNote.is_finalized && !isCancelled && !isVoid && (
              <div className="flex items-center gap-3 justify-center">
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full status-success-bg">
                  <CheckIcon className="h-5 w-5 status-success-text" />
                </span>
                <div>
                  <p className="text-lg font-semibold status-success-text">Finalized</p>
                  <p className="text-sm text-tertiary">
                    {creditNote.credit_note_number ?? "—"}
                  </p>
                </div>
              </div>
            )}
            {isCancelled && (
              <div className="flex items-center gap-3 justify-center">
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full status-tertiary-bg">
                  <span className="h-5 w-5 status-tertiary-text">✕</span>
                </span>
                <div>
                  <p className="text-lg font-semibold status-tertiary-text">Cancelled</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-color bg-surface p-5 shadow-sm">
            <h3 className="invoice-section-title mb-3">Credit Note Details</h3>
            <div className="space-y-2">
              <InfoRow label="Issue date" value={creditNote.issue_date ? formatDate(creditNote.issue_date) : "—"} />
              <InfoRow label="Currency" value={creditNote.currency} />
              {creditNote.credit_note_number && <InfoRow label="Credit Note #" value={creditNote.credit_note_number} />}
              {creditNote.reference_invoice_id && (
                <InfoRow label="Original Invoice #" value={creditNote.reference_invoice_number ?? creditNote.reference_invoice_id.slice(0, 8)} />
              )}
              {creditNote.reason && <InfoRow label="Reason" value={creditNote.reason} />}
              {creditNote.finalized_at && <InfoRow label="Finalized" value={formatDate(creditNote.finalized_at)} />}
              {creditNote.cancelled_at && <InfoRow label="Cancelled" value={formatDate(creditNote.cancelled_at)} />}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-color bg-surface p-5 shadow-sm">
        <h3 className="invoice-section-title mb-3">Activity Timeline</h3>
        {events.length === 0 ? (
          <p className="text-sm text-secondary">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <CreditNoteTimelineItem key={e.id ?? `${e.event_type}-${e.created_at}`} event={e} />
            ))}
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={(data) => handleCancel(data?.input ?? "Cancelled by user")}
        title="Cancel Credit Note"
        message="Cancelling this credit note will prevent it from being applied to invoices. The credit note will remain in your records but cannot be used."
        confirmLabel="Cancel Credit Note"
        destructive
        showInput
        inputLabel="Reason (optional)"
        inputPlaceholder="Enter a reason..."
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-color-subtle last:border-b-0">
      <span className="text-sm text-tertiary">{label}</span>
      <span className="text-sm font-medium text-primary" aria-label={label}>{value}</span>
    </div>
  );
}

function CreditNoteTimelineItem({ event }: { event: ApiCreditNoteEvent }) {
  const label = (event.event_type ?? "").replace(/_/g, " ");
  const actor =
    event.actor_type === "customer" ? "Customer"
    : event.actor_type === "payment" ? "Payment"
    : event.actor_type === "system" ? "System"
    : event.actor_type === "user" ? "User"
    : "System";
  return (
    <li className="flex gap-3">
      <div className="h-2 w-2 flex-shrink-0 rounded-full bg-primary-action mt-1" aria-hidden="true"></div>
      <div className="flex-1">
        <p className="text-sm font-medium text-primary capitalize" aria-label={`${label} by ${actor}`}>
          {label}
        </p>
        <p className="text-xs text-tertiary">
          {actor} · {formatDate(event.created_at)}
        </p>
      </div>
    </li>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return <span className={className}>✓</span>;
}

function CreditNoteDetailView({ creditNote }: { creditNote: ApiCreditNote }) {
  return (
    <div className="rounded-xl border border-color bg-surface shadow-sm">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="invoice-title">
              Credit Note {creditNote.credit_note_number || "Draft"}
            </h2>
            <div className="mt-3">
              <CreditNoteLifecycle status={creditNote.status} />
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-color">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-alt">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tertiary">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Qty</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Rate</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Tax Rate</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-tertiary">Credit</th>
              </tr>
            </thead>
            <tbody>
              {(creditNote.items ?? []).map((item: ApiCreditNoteItem, i: number) => {
                const lineTotal = new Decimal(item.quantity || 1).mul(item.unit_price || 0);
                return (
                  <tr key={item.id || i} className="border-t border-color-subtle">
                    <td className="px-4 py-3 text-center text-sm text-tertiary font-tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 text-sm text-primary">{item.description || "—"}</td>
                    <td className="px-3 py-3 text-sm text-secondary text-right font-tabular-nums">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary text-right font-tabular-nums">
                      {formatCurrency(item.unit_price, creditNote.currency)}
                    </td>
                    <td className="px-3 py-3 text-sm text-tertiary text-right font-tabular-nums">
                      {Number(item.tax_rate) > 0 ? `${new Decimal(item.tax_rate).mul(100).toFixed(2)}%` : "0%"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-primary font-tabular-nums">
                      -{formatCurrency(lineTotal, creditNote.currency)}
                    </td>
                  </tr>
                );
              })}
              {(creditNote.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-tertiary">
                    No line items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {(creditNote.fees ?? []).length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-lg border border-color">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-alt">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Tax Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-tertiary">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(creditNote.fees ?? []).map((fee: ApiCreditNoteFee, i: number) => (
                  <tr key={i} className="border-t border-color-subtle">
                    <td className="px-4 py-3 text-sm text-primary">{fee.description || "—"}</td>
                    <td className="px-3 py-3 text-sm text-tertiary text-right font-tabular-nums">
                      {Number(fee.tax_rate) > 0 ? `${new Decimal(fee.tax_rate).mul(100).toFixed(2)}%` : "0%"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-primary font-tabular-nums">
                      -{formatCurrency(fee.amount, creditNote.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <div className="w-72 space-y-1 font-tabular-nums">
            <div className="flex justify-between py-2 text-sm">
              <span className="text-tertiary">Subtotal</span>
              <span className="text-primary">{formatCurrency(creditNote.subtotal, creditNote.currency)}</span>
            </div>
            {Number(creditNote.discount_total) > 0 && (
              <div className="flex justify-between py-2 text-sm">
                <span className="text-tertiary">Discount</span>
                <span className="text-success-text">−{formatCurrency(creditNote.discount_total, creditNote.currency)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 text-sm">
              <span className="text-tertiary">Tax</span>
              <span className="text-primary">
                {Number(creditNote.tax_total) > 0
                  ? formatCurrency(creditNote.tax_total, creditNote.currency)
                  : formatCurrency(0, creditNote.currency)}
              </span>
            </div>
            {Number(creditNote.fee_total) > 0 && (
              <div className="flex justify-between py-2 text-sm">
                <span className="text-tertiary">Fees</span>
                <span className="text-primary">{formatCurrency(creditNote.fee_total, creditNote.currency)}</span>
              </div>
            )}
            <div className="border-t-2 border-color pt-3">
              <div className="flex justify-between">
                <span className="text-base font-semibold text-secondary">Total Credit</span>
                <span className="text-2xl font-bold text-primary-brand">
                  -{formatCurrency(creditNote.total, creditNote.currency)}
                </span>
              </div>
            </div>
            {Number(creditNote.applied_total) > 0 && (
              <>
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-tertiary">Amount Applied</span>
                  <span className="text-success-text">−{formatCurrency(creditNote.applied_total, creditNote.currency)}</span>
                </div>
                <div className="border-t-2 border-color pt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-secondary">Amount Remaining</span>
                    <span className="text-xl font-bold text-primary-brand">
                      -{formatCurrency(new Decimal(creditNote.total).minus(new Decimal(creditNote.applied_total)), creditNote.currency)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center pt-4 border-t border-color">
          <div className="flex gap-6">
            <InfoRow label="Issue date" value={creditNote.issue_date ? formatDate(creditNote.issue_date) : "—"} />
            {creditNote.credit_note_number && <InfoRow label="Credit Note #" value={creditNote.credit_note_number} />}
          </div>
          <InfoRow label="Currency" value={creditNote.currency} />
        </div>

        {creditNote.reason && (
          <div className="mt-6 rounded-lg bg-warning-bg border border-warning-border p-4">
            <h4 className="invoice-section-title mb-1">Reason for Credit</h4>
            <p className="text-sm text-warning-text">{creditNote.reason}</p>
          </div>
        )}

        {creditNote.notes && <p className="mt-6 text-sm text-secondary whitespace-pre-line">{creditNote.notes}</p>}

        {creditNote.internal_notes && (
          <div className="mt-6 rounded-lg bg-surface-alt border border-color p-4">
            <h4 className="invoice-section-title mb-1">Internal Notes</h4>
            <p className="text-sm text-secondary whitespace-pre-line">{creditNote.internal_notes}</p>
          </div>
        )}

        {(creditNote.applications ?? []).length > 0 && (
          <div className="mt-6">
            <h4 className="invoice-section-title mb-3">Applied To Invoices</h4>
            <div className="overflow-x-auto rounded-lg border border-color">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-alt">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tertiary">Invoice</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Amount Applied</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(creditNote.applications ?? []).map((app: any, i: number) => (
                    <tr key={i} className="border-t border-color-subtle">
                      <td className="px-4 py-3 text-sm text-primary">{app.invoice_id || "—"}</td>
                      <td className="px-3 py-3 text-right text-sm text-secondary font-tabular-nums">
                        {formatCurrency(app.amount, creditNote.currency)}
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary text-right font-tabular-nums">
                        {app.applied_at ? formatDate(app.applied_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {creditNote.terms && (
          <div className="mt-6 rounded-lg bg-surface-alt p-4">
            <h4 className="invoice-section-title mb-1">Terms &amp; Conditions</h4>
            <p className="text-xs text-tertiary whitespace-pre-line">{creditNote.terms}</p>
          </div>
        )}
      </div>
    </div>
  );
}
