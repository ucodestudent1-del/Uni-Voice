import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  getCreditNote,
  getCreditNotePdf,
  getCreditNoteEvents,
  finalizeCreditNote,
  cancelCreditNote,
  sendCreditNote,
  voidCreditNote,
  applyCreditNote,
  deleteCreditNote,
  type CreditNoteSearchParams,
} from "../api/client";
import { getBusiness } from "../api/client";
import { getCustomer } from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import { formatCurrencyValue } from "../lib/utils";
import type { ApiCreditNote, ApiBusiness, ApiCustomer, ApiCreditNoteEvent } from "../types/api";
import { Button } from "@/components/ui/Button";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { CreditNoteLifecycle, StatusBadge, creditNoteStatusConfig } from "@/components/ui";
import {
  Download,
  Send,
  Copy,
  AlertCircle,
  ArrowLeft,
  Clock,
  ExternalLink,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import CreditNoteDisplay, { type CreditNoteDesign } from "@/components/CreditNoteDisplay";
import { useSubscription } from "@/contexts/SubscriptionContext";
import PageHeader from "@/components/ui/PageHeader";

function businessAddressString(b: ApiBusiness | null): string | undefined {
  if (!b) return undefined;
  const parts = [
    b.addressLine1,
    b.addressLine2,
    b.city,
    b.stateOrRegion,
    [b.postalCode, b.countryCode].filter(Boolean).join(" "),
    b.taxId ? `Tax ID: ${b.taxId}` : undefined,
  ];
  const joined = parts.filter(Boolean).join("\n");
  return joined || undefined;
}

function customerAddressString(c: ApiCustomer | null): string | undefined {
  if (!c?.address) return undefined;
  const a = c.address;
  const parts = [
    a.addressLine1,
    a.addressLine2,
    a.city,
    a.stateOrRegion,
    [a.postalCode, a.countryCode].filter(Boolean).join(" "),
  ];
  const joined = parts.filter(Boolean).join("\n");
  return joined || undefined;
}

function buildCreditNoteDesign(
  cn: ApiCreditNote,
  business: ApiBusiness | null,
  customer: ApiCustomer | null
): CreditNoteDesign {
  const items = (cn.items ?? []).map((it) => ({
    description: it.description,
    quantity: it.quantity,
    unit: it.unit,
    unitPrice: it.unit_price,
    discount: it.discount && Number(it.discount) > 0 ? it.discount : undefined,
    discountType: it.discount_type,
    taxRate: it.tax_rate,
    tax_name: it.tax_name ?? null,
    isTaxInclusive: it.is_tax_inclusive ?? false,
  }));

  const fees = (cn.fees ?? []).map((f) => ({
    description: f.description,
    amount: f.amount,
    taxRate: f.tax_rate,
    tax_name: f.tax_name ?? null,
    tax_amount: f.tax_amount ?? null,
  }));

  const applications = (cn.applications ?? []).map((app) => ({
    amount: app.amount,
    invoiceNumber: app.invoice_id ?? undefined,
    invoiceId: app.invoice_id,
    appliedAt: app.applied_at,
  }));

  return {
    businessName: business?.name || business?.legalName || "Untitled Business",
    businessLegalName: business?.legalName ?? null,
    businessEmail: business?.email ?? undefined,
    businessPhone: business?.phone ?? undefined,
    businessWebsite: business?.website ?? undefined,
    businessAddress: businessAddressString(business),
    businessLogo: business?.logoUrl ?? null,
    businessTaxId: business?.taxId ?? undefined,
    businessRegistrationNumber: business?.registrationNumber ?? null,

    creditNoteNumber: cn.credit_note_number ?? "",
    issueDate: cn.issue_date ?? undefined,
    currency: cn.currency,
    status: cn.status,

    customerName: cn.customer_name ?? customer?.name ?? undefined,
    customerCompanyName: customer?.companyName ?? undefined,
    customerEmail: cn.customer_email ?? customer?.email ?? undefined,
    customerAddress: customerAddressString(customer) ?? cn.customer_address ?? undefined,
    customerPhone: cn.customer_phone ?? customer?.phone ?? undefined,
    customerTaxId: cn.customer_tax_id ?? customer?.taxId ?? undefined,

    referenceInvoiceNumber: cn.reference_invoice_number ?? undefined,
    referenceInvoiceDate: cn.issue_date ?? undefined,

    reason: cn.reason,
    notes: cn.notes,
    terms: cn.terms,

    items,
    fees,
    subtotal: cn.subtotal,
    discountTotal: cn.discount_total,
    taxTotal: cn.tax_total,
    feeTotal: cn.fee_total,
    total: cn.total,
    appliedTotal: cn.applied_total,
    amountDue: cn.amount_due,
    applications,

    isFinalized: cn.is_finalized,
    notesForCustomer: cn.notes ?? undefined,
  };
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-sm text-tertiary">{label}</span>
      <span className="text-sm font-medium text-primary">{value || "—"}</span>
    </div>
  );
}

