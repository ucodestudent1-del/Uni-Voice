import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getQuote,
  getQuotePdf,
  getQuoteShareLink,
  getQuoteEvents,
  acceptQuote,
  rejectQuote,
  cancelQuote,
  duplicateQuote,
  convertQuoteToInvoice,
  type ApiQuote,
  type ApiQuoteItem,
  type ApiQuoteFee,
  type ApiQuoteEvent,
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
  Dialog,
} from "@/components/ui";
import SectionCard from "@/components/SectionCard";
import {
  Send,
  Download,
  Copy,
  CheckCircle,
  XCircle,
  ExternalLink,
  Clock,
  ArrowLeft,
  FileText,
  Tag,
  Receipt,
  Eye,
  AlertCircle,
} from "lucide-react";
import { formatDate, formatTaxRateWithName } from "@/utils/format";
import { cn } from "@/lib/utils";

const LIFECYCLE_STEPS = [
  { key: "draft", label: "Draft", icon: <FileText className="h-4 w-4" /> },
  { key: "sent", label: "Sent", icon: <Send className="h-4 w-4" /> },
  { key: "viewed", label: "Viewed", icon: <Eye className="h-4 w-4" /> },
  { key: "accepted", label: "Accepted", icon: <CheckCircle className="h-4 w-4" /> },
  { key: "converted", label: "Converted", icon: <Tag className="h-4 w-4" /> },
];

const EVENT_LABELS: Record<string, string> = {
  created: "Quotation created",
  updated: "Quotation updated",
  finalized: "Quotation finalized",
  number_assigned: "Number assigned",
  sent: "Quotation sent",
  viewed: "Customer viewed",
  accepted: "Accepted by customer",
  rejected: "Rejected by customer",
  expired: "Quotation expired",
  cancelled: "Quotation cancelled",
  converted: "Converted to invoice",
  duplicate: "Quotation duplicated",
};

function getEventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type.replace(/_/g, " ");
}

