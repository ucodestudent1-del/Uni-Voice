import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getPublicInvoice } from "@/api/client";
import { Money, StatusBadge, invoiceStatusConfig } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { Download, Send, AlertCircle, FileText } from "lucide-react";
import { formatDate } from "@/utils/format";
import type { ApiInvoice, ApiInvoiceItem } from "@/types/api";
import { useToast } from "@/components/ui/ToastProvider";
import { useMetaTags } from "@/hooks/useMetaTags";

export default function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<ApiInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const invoiceNumber = invoice?.invoice_number ?? "";
  const totalAmount = invoice?.total ?? "";
  const currency = invoice?.currency ?? "USD";

  useMetaTags({
    title: invoiceNumber ? `${invoiceNumber} — InvoiceFlow` : "Invoice — InvoiceFlow",
    description: invoiceNumber
      ? `View invoice ${invoiceNumber} for ${totalAmount} ${currency}. Secure online payment available.`
      : "View your invoice and make a secure online payment.",
    noIndex: true,
  });

  useEffect(() => {
    if (!token) {
      setError("Invalid invoice link");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    getPublicInvoice(token)
      .then((res) => setInvoice(res.invoice))
      .catch((err: any) => {
        setError(err.message || "Invoice not found or link has expired");
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <p className="text-sm text-tertiary">Loading invoice…</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-error mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-primary mb-2">Invoice not found</h1>
          <p className="text-secondary">{error ?? "This invoice link is invalid or has expired."}</p>
        </div>
      </div>
    );
  }

  const status = invoice.status ?? "draft";
  const business = (invoice as any).business as {
    name?: string;
    address?: string;
    countryCode?: string;
  } | null;

  return (
    <div className="min-h-screen bg-page">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" icon={<Send className="h-4 w-4" />}>
            Pay Now
          </Button>
          <Button variant="ghost" size="sm" icon={<Download className="h-4 w-4" />}>
            Download PDF
          </Button>
        </div>

        <div className="border border-border rounded-lg bg-surface shadow-sm">
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-tertiary" />
                <div>
                  <h1 className="text-2xl font-bold text-primary">
                    Invoice {invoice.invoice_number ?? "—"}
                  </h1>
                </div>
              </div>
              <StatusBadge status={status} config={invoiceStatusConfig} />
            </div>
          </div>

          {/* Business & Customer */}
          <div className="p-6 border-b border-border grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-medium text-tertiary uppercase mb-2">From</h3>
              <div className="font-medium text-primary">{business?.name ?? "—"}</div>
              {business?.address && <div className="text-sm text-tertiary">{business.address}</div>}
            </div>
            <div>
              <h3 className="text-xs font-medium text-tertiary uppercase mb-2">Bill To</h3>
              <div className="font-medium text-primary">{invoice.customer_name ?? "—"}</div>
              {invoice.customer_email && <div className="text-sm text-tertiary">{invoice.customer_email}</div>}
              {invoice.customer_address_line_1 && <div className="text-sm text-tertiary">{invoice.customer_address_line_1}</div>}
            </div>
          </div>

          {/* Invoice Info */}
          <div className="p-6 border-b border-border grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <h4 className="text-xs font-medium text-tertiary uppercase">Invoice Date</h4>
              <p className="mt-1 text-sm text-primary">{invoice.issue_date ? formatDate(invoice.issue_date) : "—"}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-tertiary uppercase">Due Date</h4>
              <p className="mt-1 text-sm text-primary">{invoice.due_date ? formatDate(invoice.due_date) : "—"}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-tertiary uppercase">Po Number</h4>
              <p className="mt-1 text-sm text-primary">{invoice.po_number ?? "—"}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-tertiary uppercase">Currency</h4>
              <p className="mt-1 text-sm text-primary">{invoice.currency}</p>
            </div>
          </div>

          {/* Line Items */}
          <div className="p-6 border-b border-border">
            {(invoice.items ?? []).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-tertiary font-medium">Description</th>
                      <th className="text-right py-2 text-tertiary font-medium">Qty</th>
                      <th className="text-right py-2 text-tertiary font-medium">Unit Price</th>
                      <th className="text-right py-2 text-tertiary font-medium">Tax</th>
                      <th className="text-right py-2 text-tertiary font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice.items ?? []).map((item: ApiInvoiceItem, idx: number) => (
                      <tr key={item.id ?? idx} className="border-b border-border/50">
                        <td className="py-2">
                          <div className="font-medium text-primary">{item.description}</div>
                          {item.tax_name && <span className="text-xs text-tertiary">{item.tax_name}</span>}
                        </td>
                        <td className="text-right py-2">{item.quantity}</td>
                        <td className="text-right py-2">{item.unit_price}</td>
                        <td className="text-right py-2">
                          {Number(item.tax_rate) > 0
                            ? `${(Number(item.tax_rate) * 100).toFixed(2)}%${item.tax_name ? ` ${item.tax_name}` : ""}`
                            : "—"}
                        </td>
                        <td className="text-right py-2 font-medium">{item.line_total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-tertiary">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No line items</p>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="p-6">
            <div className="ml-auto max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-tertiary">Subtotal</span>
                <Money amount={invoice.subtotal ?? "0"} currency={invoice.currency} />
              </div>
              {Number(invoice.discount_total ?? "0") > 0 && (
                <div className="flex justify-between">
                  <span className="text-tertiary">Discount</span>
                  <span className="text-error">-{invoice.discount_total}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-tertiary">Tax</span>
                <Money amount={invoice.tax_total ?? "0"} currency={invoice.currency} />
              </div>
              <div className="flex justify-between font-bold text-lg text-primary pt-2 border-t border-border">
                <span>Total</span>
                <Money amount={invoice.total ?? "0"} currency={invoice.currency} />
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-tertiary">Amount Due</span>
                <span className="font-bold text-primary">
                  <Money amount={invoice.amount_due ?? "0"} currency={invoice.currency} />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {(invoice.notes || invoice.terms || invoice.payment_instructions) && (
          <div className="mt-6 border border-border rounded-lg p-6 bg-surface">
            <div className="space-y-3 text-sm">
              {invoice.notes && (
                <div>
                  <h4 className="font-medium text-primary mb-1">Notes</h4>
                  <p className="text-secondary whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <h4 className="font-medium text-primary mb-1">Terms</h4>
                  <p className="text-secondary whitespace-pre-wrap">{invoice.terms}</p>
                </div>
              )}
              {invoice.payment_instructions && (
                <div>
                  <h4 className="font-medium text-primary mb-1">Payment Instructions</h4>
                  <p className="text-secondary whitespace-pre-wrap">{invoice.payment_instructions}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => toast("Payment integration coming soon!", { type: "info", title: "Coming Soon" })}
            className="inline-flex items-center justify-center px-6 py-3 border border-primary text-primary rounded-md font-medium hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <Send className="h-4 w-4 mr-2" />
            Pay this invoice
          </button>
        </div>
      </div>
    </div>
  );
}
