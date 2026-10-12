import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getQuote,
  cancelQuote,
  getQuotePdf,
  getQuoteShareLink,
  getQuoteEvents,
  convertQuote,
  acceptQuote,
   rejectQuote,
} from "@/api/client";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Button,
  StatusBadge,
  quoteStatusConfig,
  Money,
  PageHeader,
  EmptyState,
  FormTextareaField,
} from "@/components/ui";
import {
  Send,
  Edit2,
  Download,
  XCircle,
  ExternalLink,
  Clock,
  CheckCircle,
  Eye,
  Tag,
  Printer,
  FileText,
} from "lucide-react";
import { formatDate, formatTaxRateWithName } from "@/utils/format";
import { Decimal } from "decimal.js";
import type { ApiQuote, ApiQuoteItem, ApiQuoteFee, ApiQuoteEvent } from "@/types/api";
import { cn } from "@/lib/utils";

const LIFECYCLE_STEPS = [
  { key: "draft", label: "Draft", icon: <Tag className="h-4 w-4" /> },
  { key: "sent", label: "Sent", icon: <Send className="h-4 w-4" /> },
  { key: "viewed", label: "Viewed", icon: <Eye className="h-4 w-4" /> },
  { key: "accepted", label: "Accepted", icon: <CheckCircle className="h-4 w-4" /> },
  { key: "converted", label: "Converted", icon: <FileText className="h-4 w-4" /> },
];

const EVENT_LABELS: Record<string, string> = {
  created: "Quote created",
  updated: "Quote updated",
  finalized: "Quote finalized",
  sent: "Quote sent",
  viewed: "Quote viewed",
  accepted: "Quote accepted",
  rejected: "Quote rejected",
  expired: "Quote expired",
  cancelled: "Quote cancelled",
  converted: "Quote converted to invoice",
  deposit_requested: "Deposit requested",
  deposit_paid: "Deposit paid",
  changes_requested: "Changes requested",
};

function getEventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type.replace(/_/g, " ");
}

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [events, setEvents] = useState<ApiQuoteEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const fetchQuote = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await getQuote(id);
      setQuote(res.quote);
    } catch (err: any) {
      setError(err.message || "Failed to load quote");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const fetchEvents = useCallback(async () => {
    if (!id) return;
    try {
      const res = await getQuoteEvents(id);
      setEvents(res.events);
    } catch (err) {
      console.error("Failed to load events:", err);
    }
  }, [id]);

  useEffect(() => {
    fetchQuote();
    fetchEvents();
  }, [fetchQuote, fetchEvents]);

  const canEdit = !quote?.is_finalized;
  const canSend = quote?.is_finalized && !["accepted", "rejected", "expired", "cancelled", "converted"].includes(quote?.status ?? "");
  const canCancel = quote?.status !== "cancelled" && quote?.status !== "converted" && quote?.status !== "expired";
  const canConvert = quote?.status === "accepted" || quote?.status === "sent" || quote?.status === "viewed";
  const canAccept = quote?.status === "sent" || quote?.status === "viewed";
  const canReject = quote?.status === "sent" || quote?.status === "viewed";

  const handleCancel = useCallback(async () => {
    if (!quote) return;
    setActionLoading("cancel");
    try {
      const res = await cancelQuote(quote.id, cancelReason);
      setQuote(res.quote);
      toast("Quote cancelled.", { type: "success", title: "Cancelled" });
      setCancelDialogOpen(false);
      fetchEvents();
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Cancel failed" });
    } finally {
      setActionLoading(null);
    }
  }, [quote, cancelReason, toast, fetchEvents]);

  const handleConvert = useCallback(async () => {
    if (!quote) return;
    if (!window.confirm("Convert this quote to an invoice?")) return;
    setActionLoading("convert");
    try {
      const res = await convertQuote(quote.id);
      toast("Quote converted to invoice.", { type: "success", title: "Converted" });
      navigate(`/app/invoices/${res.invoiceId}`);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Convert failed" });
    } finally {
      setActionLoading(null);
    }
  }, [quote, navigate, toast]);

  const handleAccept = useCallback(async () => {
    if (!quote) return;
    setActionLoading("accept");
    try {
      const res = await acceptQuote(quote.id);
      setQuote(res.quote);
      toast("Quote accepted.", { type: "success", title: "Accepted" });
      fetchEvents();
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Accept failed" });
    } finally {
      setActionLoading(null);
    }
  }, [quote, toast, fetchEvents]);

  const handleReject = useCallback(async () => {
    if (!quote) return;
    setActionLoading("reject");
    try {
      const res = await rejectQuote(quote.id, "Rejected from detail");
      setQuote(res.quote);
      toast("Quote rejected.", { type: "success", title: "Rejected" });
      fetchEvents();
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Reject failed" });
    } finally {
      setActionLoading(null);
    }
  }, [quote, toast, fetchEvents]);

  const handleDownloadPdf = useCallback(async () => {
    if (!quote) return;
    try {
      const blob = await getQuotePdf(quote.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quote-${quote.quote_number ?? quote.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Download failed" });
    }
  }, [quote, toast]);

  const handleShareLink = useCallback(async () => {
    if (!quote) return;
    try {
      const res = await getQuoteShareLink(quote.id);
      navigator.clipboard.writeText(res.url);
      toast("Share link copied to clipboard.", { type: "success", title: "Link copied" });
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Failed to generate link" });
    }
  }, [quote, toast]);

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <EmptyState
          title="Something went wrong"
          description={error}
          variant="error"
          actionLabel="Retry"
          onAction={fetchQuote}
        />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="page-container">
        <EmptyState
          title="Quote not found"
          description="The quote you're looking for doesn't exist."
          actionLabel="Back to quotes"
          onAction={() => navigate("/app/quotes")}
        />
      </div>
    );
  }

  const status = quote.status ?? "draft";
  const currentStepIdx = LIFECYCLE_STEPS.findIndex((s) => s.key === status);

  return (
    <div className="page-container">
      <PageHeader
        title={`Quote #${quote.quote_number ?? "—"}`}
        primaryAction={
          <div className="flex items-center gap-2">
            <StatusBadge status={status} config={quoteStatusConfig} />
            <Button
              variant="ghost"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={handleDownloadPdf}
            >
              Download PDF
            </Button>
            {canConvert && (
              <Button
                variant="primary"
                size="sm"
                icon={<FileText className="h-4 w-4" />}
                onClick={handleConvert}
                loading={actionLoading === "convert"}
              >
                Convert to Invoice
              </Button>
            )}
            {canAccept && (
              <Button
                variant="primary"
                size="sm"
                icon={<CheckCircle className="h-4 w-4" />}
                onClick={handleAccept}
                loading={actionLoading === "accept"}
              >
                Accept
              </Button>
            )}
            {canReject && (
              <Button
                variant="danger"
                size="sm"
                icon={<XCircle className="h-4 w-4" />}
                onClick={handleReject}
                loading={actionLoading === "reject"}
              >
                Reject
              </Button>
            )}
            {canSend && (
              <Button
                variant="primary"
                size="sm"
                icon={<Send className="h-4 w-4" />}
                onClick={() => navigate(`/app/quotes/${quote.id}/edit`)}
              >
                Send
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Edit2 className="h-4 w-4" />}
                onClick={() => navigate(`/app/quotes/${quote.id}/edit`)}
              >
                Edit
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<ExternalLink className="h-4 w-4" />}
              onClick={handleShareLink}
            >
              Copy Share Link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Printer className="h-4 w-4" />}
              onClick={handleDownloadPdf}
            >
              Print PDF
            </Button>
          </div>
        }
      />

      {/* Lifecycle Stepper */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-secondary">Quote Status</h3>
          {quote.sent_at && (
            <span className="text-xs text-tertiary">Sent {formatDate(quote.sent_at)}</span>
          )}
        </div>
        <div className="flex items-center space-x-1">
          {LIFECYCLE_STEPS.map((step, idx) => {
            const isCompleted = idx <= currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            return (
              <div key={step.key} className="flex items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs",
                    isCompleted
                      ? "bg-success border-success text-on-success"
                      : isCurrent
                      ? "border-primary text-primary"
                      : "border-border text-tertiary"
                  )}
                >
                  {step.icon}
                </div>
                {idx < LIFECYCLE_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "w-16 h-0.5",
                      idx < currentStepIdx ? "bg-success" : "bg-border"
                    )}
                  />
                )}
                <span
                  className={cn(
                    "ml-2 text-sm",
                    isCompleted ? "font-medium text-primary" : "text-tertiary"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quote Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Quote Info */}
          <div className="border border-border rounded-lg p-4 bg-surface">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-medium text-tertiary uppercase">Customer</h4>
                <div className="mt-1 font-medium text-primary">
                  {quote.customer_name ?? "—"}
                </div>
                {quote.customer_email && (
                  <div className="text-sm text-tertiary">{quote.customer_email}</div>
                )}
              </div>
              <div className="text-right">
                <h4 className="text-xs font-medium text-tertiary uppercase">Details</h4>
                <div className="mt-1 space-y-1">
                  {quote.issue_date && (
                    <div className="text-sm">
                      <span className="text-tertiary">Issue date: </span>
                      {formatDate(quote.issue_date)}
                    </div>
                  )}
                  {quote.expiry_date && (
                    <div className="text-sm">
                      <span className="text-tertiary">Expiry date: </span>
                      {formatDate(quote.expiry_date)}
                    </div>
                  )}
                  {quote.converted_invoice_id && (
                    <div className="text-sm">
                      <span className="text-tertiary">Invoice: </span>
                      {quote.converted_invoice_id}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-page">
                    <th className="text-left py-2 px-3 font-medium text-tertiary">Description</th>
                    <th className="text-right py-2 px-3 font-medium text-tertiary">Qty</th>
                    <th className="text-right py-2 px-3 font-medium text-tertiary">Unit Price</th>
                    <th className="text-right py-2 px-3 font-medium text-tertiary">Tax</th>
                    <th className="text-right py-2 px-3 font-medium text-tertiary">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(quote.items ?? []).map((item: ApiQuoteItem, idx: number) => (
                    <tr key={item.id ?? idx} className="border-b border-border/50">
                      <td className="py-2 px-3">
                        <div className="font-medium text-primary">{item.description}</div>
                        {item.tax_name && <span className="text-xs text-tertiary">{item.tax_name}</span>}
                        {item.is_optional && <span className="text-xs text-tertiary"> (Optional)</span>}
                      </td>
                      <td className="text-right py-2 px-3">{item.quantity}</td>
                      <td className="text-right py-2 px-3">
                        <Money amount={item.unit_price} currency={quote.currency} />
                      </td>
                      <td className="text-right py-2 px-3">
                        {item.tax_amount ? formatTaxRateWithName(item.tax_rate, item.tax_name) : "—"}
                      </td>
                      <td className="text-right py-2 px-3 font-medium">
                        <Money amount={item.line_total} currency={quote.currency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fees */}
          {(quote.fees ?? []).length > 0 && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h4 className="text-sm font-medium text-secondary mb-2">Fees</h4>
              <div className="space-y-1">
                {(quote.fees ?? []).map((fee: ApiQuoteFee, idx: number) => (
                  <div key={fee.id ?? idx} className="flex justify-between">
                    <span className="text-tertiary">{fee.description}</span>
                    <Money amount={fee.amount} currency={quote.currency} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scope of Work */}
          {quote.scope_of_work && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h4 className="text-xs font-medium text-tertiary uppercase mb-1">Scope of Work</h4>
              <p className="text-sm text-secondary whitespace-pre-wrap">{quote.scope_of_work}</p>
            </div>
          )}

          {/* Notes, Terms, Payment Instructions */}
          {quote.notes && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h4 className="text-xs font-medium text-tertiary uppercase mb-1">Notes</h4>
              <p className="text-sm text-secondary whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
          {quote.terms && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h4 className="text-xs font-medium text-tertiary uppercase mb-1">Terms</h4>
              <p className="text-sm text-secondary whitespace-pre-wrap">{quote.terms}</p>
            </div>
          )}
          {quote.payment_instructions && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h4 className="text-xs font-medium text-tertiary uppercase mb-1">Payment Instructions</h4>
              <p className="text-sm text-secondary whitespace-pre-wrap">{quote.payment_instructions}</p>
            </div>
          )}
        </div>

        {/* Sidebar: Totals, Actions */}
        <div className="space-y-6">
          {/* Totals */}
          <div className="border border-border rounded-lg p-4 bg-surface">
            <h4 className="text-xs font-medium text-tertiary uppercase mb-3">Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-tertiary">Subtotal</span>
                <Money amount={quote.subtotal ?? "0"} currency={quote.currency} />
              </div>
              {(Number(quote.discount_total ?? "0") > 0) && (
                <div className="flex justify-between">
                  <span className="text-tertiary">Discount</span>
                  <span className="text-error">-{Number(quote.discount_total ?? "0").toFixed(2)}</span>
                </div>
              )}
             {(() => {
                const taxBreakdown: Record<string, { name: string; rate: string; amount: Decimal }> = {};
                [...(quote.items ?? []), ...((quote.fees ?? []).map((f) => ({ tax_rate: f.tax_rate, tax_name: f.tax_name, tax_amount: f.tax_amount })))].forEach((li) => {
                  const rate = li.tax_rate ?? "0";
                  const name = li.tax_name ?? "";
                  const key = `${rate}-${name}`;
                  if (!taxBreakdown[key]) {
                    taxBreakdown[key] = { name, rate, amount: new Decimal(0) };
                  }
                  taxBreakdown[key].amount = taxBreakdown[key].amount.plus(li.tax_amount ?? "0");
                });
                const breakdownEntries = Object.entries(taxBreakdown).filter(([, v]) => !v.amount.isZero());
                return (
                  <>
                    {Number(quote.tax_total ?? "0") > 0 && (
                      <div className="flex justify-between">
                        <span className="text-tertiary">Tax</span>
                        <Money amount={quote.tax_total ?? "0"} currency={quote.currency} />
                      </div>
                    )}
                    {breakdownEntries.length > 0 && (
                      <div className="mt-1 pl-4 border-l-2 border-border/50 space-y-0.5">
                        {breakdownEntries.map(([key, v]) => (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-tertiary">
                              {formatTaxRateWithName(v.rate, v.name)}
                            </span>
                            <Money amount={v.amount.toFixed()} currency={quote.currency} />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
              {(Number(quote.fee_total ?? "0") > 0) && (
                <div className="flex justify-between">
                  <span className="text-tertiary">Fees</span>
                  <Money amount={quote.fee_total ?? "0"} currency={quote.currency} />
                </div>
              )}
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <Money amount={quote.total ?? "0"} currency={quote.currency} />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border border-border rounded-lg p-4 bg-surface space-y-2">
            <h4 className="text-xs font-medium text-tertiary uppercase mb-2">Actions</h4>
            {canConvert && (
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                icon={<FileText className="h-4 w-4" />}
                onClick={handleConvert}
                loading={actionLoading === "convert"}
              >
                Convert to Invoice
              </Button>
            )}
            {canAccept && (
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                icon={<CheckCircle className="h-4 w-4" />}
                onClick={handleAccept}
                loading={actionLoading === "accept"}
              >
                Accept Quote
              </Button>
            )}
            {canReject && (
              <Button
                variant="danger"
                size="sm"
                className="w-full"
                icon={<XCircle className="h-4 w-4" />}
                onClick={handleReject}
                loading={actionLoading === "reject"}
              >
                Reject Quote
              </Button>
            )}
            {canCancel && (
              <Button
                variant="warning"
                size="sm"
                className="w-full"
                icon={<XCircle className="h-4 w-4" />}
                onClick={() => setCancelDialogOpen(true)}
                loading={actionLoading === "cancel"}
              >
                Cancel Quote
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              icon={<ExternalLink className="h-4 w-4" />}
              onClick={handleShareLink}
            >
              Copy Share Link
            </Button>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="mt-6 border border-border rounded-lg p-4 bg-surface">
        <h4 className="text-xs font-medium text-tertiary uppercase mb-3">Activity</h4>
        {events.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Activity timeline will appear here as events occur."
            variant="compact"
          />
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-3 w-3 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-sm">
                    <span className="font-medium text-primary">{getEventLabel(event.event_type)}</span>
                    {event.created_at && <span className="text-tertiary"> — {formatDate(event.created_at)}</span>}
                  </div>
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="text-xs text-tertiary mt-0.5">
                      {JSON.stringify(event.metadata)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Dialog */}
      {cancelDialogOpen && quote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setCancelDialogOpen(false)}
        >
          <div
            className="bg-popover border border-border rounded-lg p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-primary mb-4">Cancel Quote</h3>
            <div className="space-y-3">
              <FormTextareaField
                label="Reason (optional)"
                placeholder="Why is this quote being cancelled?"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setCancelDialogOpen(false)}>
                Back
              </Button>
              <Button
                variant="warning"
                size="sm"
                loading={actionLoading === "cancel"}
                onClick={handleCancel}
              >
                Cancel Quote
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
