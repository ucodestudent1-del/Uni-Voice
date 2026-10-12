import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  getPublicQuote,
  acceptPublicQuote,
  rejectPublicQuote,
  requestChangesPublicQuote,
  recordPublicQuoteView,
} from "@/api/client";
import { Money, StatusBadge, quoteStatusConfig } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { Download, Send, AlertCircle, FileText, CheckCircle, XCircle } from "lucide-react";
import { formatDate, formatTaxRateWithName } from "@/utils/format";
import type { ApiQuote, ApiQuoteItem } from "@/types/api";
import { useToast } from "@/components/ui/ToastProvider";

export default function PublicQuote() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [changesDialogOpen, setChangesDialogOpen] = useState(false);
  const [changesReason, setChangesReason] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid quote link");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    getPublicQuote(token)
      .then((res) => {
        setQuote(res.quote);
        recordPublicQuoteView(token).catch(() => {});
      })
      .catch((err: any) => {
        setError(err.message || "Quote not found or link has expired");
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!quote) return;
    setActionLoading("accept");
    try {
      const res = await acceptPublicQuote(token!);
      setQuote(res.quote);
      toast("Quote accepted!", { type: "success", title: "Accepted" });
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Failed" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!quote) return;
    setActionLoading("reject");
    try {
      const res = await rejectPublicQuote(token!, rejectReason);
      setQuote(res.quote);
      toast("Quote rejected.", { type: "success", title: "Rejected" });
      setRejectDialogOpen(false);
      setRejectReason("");
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Failed" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestChanges = async () => {
    if (!quote) return;
    setActionLoading("changes");
    try {
      const res = await requestChangesPublicQuote(token!, changesReason);
      setQuote(res.quote);
      toast("Changes requested.", { type: "success", title: "Request Sent" });
      setChangesDialogOpen(false);
      setChangesReason("");
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Failed" });
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <p className="text-sm text-tertiary">Loading quote…</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-error mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-primary mb-2">Quote not found</h1>
          <p className="text-secondary">{error ?? "This quote link is invalid or has expired."}</p>
        </div>
      </div>
    );
  }

  const status = quote.status ?? "draft";
  const canAccept = status === "sent" || status === "viewed";
  const canReject = status === "sent" || status === "viewed";
  const canRequestChanges = status === "sent" || status === "viewed";

  return (
    <div className="min-h-screen bg-page">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-end gap-2">
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
                    Quote {quote.quote_number ?? "—"}
                  </h1>
                </div>
              </div>
              <StatusBadge status={status} config={quoteStatusConfig} />
            </div>
          </div>

          {/* Customer & Quote Info */}
          <div className="p-6 border-b border-border grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-medium text-tertiary uppercase mb-2">Bill To</h3>
              <div className="font-medium text-primary">{quote.customer_name ?? "—"}</div>
              {quote.customer_email && (
                <div className="text-sm text-tertiary">{quote.customer_email}</div>
              )}
            </div>
            <div className="text-right">
              <h3 className="text-xs font-medium text-tertiary uppercase mb-2">Details</h3>
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
                <div className="text-sm">
                  <span className="text-tertiary">Currency: </span>
                  {quote.currency}
                </div>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="p-6 border-b border-border">
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
                  {(quote.items ?? []).map((item: ApiQuoteItem, idx: number) => (
                    <tr key={item.id ?? idx} className="border-b border-border/50">
                      <td className="py-2">
                        <div className="font-medium text-primary">{item.description}</div>
                        {item.tax_name && <span className="text-xs text-tertiary">{item.tax_name}</span>}
                        {item.is_optional && <span className="text-xs text-tertiary"> (Optional)</span>}
                      </td>
                      <td className="text-right py-2">{item.quantity}</td>
                      <td className="text-right py-2">
                        <Money amount={item.unit_price} currency={quote.currency} />
                      </td>
                      <td className="text-right py-2">
                        {Number(item.tax_rate) > 0 ? `${formatTaxRateWithName(item.tax_rate, item.tax_name)}` : "—"}
                      </td>
                      <td className="text-right py-2 font-medium">
                        <Money amount={item.line_total} currency={quote.currency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="p-6">
            <div className="ml-auto max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-tertiary">Subtotal</span>
                <Money amount={quote.subtotal ?? "0"} currency={quote.currency} />
              </div>
              {(Number(quote.discount_total ?? "0") > 0) && (
                <div className="flex justify-between">
                  <span className="text-tertiary">Discount</span>
                  <span className="text-error">-{Number(quote.discount_total ?? "0").toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-tertiary">Tax</span>
                <Money amount={quote.tax_total ?? "0"} currency={quote.currency} />
              </div>
              {(Number(quote.fee_total ?? "0") > 0) && (
                <div className="flex justify-between">
                  <span className="text-tertiary">Fees</span>
                  <Money amount={quote.fee_total ?? "0"} currency={quote.currency} />
                </div>
              )}
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between font-bold text-lg text-primary">
                  <span>Total</span>
                  <Money amount={quote.total ?? "0"} currency={quote.currency} />
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {(quote.notes || quote.terms || quote.scope_of_work) && (
            <div className="p-6 border-t border-border">
              <div className="space-y-3 text-sm">
                {quote.scope_of_work && (
                  <div>
                    <h4 className="font-medium text-primary mb-1">Scope of Work</h4>
                    <p className="text-secondary whitespace-pre-wrap">{quote.scope_of_work}</p>
                  </div>
                )}
                {quote.notes && (
                  <div>
                    <h4 className="font-medium text-primary mb-1">Notes</h4>
                    <p className="text-secondary whitespace-pre-wrap">{quote.notes}</p>
                  </div>
                )}
                {quote.terms && (
                  <div>
                    <h4 className="font-medium text-primary mb-1">Terms</h4>
                    <p className="text-secondary whitespace-pre-wrap">{quote.terms}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Customer Actions */}
        {(canAccept || canReject || canRequestChanges) && (
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            {canAccept && (
              <Button
                variant="primary"
                icon={<CheckCircle className="h-4 w-4" />}
                onClick={handleAccept}
                loading={actionLoading === "accept"}
              >
                Accept Quote
              </Button>
            )}
            {canRequestChanges && (
              <Button
                variant="secondary"
                icon={<Send className="h-4 w-4" />}
                onClick={() => setChangesDialogOpen(true)}
                loading={actionLoading === "changes"}
              >
                Request Changes
              </Button>
            )}
            {canReject && (
              <Button
                variant="danger"
                icon={<XCircle className="h-4 w-4" />}
                onClick={() => setRejectDialogOpen(true)}
              >
                Reject Quote
              </Button>
            )}
          </div>
        )}

        {(quote.deposit_paid || quote.amount_due) && Number(quote.amount_due ?? "0") > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={() => toast("Payment integration coming soon!", { type: "info", title: "Coming Soon" })}
              className="inline-flex items-center justify-center px-6 py-3 border border-primary text-primary rounded-md font-medium hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <Send className="h-4 w-4 mr-2" />
              Pay {quote.deposit_paid ? "Remaining Balance" : "Deposit"}
            </button>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      {rejectDialogOpen && quote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setRejectDialogOpen(false)}
        >
          <div
            className="bg-popover border border-border rounded-lg p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-primary mb-4">Reject Quote</h3>
            <div className="space-y-3">
              <textarea
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Reason for rejection (optional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setRejectDialogOpen(false)}>
                Back
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={actionLoading === "reject"}
                onClick={handleReject}
              >
                Reject Quote
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Request Changes Dialog */}
      {changesDialogOpen && quote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setChangesDialogOpen(false)}
        >
          <div
            className="bg-popover border border-border rounded-lg p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-primary mb-4">Request Changes</h3>
            <div className="space-y-3">
              <textarea
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="What changes would you like?"
                value={changesReason}
                onChange={(e) => setChangesReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setChangesDialogOpen(false)}>
                Back
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={actionLoading === "changes"}
                onClick={handleRequestChanges}
              >
                Send Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