function ExpiryWarning({ expiryDate }: { expiryDate: string }) {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <div className="mb-4 p-3 bg-error-bg border border-error rounded-lg flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-error">Quotation expired</p>
          <p className="text-sm text-error/80">
            This quotation expired on {formatDate(expiryDate)}.
          </p>
        </div>
      </div>
    );
  }

  if (diffDays <= 7) {
    return (
      <div className="mb-4 p-3 bg-warning-bg border border-warning rounded-lg flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-warning">Quotation expires soon</p>
          <p className="text-sm text-warning/80">
            This quotation expires in {diffDays} day{diffDays !== 1 ? "s" : ""} (on {formatDate(expiryDate)}).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 p-3 bg-success-bg border border-success rounded-lg flex items-start gap-2">
      <Clock className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-success">Valid quotation</p>
        <p className="text-sm text-success/80">
          This quotation expires on {formatDate(expiryDate)} ({diffDays} days remaining).
        </p>
      </div>
    </div>
  );
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
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const fetchQuote = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await getQuote(id);
      setQuote(res.quote);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load quotation";
      setError(message);
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

  const canSend = quote?.is_finalized && (quote?.status === "draft" || quote?.status === "sent" || quote?.status === "viewed");
  const canAccept = quote?.status === "sent" || quote?.status === "viewed";
  const canReject = quote?.status === "sent" || quote?.status === "viewed";
  const canCancel = quote?.status !== "cancelled" && quote?.status !== "converted" && quote?.status !== "accepted";
  const canConvert = quote?.status === "accepted";
  const canDuplicate = quote?.is_finalized;
  const canEdit = !quote?.is_finalized;

  const handleAccept = useCallback(async () => {
    if (!quote) return;
    setActionLoading("accept");
    try {
      const res = await acceptQuote(quote.id);
      setQuote(res.quote);
      toast("Quotation accepted.", { type: "success", title: "Accepted" });
      setAcceptDialogOpen(false);
      fetchEvents();
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Action failed" });
    } finally {
      setActionLoading(null);
    }
  }, [quote, toast, fetchEvents]);

  const handleReject = useCallback(async () => {
    if (!quote) return;
    setActionLoading("reject");
    try {
      const res = await rejectQuote(quote.id);
      setQuote(res.quote);
      toast("Quotation rejected.", { type: "success", title: "Rejected" });
      setRejectDialogOpen(false);
      fetchEvents();
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Action failed" });
    } finally {
      setActionLoading(null);
    }
  }, [quote, toast, fetchEvents]);

  const handleCancel = useCallback(async () => {
    if (!quote) return;
    setActionLoading("cancel");
    try {
      const res = await cancelQuote(quote.id, cancelReason);
      setQuote(res.quote);
      toast("Quotation cancelled.", { type: "success", title: "Cancelled" });
      setCancelDialogOpen(false);
      setCancelReason("");
      fetchEvents();
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Cancel failed" });
    } finally {
      setActionLoading(null);
    }
  }, [quote, cancelReason, toast, fetchEvents]);

  const handleDuplicate = useCallback(async () => {
    if (!quote) return;
    setActionLoading("duplicate");
    try {
      const result = await duplicateQuote(quote.id);
      toast("Quotation duplicated.", { type: "success", title: "Duplicated" });
      navigate(`/app/quotes/${result.quote.id}`);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Duplicate failed" });
    } finally {
      setActionLoading(null);
    }
  }, [quote, navigate, toast]);

  const handleDownloadPdf = useCallback(async () => {
    if (!quote) return;
    try {
      const blob = await getQuotePdf(quote.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quotation-${quote.quote_number ?? quote.id}.pdf`;
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

  const handleConvert = useCallback(async () => {
    if (!quote) return;
    setActionLoading("convert");
    try {
      const res = await convertQuoteToInvoice(quote.id);
      toast("Quotation converted to invoice.", { type: "success", title: "Converted" });
      if (res.invoiceId) {
        navigate(`/app/invoices/${res.invoiceId}`);
      } else {
        fetchQuote();
      }
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Convert failed" });
    } finally {
      setActionLoading(null);
    }
  }, [quote, navigate, toast]);

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64 text-secondary">
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
          title="Quotation not found"
          description="The quotation you're looking for doesn't exist."
          actionLabel="Back to quotations"
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
        title={`Quotation #${quote.quote_number ?? "—"}`}
        breadcrumbs={[
          { label: "Quotations", to: "/app/quotes" },
          { label: `#${quote.quote_number ?? ""}` },
        ]}
        description={status}
        primaryAction={
          <div className="flex items-center gap-3">
            <StatusBadge status={status} config={quoteStatusConfig} />
            {quote.finalized_at && (
              <span className="text-xs text-tertiary">
                Finalized {formatDate(quote.finalized_at)}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => navigate("/app/quotes")}
            >
              Back
            </Button>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                icon={<FileText className="h-4 w-4" />}
                onClick={() => navigate(`/app/quotes/${quote.id}/edit`)}
              >
                Edit
              </Button>
            )}
            {canSend && (
              <Button
                variant="primary"
                size="sm"
                icon={<Send className="h-4 w-4" />}
                onClick={() => {
                  if (!quote.is_finalized) {
                    navigate(`/app/quotes/${quote.id}/edit`);
                  }
                }}
              >
                Send
              </Button>
            )}
            {canAccept && (
              <Button
                variant="secondary"
                size="sm"
                icon={<CheckCircle className="h-4 w-4" />}
                onClick={() => setAcceptDialogOpen(true)}
                loading={actionLoading === "accept"}
              >
                Accept
              </Button>
            )}
            {canReject && (
              <Button
                variant="warning"
                size="sm"
                icon={<XCircle className="h-4 w-4" />}
                onClick={() => setRejectDialogOpen(true)}
                loading={actionLoading === "reject"}
              >
                Reject
              </Button>
            )}
            {canCancel && (
              <Button
                variant="ghost"
                size="sm"
                icon={<XCircle className="h-4 w-4" />}
                onClick={() => setCancelDialogOpen(true)}
                loading={actionLoading === "cancel"}
              >
                Cancel
              </Button>
            )}
            {canConvert && (
              <Button
                variant="primary"
                size="sm"
                icon={<Receipt className="h-4 w-4" />}
                onClick={handleConvert}
                loading={actionLoading === "convert"}
              >
                Convert to Invoice
              </Button>
            )}
            {canDuplicate && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={handleDuplicate}
                loading={actionLoading === "duplicate"}
              >
                Duplicate
              </Button>
            )}
            <Button variant="ghost" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleDownloadPdf}>
              Download PDF
            </Button>
            <Button variant="ghost" size="sm" icon={<ExternalLink className="h-4 w-4" />} onClick={handleShareLink}>
              Share Link
            </Button>
          </div>
        }
      />

      {/* Lifecycle Stepper */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-secondary">Quotation Status</h3>
          {quote.sent_at && (
            <span className="text-xs text-tertiary">Sent {formatDate(quote.sent_at)}</span>
          )}
          {quote.accepted_at && (
            <span className="text-xs text-tertiary">Accepted {formatDate(quote.accepted_at)}</span>
          )}
          {quote.expiry_date && (
            <span className="text-xs text-tertiary">Expires {formatDate(quote.expiry_date)}</span>
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
                      : "border-border text-tertiary",
                  )}
                >
                  {step.icon}
                </div>
                {idx < LIFECYCLE_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "w-16 h-0.5",
                      idx < currentStepIdx ? "bg-success" : "bg-border",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "ml-2 text-sm",
                    isCompleted ? "font-medium text-primary" : "text-tertiary",
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expiry Warning */}
      {quote.expiry_date && status !== "accepted" && status !== "converted" && (
        <ExpiryWarning expiryDate={quote.expiry_date} />
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quote Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Quote Info */}
          <SectionCard title="Details">
            <div className="p-5">
              <div className="grid grid-cols-2 gap-6">
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
                  <h4 className="text-xs font-medium text-tertiary uppercase">Quote Details</h4>
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
                    <div className="text-sm">
                      <span className="text-tertiary">Currency: </span>
                      {quote.currency}
                    </div>
                    {quote.quote_number && (
                      <div className="text-sm">
                        <span className="text-tertiary">Number: </span>
                        {quote.quote_number}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Line Items */}
          {quote.items && quote.items.length > 0 && (
            <SectionCard title="Line Items">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-page">
                      <th className="text-left py-2 px-3 font-medium text-tertiary">Description</th>
                      <th className="text-right py-2 px-3 font-medium text-tertiary">Qty</th>
                      <th className="text-right py-2 px-3 font-medium text-tertiary">Unit Price</th>
                      <th className="text-right py-2 px-3 font-medium text-tertiary">Tax</th>
                      <th className="text-right py-2 px-3 font-medium text-tertiary">Discount</th>
                      <th className="text-right py-2 px-3 font-medium text-tertiary">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.items.map((item: ApiQuoteItem, idx: number) => (
                      <tr key={item.id ?? idx} className="border-b border-border/50">
                        <td className="py-2 px-3">
                          <div className="font-medium text-primary">{item.description}</div>
                          {item.is_optional && (
                            <span className="text-xs text-tertiary">(Optional)</span>
                          )}
                          {item.tax_name && <span className="text-xs text-tertiary">{item.tax_name}</span>}
                        </td>
                        <td className="text-right py-2 px-3">{item.quantity}</td>
                        <td className="text-right py-2 px-3">
                          <Money amount={item.unit_price} currency={quote.currency} />
                        </td>
                        <td className="text-right py-2 px-3">
                          <span className="text-xs text-tertiary">
                            {formatTaxRateWithName(item.tax_rate, item.tax_name)}
                          </span>
                        </td>
                        <td className="text-right py-2 px-3 text-tertiary">
                          {item.discount && Number(item.discount) > 0
                            ? "-" + <Money amount={item.discount} currency={quote.currency} />
                            : "—"}
                        </td>
                        <td className="text-right py-2 px-3 font-medium">
                          <Money amount={item.line_total} currency={quote.currency} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Fees */}
          {quote.fees && quote.fees.length > 0 && (
            <SectionCard title="Fees">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-page">
                      <th className="text-left py-2 px-3 font-medium text-tertiary">Description</th>
                      <th className="text-right py-2 px-3 font-medium text-tertiary">Amount</th>
                      <th className="text-right py-2 px-3 font-medium text-tertiary">Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.fees.map((fee: ApiQuoteFee, idx: number) => (
                      <tr key={fee.id ?? idx} className="border-b border-border/50">
                        <td className="py-2 px-3 text-sm text-primary">{fee.description}</td>
                        <td className="text-right py-2 px-3 font-medium">
                          <Money amount={fee.amount} currency={quote.currency} />
                        </td>
                        <td className="text-right py-2 px-3">
                          <span className="text-xs text-tertiary">
                            {formatTaxRateWithName(fee.tax_rate, fee.tax_name)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Scope of Work */}
          {quote.scope_of_work && (
            <SectionCard title="Scope of Work">
              <div className="p-5">
                <p className="text-sm text-secondary whitespace-pre-line">{quote.scope_of_work}</p>
              </div>
            </SectionCard>
          )}

          {/* Notes, Terms, Payment Instructions */}
          {quote.notes && (
            <SectionCard title="Notes">
              <div className="p-5">
                <p className="text-sm text-secondary whitespace-pre-line">{quote.notes}</p>
              </div>
            </SectionCard>
          )}
          {quote.terms && (
            <SectionCard title="Terms">
              <div className="p-5">
                <p className="text-sm text-secondary whitespace-pre-line">{quote.terms}</p>
              </div>
            </SectionCard>
          )}
          {quote.payment_instructions && (
            <SectionCard title="Payment Instructions">
              <div className="p-5">
                <p className="text-sm text-secondary whitespace-pre-line">{quote.payment_instructions}</p>
              </div>
            </SectionCard>
          )}
          {quote.internal_notes && (
            <SectionCard title="Internal Notes">
              <div className="p-5">
                <p className="text-sm text-secondary whitespace-pre-line">{quote.internal_notes}</p>
              </div>
            </SectionCard>
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
              {Number(quote.discount_total ?? "0") > 0 && (
                <div className="flex justify-between">
                  <span className="text-tertiary">Discount</span>
                  <span className="text-error">-<Money amount={quote.discount_total ?? "0"} currency={quote.currency} /></span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-tertiary">Tax</span>
                <Money amount={quote.tax_total ?? "0"} currency={quote.currency} />
              </div>
              {Number(quote.fee_total ?? "0") > 0 && (
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
              {quote.expiry_date && (
                <div className="flex justify-between pt-1">
                  <span className="text-tertiary">Expires</span>
                  <span className="text-tertiary">{formatDate(quote.expiry_date)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="border border-border rounded-lg p-4 bg-surface space-y-2">
            <h4 className="text-xs font-medium text-tertiary uppercase mb-2">Quick Actions</h4>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              icon={<Download className="h-4 w-4" />}
              onClick={handleDownloadPdf}
            >
              Download PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              icon={<ExternalLink className="h-4 w-4" />}
              onClick={handleShareLink}
            >
              Copy Share Link
            </Button>
            {canConvert && (
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                icon={<Receipt className="h-4 w-4" />}
                onClick={handleConvert}
                loading={actionLoading === "convert"}
              >
                Convert to Invoice
              </Button>
            )}
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

      {/* Accept Confirmation Dialog */}
      <Dialog
        open={acceptDialogOpen}
        onClose={() => setAcceptDialogOpen(false)}
        title="Accept Quotation"
        description="Mark this quotation as accepted by the customer?"
        size="sm"
      >
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" size="sm" onClick={() => setAcceptDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={actionLoading === "accept"}
            onClick={handleAccept}
          >
            Accept Quotation
          </Button>
        </div>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        title="Reject Quotation"
        description="Mark this quotation as rejected by the customer?"
        size="sm"
      >
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" size="sm" onClick={() => setRejectDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="warning"
            size="sm"
            loading={actionLoading === "reject"}
            onClick={handleReject}
          >
            Reject Quotation
          </Button>
        </div>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        title="Cancel Quotation"
        description="Provide a reason for cancelling this quotation."
        size="sm"
      >
        <div className="space-y-3">
          <FormTextareaField
            label="Reason (optional)"
            placeholder="Why is this quotation being cancelled?"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border mt-4">
          <Button variant="secondary" size="sm" onClick={() => setCancelDialogOpen(false)}>
            Back
          </Button>
          <Button
            variant="warning"
            size="sm"
            loading={actionLoading === "cancel"}
            onClick={handleCancel}
          >
            Cancel Quotation
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
