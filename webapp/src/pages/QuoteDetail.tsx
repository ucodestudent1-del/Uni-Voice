import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getQuoteById,
  sendQuote,
  getQuotePdf,
  convertQuote,
  convertAndSendQuote,
  getQuoteEvents,
  getBusiness,
  getCustomer,
  type ApiQuote,
} from "../api/client";
import type { ApiBusiness, ApiCustomer } from "../types/api";
import type { PreviewQuote } from "../components/QuotePreviewV2";
import QuotePreviewV2, { buildPreviewQuote } from "../components/QuotePreviewV2";
import { Button } from "../components/ui/Button";
import { Download, Send, Copy, ArrowLeft } from "lucide-react";
import QuoteBuilder from "../components/QuoteBuilder/QuoteBuilder";

export interface ApiQuoteEvent {
  id?: string;
  quote_id?: string;
  event_type: string;
  actor_type?: string | null;
  actor_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [customer, setCustomer] = useState<ApiCustomer | null>(null);
  const [events, setEvents] = useState<ApiQuoteEvent[]>([]);
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
      const [quoteRes, eventsRes, bizRes] = await Promise.allSettled([
        getQuoteById(id),
        getQuoteEvents(id),
        getBusiness().catch(() => null),
      ]);
      if (quoteRes.status === "fulfilled") {
        const q = quoteRes.value.quote;
        setQuote(q);
        if (q?.customer_id) {
          getCustomer(q.customer_id)
            .then((res) => setCustomer(res.customer ?? null))
            .catch(() => setCustomer(null));
        }
      }
      if (eventsRes.status === "fulfilled") setEvents(eventsRes.value.events ?? []);
      if (bizRes.status === "fulfilled" && bizRes.value) setBusiness(bizRes.value.business ?? null);
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

  async function handleConvertAndSend() {
    if (!id) return;
    if (!window.confirm("Convert this quote to an invoice and send it to the customer?")) return;
    setSaving(true);
    try {
      const result = await convertAndSendQuote(id);
      setActionMessage(`Converted and sent! Invoice #${result.invoiceId?.slice(0, 8)}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to convert and send quote");
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

  const previewQuote = useMemo<PreviewQuote | null>(
    () => (quote ? buildPreviewQuote(quote, business, customer) : null),
    [quote, business, customer]
  );

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
          <Button variant="secondary" size="sm" icon={<Copy className="w-4 h-4" />} onClick={handleConvert} disabled={saving}>
            Convert
          </Button>
          <Button variant="primary" size="sm" icon={<Send className="w-4 h-4" />} onClick={handleConvertAndSend} disabled={saving}>
            Convert &amp; Send
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

      {previewQuote ? <QuotePreviewV2 quote={previewQuote} /> : null}

      <div className="bg-surface rounded-xl border border-color-subtle p-6">
        <h3 className="text-sm font-medium text-secondary mb-3">Activity Timeline</h3>
        {events.length === 0 ? (
          <p className="text-sm text-secondary">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => (
              <QuoteTimelineItem key={e.id ?? `${e.event_type}-${e.created_at}`} event={e} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function QuoteTimelineItem({ event }: { event: ApiQuoteEvent }) {
   const label = (event.event_type ?? "").replace(/_/g, " ");
   const actor =
     event.actor_type === "customer" ? "Customer"
     : event.actor_type === "payment" ? "Payment"
     : event.actor_type === "system" ? "System"
     : event.actor_type === "user" ? "User"
     : "System";
   return (
     <li className="flex gap-3">
       <div className="h-2 w-2 flex-shrink-0 rounded-full bg-primary-action mt-1" aria-hidden="true"></div>
       <div className="flex-1">
         <p className="text-sm font-medium text-primary capitalize" aria-label={`${label} by ${actor}`}>
           {label}
         </p>
         <p className="text-xs text-tertiary">
           {actor} · {formatDate(event.created_at)}
         </p>
       </div>
     </li>
   );
}

function formatDate(dateStr: string | undefined): string {
   if (!dateStr) return "—";
   return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
