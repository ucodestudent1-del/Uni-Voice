import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getPublicQuote, getQuotePdf } from "@/api/client";
import { Money, StatusBadge, quoteStatusConfig } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { Download, AlertCircle, FileText } from "lucide-react";
import { formatDate, formatTaxRateWithName } from "@/utils/format";
import type { ApiQuote, ApiQuoteItem } from "@/types/api";
import { useToast } from "@/components/ui/ToastProvider";

export default function PublicQuote() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid quote link");
      setIsLoading(false);
      return;
    }
    getPublicQuote(token)
      .then((res) => {
        setQuote(res.quote as ApiQuote);
      })
      .catch((err) => {
        setError(err.message || "Failed to load quote");
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleDownloadPdf = async () => {
    if (!quote) return;
    try {
      const blob = await getQuotePdf(quote.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quote-${quote.quote_number ?? quote.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Download failed";
      toast(message, { type: "error", title: "Download failed" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-error mx-auto mb-4" />
          <h2 className="text-xl font-bold text-primary mb-2">
            Unable to load quote
          </h2>
          <p className="text-tertiary">{error}</p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <FileText className="h-12 w-12 text-tertiary mx-auto mb-4" />
          <h2 className="text-xl font-bold text-primary mb-2">
            Quote not found
          </h2>
          <p className="text-tertiary">
            The quote you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page py-8">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-primary">
              Quote #{quote.quote_number ?? "—"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={quote.status} config={quoteStatusConfig} />
            <Button
              variant="ghost"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={handleDownloadPdf}
            >
              Download PDF
            </Button>
          </div>
        </div>

        {/* Quote Details */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-medium text-tertiary uppercase">
                Customer
              </h3>
              <div className="mt-1 font-medium text-primary">
                {quote.customer_name ?? "—"}
              </div>
              {quote.customer_email && (
                <div className="text-sm text-tertiary">
                  {quote.customer_email}
                </div>
              )}
            </div>
            <div className="text-right">
              <h3 className="text-xs font-medium text-tertiary uppercase">
                Details
              </h3>
              <div className="mt-1 space-y-1">
                {quote.issue_date && (
                  <div className="text-sm">
                    <span className="text-tertiary">Issue date: </span>
                    {formatDate(quote.issue_date)}
                  </div>
                )}
                {quote.expiry_date && (
                  <div className="text-sm">
                    <span className="text-tertiary">Expiry date: </span>
                    {formatDate(quote.expiry_date)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-page">
                    <th className="text-left py-2 px-3 font-medium text-tertiary">
                      Description
                    </th>
                    <th className="text-right py-2 px-3 font-medium text-tertiary">
                      Qty
                    </th>
                    <th className="text-right py-2 px-3 font-medium text-tertiary">
                      Unit Price
                    </th>
                    <th className="text-right py-2 px-3 font-medium text-tertiary">
                      Tax
                    </th>
                    <th className="text-right py-2 px-3 font-medium text-tertiary">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(quote.items ?? []).map(
                    (item: ApiQuoteItem, idx: number) => (
                      <tr
                        key={item.id ?? idx}
                        className="border-b border-border/50"
                      >
                        <td className="py-2 px-3">
                          <div className="font-medium text-primary">
                            {item.description}
                          </div>
                          {item.tax_name && (
                            <span className="text-xs text-tertiary">
                              {item.tax_name}
                            </span>
                          )}
                        </td>
                        <td className="text-right py-2 px-3">
                          {item.quantity}
                        </td>
                        <td className="text-right py-2 px-3">
                          <Money
                            amount={item.unit_price}
                            currency={quote.currency}
                          />
                        </td>
                        <td className="text-right py-2 px-3">
                          {item.tax_amount
                            ? formatTaxRateWithName(
                                item.tax_rate,
                                item.tax_name,
                              )
                            : "—"}
                        </td>
                        <td className="text-right py-2 px-3 font-medium">
                          <Money
                            amount={item.line_total}
                            currency={quote.currency}
                          />
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fees */}
          {(quote.fees ?? []).length > 0 && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h4 className="text-sm font-medium text-secondary mb-2">Fees</h4>
              <div className="space-y-1">
                {(quote.fees ?? []).map((fee, idx) => (
                  <div
                    key={fee.id ?? idx}
                    className="flex justify-between items-center"
                  >
                    <span className="text-tertiary">{fee.description}</span>
                    <Money amount={fee.amount} currency={quote.currency} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="border border-border rounded-lg p-4 bg-surface">
            <h4 className="text-xs font-medium text-tertiary uppercase mb-3">
              Summary
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-tertiary">Subtotal</span>
                <Money
                  amount={quote.subtotal ?? "0"}
                  currency={quote.currency}
                />
              </div>
              {Number(quote.discount_total ?? "0") > 0 && (
                <div className="flex justify-between">
                  <span className="text-tertiary">Discount</span>
                  <span className="text-error">
                    -
                    <Money
                      amount={quote.discount_total ?? "0"}
                      currency={quote.currency}
                    />
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-tertiary">Tax</span>
                <Money
                  amount={quote.tax_total ?? "0"}
                  currency={quote.currency}
                />
              </div>
              {Number(quote.fee_total ?? "0") > 0 && (
                <div className="flex justify-between">
                  <span className="text-tertiary">Fees</span>
                  <Money
                    amount={quote.fee_total ?? "0"}
                    currency={quote.currency}
                  />
                </div>
              )}
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Estimated Total</span>
                  <Money
                    amount={quote.total ?? "0"}
                    currency={quote.currency}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {quote.notes && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h4 className="text-xs font-medium text-tertiary uppercase mb-1">
                Notes
              </h4>
              <p className="text-sm text-secondary whitespace-pre-wrap">
                {quote.notes}
              </p>
            </div>
          )}
          {quote.terms && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h4 className="text-xs font-medium text-tertiary uppercase mb-1">
                Terms
              </h4>
              <p className="text-sm text-secondary whitespace-pre-wrap">
                {quote.terms}
              </p>
            </div>
          )}
          {quote.payment_instructions && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h4 className="text-xs font-medium text-tertiary uppercase mb-1">
                Payment Instructions
              </h4>
              <p className="text-sm text-secondary whitespace-pre-wrap">
                {quote.payment_instructions}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
