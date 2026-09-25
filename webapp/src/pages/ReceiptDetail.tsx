import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  getReceiptDetail,
  getReceiptPdf,
  type ApiReceiptDetail,
  type ApiReceiptItem,
  type ApiReceiptPayment,
} from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import { Button } from "../components/ui/Button";
import {
  Download,
  Mail,
  Copy,
  ExternalLink,
  MoreVertical,
  RefreshCw,
  ArrowLeft,
  FileText,
  Trash2,
} from "lucide-react";
import PaymentStatus from "../components/ui/PaymentStatus";
import { useToast } from "../components/ui/ToastProvider";
import EmailReceiptModal from "../components/EmailReceiptModal";
import RefundReceiptModal from "../components/RefundReceiptModal";
import { ConfirmationDialog } from "../components/ui/ConfirmationDialog";

type ActionMenuState = "closed" | "email" | "refund" | "delete";

export default function ReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [receipt, setReceipt] = useState<ApiReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState<ActionMenuState>("closed");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (id) loadReceipt();
  }, [id]);

  async function loadReceipt() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { receipt } = await getReceiptDetail(id);
      setReceipt(receipt);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { error?: string } } };
      if (error?.response?.status === 404) {
        navigate("/app/receipts");
      } else {
        setError(error?.response?.data?.error || "Failed to load receipt");
      }
    } finally {
      setLoading(false);
    }
  }

  const handleDownloadPdf = useCallback(async () => {
    if (!receipt) return;
    setDownloadingPdf(true);
    try {
      const blob = await getReceiptPdf(receipt.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const fileName = `receipt-${receipt.receipt_number ?? receipt.id.slice(0, 8)}.pdf`;
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
      toast("PDF downloaded successfully", { type: "success" });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast(error?.response?.data?.error || "Failed to download PDF", { type: "error" });
    } finally {
      setDownloadingPdf(false);
    }
  }, [receipt, toast]);

  const handleCopyReceiptNumber = useCallback(async () => {
    if (!receipt?.receipt_number) return;
    try {
      await navigator.clipboard.writeText(receipt.receipt_number);
      toast("Receipt number copied to clipboard", { type: "success" });
    } catch {
      toast("Failed to copy receipt number", { type: "error" });
    }
    setShowActionMenu("closed");
  }, [receipt, toast]);

  const handleViewInvoice = useCallback(() => {
    if (!receipt?.invoice_id) return;
    navigate(`/app/invoices/${receipt.invoice_id}`);
    setShowActionMenu("closed");
  }, [receipt, navigate]);

  const handleViewInProvider = useCallback(() => {
    if (!receipt?.provider_receipt_url) return;
    window.open(receipt.provider_receipt_url, "_blank", "noopener,noreferrer");
    setShowActionMenu("closed");
  }, [receipt]);

  const handleEmailSent = () => {
    loadReceipt();
  };

  const handleRefundProcessed = () => {
    loadReceipt();
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
    setShowActionMenu("closed");
  };

  const confirmDelete = async () => {
    if (!receipt) return;
    try {
      await fetch(`/api/receipts/${receipt.id}`, {
        method: "DELETE",
      });
      toast("Receipt deleted", { type: "success" });
      navigate("/app/receipts");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast(error?.response?.data?.error || "Failed to delete receipt", { type: "error" });
    } finally {
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-secondary">Loading receipt…</div>;
  }

  if (!receipt) {
    return (
      <div className="p-6 text-center text-secondary">
        {error && <p className="text-sm status-error-text">{error}</p>}
        {!error && <p>Receipt not found.</p>}
      </div>
    );
  }

  const payment: ApiReceiptPayment | null = receipt.payment ?? null;
  const items: ApiReceiptItem[] = receipt.items ?? [];
  const canRefund = payment && payment.status === "succeeded" && payment.provider === "stripe";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/receipts" className="text-secondary hover:text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-primary">
            {receipt.receipt_number || `#${receipt.id.slice(0, 8)}`}
          </h1>
          <PaymentStatus status={receipt.status} showIcon />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="hidden sm:inline-flex"
          >
            {downloadingPdf ? "Downloading…" : "Download PDF"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Mail className="w-4 h-4" />}
            onClick={() => setShowEmailModal(true)}
            className="hidden sm:inline-flex"
          >
            Email
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<MoreVertical className="w-4 h-4" />}
            onClick={() => setShowActionMenu(showActionMenu === "closed" ? "email" : "closed")}
            aria-label="More actions"
          />
        </div>
      </div>

      {/* Error / Status Banner */}
      {error && (
        <div className="p-3 status-error-bg border status-error-border rounded-lg">
          <p className="text-sm status-error-text">{error}</p>
        </div>
      )}

      {/* Status Banner */}
      {receipt.status === "sent" && receipt.sent_to && (
        <div className="p-3 status-success-bg border status-success-border rounded-lg">
          <p className="text-sm status-success-text">
            Receipt emailed to <strong>{receipt.sent_to}</strong> on {formatDate(receipt.updated_at)}.
          </p>
        </div>
      )}

      {receipt.status === "issued" && (
        <div className="p-3 status-info-bg border status-info-border rounded-lg">
          <p className="text-sm status-info-text">
            Receipt issued on {receipt.issued_at ? formatDate(receipt.issued_at) : "—"}.
          </p>
        </div>
      )}

      {receipt.status === "failed" && (
        <div className="p-3 status-error-bg border status-error-border rounded-lg">
          <p className="text-sm status-error-text">
            Receipt generation or delivery failed. Please retry or contact support.
          </p>
        </div>
      )}

      {/* Action Menu (Dropdown) */}
      {showActionMenu !== "closed" && (
        <div className="fixed inset-0 z-10" onClick={() => setShowActionMenu("closed")}>
          <div
            className="absolute top-20 right-4 z-20 w-48 bg-surface border border-color-subtle rounded-lg shadow-lg py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setShowEmailModal(true); setShowActionMenu("closed"); }}
              className="flex items-center w-full px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface-alt"
            >
              <Mail className="h-4 w-4 mr-2" />
              Email Receipt
            </button>
            <button
              onClick={handleCopyReceiptNumber}
              className="flex items-center w-full px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface-alt"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Receipt Number
            </button>
            <button
              onClick={handleViewInvoice}
              className="flex items-center w-full px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface-alt"
            >
              <FileText className="h-4 w-4 mr-2" />
              View Invoice
            </button>
            {receipt.provider_receipt_url && (
              <button
                onClick={handleViewInProvider}
                className="flex items-center w-full px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface-alt"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Provider
              </button>
            )}
            <hr className="my-1 border-color-subtle" />
            {canRefund && (
              <button
                onClick={() => { setShowRefundModal(true); setShowActionMenu("closed"); }}
                className="flex items-center w-full px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface-alt"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Request Refund
              </button>
            )}
            <button
              onClick={handleDelete}
              className="flex items-center w-full px-3 py-2 text-sm status-error-text hover:bg-surface-alt"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Receipt
            </button>
          </div>
        </div>
      )}

      {/* Mobile Action Bar */}
      <div className="sm:hidden flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="w-4 h-4" />}
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          className="flex-1"
        >
          PDF
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Mail className="w-4 h-4" />}
          onClick={() => setShowEmailModal(true)}
          className="flex-1"
        >
          Email
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<MoreVertical className="w-4 h-4" />}
          onClick={() => setShowActionMenu("email")}
          className="flex-1"
        >
          More
        </Button>
      </div>

      {/* Two-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Receipt & Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Receipt Details */}
          <div className="bg-surface rounded-xl border border-color-subtle p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">Receipt Details</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-tertiary">Receipt Number</dt>
                <dd className="text-primary font-medium mt-0.5 flex items-center gap-2">
                  {receipt.receipt_number || "—"}
                  {receipt.receipt_number && (
                    <button
                      onClick={handleCopyReceiptNumber}
                      className="text-xs text-tertiary hover:text-primary"
                      title="Copy receipt number"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-tertiary">Order ID</dt>
                <dd className="text-primary mt-0.5">
                  {receipt.invoice_id ? (
                    <Link
                      to={`/app/invoices/${receipt.invoice_id}`}
                      className="text-primary-brand hover:underline"
                    >
                      {receipt.invoice_number || `#${receipt.invoice_id.slice(0, 8)}`}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-tertiary">Date Issued</dt>
                <dd className="text-primary mt-0.5">
                  {receipt.issued_at ? formatDate(receipt.issued_at) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-tertiary">Due Date</dt>
                <dd className="text-primary mt-0.5">
                  {receipt.invoice_due_date ? formatDate(receipt.invoice_due_date) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-tertiary">Status</dt>
                <dd className="mt-0.5">
                  <PaymentStatus status={receipt.status} showIcon showLabel />
                </dd>
              </div>
              <div>
                <dt className="text-tertiary">Currency</dt>
                <dd className="text-primary mt-0.5">{receipt.currency}</dd>
              </div>
            </dl>

            {receipt.invoice_notes && (
              <div className="mt-4 pt-4 border-t border-color-subtle">
                <dt className="text-tertiary text-sm">Notes</dt>
                <dd className="text-primary mt-1 whitespace-pre-line text-sm">
                  {receipt.invoice_notes}
                </dd>
              </div>
            )}
          </div>

          {/* Itemized List */}
          <div className="bg-surface rounded-xl border border-color-subtle p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-color-subtle">
                    <th className="text-left text-xs font-medium text-tertiary uppercase py-2">Description</th>
                    <th className="text-right text-xs font-medium text-tertiary uppercase py-2">Qty</th>
                    <th className="text-right text-xs font-medium text-tertiary uppercase py-2">Unit Price</th>
                    <th className="text-right text-xs font-medium text-tertiary uppercase py-2">Tax</th>
                    <th className="text-right text-xs font-medium text-tertiary uppercase py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-tertiary">
                        No line items available for this receipt.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, i) => (
                      <tr key={item.description || i} className="border-b border-color-subtle last:border-b-0">
                        <td className="py-2 text-sm text-primary">{item.description || "—"}</td>
                        <td className="py-2 text-right text-sm text-secondary">
                          {item.quantity} {item.unit || ""}
                        </td>
                        <td className="py-2 text-right text-sm text-secondary">
                          {formatCurrency(item.unit_price, receipt.currency)}
                        </td>
                        <td className="py-2 text-right text-sm text-secondary">
                          {Number(item.tax_rate) > 0
                            ? `${(Number(item.tax_rate) * 100).toFixed(2)}%`
                            : "—"}
                        </td>
                        <td className="py-2 text-right text-sm font-medium text-primary">
                          {formatCurrency(item.line_total, receipt.currency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <table className="w-64 border-collapse text-sm">
                <tbody>
                  <tr>
                    <td className="py-2 text-tertiary">Subtotal</td>
                    <td className="py-2 text-right text-primary">
                      {formatCurrency(receipt.invoice_subtotal || "0", receipt.currency)}
                    </td>
                  </tr>
                  {Number(receipt.invoice_discount_total || 0) > 0 && (
                    <tr>
                      <td className="py-2 text-tertiary">Discount</td>
                      <td className="py-2 text-right text-primary">
                        -{formatCurrency(receipt.invoice_discount_total || "0", receipt.currency)}
                      </td>
                    </tr>
                  )}
                  {Number(receipt.invoice_tax_total || 0) > 0 && (
                    <tr>
                      <td className="py-2 text-tertiary">Tax</td>
                      <td className="py-2 text-right text-primary">
                        {formatCurrency(receipt.invoice_tax_total || "0", receipt.currency)}
                      </td>
                    </tr>
                  )}
                  {Number(receipt.invoice_fee_total || 0) > 0 && (
                    <tr>
                      <td className="py-2 text-tertiary">Fees</td>
                      <td className="py-2 text-right text-primary">
                        {formatCurrency(receipt.invoice_fee_total || "0", receipt.currency)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-color-subtle">
                    <td className="py-3 text-lg font-semibold text-primary">Total</td>
                    <td className="py-3 text-right text-lg font-bold text-primary">
                      {formatCurrency(receipt.invoice_total || "0", receipt.currency)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-tertiary">Amount Paid</td>
                    <td className="py-2 text-right text-primary">
                      {formatCurrency(receipt.invoice_amount_paid || "0", receipt.currency)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-tertiary">Balance Due</td>
                    <td className="py-2 text-right font-medium text-primary">
                      {formatCurrency(receipt.invoice_amount_due || "0", receipt.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Payment Details */}
        <div className="space-y-6">
          {/* Payment Details Card */}
          <div className="bg-surface rounded-xl border border-color-subtle p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">Payment Details</h2>
            {payment ? (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-tertiary">Payment ID</dt>
                  <dd className="text-primary mt-0.5 font-mono text-xs">
                    {payment.id}
                  </dd>
                </div>
                <div>
                  <dt className="text-tertiary">Provider</dt>
                  <dd className="text-primary mt-0.5 capitalize">{payment.provider}</dd>
                </div>
                <div>
                  <dt className="text-tertiary">Payment Method</dt>
                  <dd className="text-primary mt-0.5">
                    {payment.method ? (
                      payment.method.charAt(0).toUpperCase() + payment.method.slice(1)
                    ) : payment.provider ? (
                      <span className="capitalize">{payment.provider}</span>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-tertiary">Amount</dt>
                  <dd className="text-primary mt-0.5 font-medium">
                    {formatCurrency(payment.amount, payment.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-tertiary">Paid On</dt>
                  <dd className="text-primary mt-0.5">
                    {payment.paid_at ? formatDate(payment.paid_at) : "—"}
                  </dd>
                </div>
                {payment.provider_payment_id && (
                  <div>
                    <dt className="text-tertiary">Transaction Reference</dt>
                    <dd className="text-primary mt-0.5 font-mono text-xs">
                      {payment.provider_payment_id}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-tertiary">Status</dt>
                  <dd className="mt-0.5">
                    <PaymentStatus status={payment.status} showIcon showLabel size="sm" />
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-tertiary">No payment information available.</p>
            )}

            {canRefund && (
              <div className="mt-4 pt-4 border-t border-color-subtle">
                <Button
                  variant="danger"
                  size="sm"
                  icon={<RefreshCw className="w-4 h-4" />}
                  onClick={() => setShowRefundModal(true)}
                  className="w-full"
                >
                  Request Refund
                </Button>
              </div>
            )}
          </div>

          {/* Customer Details Card */}
          {(receipt.customer_name || receipt.customer_email) && (
            <div className="bg-surface rounded-xl border border-color-subtle p-6">
              <h2 className="text-lg font-semibold text-primary mb-4">Customer</h2>
              <dl className="space-y-2 text-sm">
                {receipt.customer_name && (
                  <div>
                    <dt className="text-tertiary">Name</dt>
                    <dd className="text-primary mt-0.5">{receipt.customer_name}</dd>
                  </div>
                )}
                {receipt.customer_email && (
                  <div>
                    <dt className="text-tertiary">Email</dt>
                    <dd className="text-primary mt-0.5">{receipt.customer_email}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Business Info Footer */}
          <div className="bg-surface rounded-xl border border-color-subtle p-4 text-center">
            <p className="text-xs text-tertiary">
              Receipt #{receipt.receipt_number} was issued by{" "}
              <strong className="text-secondary">{receipt.business_name || "your business"}</strong>.
            </p>
            <p className="text-xs text-tertiary mt-1">
              This document is digitally signed and serves as proof of payment.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EmailReceiptModal
        open={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onEmailSent={handleEmailSent}
        receipt={receipt}
      />

      <RefundReceiptModal
        open={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        onRefundProcessed={handleRefundProcessed}
          receipt={{
            id: receipt.id,
            receipt_number: receipt.receipt_number ?? null,
            amount: payment?.amount ?? receipt.amount,
            currency: receipt.currency,
          }}
        payment={payment}
      />

      <ConfirmationDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        title="Delete Receipt"
        message="Deleting this receipt will permanently remove the receipt record. The underlying payment will not be affected."
        confirmLabel="Delete Receipt"
        destructive
        inputRequiredMatch="delete"
        inputLabel='Type "delete" to confirm'
      />
    </div>
  );
}
