import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCreditNote, getInvoices, type InvoiceSearchParams, applyCreditNote } from "@/api/client";
import {
  PageHeader,
  StatusBadge,
  creditNoteStatusConfig,
  Money,
} from "@/components/ui";
import { Button } from "@/components/ui/Button";
import SectionCard from "@/components/SectionCard";
import {
  ArrowLeft,
  FileText,
  Send,
  Download,
  Plus,
} from "lucide-react";
import { formatDate, formatTaxRateWithName } from "@/utils/format";
import type { ApiCreditNote, ApiInvoiceListItem } from "@/types/api";
import { Decimal } from "decimal.js";

export default function CreditNoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [creditNote, setCreditNote] = useState<ApiCreditNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyAmount, setApplyAmount] = useState<string>("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [availableInvoices, setAvailableInvoices] = useState<ApiInvoiceListItem[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const fetchCreditNote = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCreditNote(id);
      setCreditNote(data.creditNote);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load credit note";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCreditNote();
  }, [fetchCreditNote]);

  const appliedAmount = new Decimal(creditNote?.applied_total ?? 0);
  const totalAmount = new Decimal(creditNote?.total ?? 0);
  const remainingCredit = totalAmount.minus(appliedAmount);
  const canApply = creditNote && (creditNote.status === "finalized" || creditNote.status === "sent") && remainingCredit.gt(0);

  const handleApplyClick = async () => {
    if (!creditNote) return;
    setSelectedInvoiceId("");
    setApplyAmount("");
    try {
      const data = await getInvoices({
        limit: 100,
        customerId: creditNote.customer_id ?? undefined,
      } as InvoiceSearchParams);
      const openInvoices = (data.invoices ?? []).filter(
        (inv) => new Decimal(inv.amount_due ?? 0).gt(0)
      );
      setAvailableInvoices(openInvoices);
    } catch {
      setAvailableInvoices([]);
    }
    setApplyDialogOpen(true);
  };

  const confirmApply = async () => {
    if (!creditNote || !selectedInvoiceId || !applyAmount) return;
    setIsApplying(true);
    try {
      const result = await applyCreditNote(creditNote.id, {
        invoiceId: selectedInvoiceId,
        amount: applyAmount,
      });
      if (result.ok) {
        fetchCreditNote();
        setApplyDialogOpen(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to apply credit note";
      setError(message);
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64 text-secondary">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mr-3" />
          Loading credit note...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="p-4 rounded-md bg-error/10 text-error-text">
          {error}
        </div>
      </div>
    );
  }

  if (!creditNote) {
    return (
      <div className="page-container">
        <div className="text-center py-10">
          <FileText className="h-12 w-12 mx-auto mb-4 text-tertiary opacity-30" />
          <p className="text-tertiary">Credit note not found.</p>
          <Button variant="ghost" className="mt-4" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/app/credit-notes")}>
            Back to Credit Notes
          </Button>
        </div>
      </div>
    );
  }

  const totalDisplay = new Decimal(creditNote.total);
  const balanceDue = new Decimal(creditNote.amount_due ?? 0);
  const appliedTotal = new Decimal(creditNote.applied_total ?? 0);

  return (
    <div className="page-container">
      <PageHeader
        title={`Credit Note #${creditNote.credit_note_number ?? ""}`}
        breadcrumbs={[
          { label: "Credit Notes", to: "/app/credit-notes" },
          { label: `#${creditNote.credit_note_number ?? ""}` },
        ]}
        description={creditNote.status}
        primaryAction={
          <div className="flex items-center gap-3">
            <StatusBadge status={creditNote.status} config={creditNoteStatusConfig} />
            {creditNote.finalized_at && (
              <span className="text-xs text-tertiary">
                Finalized {formatDate(creditNote.finalized_at)}
              </span>
            )}
            <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/app/credit-notes")}>
              Back
            </Button>
            {canApply && (
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={handleApplyClick}>
                Apply to Invoice
              </Button>
            )}
            <Button variant="ghost" icon={<Download className="h-4 w-4" />} onClick={() => window.open(`/api/credit-notes/${creditNote.id}/pdf`, "_blank")}>
              Download PDF
            </Button>
            {creditNote.status === "finalized" && (
              <Button variant="primary" icon={<Send className="h-4 w-4" />}>
                Send
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-6">
        {/* Credit Note Details */}
        <SectionCard title="Credit Note Details">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Issue Date</span>
                <p className="text-sm text-primary mt-1">
                  {creditNote.issue_date ? formatDate(creditNote.issue_date) : "—"}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Currency</span>
                <p className="text-sm text-primary mt-1">{creditNote.currency}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Reference Invoice</span>
                <p className="text-sm text-primary mt-1">
                  {creditNote.reference_invoice_number
                    ? (
                      <a
                        href={`/app/invoices/${creditNote.reference_invoice_id}`}
                        className="text-primary hover:underline"
                      >
                        {creditNote.reference_invoice_number}
                      </a>
                    )
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Customer</span>
                <p className="text-sm text-primary mt-1">
                  {creditNote.customer_name ?? "—"}
                  {creditNote.customer_email && (
                    <span className="block text-xs text-tertiary">{creditNote.customer_email}</span>
                  )}
                </p>
              </div>
            </div>

            {creditNote.reason && (
              <div>
                <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Reason</span>
                <p className="text-sm text-primary mt-1">{creditNote.reason}</p>
              </div>
            )}

            {creditNote.notes && (
              <div>
                <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Notes</span>
                <p className="text-sm text-secondary mt-1 whitespace-pre-wrap">{creditNote.notes}</p>
              </div>
            )}

            {creditNote.terms && (
              <div>
                <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Terms</span>
                <p className="text-sm text-secondary mt-1 whitespace-pre-wrap">{creditNote.terms}</p>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Line Items */}
        {creditNote.items && creditNote.items.length > 0 && (
          <SectionCard title="Line Items">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="text-left py-2 px-3 text-xs font-medium text-tertiary uppercase">Description</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-tertiary uppercase">Qty</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-tertiary uppercase">Unit</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-tertiary uppercase">Unit Price</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-tertiary uppercase">Tax</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-tertiary uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {creditNote.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-2 px-3 text-sm text-primary">{item.description}</td>
                      <td className="py-2 px-3 text-right text-sm text-primary">{item.quantity}</td>
                      <td className="py-2 px-3 text-sm text-tertiary">{item.unit}</td>
                      <td className="py-2 px-3 text-right text-sm text-primary">{new Decimal(item.unit_price).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-xs text-tertiary">
                        {formatTaxRateWithName(item.tax_rate, item.tax_name)}
                      </td>
                      <td className="py-2 px-3 text-right text-sm font-medium text-primary">
                        <Money amount={item.line_total} currency={creditNote.currency} signed />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* Fees */}
        {creditNote.fees && creditNote.fees.length > 0 && (
          <SectionCard title="Fees">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="text-left py-2 px-3 text-xs font-medium text-tertiary uppercase">Description</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-tertiary uppercase">Amount</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-tertiary uppercase">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {creditNote.fees.map((fee, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-2 px-3 text-sm text-primary">{fee.description}</td>
                      <td className="py-2 px-3 text-right text-sm font-medium text-primary">
                        <Money amount={fee.amount} currency={creditNote.currency} signed />
                      </td>
                      <td className="py-2 px-3 text-right text-xs text-tertiary">
                        {formatTaxRateWithName(fee.tax_rate, fee.tax_name)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* Totals */}
        <SectionCard>
          <div className="p-5">
            <div className="space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between text-tertiary">
                <span>Subtotal</span>
                <Money amount={creditNote.subtotal} currency={creditNote.currency} />
              </div>
              {Number(new Decimal(creditNote.discount_total).toNumber()) !== 0 && (
                <div className="flex justify-between text-tertiary">
                  <span>Discount</span>
                  <Money amount={new Decimal(creditNote.discount_total).negated()} currency={creditNote.currency} />
                </div>
              )}
              <div className="flex justify-between text-tertiary">
                <span>Tax</span>
                <Money amount={creditNote.tax_total} currency={creditNote.currency} />
              </div>
              {creditNote.fees && creditNote.fees.length > 0 && Number(new Decimal(creditNote.fee_total).toNumber()) !== 0 && (
                <div className="flex justify-between text-tertiary">
                  <span>Fees</span>
                  <Money amount={creditNote.fee_total} currency={creditNote.currency} />
                </div>
              )}
              <div className="flex justify-between text-tertiary">
                <span>Applied</span>
                <Money amount={appliedTotal} currency={creditNote.currency} />
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-lg font-bold text-primary">
                <span>Balance Due</span>
                <Money amount={balanceDue} currency={creditNote.currency} signed />
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-tertiary">Total</span>
                <Money amount={totalDisplay} currency={creditNote.currency} signed />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Applications */}
        <SectionCard title="Applications">
          <div className="p-5">
            {creditNote.applications && creditNote.applications.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-alt">
                      <th className="text-left py-2 px-3 text-xs font-medium text-tertiary uppercase">Invoice</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-tertiary uppercase">Amount Applied</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-tertiary uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditNote.applications.map((app) => (
                      <tr key={app.id} className="border-b border-border/50">
                        <td className="py-2 px-3 text-sm text-primary">
                          {app.invoice_id ? (
                            <a
                              href={`/app/invoices/${app.invoice_id}`}
                              className="text-primary hover:underline"
                            >
                              {app.invoice_id}
                            </a>
                          ) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right text-sm font-medium text-primary">
                          <Money amount={app.amount} currency={creditNote.currency} signed />
                        </td>
                        <td className="py-2 px-3 text-sm text-tertiary">{formatDate(app.applied_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-tertiary">This credit note has not been applied to any invoice yet.</p>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Apply Credit Note Dialog */}
      {applyDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"
          onClick={() => !isApplying && setApplyDialogOpen(false)}
        >
          <div
            className="relative mx-4 w-full max-w-lg rounded-xl bg-surface border border-border shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-4">
              <h2 className="text-lg font-semibold text-primary">Apply Credit Note</h2>
              <p className="mt-2 text-sm text-secondary">
                Remaining credit: <strong>{remainingCredit.toFixed(2)}</strong>
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Target Invoice</label>
                  <select
                    className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  >
                    <option value="">Select an invoice</option>
                    {availableInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number ?? inv.id} — {formatDate(inv.issue_date ?? undefined)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Amount to Apply</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={remainingCredit.toFixed(2)}
                    className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary placeholder-target"
                    placeholder={remainingCredit.toFixed(2)}
                    value={applyAmount}
                    onChange={(e) => setApplyAmount(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-border-subtle p-6 pt-4">
              <Button variant="secondary" size="sm" onClick={() => !isApplying && setApplyDialogOpen(false)} disabled={isApplying}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={confirmApply}
                disabled={isApplying || !selectedInvoiceId || !applyAmount}
                loading={isApplying}
              >
                Apply Credit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
