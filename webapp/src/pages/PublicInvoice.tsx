import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicInvoice, recordPublicView, payInvoicePublic, getPublicInvoicePdf } from "../api/client";
import { formatCurrency } from "../utils/format";
import { Decimal } from "decimal.js";

interface PublicInvoiceData {
  id: string;
  invoice_number?: string | null;
  status: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  currency: string;
  due_date?: string | null;
  issue_date?: string | null;
  paid_at?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  payment_instructions?: string | null;
  notes?: string | null;
  public_token?: string | null;
}

export default function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<PublicInvoiceData | null>(null);
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payAmount, setPayAmount] = useState<string>("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      recordPublicView(token).catch(() => {});
      getPublicInvoice(token)
        .then((data) => {
          setInvoice(data.invoice);
          setHtml(data.html || "");
        })
        .catch(() => {
          setInvoice(null);
        })
        .finally(() => setLoading(false));
    }
  }, [token]);

  if (loading) return <div className="text-center py-20 text-slate-500">Loading invoice...</div>;
  if (!invoice) return <div className="text-center py-20 text-slate-500">Invoice not found or link has expired.</div>;

  const paid = new Decimal(invoice.amount_paid || 0);
  const due = new Decimal(invoice.amount_due || 0);
  const isFullyPaid = paid.gte(new Decimal(invoice.total || 0));

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-slate-100 text-slate-800",
      sent: "bg-blue-100 text-blue-800",
      viewed: "bg-indigo-100 text-indigo-800",
      partially_paid: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
      cancelled: "bg-slate-100 text-slate-800",
      void: "bg-slate-100 text-slate-800",
    };
    return colors[status] || colors.draft;
  };

  async function handlePay() {
    if (!token || !payAmount || Number(payAmount) <= 0) return;
    setPaying(true);
    setPaymentError(null);
    try {
      await payInvoicePublic(token, {
        amount: Number(payAmount),
        provider: "stub",
      });
      setPaymentSuccess(true);
      if (invoice) {
        setInvoice({ ...invoice, amount_paid: new Decimal(invoice.amount_paid || 0).plus(payAmount).toFixed(2) });
      }
      setPayAmount("");
    } catch (err: any) {
      setPaymentError(err.response?.data?.error || err.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  function handleDownloadPdf() {
    if (!token) return;
    getPublicInvoicePdf(token)
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `invoice-${invoice?.invoice_number ?? invoice?.id ?? "invoice"}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => {});
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-8 py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-slate-900">
                Invoice #{invoice.invoice_number || invoice.id}
              </h1>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(invoice.status)}`}>
                {invoice.status}
              </span>
            </div>
          </div>

          <div className="px-8 py-6" dangerouslySetInnerHTML={{ __html: html }} />

          {!isFullyPaid && due.gt(0) && (
            <div className="border-t border-slate-200 px-8 py-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="text-center">
                  <p className="text-sm text-slate-600">Amount Due</p>
                  <p className="text-3xl font-bold text-primary-700">{formatCurrency(invoice.total, invoice.currency)}</p>
                  {invoice.due_date && (
                    <p className="text-xs text-slate-500 mt-1">Due: {new Date(invoice.due_date).toLocaleDateString()}</p>
                  )}
                </div>

                {paymentSuccess ? (
                  <div className="text-center">
                    <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-green-100 text-green-800">
                      Payment Successful!
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setPayAmount(invoice.amount_due || invoice.total);
                    }}
                    className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white hover:bg-primary-700"
                  >
                    Pay Now
                  </button>
                )}
              </div>

              {payAmount && (
                <div className="mt-6 border-t border-slate-200 pt-6">
                  <div className="max-w-sm">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Payment Amount ({invoice.currency.toUpperCase()})</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={invoice.amount_due || invoice.total}
                        value={payAmount}
                        onChange={(e) => {
                          setPayAmount(e.target.value);
                          setPaymentError(null);
                        }}
                        className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder={invoice.amount_due || invoice.total}
                      />
                      <button
                        onClick={handlePay}
                        disabled={paying || !payAmount || Number(payAmount) <= 0}
                        className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                      >
                        {paying ? "Processing..." : "Confirm"}
                      </button>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setPayAmount(invoice.amount_due || invoice.total)}
                        className="text-xs text-slate-600 hover:text-slate-900"
                      >
                        Pay full amount
                      </button>
                      <button
                        onClick={() => setPayAmount("")}
                        className="text-xs text-slate-600 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  {paymentError && (
                    <p className="mt-2 text-xs text-red-600">{paymentError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {isFullyPaid && (
            <div className="border-t border-slate-200 px-8 py-6">
              <div className="text-center">
                <span className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium bg-green-100 text-green-800">
                  Fully Paid
                </span>
                {invoice.paid_at && (
                  <p className="text-xs text-slate-500 mt-1">
                    Paid on {new Date(invoice.paid_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 px-8 py-4 flex justify-end gap-3">
            <button
              onClick={handleDownloadPdf}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Download PDF
            </button>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-slate-500">
          <p>Powered by InvoiceFlow</p>
        </div>
      </div>
    </div>
  );
}
