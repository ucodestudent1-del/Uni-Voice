import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getCreditNote,
  getInvoices,
  cancelCreditNote,
  voidCreditNote,
  type InvoiceSearchParams,
} from "@/api/client";
import {
  PageHeader,
  StatusBadge,
  creditNoteStatusConfig,
  Money,
  CreditNoteInvoiceLink,
  CreditNoteTotalsSummary,
  CreditNoteAppliedSummary,
  CreditNoteActivityTimeline,
  ApplyCreditNoteDialog,
  ConfirmationDialog,
} from "@/components/ui";
import { Button } from "@/components/ui/Button";
import SectionCard from "@/components/SectionCard";
import {
  ArrowLeft,
  FileText,
  Send,
  Download,
  Plus,
  XCircle,
  Clock,
} from "lucide-react";
import { formatDate, formatTaxRateWithName } from "@/utils/format";
import { useToast } from "@/components/ui/ToastProvider";
import type { ApiCreditNote, ApiInvoiceListItem } from "@/types/api";
import { Decimal } from "decimal.js";

export default function CreditNoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const action = searchParams.get("action") ?? "";
  const { toast } = useToast();

  const [creditNote, setCreditNote] = useState<ApiCreditNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [availableInvoices, setAvailableInvoices] = useState<ApiInvoiceListItem[]>([]);

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmVoidOpen, setConfirmVoidOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);

  const fetchCreditNote = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCreditNote(id);
      setCreditNote(data.creditNote);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load credit note";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCreditNote();
  }, [fetchCreditNote]);

  const handleApplyClick = useCallback(async () => {
    if (!creditNote) return;
    try {
      const data = await getInvoices({
        limit: 100,
        customerId: creditNote.customer_id ?? undefined,
      } as InvoiceSearchParams);
      const openInvoices = (data.invoices ?? []).filter(
        (inv) => new Decimal(inv.amount_due ?? 0).gt(0)
      );
      setAvailableInvoices(openInvoices);
    } catch {
      setAvailableInvoices([]);
    }
    setApplyDialogOpen(true);
  }, [creditNote]);

  useEffect(() => {
    if (action === "apply" && creditNote && (creditNote.status === "finalized" || creditNote.status === "sent")) {
      handleApplyClick();
    }
  }, [action, creditNote, handleApplyClick]);

  useEffect(() => {
    if (action === "apply" && creditNote && (creditNote.status === "finalized" || creditNote.status === "sent")) {
      handleApplyClick();
    }
  }, [action, creditNote, handleApplyClick]);

  const appliedAmount = creditNote ? new Decimal(creditNote.applied_total ?? 0) : new Decimal(0);
  const totalAmount = creditNote ? new Decimal(creditNote.total ?? 0) : new Decimal(0);
  const remainingCredit = totalAmount.minus(appliedAmount);
  const canApply = creditNote && (creditNote.status === "finalized" || creditNote.status === "sent") && remainingCredit.gt(0);
  const isCancelledOrVoid = creditNote && (creditNote.status === "cancelled" || creditNote.status === "void" || creditNote.status === "refunded");

  const handleApplySuccess = (result: { ok: boolean; remaining: string; status: string }) => {
    toast(
      result.ok ? "Credit note applied successfully" : "Failed to apply credit note",
      { type: result.ok ? "success" : "error", title: result.ok ? "Applied" : "Error" }
    );
    fetchCreditNote();
  };

  const handleCancelWithReason = async (reason: string) => {
    if (!creditNote) return;
    setIsCancelling(true);
    try {
      await cancelCreditNote(creditNote.id, reason);
      toast("Credit note cancelled", { type: "success", title: "Cancelled" });
      setConfirmCancelOpen(false);
      fetchCreditNote();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to cancel", { type: "error", title: "Error" });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleVoidWithReason = async (reason: string) => {
    if (!creditNote) return;
    setIsVoiding(true);
    try {
      await voidCreditNote(creditNote.id, reason);
      toast("Credit note voided", { type: "success", title: "Voided" });
      setConfirmVoidOpen(false);
      fetchCreditNote();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to void", { type: "error", title: "Error" });
    } finally {
      setIsVoiding(false);
    }
  };

  const canCancel = creditNote && creditNote.status === "draft";
  const canVoid = creditNote && (creditNote.status === "finalized" || creditNote.status === "sent" || creditNote.status === "partially_applied");

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64 text-secondary">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mr-3" />
          Loading credit note...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="p-4 rounded-md bg-error/10 text-error-text">
          {error}
        </div>
      </div>
    );
  }

  if (!creditNote) {
    return (
      <div className="page-container">
        <div className="text-center py-10">
          <FileText className="h-12 w-12 mx-auto mb-4 text-tertiary opacity-30" />
          <p className="text-tertiary">Credit note not found.</p>
          <Button variant="ghost" className="mt-4" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/app/credit-notes")}>
            Back to Credit Notes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title={`Credit Note #${creditNote.credit_note_number ?? ""}`}
        breadcrumbs={[
          { label: "Credit Notes", to: "/app/credit-notes" },
          { label: `#${creditNote.credit_note_number ?? ""}` },
        ]}
        description={creditNote.status}
        primaryAction={
          <div className="flex items-center gap-3">
            <StatusBadge status={creditNote.status} config={creditNoteStatusConfig} />
            {creditNote.finalized_at && (
              <span className="text-xs text-tertiary">
                Finalized {formatDate(creditNote.finalized_at)}
              </span>
            )}
            <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/app/credit-notes")}>
              Back
            </Button>
            {canApply && (
              <Button
                variant="primary"
                icon={<Plus className="h-4 w-4" />}
                onClick={handleApplyClick}
              >
                Apply to Invoice
              </Button>
            )}
            <Button variant="ghost" icon={<Download className="h-4 w-4" />} onClick={() => window.open(`/api/credit-notes/${creditNote.id}/pdf`, "_blank")}>
              Download PDF
            </Button>
            {creditNote.status === "finalized" && (
              <Button variant="primary" icon={<Send className="h-4 w-4" />}>
                Send
              </Button>
            )}
            {canCancel && (
              <Button
                variant="secondary"
                icon={<XCircle className="h-4 w-4" />}
                onClick={() => setConfirmCancelOpen(true)}
              >
                Cancel Draft
              </Button>
            )}
            {canVoid && (
              <Button
                variant="danger"
                icon={<Clock className="h-4 w-4" />}
                onClick={() => setConfirmVoidOpen(true)}
              >
                Void
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-6">
        <CreditNoteInvoiceLink
          creditNote={creditNote}
          onNavigateToInvoice={(invoiceId) => navigate(`/app/invoices/${invoiceId}`)}
        />

        <SectionCard title="Credit Note Details">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Issue Date</span>
                <p className="text-sm text-primary mt-1">
                  {creditNote.issue_date ? formatDate(creditNote.issue_date) : "—"}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Currency</span>
                <p className="text-sm text-primary mt-1">{creditNote.currency}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Customer</span>
                <p className="text-sm text-primary mt-1">
                  {creditNote.customer_name ?? "—"}
                  {creditNote.customer_email && (
                    <span className="block text-xs text-tertiary">{creditNote.customer_email}</span>
                  )}
                </p>
              </div>
              {creditNote.finalized_at && (
                <div>
                  <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Finalized At</span>
                  <p className="text-sm text-primary mt-1">
                    {formatDate(creditNote.finalized_at)}
                  </p>
                </div>
              )}
            </div>

            {creditNote.reason && (
              <div>
                <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Reason</span>
                <p className="text-sm text-primary mt-1">{creditNote.reason}</p>
              </div>
            )}

            {creditNote.notes && (
              <div>
                <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Notes</span>
                <p className="text-sm text-secondary mt-1 whitespace-pre-wrap">{creditNote.notes}</p>
              </div>
            )}

            {creditNote.terms && (
              <div>
                <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Terms</span>
                <p className="text-sm text-secondary mt-1 whitespace-pre-wrap">{creditNote.terms}</p>
              </div>
            )}
          </div>
        </SectionCard>

        {creditNote.items && creditNote.items.length > 0 && (
          <SectionCard title="Line Items">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="text-left py-2 px-3 text-xs font-medium text-tertiary uppercase">Description</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-tertiary uppercase">Qty</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-tertiary uppercase">Unit</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-tertiary uppercase">Unit Price</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-tertiary uppercase">Tax</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-tertiary uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {creditNote.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-2 px-3 text-sm text-primary">{item.description}</td>
                      <td className="py-2 px-3 text-right text-sm text-primary">{item.quantity}</td>
                      <td className="py-2 px-3 text-sm text-tertiary">{item.unit}</td>
                      <td className="py-2 px-3 text-right text-sm text-primary">{new Decimal(item.unit_price).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-xs text-tertiary">
                        {formatTaxRateWithName(item.tax_rate, item.tax_name)}
                      </td>
                      <td className="py-2 px-3 text-right text-sm font-medium text-primary">
                        <Money amount={item.line_total} currency={creditNote.currency} signed />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {creditNote.fees && creditNote.fees.length > 0 && (
          <SectionCard title="Fees">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="text-left py-2 px-3 text-xs font-medium text-tertiary uppercase">Description</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-tertiary uppercase">Amount</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-tertiary uppercase">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {creditNote.fees.map((fee, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-2 px-3 text-sm text-primary">{fee.description}</td>
                      <td className="py-2 px-3 text-right text-sm font-medium text-primary">
                        <Money amount={fee.amount} currency={creditNote.currency} signed />
                      </td>
                      <td className="py-2 px-3 text-right text-xs text-tertiary">
                        {formatTaxRateWithName(fee.tax_rate, fee.tax_name)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        <SectionCard title="Totals">
          <div className="p-5">
            <div className="max-w-xs ml-auto">
              <CreditNoteTotalsSummary creditNote={creditNote} />
            </div>
          </div>
        </SectionCard>

        {creditNote.applications && creditNote.applications.length > 0 && (
          <SectionCard title="Application Summary">
            <div className="p-5">
              <CreditNoteAppliedSummary creditNote={creditNote} />
            </div>
          </SectionCard>
        )}

        {creditNote.events && creditNote.events.length > 0 && (
          <SectionCard title="Activity Timeline">
            <div className="p-5">
              <CreditNoteActivityTimeline events={creditNote.events} />
            </div>
          </SectionCard>
        )}

        {isCancelledOrVoid && creditNote.cancelled_reason && (
          <SectionCard title="Cancellation / Void Details">
            <div className="p-5 space-y-2">
              <div className="text-sm text-tertiary">
                <span className="font-medium text-primary">Status:</span>{" "}
                <span className="text-error-text">{creditNote.status}</span>
              </div>
              <div className="text-sm text-tertiary">
                <span className="font-medium text-primary">Reason:</span> {creditNote.cancelled_reason ?? creditNote.void_reason ?? "—"}
              </div>
              {(creditNote.cancelled_at ?? creditNote.voided_at) && (
                <div className="text-sm text-tertiary">
                  <span className="font-medium text-primary">Date:</span>{" "}
                  {formatDate(creditNote.cancelled_at ?? creditNote.voided_at ?? "")}
                </div>
              )}
            </div>
          </SectionCard>
        )}
      </div>

      {creditNote.status !== "cancelled" && creditNote.status !== "void" && (
        <ApplyCreditNoteDialog
          open={action === "apply"}
          onClose={() => navigate(-1)}
          creditNote={creditNote}
          onSuccess={handleApplySuccess}
          availableInvoices={availableInvoices}
        />
      )}

      <ConfirmationDialog
        open={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={(data) => {
          const reason = data?.reason ?? "";
          if (reason.trim()) handleCancelWithReason(reason);
        }}
        title="Cancel Draft Credit Note"
        message="This will cancel the credit note. You can still create a new one."
        confirmLabel="Cancel Draft"
        destructive
        isLoading={isCancelling}
        showInput
        inputLabel="Reason"
        inputPlaceholder="Enter reason for cancellation..."
      />

      <ConfirmationDialog
        open={confirmVoidOpen}
        onClose={() => setConfirmVoidOpen(false)}
        onConfirm={(data) => {
          const reason = data?.reason ?? "";
          if (reason.trim()) handleVoidWithReason(reason);
        }}
        title="Void Credit Note"
        message="This action cannot be undone. The credit note will be marked as voided and all applications will be reversed."
        confirmLabel="Void Credit Note"
        destructive
        isLoading={isVoiding}
        showInput
        inputLabel="Reason"
        inputPlaceholder="Enter reason for voiding..."
      />
      {creditNote && !isCancelledOrVoid && (
        <ApplyCreditNoteDialog
          open={applyDialogOpen}
          onClose={() => setApplyDialogOpen(false)}
          creditNote={creditNote}
          onSuccess={handleApplySuccess}
          availableInvoices={availableInvoices}
        />
      )}
    </div>
  );
}
