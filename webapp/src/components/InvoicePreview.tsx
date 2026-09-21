import { Decimal } from "decimal.js";
import { CreditCard, Upload } from "lucide-react";
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

export interface PreviewAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  category?: "attachment" | "before" | "after";
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
  paymentLink?: string;
  attachments?: PreviewAttachment[];
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
    <div className="bg-surface border border-color rounded-xl shadow-lg p-8 max-w-3xl mx-auto font-[system-ui,-apple-system,BlinkMacSystemFont,Segoe_UI,Roboto,Helvetica,Arial,sans-serif]">
      <div className="flex justify-between items-start mb-8">
        <div>
          {invoice.businessLogo ? (
            <img src={invoice.businessLogo} alt={invoice.businessName} className="h-12 w-auto" />
          ) : (
            <h2 className="text-2xl font-bold text-primary">{invoice.businessName || "InvoiceFlow"}</h2>
          )}
          {invoice.businessEmail && <p className="text-sm text-tertiary mt-1">{invoice.businessEmail}</p>}
          {invoice.businessPhone && <p className="text-sm text-tertiary">{invoice.businessPhone}</p>}
          {invoice.businessWebsite && <p className="text-sm text-tertiary">{invoice.businessWebsite}</p>}
          {invoice.businessAddress && <p className="text-sm text-tertiary whitespace-pre-line">{invoice.businessAddress}</p>}
        </div>
        <div className="text-right">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
            invoice.status === "paid" ? "status-success-bg status-success-text" :
            invoice.status === "sent" ? "status-info-bg status-info-text" :
            invoice.status === "overdue" ? "status-error-bg status-error-text" :
            invoice.status === "draft" ? "status-tertiary-bg status-tertiary-text" :
            "status-warning-bg status-warning-text"
          }`}>
            {invoice.status}
          </span>
          {invoice.invoiceNumber && (
            <p className="mt-2 text-lg font-semibold text-primary">#{invoice.invoiceNumber}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-xs font-semibold text-tertiary uppercase tracking-wider mb-2">Bill To</h3>
          {invoice.customerName ? (
            <>
              <p className="font-semibold text-primary">{invoice.customerName}</p>
              {invoice.customerCompanyName && <p className="text-sm text-secondary">{invoice.customerCompanyName}</p>}
              {invoice.customerEmail && <p className="text-sm text-tertiary">{invoice.customerEmail}</p>}
              {invoice.customerAddress && <p className="text-sm text-tertiary whitespace-pre-line">{invoice.customerAddress}</p>}
            </>
          ) : (
            <p className="text-sm text-tertiary">No customer selected</p>
          )}
        </div>
        <div className="text-right">
          <h3 className="text-xs font-semibold text-tertiary uppercase tracking-wider mb-2">Invoice Details</h3>
          {invoice.issueDate && <p className="text-sm text-secondary">Issue date: <span className="text-primary">{invoice.issueDate}</span></p>}
          {invoice.dueDate && <p className="text-sm text-secondary">Due date: <span className="text-primary">{invoice.dueDate}</span></p>}
          <p className="text-sm text-secondary">Currency: <span className="text-primary">{cur}</span></p>
        </div>
      </div>

      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="border-b border-color">
            <th className="text-left text-xs font-semibold text-tertiary uppercase py-3">#</th>
            <th className="text-left text-xs font-semibold text-tertiary uppercase py-3">Description</th>
            <th className="text-right text-xs font-semibold text-tertiary uppercase py-3">Qty</th>
            <th className="text-right text-xs font-semibold text-tertiary uppercase py-3">Rate</th>
            <th className="text-right text-xs font-semibold text-tertiary uppercase py-3">Tax</th>
            <th className="text-right text-xs font-semibold text-tertiary uppercase py-3">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => {
            const lineTotal = computeLineTotal(item, cur);
            return (
              <tr key={i} className="border-b border-color-subtle">
                <td className="py-3 text-sm text-tertiary">{i + 1}</td>
                <td className="py-3 text-sm text-primary">{item.description || "—"}</td>
                <td className="py-3 text-right text-sm text-secondary">{item.quantity} {item.unit}</td>
                <td className="py-3 text-right text-sm text-secondary">{fmt(item.unitPrice, cur)}</td>
                <td className="py-3 text-right text-sm text-secondary">{fmtRate(item.taxRate)}</td>
                <td className="py-3 text-right text-sm font-medium text-primary">{lineTotal}</td>
              </tr>
            );
          })}
          {invoice.items.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-sm text-tertiary">No line items added yet</td>
            </tr>
          )}
        </tbody>
      </table>

      {invoice.fees.length > 0 && (
        <table className="w-full border-collapse mb-6">
          <tbody>
            {invoice.fees.map((fee, i) => (
              <tr key={i} className="border-b border-color-subtle">
                <td colSpan={5} className="py-2 text-sm text-secondary">{fee.description}</td>
                <td className="py-2 text-right text-sm font-medium text-primary">{fmt(fee.amount, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex justify-end mb-8">
        <table className="w-64 border-collapse">
          <tbody>
            <tr>
              <td className="py-2 text-sm text-secondary">Subtotal</td>
              <td className="py-2 text-right text-sm text-primary">{fmt(invoice.subtotal, cur)}</td>
            </tr>
            {Number(invoice.discountTotal) > 0 && (
              <tr>
                <td className="py-2 text-sm text-secondary">Discount</td>
                <td className="py-2 text-right text-sm text-success-text">−{fmt(invoice.discountTotal, cur)}</td>
              </tr>
            )}
            {Number(invoice.taxTotal) > 0 && (
              <tr>
                <td className="py-2 text-sm text-secondary">Tax</td>
                <td className="py-2 text-right text-sm text-primary">{fmt(invoice.taxTotal, cur)}</td>
              </tr>
            )}
            {Number(invoice.feeTotal) > 0 && (
              <tr>
                <td className="py-2 text-sm text-secondary">Fees</td>
                <td className="py-2 text-right text-sm text-primary">{fmt(invoice.feeTotal, cur)}</td>
              </tr>
            )}
            <tr className="border-t border-color">
              <td className="py-3 text-lg font-semibold text-primary">Total</td>
              <td className="py-3 text-right text-lg font-bold text-primary">{fmt(invoice.total, cur)}</td>
            </tr>
            {Number(invoice.amountPaid) > 0 && (
              <>
                <tr>
                  <td className="py-2 text-sm text-secondary">Paid</td>
                  <td className="py-2 text-right text-sm text-primary">{fmt(invoice.amountPaid, cur)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm font-semibold text-primary">Amount Due</td>
                  <td className="py-2 text-right text-lg font-bold text-primary-brand">{fmt(invoice.amountDue, cur)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {invoice.notes && <p className="text-sm text-secondary mb-4 whitespace-pre-line">{invoice.notes}</p>}
      {invoice.terms && <p className="text-xs text-tertiary mb-4 whitespace-pre-line">{invoice.terms}</p>}
      {invoice.paymentInstructions && (
        <div className="bg-surface-alt rounded-lg p-4 mt-6">
          <h4 className="text-xs font-semibold text-tertiary uppercase mb-2">Payment Instructions</h4>
          <p className="text-sm text-secondary whitespace-pre-line">{invoice.paymentInstructions}</p>
        </div>
      )}

      {invoice.attachments && invoice.attachments.length > 0 && (
        <div className="mt-8">
          <h4 className="text-xs font-semibold text-tertiary uppercase tracking-wider mb-3">
            Photos &amp; Attachments
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {invoice.attachments.map((a) => (
              <div key={a.id} className="group">
                {a.type.startsWith("image/") ? (
                  <img
                    src={a.url}
                    alt={a.name}
                    className={`w-full h-24 object-cover rounded-lg border border-color ${
                      a.category === "before"
                        ? "ring-2 ring-offset-2 ring-warning-text"
                        : a.category === "after"
                        ? "ring-2 ring-offset-2 ring-success-text"
                        : ""
                    }`}
                  />
                ) : (
                  <div className="flex h-24 w-full items-center justify-center rounded-lg border border-color bg-surface-alt">
                    <Upload className="h-6 w-6 text-tertiary" />
                  </div>
                )}
                <p className="mt-1 text-xs text-tertiary truncate">{a.name}</p>
                {a.category && a.category !== "attachment" && (
                  <span className="text-[10px] font-medium capitalize text-secondary">
                    {a.category}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {invoice.paymentLink && (
        <div className="mt-10 border-t border-color pt-6 text-center">
          <a
            href={invoice.paymentLink}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-action px-6 py-3 text-base font-semibold text-on-primary shadow-md hover:bg-primary-hover hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          >
            <CreditCard className="h-5 w-5" />
            Pay {fmt(invoice.amountDue, cur)} now
          </a>
          <p className="mt-2 text-xs text-tertiary">
            Secure online payment — no account required
          </p>
        </div>
      )}
    </div>
  );
}

function computeLineTotal(item: PreviewLineItem, currency: string): string {
  const qty = new Decimal(item.quantity || 1);
  const price = new Decimal(item.unitPrice || 0);
  let total = qty.mul(price);

  if (item.discount && new Decimal(item.discount).gt(0)) {
    if (item.discountType === "percentage") {
      total = total.minus(total.mul(new Decimal(item.discount).div(100)));
    } else {
      total = total.minus(new Decimal(item.discount));
    }
  }

  return fmt(total.toFixed(2), currency);
}