export default function CreditNoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [creditNote, setCreditNote] = useState<ApiCreditNote | null>(null);
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [customer, setCustomer] = useState<ApiCustomer | null>(null);
  const [events, setEvents] = useState<ApiCreditNoteEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
      const [cnRes, bizRes, evRes] = await Promise.allSettled([
        getCreditNote(id),
        getBusiness(),
        getCreditNoteEvents(id),
      ]);
      if (cnRes.status === "fulfilled") {
        setCreditNote(cnRes.value.creditNote);
        if (cnRes.value.creditNote.customer_id) {
          try {
            const custRes = await getCustomer(cnRes.value.creditNote.customer_id);
            setCustomer(custRes.customer ?? null);
          } catch {
            setCustomer(null);
          }
        }
      }
      if (bizRes.status === "fulfilled") setBusiness(bizRes.value.business ?? null);
      if (evRes.status === "fulfilled") setEvents(evRes.value.events ?? []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to load credit note";
      setActionMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  const design = useMemo(() => {
    if (!creditNote) return null;
    return buildCreditNoteDesign(creditNote, business, customer);
  }, [creditNote, business, customer]);

  const amountDue = new Decimal(creditNote?.amount_due ?? 0);
  const total = new Decimal(creditNote?.total ?? 0);
  const appliedTotal = new Decimal(creditNote?.applied_total ?? 0);
  const remaining = total.minus(appliedTotal);

  const canFinalize = creditNote && creditNote.status === "draft";
  const canEdit = creditNote && creditNote.status === "draft";
  const canCancel = creditNote && creditNote.status === "finalized";
  const canSend = creditNote && (creditNote.status === "finalized" || creditNote.status === "draft");
  const canVoid = creditNote && ["draft", "finalized", "sent", "partially_applied", "applied", "partially_refunded"].includes(creditNote.status);
  const canApply = creditNote && creditNote.is_finalized && remaining.gt(0) && creditNote.status !== "void" && creditNote.status !== "cancelled";
  const canDelete = creditNote && creditNote.status === "draft";
  const isCancelled = creditNote && (creditNote.status === "cancelled" || creditNote.status === "void");

  async function handleDownloadPdf() {
    if (!id) return;
    try {
      const blob = await getCreditNotePdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Credit-Note-${creditNote?.credit_note_number ?? id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setActionMessage(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to download PDF"
      );
    }
  }

  async function handleFinalize() {
    if (!id) return;
    try {
      await finalizeCreditNote(id);
      await loadCreditNote();
      setActionMessage("Credit note finalized successfully.");
    } catch (err: unknown) {
      setActionMessage(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to finalize credit note"
      );
    }
  }

  async function handleSend() {
    if (!id) return;
    try {
      await sendCreditNote(id);
      await loadCreditNote();
      setActionMessage("Credit note sent successfully.");
    } catch (err: unknown) {
      setActionMessage(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to send credit note"
      );
    }
  }

  async function handleCancel(reason: string) {
    if (!id) return;
    try {
      await cancelCreditNote(id, reason);
      setShowCancelDialog(false);
      await loadCreditNote();
      setActionMessage("Credit note cancelled.");
    } catch (err: unknown) {
      setActionMessage(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to cancel credit note"
      );
    }
  }

  async function handleVoid(reason: string) {
    if (!id) return;
    try {
      await voidCreditNote(id, reason);
      setShowVoidDialog(false);
      await loadCreditNote();
      setActionMessage("Credit note voided.");
    } catch (err: unknown) {
      setActionMessage(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to void credit note"
      );
    }
  }

  async function handleDelete() {
    if (!id) return;
    try {
      await deleteCreditNote(id);
      setShowDeleteDialog(false);
      navigate("/app/credit-notes");
    } catch (err: unknown) {
      setActionMessage(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to delete credit note"
      );
    }
  }

  async function handleApplyCredit() {
    if (!creditNote || !id) return;
    const remainingStr = remaining.gt(0) ? remaining.toFixed(6) : undefined;
    if (!remainingStr || !remaining.gt(0)) {
      setActionMessage("No remaining credit to apply.");
      return;
    }
    try {
      await applyCreditNote(id, creditNote.reference_invoice_id ?? "", remainingStr, "invoice_offset");
      await loadCreditNote();
      setActionMessage("Credit applied successfully.");
    } catch (err: unknown) {
      setActionMessage(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to apply credit"
      );
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-secondary">
        Loading credit note…
      </div>
    );
  }

  if (!creditNote) {
    return (
      <div className="text-center py-20 text-secondary">
        Credit note not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/app/credit-notes"
          className="text-tertiary hover:text-primary flex-shrink-0"
        >
          &larr; Credit Notes
        </Link>
      </div>

      {actionMessage && (
        <div
          className="rounded-lg border status-info-border status-info-bg px-3 py-2 text-sm status-info-text"
          role="status"
          aria-live="polite"
        >
          {actionMessage}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <h1 className="text-2xl font-bold text-primary truncate">
            {creditNote.credit_note_number || `Draft #${creditNote.id.slice(0, 8)}`}
          </h1>
          <StatusBadge
            status={creditNote.status}
            config={creditNoteStatusConfig}
            showLabel={true}
            size="sm"
          />
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          {canEdit && (
            <Link to={`/app/credit-notes/${creditNote.id}/edit`}>
              <Button variant="secondary" size="sm">
                Edit
              </Button>
            </Link>
          )}
          {canFinalize && (
            <Button variant="primary" size="sm" onClick={handleFinalize}>
              Finalize
            </Button>
          )}
          {canSend && creditNote.status !== "sent" && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Send className="w-4 h-4" />}
              onClick={handleSend}
            >
              Send
            </Button>
          )}
          {canApply && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Copy className="w-4 h-4" />}
              onClick={handleApplyCredit}
            >
              Apply Credit
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleDownloadPdf}
          >
            Download PDF
          </Button>
          {canCancel && (
            <Button
              variant="secondary"
              size="sm"
              icon={<AlertCircle className="w-4 h-4" />}
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel
            </Button>
          )}
          {canVoid && !isCancelled && (
            <Button
              variant="danger"
              size="sm"
              icon={<AlertCircle className="w-4 h-4" />}
              onClick={() => setShowVoidDialog(true)}
            >
              Void
            </Button>
          )}
          {canDelete && (
            <Button
              variant="danger"
              size="sm"
              icon={<Copy className="w-4 h-4" />}
              onClick={() => setShowDeleteDialog(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Status Badge with Lifecycle */}
      <div className="px-4 py-3 bg-surface-alt rounded-lg border border-color">
        <CreditNoteLifecycle status={creditNote.status} />
      </div>

      {/* Action message from contextual actions */}
      {actionMessage && (
        <div
          className="rounded-lg border status-success-border status-success-bg px-3 py-2 text-sm status-success-text"
          role="status"
          aria-live="polite"
        >
          {actionMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CreditNoteDisplay
            design={design!}
            showActions={false}
            onDownloadPdf={handleDownloadPdf}
          />
        </div>

        <div className="space-y-6">
          {/* Contextual action card */}
          <div className="rounded-xl border border-color bg-surface p-5 text-center shadow-sm">
            {isCancelled ? (
              <div className="flex items-center justify-center gap-3">
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full status-tertiary-bg">
                  <AlertCircle className="h-5 w-5 status-tertiary-text" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-tertiary">
                    Credit Note {creditNote.status === "void" ? "Voided" : "Cancelled"}
                  </p>
                  <p className="text-sm text-tertiary">
                    {creditNote.cancelled_reason || creditNote.void_reason || "—"}
                  </p>
                </div>
              </div>
            ) : creditNote.status === "draft" ? (
              <Link
                to={`/app/credit-notes/${creditNote.id}/edit`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
              >
                Edit Draft
              </Link>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full status-success-bg">
                  <CheckCircle className="h-5 w-5 status-success-text" />
                </span>
                <div>
                  <p className="text-lg font-semibold status-success-text">
                    Credit Note Issued
                  </p>
                  <p className="text-sm text-tertiary">
                    {creditNote.finalized_at ? formatDate(creditNote.finalized_at) : "—"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Credit Note Details Sidebar */}
          <div className="rounded-xl border border-color bg-surface p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-tertiary mb-3">
              Credit Note Details
            </h3>
            <div className="space-y-2">
              <InfoRow label="Credit Note #" value={creditNote.credit_note_number ?? "—"} />
              <InfoRow label="Issue Date" value={creditNote.issue_date ? formatDate(creditNote.issue_date) : "—"} />
              <InfoRow label="Currency" value={creditNote.currency} />
              <InfoRow label="Status" value={<span className="capitalize">{creditNote.status}</span>} />
              {creditNote.sent_at && <InfoRow label="Sent" value={formatDate(creditNote.sent_at)} />}
              {creditNote.finalized_at && <InfoRow label="Finalized" value={formatDate(creditNote.finalized_at)} />}
              {creditNote.created_at && <InfoRow label="Created" value={formatDate(creditNote.created_at)} />}
              {creditNote.updated_at && <InfoRow label="Updated" value={formatDate(creditNote.updated_at)} />}
            </div>
          </div>

          {/* Reference Invoice */}
          {creditNote.reference_invoice_id && (
            <div className="rounded-xl border border-color bg-surface p-5 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-tertiary mb-3">
                Original Invoice
              </h3>
              <div className="space-y-2">
                <InfoRow
                  label="Invoice #"
                  value={
                    <Link
                      to={`/app/invoices/${creditNote.reference_invoice_id}`}
                      className="text-primary-brand hover:text-primary"
                    >
                      {creditNote.reference_invoice_number ?? "—"}
                    </Link>
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="rounded-xl border border-color bg-surface p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-tertiary mb-3">
          Activity Timeline
        </h3>
        {events.length === 0 ? (
          <p className="text-sm text-secondary">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <div key={e.id} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-alt">
                  <Clock className="h-3.5 w-3.5 text-tertiary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-primary capitalize">
                    {e.event_type?.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-tertiary">
                    {e.created_at ? formatDate(e.created_at) : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={() => {
          if (creditNote) {
            handleCancel("Cancelled by user");
          }
        }}
        title="Cancel Credit Note"
        message="Are you sure you want to cancel this credit note? This will invalidate it but it can still be referenced for audit purposes."
        confirmLabel="Cancel Credit Note"
        destructive
      />

      <ConfirmationDialog
        open={showVoidDialog}
        onClose={() => setShowVoidDialog(false)}
        onConfirm={() => {
          if (creditNote) {
            handleVoid("Voided by user");
          }
        }}
        title="Void Credit Note"
        message={creditNote
          ? `Voiding "${creditNote.credit_note_number || "this credit note"}" will permanently invalidate it. This action cannot be undone. Voided credit notes cannot be applied or refunded.`
          : ""
        }
        confirmLabel="Void Credit Note"
        destructive
      />

      <ConfirmationDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Credit Note"
        message={creditNote
          ? `Are you sure you want to delete "${creditNote.credit_note_number || "this credit note"}"? This action cannot be undone.`
          : ""
        }
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
