import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  getInvoice,
  getInvoicePdf,
  getInvoicePayments,
  getInvoiceEvents,
  sendReminder,
  cancelInvoice,
  voidInvoice,
  duplicateInvoice,
  createPaymentIntent,
  payInvoicePublic,
  recordPublicView,
} from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import type { ApiInvoice, ApiPayment, ApiInvoiceEvent, ApiPaymentIntent } from "../types/api";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-800",
  sent: "bg-blue-100 text-blue-800",
  viewed: "bg-indigo-100 text-indigo-800",
  partially_paid: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-800",
  void: "bg-slate-100 text-slate-800",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  void: "Void",
};

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<ApiInvoice | null>(null);
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [events, setEvents] = useState<ApiInvoiceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payAmount, setPayAmount] = useState<string>("");

  useEffect(() => {
    if (id) loadInvoice();
  }, [id]);

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  async function loadInvoice() {
    if (!id) return;
    setLoading(true);
    try {
      const [invRes, payRes, evRes] = await Promise.allSettled([
        getInvoice(id),
        getInvoicePayments(id),
        getInvoiceEvents(id),
      ]);
      if (invRes.status === "fulfilled") setInvoice(invRes.value.invoice);
      if (payRes.status === "fulfilled") setPayments(payRes.value.payments ?? []);
      if (evRes.status === "fulfilled") setEvents(evRes.value.events ?? []);
    } catch (err: any) {
      if (err.response?.status === 404) {
        navigate("/app/invoices");
      }
    } finally {
      setLoading(false);
    }
  }

  const amountDue = new Decimal(invoice?.amount_due ?? 0);
  const total = new Decimal(invoice?.total ?? 0);
  const isFullyPaid = amountDue.lte(0);
  const canSendReminder = invoice && !["draft", "paid", "cancelled", "void"].includes(invoice.status);
  const canEdit = invoice && !invoice.is_finalized;
  const canCancel = invoice && ["draft", "sent", "viewed"].includes(invoice.status);
  const canVoid = invoice && ["draft", "sent", "viewed", "partially_paid", "overdue"].includes(invoice.status);

  async function handleSendReminder() {
    if (!id) return;
    try {
      await sendReminder(id);
      setActionMessage("Reminder sent successfully!");
      loadInvoice();
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || "Failed to send reminder");
    }
  }

  async function handleCancel(reason: string) {
    if (!id) return;
    try {
      await cancelInvoice(id, { reason });
      setShowCancelDialog(false);
      setActionMessage("Invoice cancelled.");
      loadInvoice();
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || "Failed to cancel invoice");
    }
  }

  async function handleVoid(reason: string) {
    if (!id) return;
    try {
      await voidInvoice(id, { reason });
      setShowVoidDialog(false);
      setActionMessage("Invoice voided.");
      loadInvoice();
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || "Failed to void invoice");
    }
  }

  async function handleDuplicate() {
    if (!id) return;
    try {
      const res = await duplicateInvoice(id);
      navigate(`/app/invoices/${res.invoiceId}/edit`);
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || "Failed to duplicate");
    }
  }

  async function handleDownloadPdf() {
    if (!id) return;
    try {
      const blob = await getInvoicePdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoice?.invoice_number ?? id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || "Failed to download PDF");
    }
  }

  async function handleRecordPayment() {
    if (!id || !payAmount) return;
    try {
      const intent: ApiPaymentIntent = await createPaymentIntent(id);
      const amountDecimal = new Decimal(payAmount);
      if (intent.provider === "stripe" && intent.clientSecret) {
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");
        if (stripe) {
          const { error } = await stripe.confirmCardPayment(intent.clientSecret, {
            payment_method: {
              card: { token: "tok_visa" } as any,
            },
          });
          if (error) throw new Error(error.message);
        }
      } else {
        await payInvoicePublic(invoice?.public_token as string, {
          amount: Number(amountDecimal.toNumber()),
          provider: "stub",
        });
      }
      setActionMessage("Payment recorded successfully!");
      setShowPayDialog(false);
      setPayAmount("");
      loadInvoice();
    } catch (err: any) {
      setActionMessage(err.message || err.response?.data?.error || "Failed to record payment");
    }
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Loading invoice...</div>;
  if (!invoice) return <div className="text-center py-20 text-slate-500">Invoice not found</div>;

  const statusColor = STATUS_COLORS[invoice.status] || STATUS_COLORS.draft;
  const statusLabel = STATUS_LABELS[invoice.status] || invoice.status;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/app/invoices" className="text-slate-500 hover:text-slate-700">
            &larr; Back to Invoices
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            {invoice.invoice_number || `Draft #${invoice.id.slice(0, 8)}`}
          </h1>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/app/invoices/${invoice.id}/edit`}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit
          </Link>
          <button
            onClick={handleDuplicate}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Duplicate
          </button>
          <button
            onClick={handleDownloadPdf}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Download PDF
          </button>
          {canSendReminder && (
            <button
              onClick={handleSendReminder}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Send Reminder
            </button>
          )}
          {!isFullyPaid && amountDue.gt(0) && invoice.status !== "draft" && invoice.status !== "cancelled" && invoice.status !== "void" && (
            <button
              onClick={() => setShowPayDialog(true)}
              className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Record Payment
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setShowCancelDialog(true)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
          {canVoid && (
            <button
              onClick={() => setShowVoidDialog(true)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Void
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {actionMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <InvoiceDetailView invoice={invoice} />
        </div>

        <div className="space-y-6">
          <SummaryCard
            title="Total"
            value={formatCurrency(invoice.total, invoice.currency)}
            subtitle="Invoice total"
          />
          <SummaryCard
            title="Paid"
            value={formatCurrency(invoice.amount_paid, invoice.currency)}
            subtitle="Amount received"
          />
          <SummaryCard
            title="Outstanding"
            value={formatCurrency(invoice.amount_due, invoice.currency)}
            subtitle="Still due"
          />
          <InfoRow label="Issue date" value={invoice.issue_date ? formatDate(invoice.issue_date) : "—"} />
          <InfoRow label="Due date" value={invoice.due_date ? formatDate(invoice.due_date) : "—"} />
          <InfoRow label="Currency" value={invoice.currency} />
          {invoice.sent_at && <InfoRow label="Sent" value={formatDate(invoice.sent_at)} />}
          {invoice.paid_at && <InfoRow label="Paid" value={formatDate(invoice.paid_at)} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment History</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500">No payments recorded yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase py-2">Date</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase py-2">Amount</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase py-2">Method</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 text-sm text-slate-600">{p.paid_at ? formatDate(p.paid_at) : formatDate(p.created_at)}</td>
                    <td className="py-2 text-sm font-medium text-slate-900">{formatCurrency(p.amount, p.currency)}</td>
                    <td className="py-2 text-sm text-slate-600">{p.method || p.provider || "-"}</td>
                    <td className="py-2 text-sm text-slate-600 capitalize">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Activity Timeline</h3>
          {events.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {events.map((e) => (
                <TimelineItem key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CancelDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancel}
        title="Cancel Invoice"
        message="Cancelling this invoice will prevent further payments. The invoice will remain visible for record-keeping."
      />
      <CancelDialog
        open={showVoidDialog}
        onClose={() => setShowVoidDialog(false)}
        onConfirm={handleVoid}
        title="Void Invoice"
        message="Voiding this invoice will mark it as invalid. This action cannot be undone."
      />

      {showPayDialog && (
        <PaymentDialog
          invoice={invoice}
          amountDue={amountDue}
          payAmount={payAmount}
          onAmountChange={setPayAmount}
          onConfirm={handleRecordPayment}
          onCancel={() => setShowPayDialog(false)}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-100">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value}</span>
    </div>
  );
}

function SummaryCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500 uppercase">{title}</p>
      <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}

function TimelineItem({ event }: { event: ApiInvoiceEvent }) {
  const label = event.event_type.replace(/_/g, " ");
  const actor = event.actor_type === "customer" ? "Customer" : event.actor_type === "payment" ? "Payment" : event.actor_type === "system" ? "System" : "User";
  return (
    <div className="flex gap-3">
      <div className="w-2 h-2 rounded-full bg-primary-500 mt-1 flex-shrink-0"></div>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900 capitalize">{label}</p>
        <p className="text-xs text-slate-500">
          {actor} · {formatDate(event.created_at)}
        </p>
      </div>
    </div>
  );
}

function CancelDialog({
  open, onClose, onConfirm, title, message
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  message: string;
}) {
  const [reason, setReason] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">{message}</p>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Enter a reason..."
          />
        </div>
        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(reason); setReason(""); }}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentDialog({
  invoice, amountDue, payAmount, onAmountChange, onConfirm, onCancel
}: {
  invoice: ApiInvoice;
  amountDue: Decimal;
  payAmount: string;
  onAmountChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isFull = new Decimal(payAmount || 0).eq(amountDue);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Record Payment</h3>
          <p className="text-sm text-slate-500 mt-1">
            Amount due: {formatCurrency(amountDue, invoice.currency)}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={payAmount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={amountDue.toFixed()}
            />
          </div>
          <button
            onClick={() => onAmountChange(amountDue.toFixed(2))}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Pay full amount ({formatCurrency(amountDue, invoice.currency)})
          </button>
          {isFull && <p className="text-xs text-green-600">This will fully pay the invoice.</p>}
        </div>
        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!payAmount || Number(payAmount) <= 0}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoiceDetailView({ invoice }: { invoice: ApiInvoice }) {
  const statusColor = STATUS_COLORS[invoice.status] || STATUS_COLORS.draft;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {invoice.invoice_number || "Draft Invoice"}
          </h2>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${statusColor}`}>
          {STATUS_LABELS[invoice.status] || invoice.status}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left text-xs font-medium text-slate-500 uppercase py-2">#</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase py-2">Description</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase py-2">Qty</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase py-2">Rate</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase py-2">Tax</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => {
              const lineTotal = new Decimal(item.quantity || 1).mul(item.unit_price || 0);
              return (
                <tr key={item.id || i} className="border-b border-slate-100">
                  <td className="py-2 text-sm text-slate-500">{i + 1}</td>
                  <td className="py-2 text-sm text-slate-900">{item.description || "—"}</td>
                  <td className="py-2 text-right text-sm text-slate-600">{item.quantity} {item.unit}</td>
                  <td className="py-2 text-right text-sm text-slate-600">{formatCurrency(item.unit_price, invoice.currency)}</td>
                  <td className="py-2 text-right text-sm text-slate-600">{Number(item.tax_rate) > 0 ? `${Number(new Decimal(item.tax_rate).mul(100)).toFixed(2)}%` : "-"}</td>
                  <td className="py-2 text-right text-sm font-medium text-slate-900">{formatCurrency(lineTotal, invoice.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <table className="w-64 border-collapse">
          <tbody>
            <tr>
              <td className="py-2 text-sm text-slate-600">Subtotal</td>
              <td className="py-2 text-right text-sm text-slate-900">{formatCurrency(invoice.subtotal, invoice.currency)}</td>
            </tr>
            {Number(invoice.discount_total) > 0 && (
              <tr>
                <td className="py-2 text-sm text-slate-600">Discount</td>
                <td className="py-2 text-right text-sm text-slate-900">-{formatCurrency(invoice.discount_total, invoice.currency)}</td>
              </tr>
            )}
            {Number(invoice.tax_total) > 0 && (
              <tr>
                <td className="py-2 text-sm text-slate-600">Tax</td>
                <td className="py-2 text-right text-sm text-slate-900">{formatCurrency(invoice.tax_total, invoice.currency)}</td>
              </tr>
            )}
            {Number(invoice.fee_total) > 0 && (
              <tr>
                <td className="py-2 text-sm text-slate-600">Fees</td>
                <td className="py-2 text-right text-sm text-slate-900">{formatCurrency(invoice.fee_total, invoice.currency)}</td>
              </tr>
            )}
            <tr className="border-t border-slate-200">
              <td className="py-3 text-lg font-semibold text-slate-900">Total</td>
              <td className="py-3 text-right text-lg font-bold text-slate-900">{formatCurrency(invoice.total, invoice.currency)}</td>
            </tr>
            <tr>
              <td className="py-2 text-sm text-slate-600">Paid</td>
              <td className="py-2 text-right text-sm text-slate-900">{formatCurrency(invoice.amount_paid, invoice.currency)}</td>
            </tr>
            <tr>
              <td className="py-2 text-sm font-semibold text-slate-900">Amount Due</td>
              <td className="py-2 text-right text-lg font-bold text-primary-700">{formatCurrency(invoice.amount_due, invoice.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {invoice.notes && <p className="mt-6 text-sm text-slate-700 whitespace-pre-line">{invoice.notes}</p>}
      {invoice.payment_instructions && (
        <div className="mt-4 bg-slate-50 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Payment Instructions</h4>
          <p className="text-sm text-slate-700 whitespace-pre-line">{invoice.payment_instructions}</p>
        </div>
      )}
    </div>
  );
}
