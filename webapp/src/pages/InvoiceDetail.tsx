import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  getInvoice,
  getInvoicePdf,
  getInvoicePayments,
  getInvoiceEvents,
  getBusiness,
  sendReminder,
  cancelInvoice,
  voidInvoice,
  duplicateInvoice,
  createPaymentIntent,
  payInvoicePublic,
  recordPublicView,
  recordDepositPayment,
  generateInvoiceReceipt,
  getReceiptPdf,
} from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import { formatCurrencyValue } from "../lib/utils";
import type { ApiInvoice, ApiPayment, ApiInvoiceEvent, ApiPaymentIntent, ApiDepositInfo, ApiBusiness } from "../types/api";
import { InvoiceLifecycle, StatusBadge, invoiceStatusConfig, isOverdueStatus } from "@/components/ui";
import { Button } from "../components/ui/Button";
import { ConfirmationDialog } from "../components/ui/ConfirmationDialog";
import PaymentDialog from "../components/payments/PaymentDialog";
import DepositDialog from "../components/payments/DepositDialog";
import { AlertCircle, Check, Copy, Building2, Phone, Mail, Globe, MapPin } from "lucide-react";

const AlertCircleIcon = AlertCircle;
const CheckIcon = Check;

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<ApiInvoice | null>(null);
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [events, setEvents] = useState<ApiInvoiceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payAmount, setPayAmount] = useState<string>("");
  const [paymentIntent, setPaymentIntent] = useState<ApiPaymentIntent | null>(null);
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
      const [invRes, payRes, evRes, bizRes] = await Promise.allSettled([
        getInvoice(id),
        getInvoicePayments(id),
        getInvoiceEvents(id),
        getBusiness(),
      ]);
      if (invRes.status === "fulfilled") setInvoice(invRes.value.invoice);
      if (payRes.status === "fulfilled") setPayments(payRes.value.payments ?? []);
      if (evRes.status === "fulfilled") setEvents(evRes.value.events ?? []);
      if (bizRes.status === "fulfilled") setBusiness(bizRes.value);
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

  const depositType = invoice?.deposit_type ?? "none";
  const depositValue = invoice?.deposit_value ?? "0";
  const depositDueDate = invoice?.deposit_due_date;
  const depositPaid = new Decimal(invoice?.deposit_paid ?? 0);
  const depositDue = new Decimal(invoice?.deposit_due ?? 0);
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

  async function handleGenerateReceipt() {
    if (!id) return;
    try {
      const result = await generateInvoiceReceipt(id);
      const receiptId = result.receiptId ?? result.id;
      if (!receiptId) {
        setActionMessage("Receipt generated but no ID returned");
        return;
      }
      const blob = await getReceiptPdf(receiptId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${invoice?.invoice_number ?? id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      setActionMessage("Receipt generated and downloaded!");
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || "Failed to generate receipt");
    }
  }

  async function handleRecordPayment() {
    if (!id || !payAmount) return;
    try {
      const intent: ApiPaymentIntent = await createPaymentIntent(id);
      setPaymentIntent(intent);
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || "Failed to create payment intent");
    }
  }

  async function handlePaymentSuccess() {
    setActionMessage("Payment recorded successfully!");
    setShowPayDialog(false);
    setPayAmount("");
    setPaymentIntent(null);
    loadInvoice();
  }

  async function handlePaymentError(errorMsg: string) {
    setActionMessage(errorMsg);
  }

  async function handleStubPayment() {
    if (!invoice?.public_token || !payAmount) return;
    try {
      const amountDecimal = new Decimal(payAmount);
      await payInvoicePublic(invoice.public_token, {
        amount: Number(amountDecimal.toNumber()),
        provider: "stub",
      });
      handlePaymentSuccess();
    } catch (err: any) {
      setActionMessage(err.response?.data?.error || "Failed to record payment");
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

  const renderContextualAction = () => {
    if (invoice.status === "void" || invoice.status === "cancelled") {
      const label = invoice.status === "void" ? "Voided" : "Cancelled";
      return (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-full status-tertiary-bg">
            <AlertCircleIcon className="h-5 w-5 status-tertiary-text" />
          </span>
          <div>
            <p className="text-lg font-semibold text-tertiary">Invoice {label}</p>
            <p className="text-sm text-tertiary">
              {invoice.cancelled_reason || "—"}
            </p>
          </div>
        </div>
      );
    }

    if (invoice.status === "draft") {
      return (
        <Link
          to={`/app/invoices/${invoice.id}/edit`}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          Edit &amp; Send
        </Link>
      );
    }

    if (invoice.status === "paid" && isFullyPaid) {
      return (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-full status-success-bg">
            <CheckIcon className="h-5 w-5 status-success-text" />
          </span>
          <div>
            <p className="text-lg font-semibold status-success-text">Paid in full</p>
            <p className="text-sm text-tertiary">
              {invoice.paid_at ? formatDate(invoice.paid_at) : "—"}
            </p>
          </div>
        </div>
      );
    }

    if (isOverdue) {
      const daysOverdue = invoice.due_date
        ? Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return (
        <div className="flex items-center gap-3">
          <AlertCircleIcon className="h-5 w-5 text-error-text" />
          <div>
            <p className="text-lg font-semibold text-error-text">
              {formatCurrencyValue(invoice.amount_due, invoice.currency)} is {daysOverdue} {daysOverdue === 1 ? "day" : "days"} overdue
            </p>
            <p className="text-sm text-tertiary">Due {invoice.due_date ? formatDate(invoice.due_date) : "—"}</p>
          </div>
        </div>
      );
    }

    if (!isFullyPaid && amountDue.gt(0)) {
      return (
        <button
          onClick={() => setShowPayDialog(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          Record Payment
        </button>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/app/invoices" className="text-tertiary hover:text-primary flex-shrink-0">
            &larr; Invoices
          </Link>
          <h1 className="text-2xl font-bold text-primary truncate">
            {invoice.invoice_number || `Draft #${invoice.id.slice(0, 8)}`}
          </h1>
          <StatusBadge
            status={invoice.status}
            isOverdue={isOverdue}
            showLabel={true}
            config={invoiceStatusConfig}
            size="sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/app/invoices/${invoice.id}/edit`}
            className="rounded-lg border border-input-border px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-alt min-h-[40px]"
          >
            Edit
          </Link>
          <Button variant="secondary" size="sm" onClick={handleDuplicate}>
            Duplicate
          </Button>
          <Button variant="secondary" size="sm" icon={<Copy className="h-4 w-4" />} onClick={handleDownloadPdf}>
            Download PDF
          </Button>
          {invoice.status === "paid" && (
            <Button variant="secondary" size="sm" onClick={handleGenerateReceipt}>
              Generate Receipt
            </Button>
          )}
          {canSendReminder && (
            <Button variant="secondary" size="sm" icon={<AlertCircle className="h-4 w-4" />} onClick={handleSendReminder}>
              Send Reminder
            </Button>
          )}
          {canCancel && (
            <Button variant="secondary" size="sm" onClick={() => setShowCancelDialog(true)}>
              Cancel
            </Button>
          )}
          {canVoid && (
            <Button variant="danger" size="sm" onClick={() => setShowVoidDialog(true)}>
              Void
            </Button>
          )}
          {hasDeposit && depositDue.gt(0) && invoice.status !== "draft" && invoice.status !== "cancelled" && invoice.status !== "void" && (
            <Button variant="warning" size="sm" onClick={() => setShowDepositDialog(true)}>
              Record Deposit
            </Button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div
          className="rounded-lg border status-error-border status-error-bg px-3 py-2 text-sm status-error-text"
          role="alert"
          aria-live="polite"
        >
          {actionMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BusinessInfoSection business={business} />
          <CustomerBillingSection invoice={invoice} />
          <InvoiceDetailView invoice={invoice} />
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-color bg-surface p-5 text-center shadow-sm">
            {renderContextualAction()}
          </div>

          <div className="rounded-xl border border-color bg-surface p-5 shadow-sm">
            <h3 className="invoice-section-title mb-3">Invoice details</h3>
            <div className="space-y-2">
              <InfoRow label="Issue date" value={invoice.issue_date ? formatDate(invoice.issue_date) : "—"} />
              <InfoRow label="Due date" value={invoice.due_date ? formatDate(invoice.due_date) : "—"} />
              <InfoRow label="Currency" value={invoice.currency} />
              {invoice.sent_at && <InfoRow label="Sent" value={formatDate(invoice.sent_at)} />}
              {invoice.paid_at && <InfoRow label="Paid" value={formatDate(invoice.paid_at)} />}
              {hasDeposit && (
                <>
                  <InfoRow label="Deposit Type" value={depositType === "fixed" ? "Fixed Amount" : depositType === "percentage" ? `${depositValue}%` : "None"} />
                  {depositDueDate && <InfoRow label="Deposit Due Date" value={formatDate(depositDueDate)} />}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-color bg-surface p-5 shadow-sm">
          <h3 className="invoice-section-title mb-3">Payment History</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-secondary">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-color">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-alt">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tertiary">Date</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-tertiary">Amount</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-tertiary">Method</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-tertiary">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-color-subtle last:border-b-0">
                      <td className="px-4 py-2.5 text-sm text-secondary">
                        {p.paid_at ? formatDate(p.paid_at) : formatDate(p.created_at)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm font-medium text-primary font-tabular-nums">
                        {formatCurrency(p.amount, p.currency)}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-secondary">{p.method || p.provider || "—"}</td>
                      <td className="px-3 py-2.5 text-sm text-secondary capitalize">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-color bg-surface p-5 shadow-sm">
          <h3 className="invoice-section-title mb-3">Activity Timeline</h3>
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
          open={showPayDialog}
          invoice={invoice}
          amountDue={amountDue}
          payAmount={payAmount}
          onAmountChange={setPayAmount}
          paymentIntent={paymentIntent}
          onCreatePaymentIntent={handleRecordPayment}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentError={handlePaymentError}
          onCancel={() => { setShowPayDialog(false); setPaymentIntent(null); }}
        />
      )}

      {showDepositDialog && (
        <DepositDialog
          open={showDepositDialog}
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
    <div className="flex justify-between py-2.5 border-b border-color-subtle last:border-b-0">
      <span className="text-sm text-tertiary">{label}</span>
      <span className="text-sm font-medium text-primary" aria-label={label}>{value}</span>
    </div>
  );
}
function TimelineItem({ event }: { event: ApiInvoiceEvent }) {
  const label = (event.event_type ?? "").replace(/_/g, " ");
  const actor = event.actor_type === "customer" ? "Customer" : event.actor_type === "payment" ? "Payment" : event.actor_type === "system" ? "System" : "User";
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

function BusinessInfoSection({ business }: { business: ApiBusiness | null }) {
  if (!business) return null;
  const hasDetails =
    business.name ||
    business.email ||
    business.phone ||
    business.website ||
    business.taxId ||
    business.addressLine1;
  if (!hasDetails) return null;
  return (
    <div className="rounded-xl border border-color bg-surface p-6 shadow-sm mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Building2 className="h-5 w-5 text-tertiary flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h3 className="invoice-section-title mb-1">Seller</h3>
            <p className="text-lg font-semibold text-primary">{business.name}</p>
            {business.legalName && business.legalName !== business.name && (
              <p className="text-sm text-secondary">{business.legalName}</p>
            )}
          </div>
        </div>
        {business.logoUrl && (
          <img
            src={business.logoUrl}
            alt={business.name}
            className="h-12 w-auto object-contain"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>
      <div className="mt-3 space-y-1 text-sm">
        {business.email && (
          <div className="flex items-center gap-2 text-secondary">
            <Mail className="h-4 w-4 text-tertiary" />
            <a href={`mailto:${business.email}`} className="text-primary hover:text-primary-brand">
              {business.email}
            </a>
          </div>
        )}
        {business.phone && (
          <div className="flex items-center gap-2 text-secondary">
            <Phone className="h-4 w-4 text-tertiary" />
            <span>{business.phone}</span>
          </div>
        )}
        {business.website && (
          <div className="flex items-center gap-2 text-secondary">
            <Globe className="h-4 w-4 text-tertiary" />
            <a
              href={business.website.startsWith("http") ? business.website : `https://${business.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-brand"
            >
              {business.website}
            </a>
          </div>
        )}
        {(business.addressLine1 || business.city || business.stateOrRegion || business.postalCode || business.countryCode) && (
          <div className="flex items-start gap-2 text-secondary">
            <MapPin className="h-4 w-4 text-tertiary mt-0.5" />
            <address className="not-italic">
              {business.addressLine1}
              {business.addressLine2 && <><br />{business.addressLine2}</>}
              {business.city && <>{business.addressLine2 || business.addressLine1 ? ", " : ""}{business.city}</>}
              {business.stateOrRegion && <>{business.city || business.addressLine1 ? ", " : ""}{business.stateOrRegion}</>}
              {business.postalCode && <>{business.city || business.stateOrRegion ? " " : ""}{business.postalCode}</>}
              {business.countryCode && <br />}{business.countryCode}
            </address>
          </div>
        )}
        {business.taxId && (
          <div className="text-secondary">
            <span className="text-tertiary">Tax ID: </span>
            <span className="text-primary">{business.taxId}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerBillingSection({ invoice }: { invoice: ApiInvoice }) {
  const hasCustomer =
    invoice.customer_name ||
    invoice.customer_email ||
    invoice.customer_phone ||
    invoice.customer_address_line_1;

  return (
    <div className="rounded-xl border border-color bg-surface p-6 shadow-sm mb-6">
      <h3 className="invoice-section-title mb-4">Customer / Billing</h3>

      {hasCustomer ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-primary">
              {invoice.customer_name || "Unknown Customer"}
            </p>
            {invoice.customer_company_name && (
              <p className="text-sm text-secondary">{invoice.customer_company_name}</p>
            )}
            {invoice.customer_email && (
              <a
                href={`mailto:${invoice.customer_email}`}
                className="text-sm text-primary-brand hover:text-primary-hover"
              >
                {invoice.customer_email}
              </a>
            )}
            {invoice.customer_phone && (
              <p className="text-sm text-secondary">{invoice.customer_phone}</p>
            )}
          </div>
          {invoice.customer_address_line_1 && (
            <div>
              <address className="text-sm text-secondary not-italic">
                {invoice.customer_address_line_1}
                {invoice.customer_address_line_2 && <br />}
                {invoice.customer_address_line_2}
                <br />
                {[
                  invoice.customer_city,
                  invoice.customer_state_or_region,
                  invoice.customer_postal_code,
                ]
                  .filter(Boolean)
                  .join(", ")}
                {invoice.customer_country_code && (
                  <>
                    <br />
                    {invoice.customer_country_code}
                  </>
                )}
              </address>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm italic text-tertiary">No customer information available.</p>
      )}
    </div>
  );
}

function InvoiceDetailView({ invoice }: { invoice: ApiInvoice }) {
  const isOverdue = isOverdueStatus(invoice.status, invoice.due_date);
  const amountDue = new Decimal(invoice.amount_due ?? 0);

  return (
    <div className="rounded-xl border border-color bg-surface shadow-sm">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="invoice-title">{invoice.invoice_number || "Draft Invoice"}</h2>
              <StatusBadge
                status={invoice.status}
                isOverdue={isOverdue}
                showLabel={true}
                config={invoiceStatusConfig}
                size="md"
              />
            </div>
            <div className="mt-3">
              <InvoiceLifecycle status={invoice.status} isOverdue={isOverdue} />
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
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-tertiary">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => {
                const lineTotal = new Decimal(item.line_total ?? 0);
                return (
                  <tr key={item.id || i} className="border-t border-color-subtle">
                    <td className="px-4 py-3 text-center text-sm text-tertiary font-tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 text-sm text-primary">
                      {item.description || "—"}
                      {item.tax_rate && Number(new Decimal(item.tax_rate).mul(100)) > 0 && (
                        <span className="mt-0.5 block text-xs text-tertiary">
                          {item.is_tax_inclusive
                            ? `incl. ${new Decimal(item.tax_rate).mul(100).toFixed(2)}% tax${item.tax_name ? ` (${item.tax_name})` : ""}`
                            : `${new Decimal(item.tax_rate).mul(100).toFixed(2)}% tax${item.tax_name ? ` (${item.tax_name})` : ""}`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary text-right font-tabular-nums">
                      {formatQuantity(item.quantity)} {item.unit}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary text-right font-tabular-nums">
                      {formatCurrency(item.unit_price, invoice.currency)}
                    </td>
                    <td className="px-3 py-3 text-sm text-tertiary text-right font-tabular-nums">
                      {Number(item.tax_rate) > 0
                        ? `${new Decimal(item.tax_rate).mul(100).toFixed(2)}%${item.tax_name ? ` (${item.tax_name})` : ""}`
                        : "0%"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-primary font-tabular-nums">
                      {formatCurrency(lineTotal, invoice.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-72 space-y-1 font-tabular-nums">
            <div className="flex justify-between py-2.5 text-sm">
              <span className="text-tertiary">Subtotal</span>
              <span className="text-primary">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            {Number(invoice.discount_total) > 0 && (
              <div className="flex justify-between py-2.5 text-sm">
                <span className="text-tertiary">Discount</span>
                <span className="text-success-text">−{formatCurrency(invoice.discount_total, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between py-2.5 text-sm">
              <span className="text-tertiary">Tax</span>
              <span className="text-primary">
                {Number(invoice.tax_total) > 0
                  ? formatCurrency(invoice.tax_total, invoice.currency)
                  : formatCurrency(0, invoice.currency)}
              </span>
            </div>
            {Number(invoice.fee_total) > 0 && (
              <div className="flex justify-between py-2.5 text-sm">
                <span className="text-tertiary">Fees</span>
                <span className="text-primary">{formatCurrency(invoice.fee_total, invoice.currency)}</span>
              </div>
            )}
            <div className="border-t-2 border-color pt-3">
              <div className="flex justify-between">
                <span className="text-base font-semibold text-secondary">Total</span>
                <span className="text-2xl font-bold text-primary">{formatCurrency(invoice.total, invoice.currency)}</span>
              </div>
            </div>
            <div className="flex justify-between py-2.5 text-sm">
              <span className="text-tertiary">Paid</span>
              <span className="text-success-text">+{formatCurrency(invoice.amount_paid, invoice.currency)}</span>
            </div>
            <div className="border-t-2 border-color pt-3">
              <div className="flex justify-between">
                <span className="text-base font-semibold text-primary-brand">Amount Due</span>
                <span className="text-2xl font-bold text-primary-brand">{formatCurrency(amountDue, invoice.currency)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center pt-4 border-t border-color">
          <div className="flex gap-6">
            <InfoRow label="Issue date" value={invoice.issue_date ? formatDate(invoice.issue_date) : "—"} />
            <InfoRow label="Due date" value={invoice.due_date ? formatDate(invoice.due_date) : "—"} />
          </div>
          <InfoRow label="Currency" value={invoice.currency} />
        </div>

        {invoice.notes && <p className="mt-6 text-sm text-secondary whitespace-pre-line">{invoice.notes}</p>}
        {invoice.payment_instructions && (
          <div className="mt-4 rounded-lg bg-surface-alt p-4">
            <h4 className="invoice-section-title mb-1">Payment Instructions</h4>
            <p className="text-sm text-secondary whitespace-pre-line">{invoice.payment_instructions}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatQuantity(qty: string | undefined | null): string {
  const d = new Decimal(qty ?? 0);
  if (d.isZero()) return "0";
  return d.toFixed(2).replace(/\.?0+$/, "");
}





