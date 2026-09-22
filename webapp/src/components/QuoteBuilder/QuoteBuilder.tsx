import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Send, Copy, Download } from "lucide-react";
import { useQuoteBuilder } from "./useQuoteBuilder";
import { LineItemsTable } from "./LineItemsTable";
import { FeesSection } from "./FeesSection";
import { QuoteTotals } from "./QuoteTotals";
import { QuoteDetailsForm } from "./QuoteDetailsForm";
import { ReviewAndSendDialog } from "./ReviewAndSendDialog";
import { ValidationPanel } from "../../components/ValidationPanel";
import { Button } from "../../components/ui/Button";

interface QuoteBuilderProps {
  quoteId?: string | null;
}

export default function QuoteBuilder({ quoteId }: QuoteBuilderProps) {
  const navigate = useNavigate();
  const [reviewOpen, setReviewOpen] = useState(false);

  const {
    data,
    isNew,
    customers,
    loading,
    saveState,
    calcResult,
    validation,
    error,
    actionMessage,
    updateField,
    setItems,
    addFee,
    removeFee,
    setFees,
    doSave,
  } = useQuoteBuilder({ quoteId });

  const customerOptions: Array<{ id: string; name: string; email?: string; companyName?: string }> = customers.map(c => ({
    id: c.id,
    name: c.name,
    email: c.email ?? undefined,
    companyName: c.companyName ?? undefined,
  }));

  const currencyLocked = data.items.length > 0 && data.items.some(item => Number(item.unitPrice) > 0);

  function getSaveStateLabel(): string {
    switch (saveState) {
      case "saving": return "Saving…";
      case "saved": return "Saved";
      case "error": return "Save failed";
      case "unsaved": return "Unsaved changes";
      default: return "Unsaved";
    }
  }

  const saveStateColor =
    saveState === "saved" ? "text-success-text"
    : saveState === "saving" ? "text-tertiary"
    : saveState === "error" ? "text-error-text"
    : "text-warning-text";

  async function handleSend() {
    const quoteId = data.savedQuoteId;
    if (!quoteId) return;
    try {
      const { finalizeQuote, sendQuote } = await import("../../api/client");
      await finalizeQuote(quoteId);
      await sendQuote(quoteId);
    } catch (err: any) {
      // error handled by actionMessage in hook
    }
    setReviewOpen(false);
  }

  async function handleDownloadPdf() {
    const quoteId = data.savedQuoteId;
    if (!quoteId) return;
    try {
      const { getQuotePdf } = await import("../../api/client");
      const blob = await getQuotePdf(quoteId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quote-${quoteId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      // handle error
    }
  }

  async function handleConvert() {
    const quoteId = data.savedQuoteId;
    if (!quoteId) return;
    if (!window.confirm("Convert this quote to an invoice? This will finalize the quote and create a new invoice.")) return;
    try {
      const { convertQuote } = await import("../../api/client");
      const result = await convertQuote(quoteId);
      if (result?.invoiceId) {
        navigate(`/app/invoices/${result.invoiceId}`);
      }
    } catch (err: any) {
      // error handling
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-surface-alt rounded" />
          <div className="h-4 bg-surface-alt rounded w-full max-w-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-64 bg-surface-alt rounded-xl" />
              <div className="h-32 bg-surface-alt rounded-xl" />
            </div>
            <div className="h-48 bg-surface-alt rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/app/quotes")}
            className="rounded-lg p-1.5 text-tertiary hover:text-primary hover:bg-surface-alt"
            aria-label="Back to quotes"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold text-primary">
            {isNew ? "New Quote" : `Quote ${data.savedQuoteId ? `#${data.savedQuoteId.slice(0, 8)}` : ""}`}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {actionMessage && (
            <span className={`text-sm ${saveStateColor}`}>{actionMessage}</span>
          )}
          <div className={`flex items-center gap-1.5 text-sm font-medium ${saveStateColor}`}>
            {saveState === "saving" && (
              <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
            )}
            {getSaveStateLabel()}
          </div>
          {!isNew && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<Download className="h-4 w-4" />}
                onClick={handleDownloadPdf}
              >
                PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Send className="h-4 w-4" />}
                onClick={() => setReviewOpen(true)}
                disabled={validation.hasErrors}
              >
                Send
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={handleConvert}
              >
                Convert
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error / Action message */}
      {error && (
        <div className="p-3 status-error-bg border status-error-border rounded-lg">
          <p className="text-sm status-error-text">{error}</p>
        </div>
      )}

      {/* Validation panel */}
      {validation.issues.length > 0 && (
        <ValidationPanel issues={validation.issues} hasErrors={validation.hasErrors} hasWarnings={validation.hasWarnings} />
      )}

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer selector */}
          <div className="bg-surface rounded-xl border border-color-subtle p-6">
            <h3 className="text-sm font-medium text-secondary mb-3">Customer</h3>
            <select
              value={data.customerId ?? ""}
              onChange={(e) => updateField("customerId", e.target.value ? e.target.value : null)}
              className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select a customer</option>
              {customerOptions.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.companyName ? `(${c.companyName})` : ""}</option>
              ))}
            </select>
          </div>

          {/* Line items */}
          <div className="bg-surface rounded-xl border border-color-subtle p-6">
            <h3 className="text-sm font-medium text-secondary mb-3">Line Items</h3>
            <LineItemsTable
              items={data.items}
              currency={data.currency}
              onChange={setItems}
            />
          </div>

          {/* Fees */}
          <div className="bg-surface rounded-xl border border-color-subtle p-6">
            <FeesSection
              fees={data.fees}
              currency={data.currency}
              onChange={setFees}
            />
          </div>

          {/* Quote details */}
          <div className="bg-surface rounded-xl border border-color-subtle p-6">
            <QuoteDetailsForm
              data={data}
              customers={customerOptions}
              onChange={updateField}
              currencyLocked={currencyLocked}
            />
          </div>
        </div>

        {/* Totals sidebar */}
        <div>
          <div className="bg-surface rounded-xl border border-color-subtle p-6 sticky top-6">
            <h3 className="text-sm font-medium text-secondary mb-3">Totals</h3>
            <QuoteTotals calcResult={calcResult} currency={data.currency} />

            {isNew && (
              <button
                type="button"
                onClick={doSave}
                disabled={saveState === "saving"}
                className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-action px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-60"
              >
                {saveState === "saving" ? (
                  <span className="animate-spin h-4 w-4 border-2 border-on-primary border-t-transparent rounded-full" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saveState === "saving" ? "Saving…" : "Save Draft"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Review & Send dialog */}
      <ReviewAndSendDialog
        open={reviewOpen}
        data={data}
        calcResult={calcResult}
        onClose={() => setReviewOpen(false)}
        onSend={handleSend}
        onDownloadPdf={handleDownloadPdf}
      />
    </div>
  );
}
