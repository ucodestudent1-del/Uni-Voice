import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getQuoteById,
  sendQuote,
  getQuotePdf,
  convertQuote,
  type ApiQuote,
} from "../api/client";
import { formatCurrencyValue } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { Download, Send, Copy, ArrowLeft } from "lucide-react";
import QuoteBuilder from "../components/QuoteBuilder/QuoteBuilder";

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew && id) {
      loadQuote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadQuote() {
    if (!id) return;
    setLoading(true);
    try {
      const { quote } = await getQuoteById(id);
      setQuote(quote);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load quote");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!id) return;
    setSaving(true);
    try {
      await sendQuote(id);
      setActionMessage("Quote sent successfully!");
      loadQuote();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to send quote");
    } finally {
      setSaving(false);
    }
  }

  async function handleConvert() {
    if (!id) return;
    if (!window.confirm("Convert this quote to an invoice?")) return;
    setSaving(true);
    try {
      const result = await convertQuote(id);
      setActionMessage(`Converted to invoice #${result.invoiceId?.slice(0, 8)}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to convert quote");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!id) return;
    try {
      const blob = await getQuotePdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quote-${id.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to download PDF");
    }
  }

  if (isNew) {
    return <QuoteBuilder quoteId={null} />;
  }

  if (loading) {
    return <div className="p-6 text-secondary">Loading quote…</div>;
  }

  if (!quote) {
    return <div className="p-6 text-secondary">Quote not found.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => navigate("/app/quotes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-primary">
            Quote {quote.quote_number || `#${quote.id.slice(0, 8)}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={handleDownloadPdf}>
            PDF
          </Button>
          <Button variant="secondary" size="sm" icon={<Send className="w-4 h-4" />} onClick={handleSend} disabled={saving}>
            Send
          </Button>
          <Button variant="primary" size="sm" icon={<Copy className="w-4 h-4" />} onClick={handleConvert} disabled={saving}>
            Convert
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 status-error-bg border status-error-border rounded-lg">
          <p className="text-sm status-error-text">{error}</p>
        </div>
      )}
      {actionMessage && (
        <div className="p-3 status-success-bg border status-success-border rounded-lg">
          <p className="text-sm status-success-text">{actionMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface rounded-xl border border-color-subtle p-6">
          <h3 className="text-sm font-medium text-secondary mb-3">Line Items</h3>
          <div className="space-y-2 text-sm">
            {quote.items?.map((it) => (
              <div key={it.id} className="flex justify-between">
                <span className="text-secondary">{it.description} × {it.quantity} {it.unit}</span>
                <span className="text-primary">{formatCurrencyValue(Number(it.line_total), quote.currency)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-color-subtle p-6">
          <h3 className="text-sm font-medium text-secondary mb-3">Totals</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-secondary">Subtotal</span><span>{formatCurrencyValue(Number(quote.subtotal), quote.currency)}</span></div>
            <div className="flex justify-between"><span className="text-secondary">Discount</span><span>-{formatCurrencyValue(Number(quote.discount_total), quote.currency)}</span></div>
            <div className="flex justify-between"><span className="text-secondary">Tax</span><span>{formatCurrencyValue(Number(quote.tax_total), quote.currency)}</span></div>
            <div className="flex justify-between"><span className="text-secondary">Fees</span><span>{formatCurrencyValue(Number(quote.fee_total), quote.currency)}</span></div>
            <div className="flex justify-between font-semibold pt-2 border-t border-color-subtle">
              <span className="text-primary">Total</span>
              <span className="text-primary">{formatCurrencyValue(Number(quote.total), quote.currency)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-color-subtle p-6">
        <h3 className="text-sm font-medium text-secondary mb-3">Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-tertiary">Status</span><span className="text-primary ml-2">{quote.status}</span></div>
          <div><span className="text-tertiary">Currency</span><span className="text-primary ml-2">{quote.currency}</span></div>
          <div><span className="text-tertiary">Issue Date</span><span className="text-primary ml-2">{quote.issue_date}</span></div>
          <div><span className="text-tertiary">Due Date</span><span className="text-primary ml-2">{quote.due_date}</span></div>
        </div>
        {quote.notes && (
          <div className="mt-3">
            <span className="text-tertiary text-sm">Notes</span>
            <p className="text-primary mt-1">{quote.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
