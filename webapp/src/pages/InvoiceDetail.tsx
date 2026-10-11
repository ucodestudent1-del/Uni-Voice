import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getInvoice,
  recordPayment,
  cancelInvoice,
  voidInvoice,
  getInvoicePdf,
  getInvoiceShareLink,
  getInvoiceEvents,
  type RecordPaymentData,
  type RecordPaymentResult,
} from "@/api/client";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Button,
  StatusBadge,
  invoiceStatusConfig,
  Money,
  PageHeader,
  EmptyState,
  FormField,
  FormTextareaField,
} from "@/components/ui";
import {
  Send,
  Edit2,
  Download,
  Copy,
  XCircle,
  ExternalLink,
  Clock,
  CheckCircle,
  Eye,
  Tag,
  Printer,
} from "lucide-react";
import { formatDate, formatTaxRateWithName } from "@/utils/format";
import type { ApiInvoice, ApiInvoiceItem, ApiInvoiceFee, ApiInvoiceEvent } from "@/types/api";
import { cn } from "@/lib/utils";

const LIFECYCLE_STEPS = [
  { key: "draft", label: "Draft", icon: <Tag className="h-4 w-4" /> },
  { key: "sent", label: "Sent", icon: <Send className="h-4 w-4" /> },
  { key: "viewed", label: "Viewed", icon: <Eye className="h-4 w-4" /> },
  { key: "partially_paid", label: "Partially Paid", icon: <Clock className="h-4 w-4" /> },
  { key: "paid", label: "Paid", icon: <CheckCircle className="h-4 w-4" /> },
];

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<ApiInvoice | null>(null);
  const [events, setEvents] = useState<ApiInvoiceEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const fetchInvoice = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await getInvoice(id);
      setInvoice(res.invoice);
    } catch (err: any) {
      setError(err.message || "Failed to load invoice");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const fetchEvents = useCallback(async () => {
    if (!id) return;
    try {
      const res = await getInvoiceEvents(id);
      setEvents(res.events);
    } catch (err) {
      console.error("Failed to load events:", err);
    }
  }, [id]);

  useEffect(() => {
    fetchInvoice();
    fetchEvents();
  }, [fetchInvoice, fetchEvents]);

  const canEdit = !invoice?.is_finalized;
  const canSend = invoice?.is_finalized && !["paid", "cancelled", "void"].includes(invoice?.status ?? "");
  const canCancel = invoice?.status !== "cancelled" && invoice?.status !== "void" && invoice?.status !== "paid";
  const canVoid = invoice?.status !== "void" && invoice?.status !== "cancelled" && invoice?.status !== "paid";

  const handleRecordPayment = useCallback(async () => {
    if (!invoice) return;
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast("Please enter a valid payment amount.", { type: "error", title: "Invalid amount" });
      return;
    }
    const due = Number(invoice.amount_due);
    if (amount > due) {
      toast(`Payment exceeds the outstanding balance of ${due.toFixed(2)}.`, { type: "warning", title: "Amount exceeds balance" });
    }
    setActionLoading("payment");
    try {
      const data: RecordPaymentData = {
        amount: paymentAmount,
        provider: "manual",
      };
      const result: RecordPaymentResult = await recordPayment(invoice.id, data);
      setInvoice(result.invoice);
      toast("Payment recorded.", { type: "success", title: "Payment recorded" });
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      fetchEvents();
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Payment failed" });
    } finally {
      setActionLoading(null);
    }
  }, [invoice, paymentAmount, toast, fetchEvents]);

  const handleCancel = useCallback(async () => {
    if (!invoice) return;
    setActionLoading("cancel");
    try {
      const res = await cancelInvoice(invoice.id, cancelReason);
      setInvoice(res.invoice);
      toast("Invoice cancelled.", { type: "success", title: "Cancelled" });
      setCancelDialogOpen(false);
      fetchEvents();
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Cancel failed" });
    } finally {
      setActionLoading(null);
    }
  }, [invoice, cancelReason, toast, fetchEvents]);

  const handleVoid = useCallback(async () => {
    if (!invoice) return;
    if (!window.confirm("Voiding an invoice makes it inactive. Are you sure?")) return;
    setActionLoading("void");
    try {
      const res = await voidInvoice(invoice.id, "Voided from detail");
      setInvoice(res.invoice);
      toast("Invoice voided.", { type: "success", title: "Voided" });
      fetchEvents();
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Void failed" });
    } finally {
      setActionLoading(null);
    }
  }, [invoice, toast, fetchEvents]);

  const handleDownloadPdf = useCallback(async () => {
    if (!invoice) return;
    try {
      const blob = await getInvoicePdf(invoice.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${invoice.invoice_number ?? invoice.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Download failed" });
    }
  }, [invoice, toast]);

  const handleShareLink = useCallback(async () => {
    if (!invoice) return;
    try {
      const res = await getInvoiceShareLink(invoice.id);
      navigator.clipboard.writeText(res.url);
      toast("Share link copied to clipboard.", { type: "success", title: "Link copied" });
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Failed to generate link" });
    }
  }, [invoice, toast]);

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
          onAction={fetchInvoice}
        />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="page-container">
        <EmptyState
          title="Invoice not found"
          description="The invoice you're looking for doesn't exist."
          actionLabel="Back to invoices"
          onAction={() => navigate("/app/invoices")}
        />
      </div>
    );
  }

  const status = invoice.status ?? "draft";
  const currentStepIdx = LIFECYCLE_STEPS.findIndex((s) => s.key === status);

  return (
    <div className="page-container">
      <PageHeader
        title={`Invoice #${invoice.invoice_number ?? "—"}`}
        primaryAction={
          <div className="flex items-center gap-2">
            <StatusBadge status={status} config={invoiceStatusConfig} />
            <Button
              variant="ghost"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={handleDownloadPdf}
            >
              Download PDF
            </Button>
            {canSend && (
              <Button
                variant="primary"
                size="sm"
                icon={<Send className="h-4 w-4" />}
                onClick={() => navigate(`/app/invoices/${invoice.id}/send`)}
              >
                Send
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Edit2 className="h-4 w-4" />}
                onClick={() => navigate(`/app/invoices/${invoice.id}/edit`)}
              >
                Edit
              </Button>
            )}
          </div>
        }
      />

      {/* Lifecycle Stepper */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-secondary">Invoice Status</h3>
          {invoice.sent_at && (
            <span className="text-xs text-tertiary">Sent {formatDate(invoice.sent_at)}</span>
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
        {/* Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Invoice Info */}
          <div className="border border-border rounded-lg p-4 bg-surface">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-medium text-tertiary uppercase">Customer</h4>
                <div className="mt-1 font-medium text-primary">
                  {invoice.customer_name ?? "—"}
                </div>
                {invoice.customer_email && (
                  <div className="text-sm text-tertiary">{invoice.customer_email}</div>
                )}
              </div>
              <div className="text-right">
                <h4 className="text-xs font-medium text-tertiary uppercase">Details</h4>
                <div className="mt-1 space-y-1">
                  {invoice.issue_date && (
                    <div className="text-sm">
                      <span className="text-tertiary">Invoice date: </span>
                      {formatDate(invoice.issue_date)}
                    </div>
                  )}
                  {invoice.due_date && (
                    <div className="text-sm">
                      <span className="text-tertiary">Due date: </span>
                      {formatDate(invoice.due_date)}
                    </div>
                  )}
                  {invoice.po_number && (
                    <div className="text-sm">
                      <span className="text-tertiary">PO: </span>
                      {invoice.po_number}
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
                  {(invoice.items ?? []).map((item: ApiInvoiceItem, idx: number) => (
                    <tr key={item.id ?? idx} className="border-b border-border/50">
                      <td className="py-2 px-3">
                        <div className="font-medium text-primary">{item.description}</div>
                        {item.tax_name && <span className="text-xs text-tertiary">{item.tax_name}</span>}
                      </td>
                      <td className="text-right py-2 px-3">{item.quantity}</td>
                      <td className="text-right py-2 px-3">
                        <Money amount={item.unit_price} currency={invoice.currency} />
                      </td>
                      <td className="text-right py-2 px-3">
                        {item.tax_amount ? formatTaxRateWithName(item.tax_rate, item.tax_name) : "—"}
                      </td>
                      <td className="text-right py-2 px-3 font-medium">
                        <Money amount={item.line_total} currency={invoice.currency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fees */}
          {(invoice.fees ?? []).length > 0 && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h4 className="text-sm font-medium text-secondary mb-2">Fees</h4>
              <div className="space-y-1">
                {(invoice.fees ?? []).map((fee: ApiInvoiceFee, idx: number) => (
                  <div key={fee.id ?? idx} className="flex justify-between">
                    <span className="text-tertiary">{fee.description}</span>
                    <Money amount={fee.amount} currency={invoice.currency} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes, Terms, Payment Instructions */}
          {invoice.notes && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h4 className="text-xs font-medium text-tertiary uppercase mb-1">Notes</h4>
              <p className="text-sm text-secondary whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h4 className="text-xs font-medium text-tertiary uppercase mb-1">Terms</h4>
              <p className="text-sm text-secondary whitespace-pre-wrap">{invoice.terms}</p>
            </div>
          )}
          {invoice.payment_instructions && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h4 className="text-xs font-medium text-tertiary uppercase mb-1">Payment Instructions</h4>
              <p className="text-sm text-secondary whitespace-pre-wrap">{invoice.payment_instructions}</p>
            </div>
          )}
        </div>

        {/* Sidebar: Totals, Actions, Payments */}
        <div className="space-y-6">
          {/* Totals */}
          <div className="border border-border rounded-lg p-4 bg-surface">
            <h4 className="text-xs font-medium text-tertiary uppercase mb-3">Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-tertiary">Subtotal</span>
                <Money amount={invoice.subtotal ?? "0"} currency={invoice.currency} />
              </div>
              {(Number(invoice.discount_total ?? "0") > 0) && (
                <div className="flex justify-between">
                  <span className="text-tertiary">Discount</span>
                  <span className="text-error">-<Money amount={invoice.discount_total ?? "0"} currency={invoice.currency} /></span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-tertiary">Tax</span>
                <Money amount={invoice.tax_total ?? "0"} currency={invoice.currency} />
              </div>
              {(Number(invoice.fee_total ?? "0") > 0) && (
                <div className="flex justify-between">
                  <span className="text-tertiary">Fees</span>
                  <Money amount={invoice.fee_total ?? "0"} currency={invoice.currency} />
                </div>
              )}
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <Money amount={invoice.total ?? "0"} currency={invoice.currency} />
                </div>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-tertiary">Amount Paid</span>
                <Money amount={invoice.amount_paid ?? "0"} currency={invoice.currency} />
              </div>
              <div className="flex justify-between text-lg font-bold text-primary">
                <span>Amount Due</span>
                <Money amount={invoice.amount_due ?? "0"} currency={invoice.currency} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border border-border rounded-lg p-4 bg-surface space-y-2">
            <h4 className="text-xs font-medium text-tertiary uppercase mb-2">Actions</h4>
            {canCancel && (
              <Button
                variant="warning"
                size="sm"
                className="w-full"
                icon={<XCircle className="h-4 w-4" />}
                onClick={() => setCancelDialogOpen(true)}
                loading={actionLoading === "cancel"}
              >
                Cancel Invoice
              </Button>
            )}
            {canVoid && (
              <Button
                variant="danger"
                size="sm"
                className="w-full"
                icon={<Copy className="h-4 w-4" />}
                onClick={handleVoid}
                loading={actionLoading === "void"}
              >
                Void Invoice
              </Button>
            )}
            {Number(invoice.amount_due ?? "0") > 0 && !["cancelled", "void"].includes(status) && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                icon={<CheckCircle className="h-4 w-4" />}
                onClick={() => setPaymentDialogOpen(true)}
              >
                Record Payment
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
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              icon={<Printer className="h-4 w-4" />}
              onClick={handleDownloadPdf}
            >
              Print PDF
            </Button>
          </div>

          {/* Payments */}
          {(invoice.payments ?? []).length > 0 && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h4 className="text-xs font-medium text-tertiary uppercase mb-2">Payments</h4>
              <div className="space-y-2">
                {(invoice.payments ?? []).map((p) => (
                  <div key={p.id} className="flex justify-between items-center text-sm">
                    <div>
                      <div className="font-medium text-primary">{p.provider ?? "Manual"}</div>
                      <div className="text-xs text-tertiary">{p.paid_at ? formatDate(p.paid_at) : ""}</div>
                    </div>
                    <Money amount={p.amount} currency={invoice.currency} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {(invoice.payments ?? []).length === 0 && Number(invoice.amount_paid ?? "0") === 0 && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <EmptyState
                title="No payments recorded"
                description="This invoice has no payments yet."
                variant="compact"
              />
            </div>
          )}
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

      {/* Payment Dialog */}
      {paymentDialogOpen && invoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPaymentDialogOpen(false)}
        >
          <div
            className="bg-popover border border-border rounded-lg p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-primary mb-4">Record Payment</h3>
            <div className="space-y-3">
              <FormField
                label="Amount"
                type="number"
                step="0.01"
                min="0"
                max={Number(invoice.amount_due)}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                helperText={`Maximum: ${Number(invoice.amount_due ?? "0").toFixed(2)}`}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading === "payment"}
                onClick={handleRecordPayment}
              >
                Record
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Dialog */}
      {cancelDialogOpen && invoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setCancelDialogOpen(false)}
        >
          <div
            className="bg-popover border border-border rounded-lg p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-primary mb-4">Cancel Invoice</h3>
            <div className="space-y-3">
              <FormTextareaField
                label="Reason (optional)"
                placeholder="Why is this invoice being cancelled?"
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
                Cancel Invoice
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const EVENT_LABELS: Record<string, string> = {
  created: "Invoice created",
  updated: "Invoice updated",
  finalized: "Invoice finalized",
  sent: "Invoice sent",
  viewed: "Invoice viewed",
  paid: "Payment received",
  partially_paid: "Partial payment received",
  overdue: "Invoice marked overdue",
  cancelled: "Invoice cancelled",
  voided: "Invoice voided",
  refunded: "Payment refunded",
  payment_recorded: "Payment recorded",
  credit_note_applied: "Credit note applied",
};

function getEventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type.replace(/_/g, " ");
}
