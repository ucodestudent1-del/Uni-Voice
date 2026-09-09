import { Decimal } from "decimal.js";
import { formatCurrency } from "../utils/format";

export interface PreviewLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount?: string;
  discountType?: "fixed" | "percentage";
  taxRate?: string;
  isTaxInclusive?: boolean;
}

export interface PreviewFee {
  description: string;
  amount: string;
  taxRate?: string;
}

export interface PreviewInvoice {
  businessName: string;
  businessEmail?: string;
  businessPhone?: string;
  businessWebsite?: string;
  businessAddress?: string;
  businessLogo?: string;
  customerName?: string;
  customerCompanyName?: string;
  customerEmail?: string;
  customerAddress?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  currency: string;
  notes?: string;
  terms?: string;
  paymentInstructions?: string;
  items: PreviewLineItem[];
  fees: PreviewFee[];
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  feeTotal: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  status: string;
}

function fmt(v: string | number, currency: string, dp = 2): string {
  return formatCurrency(new Decimal(v ?? 0), currency, dp);
}

function fmtRate(v: string | number | undefined): string {
  const rate = new Decimal(v ?? 0);
  if (rate.isZero()) return "-";
  return rate.mul(100).toFixed(2) + "%";
}

export default function InvoicePreview({ invoice }: { invoice: PreviewInvoice }) {
  const cur = invoice.currency;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-8 max-w-3xl mx-auto font-[system-ui,-apple-system,BlinkMacSystemFont,Segoe_UI,Roboto,Helvetica,Arial,sans-serif]">
      <div className="flex justify-between items-start mb-8">
        <div>
          {invoice.businessLogo ? (
            <img src={invoice.businessLogo} alt={invoice.businessName} className="h-12 w-auto" />
          ) : (
            <h2 className="text-2xl font-bold text-slate-900">{invoice.businessName || "InvoiceFlow"}</h2>
          )}
          {invoice.businessEmail && <p className="text-sm text-slate-500 mt-1">{invoice.businessEmail}</p>}
          {invoice.businessPhone && <p className="text-sm text-slate-500">{invoice.businessPhone}</p>}
          {invoice.businessWebsite && <p className="text-sm text-slate-500">{invoice.businessWebsite}</p>}
          {invoice.businessAddress && <p className="text-sm text-slate-500 whitespace-pre-line">{invoice.businessAddress}</p>}
        </div>
        <div className="text-right">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
            invoice.status === "paid" ? "bg-green-100 text-green-800" :
            invoice.status === "sent" ? "bg-blue-100 text-blue-800" :
            invoice.status === "overdue" ? "bg-red-100 text-red-800" :
            invoice.status === "draft" ? "bg-slate-100 text-slate-800" :
            "bg-yellow-100 text-yellow-800"
          }`}>
            {invoice.status}
          </span>
          {invoice.invoiceNumber && (
            <p className="mt-2 text-lg font-semibold text-slate-900">#{invoice.invoiceNumber}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Bill To</h3>
          {invoice.customerName ? (
            <>
              <p className="font-semibold text-slate-900">{invoice.customerName}</p>
              {invoice.customerCompanyName && <p className="text-sm text-slate-600">{invoice.customerCompanyName}</p>}
              {invoice.customerEmail && <p className="text-sm text-slate-500">{invoice.customerEmail}</p>}
              {invoice.customerAddress && <p className="text-sm text-slate-500 whitespace-pre-line">{invoice.customerAddress}</p>}
            </>
          ) : (
            <p className="text-sm text-slate-400">No customer selected</p>
          )}
        </div>
        <div className="text-right">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Invoice Details</h3>
          {invoice.issueDate && <p className="text-sm text-slate-600">Issue date: <span className="text-slate-900">{invoice.issueDate}</span></p>}
          {invoice.dueDate && <p className="text-sm text-slate-600">Due date: <span className="text-slate-900">{invoice.dueDate}</span></p>}
          <p className="text-sm text-slate-600">Currency: <span className="text-slate-900">{cur}</span></p>
        </div>
      </div>

      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left text-xs font-semibold text-slate-500 uppercase py-3">#</th>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase py-3">Description</th>
            <th className="text-right text-xs font-semibold text-slate-500 uppercase py-3">Qty</th>
            <th className="text-right text-xs font-semibold text-slate-500 uppercase py-3">Rate</th>
            <th className="text-right text-xs font-semibold text-slate-500 uppercase py-3">Tax</th>
            <th className="text-right text-xs font-semibold text-slate-500 uppercase py-3">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => {
            const lineTotal = computeLineTotal(item, cur);
            return (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-3 text-sm text-slate-500">{i + 1}</td>
                <td className="py-3 text-sm text-slate-900">{item.description || "—"}</td>
                <td className="py-3 text-right text-sm text-slate-600">{item.quantity} {item.unit}</td>
                <td className="py-3 text-right text-sm text-slate-600">{fmt(item.unitPrice, cur)}</td>
                <td className="py-3 text-right text-sm text-slate-600">{fmtRate(item.taxRate)}</td>
                <td className="py-3 text-right text-sm font-medium text-slate-900">{lineTotal}</td>
              </tr>
            );
          })}
          {invoice.items.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-sm text-slate-400">No line items added yet</td>
            </tr>
          )}
        </tbody>
      </table>

      {invoice.fees.length > 0 && (
        <table className="w-full border-collapse mb-6">
          <tbody>
            {invoice.fees.map((fee, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td colSpan={5} className="py-2 text-sm text-slate-600">{fee.description}</td>
                <td className="py-2 text-right text-sm font-medium text-slate-900">{fmt(fee.amount, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex justify-end mb-8">
        <table className="w-64 border-collapse">
          <tbody>
            <tr>
              <td className="py-2 text-sm text-slate-600">Subtotal</td>
              <td className="py-2 text-right text-sm text-slate-900">{fmt(invoice.subtotal, cur)}</td>
            </tr>
            {Number(invoice.discountTotal) > 0 && (
              <tr>
                <td className="py-2 text-sm text-slate-600">Discount</td>
                <td className="py-2 text-right text-sm text-slate-900">-{fmt(invoice.discountTotal, cur)}</td>
              </tr>
            )}
            {Number(invoice.taxTotal) > 0 && (
              <tr>
                <td className="py-2 text-sm text-slate-600">Tax</td>
                <td className="py-2 text-right text-sm text-slate-900">{fmt(invoice.taxTotal, cur)}</td>
              </tr>
            )}
            {Number(invoice.feeTotal) > 0 && (
              <tr>
                <td className="py-2 text-sm text-slate-600">Fees</td>
                <td className="py-2 text-right text-sm text-slate-900">{fmt(invoice.feeTotal, cur)}</td>
              </tr>
            )}
            <tr className="border-t border-slate-200">
              <td className="py-3 text-lg font-semibold text-slate-900">Total</td>
              <td className="py-3 text-right text-lg font-bold text-slate-900">{fmt(invoice.total, cur)}</td>
            </tr>
            {Number(invoice.amountPaid) > 0 && (
              <>
                <tr>
                  <td className="py-2 text-sm text-slate-600">Paid</td>
                  <td className="py-2 text-right text-sm text-slate-900">{fmt(invoice.amountPaid, cur)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm font-semibold text-slate-900">Amount Due</td>
                  <td className="py-2 text-right text-lg font-bold text-primary-700">{fmt(invoice.amountDue, cur)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {invoice.notes && <p className="text-sm text-slate-700 mb-4 whitespace-pre-line">{invoice.notes}</p>}
      {invoice.terms && <p className="text-xs text-slate-500 mb-4 whitespace-pre-line">{invoice.terms}</p>}
      {invoice.paymentInstructions && (
        <div className="bg-slate-50 rounded-lg p-4 mt-6">
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Payment Instructions</h4>
          <p className="text-sm text-slate-700 whitespace-pre-line">{invoice.paymentInstructions}</p>
        </div>
      )}
    </div>
  );
}

function computeLineTotal(item: PreviewLineItem, currency: string): string {
  const qty = new Decimal(item.quantity || 1);
  const price = new Decimal(item.unitPrice || 0);
  return fmt(qty.mul(price).toFixed(2), currency);
}
