import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicInvoice } from "../api/client";
import { formatCurrency } from "../utils/format";
import { Decimal } from "decimal.js";

export default function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      getPublicInvoice(token)
        .then((data) => setInvoice(data.invoice))
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
  const isFullyPaid = paid.gte(due) && due.lte(0);

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-8 py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-slate-900">
                Invoice #{invoice.invoice_number || invoice.id}
              </h1>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                invoice.status === "paid" ? "bg-green-100 text-green-800" :
                invoice.status === "sent" ? "bg-blue-100 text-blue-800" :
                invoice.status === "overdue" ? "bg-red-100 text-red-800" :
                "bg-slate-100 text-slate-800"
              }`}>
                {invoice.status}
              </span>
            </div>
          </div>

          <div className="px-8 py-6" dangerouslySetInnerHTML={{ __html: invoice.html || "" }} />

          {!isFullyPaid && due.gt(0) && (
            <div className="border-t border-slate-200 px-8 py-6">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-sm text-slate-600">Amount Due</p>
                  <p className="text-3xl font-bold text-primary-700">{formatCurrency(invoice.total, invoice.currency)}</p>
                </div>
                <button
                  onClick={() => alert("Online payment is coming soon. For now, please pay via the method listed on the invoice.")}
                  className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white hover:bg-primary-700"
                >
                  Pay Now
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-8 text-sm text-slate-500">
          <p>Powered by InvoiceFlow</p>
        </div>
      </div>
    </div>
  );
}
