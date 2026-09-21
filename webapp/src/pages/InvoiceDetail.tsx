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
  recordDepositPayment,
} from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import { formatCurrencyValue } from "../lib/utils";
import type { ApiInvoice, ApiPayment, ApiInvoiceEvent, ApiPaymentIntent, ApiDepositInfo } from "../types/api";
import InvoiceStatus, { isOverdueStatus } from "../components/primitives/InvoiceStatus";
import { ConfirmationDialog } from "../components/primitives/ConfirmationDialog";

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
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string>("");

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

  const depositType = (invoice as any).deposit_type ?? "none";
  const depositValue = (invoice as any).deposit_value ?? "0";
  const depositDueDate = (invoice as any).deposit_due_date;
  const depositPaid = new Decimal((invoice as any).deposit_paid ?? 0);
  const depositDue = new Decimal((invoice as any).deposit_due ?? 0);
  const hasDeposit = depositType !== "none" && depositDue.gt(0);

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

  async function handleRecordDeposit() {
    if (!id || !depositAmount) return;
    try {
      await recordDepositPayment(id, {
        amount: Number(depositAmount),
        provider: "stub",
      });
      setActionMessage("Deposit payment recorded successfully!");
      setShowDepositDialog(false);
      setDepositAmount("");
      loadInvoice();
    } catch (err: any) {
      setActionMessage(err.message || err.response?.data?.error || "Failed to record deposit");
    }
  }

  if (loading) return <div className="text-center py-20 text-secondary">Loading invoice...</div>;
  if (!invoice) return <div className="text-center py-20 text-secondary">Invoice not found</div>;

  const isOverdue = isOverdueStatus(invoice.status, invoice.due_date);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/app/invoices" className="text-secondary hover:text-secondary">
            &larr; Back to Invoices
          </Link>
          <h1 className="text-2xl font-bold text-primary">
            {invoice.invoice_number || `Draft #${invoice.id.slice(0, 8)}`}
          </h1>
          <InvoiceStatus status={invoice.status} isOverdue={isOverdue} showIcon />
        </div>

        <div className="flex gap-2">
          <Link
            to={`/app/invoices/${invoice.id}/edit`}
            className="rounded-lg border border-input-border px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
          >
            Edit
          </Link>
          <button
            onClick={handleDuplicate}
            className="rounded-lg border border-input-border px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
          >
            Duplicate
          </button>
          <button
            onClick={handleDownloadPdf}
            className="rounded-lg border border-input-border px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
          >
            Download PDF
          </button>
          {canSendReminder && (
            <button
              onClick={handleSendReminder}
              className="rounded-lg border border-input-border px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
            >
              Send Reminder
            </button>
          )}
          {!isFullyPaid && amountDue.gt(0) && invoice.status !== "draft" && invoice.status !== "cancelled" && invoice.status !== "void" && (
            <button
              onClick={() => setShowPayDialog(true)}
              className="rounded-lg bg-primary-action px-3 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
            >
              Record Payment
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setShowCancelDialog(true)}
              className="rounded-lg border border-input-border px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
            >
              Cancel
            </button>
          )}
          {canVoid && (
            <button
              onClick={() => setShowVoidDialog(true)}
              className="rounded-lg border border-input-border px-3 py-2 text-sm font-medium status-error-text hover:status-error-bg"
            >
              Void
            </button>
          )}
          {hasDeposit && depositDue.gt(0) && invoice.status !== "draft" && invoice.status !== "cancelled" && invoice.status !== "void" && (
            <button
              onClick={() => setShowDepositDialog(true)}
              className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-on-primary hover:bg-orange-700"
            >
              Record Deposit
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className="rounded-lg border border-color-subtle bg-surface-alt px-3 py-2 text-sm text-secondary">
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
          {hasDeposit && (
            <>
              <SummaryCard
                title="Deposit Due"
                value={formatCurrency(depositDue, invoice.currency)}
                subtitle="Deposit outstanding"
              />
              <SummaryCard
                title="Deposit Paid"
                value={formatCurrency(depositPaid, invoice.currency)}
                subtitle="Deposit received"
              />
              <InfoRow label="Deposit Type" value={depositType === "fixed" ? "Fixed Amount" : depositType === "percentage" ? `${depositValue}%` : "None"} />
              {depositDueDate && <InfoRow label="Deposit Due Date" value={formatDate(depositDueDate)} />}
            </>
          )}
          <InfoRow label="Issue date" value={invoice.issue_date ? formatDate(invoice.issue_date) : "—"} />
          <InfoRow label="Due date" value={invoice.due_date ? formatDate(invoice.due_date) : "—"} />
          <InfoRow label="Currency" value={invoice.currency} />
          {invoice.sent_at && <InfoRow label="Sent" value={formatDate(invoice.sent_at)} />}
          {invoice.paid_at && <InfoRow label="Paid" value={formatDate(invoice.paid_at)} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border border-color-subtle p-5">
          <h3 className="text-lg font-semibold text-primary mb-4">Payment History</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-secondary">No payments recorded yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-color-subtle">
                  <th className="text-left text-xs font-medium text-secondary uppercase py-2">Date</th>
                  <th className="text-left text-xs font-medium text-secondary uppercase py-2">Amount</th>
                  <th className="text-left text-xs font-medium text-secondary uppercase py-2">Method</th>
                  <th className="text-left text-xs font-medium text-secondary uppercase py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-color-subtle last:border-b-0">
                    <td className="py-2 text-sm text-secondary">{p.paid_at ? formatDate(p.paid_at) : formatDate(p.created_at)}</td>
                    <td className="py-2 text-sm font-medium text-primary">{formatCurrency(p.amount, p.currency)}</td>
                    <td className="py-2 text-sm text-secondary">{p.method || p.provider || "-"}</td>
                    <td className="py-2 text-sm text-secondary capitalize">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-surface rounded-xl border border-color-subtle p-5">
          <h3 className="text-lg font-semibold text-primary mb-4">Activity Timeline</h3>
          {events.length === 0 ? (
            <p className="text-sm text-secondary">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {events.map((e) => (
                <TimelineItem key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={(data) => handleCancel(data?.reason ?? "")}
        title="Cancel Invoice"
        message="Cancelling this invoice will prevent further payments. The invoice will remain visible for record-keeping."
        confirmLabel="Cancel Invoice"
        destructive={false}
        showInput
        inputLabel="Reason (optional)"
        inputPlaceholder="Enter a reason..."
      />
      <ConfirmationDialog
        open={showVoidDialog}
        onClose={() => setShowVoidDialog(false)}
        onConfirm={(data) => handleVoid(data?.reason ?? "")}
        title="Void Invoice"
        message="Voiding this invoice will mark it as invalid. This action cannot be undone."
        confirmLabel="Void Invoice"
        destructive
        showInput
        inputLabel="Reason (optional)"
        inputPlaceholder="Enter a reason..."
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

      {showDepositDialog && (
        <DepositDialog
          invoice={invoice}
          depositDue={depositDue}
          depositAmount={depositAmount}
          onAmountChange={setDepositAmount}
          onConfirm={handleRecordDeposit}
          onCancel={() => setShowDepositDialog(false)}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-color-subtle">
      <span className="text-sm text-secondary">{label}</span>
      <span className="text-sm text-primary">{value}</span>
    </div>
  );
}

function SummaryCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="bg-surface rounded-xl border border-color-subtle p-4">
      <p className="text-xs font-medium text-secondary uppercase">{title}</p>
      <p className="text-xl font-bold text-primary mt-1">{value}</p>
      <p className="text-xs text-secondary mt-1">{subtitle}</p>
    </div>
  );
}

function TimelineItem({ event }: { event: ApiInvoiceEvent }) {
  const label = event.event_type.replace(/_/g, " ");
  const actor = event.actor_type === "customer" ? "Customer" : event.actor_type === "payment" ? "Payment" : event.actor_type === "system" ? "System" : "User";
  return (
    <div className="flex gap-3">
      <div className="w-2 h-2 rounded-full bg-primary-action mt-1 flex-shrink-0"></div>
      <div className="flex-1">
        <p className="text-sm font-medium text-primary capitalize">{label}</p>
        <p className="text-xs text-secondary">
          {actor} · {formatDate(event.created_at)}
        </p>
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
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6 border-b border-color-subtle">
          <h3 className="text-lg font-semibold text-primary">Record Payment</h3>
          <p className="text-sm text-secondary mt-1">
            Amount due: {formatCurrency(amountDue, invoice.currency)}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={payAmount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full text-sm border border-input-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={amountDue.toFixed()}
            />
          </div>
          <button
            onClick={() => onAmountChange(amountDue.toFixed(2))}
            className="text-sm text-primary-brand hover:text-primary-brand"
          >
            Pay full amount ({formatCurrency(amountDue, invoice.currency)})
          </button>
          {isFull && <p className="text-xs status-success-text">This will fully pay the invoice.</p>}
        </div>
        <div className="p-6 border-t border-color-subtle flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt rounded-lg">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!payAmount || Number(payAmount) <= 0}
            className="px-4 py-2 text-sm font-medium text-on-primary bg-primary-action rounded-lg hover:bg-primary-hover disabled:opacity-50"
          >
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

function DepositDialog({
  invoice, depositDue, depositAmount, onAmountChange, onConfirm, onCancel
}: {
  invoice: ApiInvoice;
  depositDue: Decimal;
  depositAmount: string;
  onAmountChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isFull = new Decimal(depositAmount || 0).eq(depositDue);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6 border-b border-color-subtle">
          <h3 className="text-lg font-semibold text-primary">Record Deposit Payment</h3>
          <p className="text-sm text-secondary mt-1">
            Deposit due: {formatCurrency(depositDue, invoice.currency)}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={depositAmount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full text-sm border border-input-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={depositDue.toFixed()}
            />
          </div>
          <button
            onClick={() => onAmountChange(depositDue.toFixed(2))}
            className="text-sm text-primary-brand hover:text-primary-brand"
          >
            Pay full deposit ({formatCurrency(depositDue, invoice.currency)})
          </button>
          {isFull && <p className="text-xs status-success-text">This will fully pay the deposit.</p>}
        </div>
        <div className="p-6 border-t border-color-subtle flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt rounded-lg">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!depositAmount || Number(depositAmount) <= 0}
            className="px-4 py-2 text-sm font-medium text-on-primary bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            Record Deposit
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoiceDetailView({ invoice }: { invoice: ApiInvoice }) {
  const isOverdue = isOverdueStatus(invoice.status, invoice.due_date);
  return (
    <div className="bg-surface rounded-xl border border-color-subtle p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-primary">
            {invoice.invoice_number || "Draft Invoice"}
          </h2>
        </div>
        <InvoiceStatus status={invoice.status} isOverdue={isOverdue} showIcon />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-color-subtle">
              <th className="text-left text-xs font-medium text-secondary uppercase py-2">#</th>
              <th className="text-left text-xs font-medium text-secondary uppercase py-2">Description</th>
              <th className="text-right text-xs font-medium text-secondary uppercase py-2">Qty</th>
              <th className="text-right text-xs font-medium text-secondary uppercase py-2">Rate</th>
              <th className="text-right text-xs font-medium text-secondary uppercase py-2">Tax</th>
              <th className="text-right text-xs font-medium text-secondary uppercase py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => {
              const lineTotal = new Decimal(item.quantity || 1).mul(item.unit_price || 0);
              return (
                <tr key={item.id || i} className="border-b border-color-subtle">
                  <td className="py-2 text-sm text-secondary">{i + 1}</td>
                  <td className="py-2 text-sm text-primary">{item.description || "—"}</td>
                  <td className="py-2 text-right text-sm text-secondary">{item.quantity} {item.unit}</td>
                  <td className="py-2 text-right text-sm text-secondary">{formatCurrency(item.unit_price, invoice.currency)}</td>
                  <td className="py-2 text-right text-sm text-secondary">{Number(item.tax_rate) > 0 ? `${Number(new Decimal(item.tax_rate).mul(100)).toFixed(2)}%` : "-"}</td>
                  <td className="py-2 text-right text-sm font-medium text-primary">{formatCurrency(lineTotal, invoice.currency)}</td>
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
              <td className="py-2 text-sm text-secondary">Subtotal</td>
              <td className="py-2 text-right text-sm text-primary">{formatCurrency(invoice.subtotal, invoice.currency)}</td>
            </tr>
            {Number(invoice.discount_total) > 0 && (
              <tr>
                <td className="py-2 text-sm text-secondary">Discount</td>
                <td className="py-2 text-right text-sm text-primary">-{formatCurrency(invoice.discount_total, invoice.currency)}</td>
              </tr>
            )}
            {Number(invoice.tax_total) > 0 && (
              <tr>
                <td className="py-2 text-sm text-secondary">Tax</td>
                <td className="py-2 text-right text-sm text-primary">{formatCurrency(invoice.tax_total, invoice.currency)}</td>
              </tr>
            )}
            {Number(invoice.fee_total) > 0 && (
              <tr>
                <td className="py-2 text-sm text-secondary">Fees</td>
                <td className="py-2 text-right text-sm text-primary">{formatCurrency(invoice.fee_total, invoice.currency)}</td>
              </tr>
            )}
            <tr className="border-t border-color-subtle">
              <td className="py-3 text-lg font-semibold text-primary">Total</td>
              <td className="py-3 text-right text-lg font-bold text-primary">{formatCurrency(invoice.total, invoice.currency)}</td>
            </tr>
            <tr>
              <td className="py-2 text-sm text-secondary">Paid</td>
              <td className="py-2 text-right text-sm text-primary">{formatCurrency(invoice.amount_paid, invoice.currency)}</td>
            </tr>
            <tr>
              <td className="py-2 text-sm font-semibold text-primary">Amount Due</td>
              <td className="py-2 text-right text-lg font-bold text-primary-brand">{formatCurrency(invoice.amount_due, invoice.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {invoice.notes && <p className="mt-6 text-sm text-secondary whitespace-pre-line">{invoice.notes}</p>}
      {invoice.payment_instructions && (
        <div className="mt-4 bg-surface-alt rounded-lg p-4">
          <h4 className="text-xs font-semibold text-secondary uppercase mb-1">Payment Instructions</h4>
          <p className="text-sm text-secondary whitespace-pre-line">{invoice.payment_instructions}</p>
        </div>
      )}
    </div>
  );
}





