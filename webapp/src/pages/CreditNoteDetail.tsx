import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  getCreditNote,
  getCreditNotePdf,
  getCreditNoteEvents,
  getInvoice,
  finalizeCreditNote,
  cancelCreditNote,
  sendCreditNote,
  applyCreditNote,
} from "../api/client";
import { formatCurrency, formatDate, formatDateLong } from "../utils/format";
import type {
  ApiCreditNote,
  ApiCreditNoteItem,
  ApiCreditNoteFee,
  ApiInvoice,
  ApiInvoiceListItem,
} from "../types/api";
import {
  CreditNoteLifecycle,
  StatusBadge,
  ConfirmationDialog,
  creditNoteStatusConfig,
} from "@/components/ui";
import CreditNoteInvoiceLink from "../components/CreditNoteInvoiceLink";
import CreditNoteApplicationStatus, {
  getApplicationMethod,
} from "../components/CreditNoteApplicationStatus";
import { ApplyCreditNoteDialog } from "../components/ApplyCreditNoteDialog";
import {
  Download,
  Send,
  Check,
  AlertCircle,
  ExternalLink,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ApiCreditNoteEvent {
  id?: string;
  credit_note_id?: string;
  event_type: string;
  actor_type?: string | null;
  actor_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

const eventMetaLabels: Record<string, string> = {
  credit_note_created: "Credit Note Created",
  credit_note_updated: "Credit Note Updated",
  credit_note_finalized: "Credit Note Finalized",
  credit_note_sent: "Credit Note Sent",
  credit_note_applied: "Credit Note Applied",
  credit_note_cancelled: "Credit Note Cancelled",
  credit_note_voided: "Credit Note Voided",
};

export default function CreditNoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [creditNote, setCreditNote] = useState<ApiCreditNote | null>(null);
  const [referenceInvoice, setReferenceInvoice] = useState<ApiInvoice | null>(null);
  const [events, setEvents] = useState<ApiCreditNoteEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
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
      if (cnRes.status === "fulfilled") {
        setCreditNote(cnRes.value.creditNote);
        if (cnRes.value.creditNote?.reference_invoice_id) {
          getInvoice(cnRes.value.creditNote.reference_invoice_id)
            .then((invRes) => {
              setReferenceInvoice(invRes.invoice ?? null);
            })
            .catch(() => {
              setReferenceInvoice(null);
            });
        }
      }
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

  async function handleApply({
    invoiceId,
    amount,
    applicationMethod,
  }: {
    invoiceId: string;
    amount?: string;
    applicationMethod?: "invoice_offset" | "balance_credit" | "refund";
  }) {
    if (!id) return;
    try {
      await applyCreditNote(id, invoiceId, amount, applicationMethod);
      setActionMessage("Credit note applied successfully!");
      setShowApplyDialog(false);
      loadCreditNote();
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || "Failed to apply credit note");
    }
  }
  const canEdit = creditNote && !creditNote.is_finalized;
  const canFinalize = creditNote && !creditNote.is_finalized;
  const canCancel =
    creditNote && ["finalized", "applied", "sent"].includes(creditNote.status);
  const isCancelled = creditNote && creditNote.status === "cancelled";
  const isVoid = creditNote && creditNote.status === "void";
  const canSend =
    creditNote &&
    creditNote.is_finalized &&
    !isCancelled &&
    !isVoid &&
    creditNote.status !== "sent";
  const canApply =
    creditNote &&
    creditNote.is_finalized &&
    !isCancelled &&
    !isVoid &&
    Number(creditNote.amount_due || 0) > 0;

  if (loading)
    return (
      <div className="text-center py-20 text-secondary">
        Loading credit note…
      </div>
    );
  if (!creditNote)
    return (
      <div className="text-center py-20 text-secondary">
        Credit note not found
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Top Bar: breadcrumbs + title + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            to="/app/credit-notes"
            className="text-tertiary hover:text-primary flex-shrink-0"
          >
            &larr; Credit Notes
          </Link>

          {creditNote.reference_invoice_id && (
            <>
              <span className="text-tertiary">/</span>
              <Link
                to={
                  referenceInvoice
                    ? `/app/invoices/${referenceInvoice.id}`
                    : `/app/invoices?search=${creditNote.reference_invoice_number ?? ""}`
                }
                className="text-tertiary hover:text-primary flex-shrink-0 text-sm font-medium"
                title={
                  referenceInvoice
                    ? `View source invoice ${creditNote.reference_invoice_number}`
                    : `Reference invoice ${creditNote.reference_invoice_number} (may be deleted)`
                }
              >
                {creditNote.reference_invoice_number || "Related Invoice"}
                {referenceInvoice ? null : (
                  <span className="ml-1 text-xs text-error-text">(not found)</span>
                )}
              </Link>
            </>
          )}

          <h1 className="text-2xl font-bold text-primary truncate">
            {creditNote.credit_note_number || `Draft #${creditNote.id.slice(0, 8)}`}
          </h1>
          <StatusBadge
            status={creditNote.status}
            config={creditNoteStatusConfig}
            className="hidden sm:inline-flex"
          />
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
          {canApply && (
            <button
              onClick={() => setShowApplyDialog(true)}
              className="rounded-lg border border-input-border px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
            >
              Apply to Invoice
            </button>
          )}
          {canCancel && !isCancelled && !isVoid && (
            <button
              onClick={() => setShowCancelDialog(true)}
              className="rounded-lg border border-error-border px-3 py-2 text-sm font-medium status-error-text hover:status-error-bg"
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
          <CreditNoteDetailView
            creditNote={creditNote}
            referenceInvoice={referenceInvoice}
          />
        </div>

        <div className="space-y-6">
          {/* Status / Action card */}
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
                  <Check className="h-5 w-5 status-success-text" />
                </span>
                <div>
                  <p className="text-lg font-semibold status-success-text">
                    Finalized
                  </p>
                  <p className="text-sm text-tertiary">
                    {creditNote.credit_note_number ?? "—"}
                  </p>
                </div>
              </div>
            )}
            {isCancelled && (
              <div className="flex items-center gap-3 justify-center">
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full status-tertiary-bg">
                  <AlertCircle className="h-5 w-5 status-tertiary-text" />
                </span>
                <div>
                  <p className="text-lg font-semibold status-tertiary-text">
                    Cancelled
                  </p>
                  {creditNote.cancelled_reason && (
                    <p className="text-xs text-tertiary mt-1">
                      {creditNote.cancelled_reason}
                    </p>
                  )}
                </div>
              </div>
            )}
            {isVoid && (
              <div className="flex items-center gap-3 justify-center">
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full status-tertiary-bg">
                  <AlertCircle className="h-5 w-5 status-tertiary-text" />
                </span>
                <div>
                  <p className="text-lg font-semibold status-tertiary-text">
                    Voided
                  </p>
                  {creditNote.void_reason && (
                    <p className="text-xs text-tertiary mt-1">
                      {creditNote.void_reason}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Credit Note Details card */}
          <div className="rounded-xl border border-color bg-surface p-5 shadow-sm">
            <h3 className="invoice-section-title mb-3">Credit Note Details</h3>
            <div className="space-y-2">
              <InfoRow
                label="Issue date"
                value={
                  creditNote.issue_date
                    ? formatDateLong(creditNote.issue_date)
                    : "—"
                }
              />
              <InfoRow
                label="Credit Note #"
                value={creditNote.credit_note_number ?? "—"}
              />
              <InfoRow label="Currency" value={creditNote.currency} />
              {creditNote.reference_invoice_id && (
                <InfoRow
                  label="Reference Invoice"
                  value={
                    <span className="flex items-center gap-1">
                      {creditNote.reference_invoice_number ?? "—"}
                      {referenceInvoice && (
                        <Link
                          to={`/app/invoices/${creditNote.reference_invoice_id}`}
                          className="text-primary-brand hover:text-primary-hover"
                          title="View source invoice"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </span>
                  }
                />
              )}
              {creditNote.reason && (
                <InfoRow label="Reason" value={creditNote.reason} />
              )}
              {creditNote.is_finalized && creditNote.finalized_at && (
                <InfoRow
                  label="Finalized"
                  value={formatDateLong(creditNote.finalized_at)}
                />
              )}
              {creditNote.cancelled_at && (
                <InfoRow
                  label="Cancelled"
                  value={formatDateLong(creditNote.cancelled_at)}
                />
              )}
            </div>
          </div>

          {/* Application summary card (NEW) */}
          {creditNote.applications &&
            creditNote.applications.length > 0 && (
              <ApplicationSummaryCard
                creditNote={creditNote}
              />
            )}
        </div>
      </div>

      <div className="rounded-xl border border-color bg-surface p-5 shadow-sm">
        <h3 className="invoice-section-title mb-3">Activity Timeline</h3>
        {events.length === 0 ? (
          <p className="text-sm text-secondary">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <CreditNoteTimelineItem
                key={e.id ?? `${e.event_type}-${e.created_at}`}
                event={e}
              />
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

      {showApplyDialog && canApply && (
        <ApplyCreditNoteDialog
          open={showApplyDialog}
          onClose={() => setShowApplyDialog(false)}
          onApply={handleApply}
          creditNote={creditNote}
          referenceInvoice={referenceInvoice}
        />
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <div className="flex justify-between py-2.5 border-b border-color-subtle last:border-b-0">
      <span className="text-sm text-tertiary">{label}</span>
      <span
        className="text-sm font-medium text-primary"
        aria-label={label}
      >
        {value}
      </span>
    </div>
  );
}

function CreditNoteTimelineItem({
  event,
}: {
  event: ApiCreditNoteEvent;
}) {
  const rawLabel = (event.event_type ?? "").replace(/_/g, " ");
  const label = eventMetaLabels[event.event_type ?? ""] ?? rawLabel;
  const actor =
    event.actor_type === "customer"
      ? "Customer"
      : event.actor_type === "payment"
      ? "Payment"
      : event.actor_type === "system"
      ? "System"
      : event.actor_type === "user"
      ? "User"
      : "System";

  const dotColorMap: Record<string, string> = {
    credit_note_created: "bg-tertiary-text",
    credit_note_updated: "bg-tertiary-text",
    credit_note_finalized: "bg-info-text",
    credit_note_sent: "bg-info-text",
    credit_note_applied: "bg-success-text",
    credit_note_cancelled: "bg-warning-text",
    credit_note_voided: "bg-tertiary-text",
  };
  const dotClass = dotColorMap[event.event_type ?? ""] ?? "bg-primary-action";

  return (
    <li className="flex gap-3">
      <div
        className={cn(
          "h-2 w-2 flex-shrink-0 rounded-full mt-1",
          dotClass
        )}
        aria-hidden="true"
      />
      <div className="flex-1">
        <p
          className="text-sm font-medium text-primary capitalize"
          aria-label={`${label} by ${actor}`}
        >
          {label}
        </p>
        <p className="text-xs text-tertiary">
          {actor} · {formatDate(event.created_at)}
        </p>
        {event.metadata &&
          Object.keys(event.metadata).length > 0 && (
            <p className="mt-1 text-xs text-tertiary">
              {JSON.stringify(event.metadata).replace(/[{}"]/g, "")}
            </p>
          )}
      </div>
    </li>
  );
}

function ApplicationSummaryCard({
  creditNote,
}: {
  creditNote: ApiCreditNote;
}) {
  const methods = creditNote.applications.map((app) =>
    getApplicationMethod(app)
  );
  const hasRefund = methods.includes("refund");
  const hasBalance = methods.includes("balance_credit");
  const hasInvoiceOffset = methods.includes("invoice_offset");

  let dominantMethod: string;
  if (hasRefund && !hasInvoiceOffset && !hasBalance) {
    dominantMethod = "Refunded";
  } else if (hasInvoiceOffset && !hasBalance && !hasRefund) {
    dominantMethod = "Applied to invoice";
  } else if (hasBalance && !hasInvoiceOffset && !hasRefund) {
    dominantMethod = "Credit held";
  } else {
    dominantMethod = "Mixed";
  }

  return (
    <div className="rounded-xl border border-color bg-surface p-5 shadow-sm">
      <h3 className="invoice-section-title mb-3">Application Summary</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-tertiary">Method</span>
          <span className="font-medium text-primary">{dominantMethod}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-tertiary">Total Applied</span>
          <span className="text-success-text font-medium">
            −{formatCurrency(creditNote.applied_total, creditNote.currency)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-tertiary">Remaining</span>
          <span
            className={cn(
              "font-medium",
              Number(creditNote.amount_due) === 0
                ? "text-success-text"
                : "text-warning-text"
            )}
          >
            −{formatCurrency(creditNote.amount_due, creditNote.currency)}
          </span>
        </div>

        <div className="pt-2 border-t border-color-subtle space-y-1.5">
          {creditNote.applications.map((app) => {
            const method = getApplicationMethod(app);
            const Icon =
              method === "refund"
                ? ReceiptRefundIcon
                : method === "balance_credit"
                ? WalletIcon
                : FileTextIcon;
            return (
              <div
                key={app.id}
                className="flex items-center gap-2 text-xs"
              >
                <Icon className="h-3 w-3" />
                <span className="text-tertiary">
                  {method === "refund"
                    ? "Refunded"
                    : method === "balance_credit"
                    ? "Balance credit"
                    : "Invoice offset"}
                </span>
                <span className="text-primary font-tabular-nums">
                  −{formatCurrency(app.amount, creditNote.currency)}
                </span>
                {app.invoice_id === creditNote.reference_invoice_id &&
                  creditNote.reference_invoice_number && (
                    <Link
                      to={`/app/invoices/${app.invoice_id}`}
                      className="ml-auto text-primary-brand hover:underline"
                      title={`View invoice ${creditNote.reference_invoice_number}`}
                    >
                      {creditNote.reference_invoice_number}
                      <ExternalLink className="h-3 w-3 inline ml-0.5" />
                    </Link>
                  )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const ReceiptRefundIcon = (props: { className?: string }) => (
  <svg
    {...props}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8c-1.654 0-3 .895-3 2s1.346 2 3 2 3-.895 3-2-1.346-2-3-2zm0 6V8m0 0v.01M12 8v6"
    />
  </svg>
);

const WalletIcon = (props: { className?: string }) => (
  <svg
    {...props}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 7h18M3 7l2-4h14l2 4M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7"
    />
  </svg>
);

const FileTextIcon = (props: { className?: string }) => (
  <svg
    {...props}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2-10v4m0 0l-4 4m4-4l4 4"
    />
  </svg>
);

function CreditNoteDetailView({
  creditNote,
  referenceInvoice,
}: {
  creditNote: ApiCreditNote;
  referenceInvoice: ApiInvoice | null;
}) {
  const hasDiscount = Number(creditNote.discount_total) > 0;
  const hasTax = Number(creditNote.tax_total) > 0;
  const hasFees = Number(creditNote.fee_total) > 0;
  const hasApplications = (creditNote.applications ?? []).length > 0;
  const creditTotal = new Decimal(creditNote.total || 0);
  const appliedTotal = new Decimal(creditNote.applied_total || 0);
  const amountDue = new Decimal(creditNote.amount_due || 0);
  const isFullyApplied = amountDue.lte(0);

  return (
    <div className="space-y-6">
      {/* Identity header */}
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

      {/* Provenance: Invoice linkage card (NEW — most prominent audit element) */}
      <CreditNoteInvoiceLink
        creditNote={creditNote}
        referenceInvoice={referenceInvoice as ApiInvoiceListItem | null}
      />

      {/* Party information */}
      <PartyInfo creditNote={creditNote} referenceInvoice={referenceInvoice} />

      {/* Reason for credit (audit-critical — always visible) */}
      {creditNote.reason && (
        <div className="rounded-lg bg-warning-bg border border-warning-border p-4">
          <h4 className="invoice-section-title mb-1 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning-text" />
            Reason for Credit
          </h4>
          <p className="text-sm text-warning-text">{creditNote.reason}</p>
        </div>
      )}

      {/* Line items table */}
      <div className="rounded-lg border border-color overflow-hidden">
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
                  <td className="px-4 py-3 text-sm text-primary">
                    {item.description || "—"}
                    {item.tax_rate && Number(new Decimal(item.tax_rate).mul(100)) > 0 && (
                      <span className="mt-0.5 block text-xs text-tertiary">
                        {item.is_tax_inclusive
                          ? `incl. ${new Decimal(item.tax_rate).mul(100).toFixed(2)}% tax`
                          : `${new Decimal(item.tax_rate).mul(100).toFixed(2)}% tax`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-secondary text-right font-tabular-nums">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-3 py-3 text-sm text-secondary text-right font-tabular-nums">
                    {formatCurrency(item.unit_price, creditNote.currency)}
                  </td>
                  <td className="px-3 py-3 text-sm text-tertiary text-right font-tabular-nums">
                    {Number(item.tax_rate) > 0 ? `${new Decimal(item.tax_rate).mul(100).toFixed(2)}%` : "0%"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-error-text font-tabular-nums">
                    −{formatCurrency(lineTotal, creditNote.currency)}
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

      {/* Fees */}
      {(creditNote.fees ?? []).length > 0 && (
        <div className="rounded-lg border border-color overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-alt">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Tax Rate</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-tertiary">Fee</th>
              </tr>
            </thead>
            <tbody>
              {(creditNote.fees ?? []).map((fee: ApiCreditNoteFee, i: number) => (
                <tr key={i} className="border-t border-color-subtle">
                  <td className="px-4 py-3 text-sm text-primary">{fee.description || "—"}</td>
                  <td className="px-3 py-3 text-sm text-tertiary text-right font-tabular-nums">
                    {Number(fee.tax_rate) > 0 ? `${new Decimal(fee.tax_rate).mul(100).toFixed(2)}%` : "0%"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-error-text font-tabular-nums">
                    −{formatCurrency(fee.amount, creditNote.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals summary with progress */}
      <div className="mt-6 flex justify-end">
        <div className="w-72 space-y-1 font-tabular-nums">
          <div className="flex justify-between py-2 text-sm">
            <span className="text-tertiary">Subtotal</span>
            <span className="text-primary">{formatCurrency(creditNote.subtotal, creditNote.currency)}</span>
          </div>
          {hasDiscount && (
            <div className="flex justify-between py-2 text-sm">
              <span className="text-tertiary">Discount</span>
              <span className="text-success-text">−{formatCurrency(creditNote.discount_total, creditNote.currency)}</span>
            </div>
          )}
          <div className="flex justify-between py-2 text-sm">
            <span className="text-tertiary">Tax</span>
            <span className="text-primary">
              {hasTax ? formatCurrency(creditNote.tax_total, creditNote.currency) : formatCurrency(0, creditNote.currency)}
            </span>
          </div>
          {hasFees && (
            <div className="flex justify-between py-2 text-sm">
              <span className="text-tertiary">Fees</span>
              <span className="text-primary">{formatCurrency(creditNote.fee_total, creditNote.currency)}</span>
            </div>
          )}

          <div className="border-t-2 border-color pt-3">
            <div className="flex justify-between">
              <span className="text-base font-semibold text-secondary">Total Credit</span>
              <span className="text-2xl font-bold text-error-text">
                −{formatCurrency(creditNote.total, creditNote.currency)}
              </span>
            </div>
          </div>

          {hasApplications && (
            <>
              <div className="flex justify-between py-2 text-sm">
                <span className="text-tertiary">Amount Applied</span>
                <span className="text-success-text font-medium">
                  −{formatCurrency(creditNote.applied_total, creditNote.currency)}
                </span>
              </div>
              <div className="border-t-2 border-color pt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-secondary">Amount Remaining</span>
                  <span
                    className={cn(
                      "text-xl font-bold",
                      isFullyApplied ? "text-success-text" : "text-warning-text"
                    )}
                  >
                    −{formatCurrency(creditNote.amount_due, creditNote.currency)}
                  </span>
                </div>
                {/* Progress bar visualizing applied vs remaining */}
                {creditTotal.gt(0) && (
                  <div className="mt-2 h-2 w-full rounded-full bg-surface-alt overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        isFullyApplied
                          ? "bg-success-text"
                          : "bg-warning-text"
                      )}
                      style={{
                        width: `${Math.min(
                          100,
                          Number(appliedTotal.div(creditTotal).mul(100).toFixed(0))
                        )}%`,
                      }}
                      aria-label={`${appliedTotal.toString()} of ${creditTotal.toString()} applied`}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Application history (enhanced with method visualization) */}
      {hasApplications ? (
        <div className="mt-6">
          <h3 className="invoice-section-title mb-3">Where This Credit Was Applied</h3>
          <div className="space-y-3">
            {creditNote.applications.map((app) => {
              const method = getApplicationMethod(app);
              const isInvoiceOffset = method === "invoice_offset";
              return (
                <CreditNoteApplicationStatus
                  key={app.id}
                  application={app}
                  currency={creditNote.currency}
                  showInvoiceLink={isInvoiceOffset}
                  referenceInvoiceNumber={
                    app.invoice_id === creditNote.reference_invoice_id
                      ? creditNote.reference_invoice_number
                      : null
                  }
                />
              );
            })}
          </div>
        </div>
      ) : creditNote.is_finalized && Number(creditNote.amount_due) > 0 ? (
        <div className="mt-6 rounded-lg border border-color bg-surface-alt p-4 text-center">
          <FileText className="mx-auto h-8 w-8 text-tertiary mb-2" />
          <p className="text-sm text-secondary">
            This credit note has not yet been applied.
          </p>
          <p className="mt-1 text-sm text-tertiary">
            {formatCurrency(creditNote.amount_due, creditNote.currency)} remaining — apply to an invoice or issue a refund.
          </p>
        </div>
      ) : null}

      {/* Notes / Internal notes / Terms */}
      {creditNote.notes && (
        <p className="mt-6 text-sm text-secondary whitespace-pre-line">
          {creditNote.notes}
        </p>
      )}

      {creditNote.internal_notes && (
        <div className="mt-6 rounded-lg bg-surface-alt border border-color p-4">
          <h4 className="invoice-section-title mb-1 flex items-center gap-2">
            <span aria-hidden="true">🔒</span>
            Internal Notes
          </h4>
          <p className="text-sm text-secondary whitespace-pre-line">
            {creditNote.internal_notes}
          </p>
        </div>
      )}

      {creditNote.terms && (
        <div className="mt-6 rounded-lg bg-surface-alt p-4">
          <h4 className="invoice-section-title mb-1">
            Terms &amp; Conditions
          </h4>
          <p className="text-xs text-tertiary whitespace-pre-line">
            {creditNote.terms}
          </p>
        </div>
      )}
    </div>
  );
}

function PartyInfo({
  creditNote,
  referenceInvoice,
}: {
  creditNote: ApiCreditNote;
  referenceInvoice: ApiInvoice | null;
}) {
  const hasCustomer =
    creditNote.customer_name ||
    creditNote.customer_email;

  return (
    <div className="rounded-lg border border-color bg-surface p-5 shadow-sm mb-6">
      <h3 className="invoice-section-title mb-4">Customer / Billing</h3>

      {hasCustomer ? (
        <div className="space-y-0.5">
          <p className="text-base font-semibold text-primary">
            {creditNote.customer_name || "Unknown Customer"}
          </p>
          {creditNote.customer_email && (
            <a
              href={`mailto:${creditNote.customer_email}`}
              className="text-sm text-primary-brand hover:text-primary-hover"
            >
              {creditNote.customer_email}
            </a>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm italic text-tertiary">
          No customer information available.
        </p>
      )}

      {referenceInvoice && (
        <div className="mt-4 pt-3 border-t border-color-subtle">
          <p className="text-xs text-tertiary">
            Original invoice total:{" "}
            <span className="text-primary font-medium">
              {formatCurrency(referenceInvoice.total, referenceInvoice.currency)}
            </span>
          </p>
          <p className="text-xs text-tertiary">
            Original amount due:{" "}
            <span className="text-primary font-medium">
              {formatCurrency(
                referenceInvoice.amount_due || 0,
                referenceInvoice.currency
              )}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
