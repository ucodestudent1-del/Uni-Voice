import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Send,
  CheckCircle,
  Download,
} from "lucide-react";
import {
  getProprietaryInvoice,
  finalizeProprietaryInvoice,
  sendProprietaryInvoice,
  markProprietaryInvoicePaid,
  getProprietaryInvoicePdf,
  getProprietaryInvoiceEvents,
  getProprietaryInvoiceShareLink,
  getProprietaryQuote,
  finalizeProprietaryQuote,
  sendProprietaryQuote,
  acceptProprietaryQuote,
  convertProprietaryQuote,
  getProprietaryQuotePdf,
  getProprietaryQuoteShareLink,
} from "../api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast, StatusBadge, invoiceStatusConfig, quoteStatusConfig, Button, Skeleton } from "@/components/ui";
import { formatCurrencyValue } from "@/lib/utils";
import { useMetaTags } from "@/hooks/useMetaTags";

type DocType = "invoice" | "quote";

interface DocState {
  id: string;
  invoice_number?: string | null;
  quote_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  status: string;
  currency: string;
  subtotal: string;
  discount_total?: string;
  tax_total?: string;
  fee_total?: string;
  total: string;
  amount_paid?: string;
  amount_due?: string;
  issue_date?: string | null;
  due_date?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
  terms?: string | null;
  payment_instructions?: string | null;
  po_number?: string | null;
  scope_of_work?: string | null;
  is_finalized: boolean;
  items: any[];
  fees: any[];
}

export default function ProprietaryDocumentWorkspace() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("manual");
  const [paymentReference, setPaymentReference] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);

  const handleGenerateShareLink = async () => {
    setIsGeneratingShare(true);
    try {
      const result =
        docType === "invoice"
          ? await getProprietaryInvoiceShareLink(id!)
          : await getProprietaryQuoteShareLink(id!);
      setShareLink(result.url);
    } catch (err: any) {
      toast(err?.message || "Failed to generate share link.", {
        title: "Error",
        type: "error",
      });
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const pathSegments = window.location.pathname.split("/");
  const docType: DocType = pathSegments.includes("quotes") ? "quote" : "invoice";
  const basePath = `/app/proprietary/${docType === "invoice" ? "invoices" : "quotes"}`;

  useMetaTags({
    title: `${docType === "invoice" ? "Invoice" : "Quote"} — DocForge`,
    description: `${docType === "invoice" ? "Invoice" : "Quote"} details and payment history.`,
    noIndex: true,
  });

  const {
    data: docData,
    isLoading,
  } = useQuery({
    queryKey: ["proprietary-document", id, docType],
    queryFn: (() => {
      if (docType === "invoice") return getProprietaryInvoice(id!);
      return getProprietaryQuote(id!);
    }) as any,
    enabled: Boolean(id),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: eventsData,
  } = useQuery({
    queryKey: ["proprietary-document-events", id, docType],
    queryFn: () =>
      docType === "invoice"
        ? getProprietaryInvoiceEvents(id!)
        : Promise.resolve({ events: [] }),
    enabled: Boolean(id),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const doc: DocState | null = useMemo(() => {
    if (!docData) return null;
    const d = docType === "invoice" ? (docData as any).invoice : (docData as any).quote;
    return d as unknown as DocState;
  }, [docData, docType]);

  const finalizeMutation = useMutation({
    mutationFn: () =>
      docType === "invoice"
        ? finalizeProprietaryInvoice(id!)
        : finalizeProprietaryQuote(id!),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["proprietary-document", id, docType] });
      queryClient.invalidateQueries({ queryKey: ["proprietary-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["proprietary-quotes"] });
      toast(
        `${docType === "invoice" ? "Invoice" : "Quote"} #${data.invoiceNumber || data.quoteNumber} has been finalized.`,
        { title: "Finalized" },
      );
    },
    onError: (err: any) => {
      toast(err?.message || "Failed to finalize document.", {
        title: "Error",
        type: "error",
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (emailData?: { to?: string; subject?: string; message?: string }) =>
      docType === "invoice"
        ? sendProprietaryInvoice(id!, emailData ?? {})
        : sendProprietaryQuote(id!, emailData ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proprietary-document", id, docType] });
      toast(`${docType === "invoice" ? "Invoice" : "Quote"} sent successfully.`, {
        title: "Sent",
      });
    },
    onError: (err: any) => {
      toast(err?.message || "Failed to send document.", {
        title: "Error",
        type: "error",
      });
    },
  });

  const markPaidMutation = useMutation({
     mutationFn: (data: { amount: string | number; method?: string; reference?: string }) =>
      markProprietaryInvoicePaid(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proprietary-document", id, docType] });
      queryClient.invalidateQueries({ queryKey: ["proprietary-invoices"] });
      toast("Payment recorded successfully.", { title: "Payment Recorded" });
    },
    onError: (err: any) => {
       toast(err?.message || "Failed to record payment.", {
        title: "Error",
        type: "error",
      });
    },
  });

  const handleRecordPayment = () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast("Please enter a valid payment amount.", {
        title: "Invalid Amount",
        type: "error",
      });
      return;
    }
    const maxAmount = parseFloat(doc?.amount_due || doc?.total || "0");
    if (parseFloat(paymentAmount) > maxAmount) {
      toast(`Payment cannot exceed balance due (${formatCurrencyValue(doc?.amount_due || doc?.total || "0", doc?.currency || "USD")}).`, {
        title: "Invalid Amount",
        type: "error",
      });
      return;
    }
    markPaidMutation.mutate({
      amount: paymentAmount,
      method: paymentMethod,
      reference: paymentReference || undefined,
    });
    setShowPaymentModal(false);
    setPaymentAmount("");
    setPaymentMethod("manual");
    setPaymentReference("");
  };

  const acceptQuoteMutation = useMutation({
    mutationFn: () => acceptProprietaryQuote(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proprietary-document", id, docType] });
      toast("Quote accepted successfully.", { title: "Accepted" });
    },
    onError: (err: any) => {
      toast(err?.message || "Failed to accept quote.", {
        title: "Error",
        type: "error",
      });
    },
  });

  const convertMutation = useMutation({
    mutationFn: () => convertProprietaryQuote(id!),
    onSuccess: (data: any) => {
      toast("Quote converted to invoice successfully.", {
        title: "Converted",
      });
      navigate(`/app/proprietary/invoices/${data.invoiceId}/edit`);
    },
    onError: (err: any) => {
      toast(err?.message || "Failed to convert quote.", {
        title: "Error",
        type: "error",
      });
    },
  });

  const downloadPdf = async () => {
    try {
      const blob =
        docType === "invoice"
          ? await getProprietaryInvoicePdf(id!)
          : await getProprietaryQuotePdf(id!);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docType}-${id!.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast("Failed to download PDF.", {
        title: "Error",
        type: "error",
      });
    }
  };

  const getStatusBadge = () => {
    if (!doc?.status) return null;
    const config = docType === "invoice" ? invoiceStatusConfig : quoteStatusConfig;
    return <StatusBadge status={doc.status} config={config} />;
  };

  if (isLoading || !doc) {
    return (
      <div className="flex items-center justify-center h-64">
        <Skeleton className="h-8 w-8 rounded-full animate-spin" />
      </div>
    );
  }

  const items = doc.items || [];
  const fees = doc.fees || [];

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {docType === "invoice" ? "Invoice" : "Quote"} #{doc.invoice_number || doc.quote_number || doc.id.slice(0, 8)}
          </h1>
          <div className="mt-1 flex items-center gap-3">
            {getStatusBadge()}
            {doc.is_finalized && (
              <span className="text-xs text-secondary">Finalized</span>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`${basePath}/${id}/edit`)}
          >
            Edit
          </Button>
          {doc.is_finalized && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowShareModal(true)}
            >
              Share
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="border rounded-lg p-4">
            <h2 className="font-medium text-sm text-secondary mb-2">From</h2>
            <p className="font-medium">{(doc as any).business?.name || "Your Business"}</p>
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="font-medium text-sm text-secondary mb-2">To</h2>
            <p className="font-medium">{doc.customer_name || "Unknown Customer"}</p>
            {doc.customer_email && (
              <p className="text-secondary">{doc.customer_email}</p>
            )}
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="font-medium text-sm text-secondary mb-2">Line Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Description</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Unit Price</th>
                    <th className="text-right py-2">Tax</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-2">{item.description}</td>
                      <td className="text-right py-2">{item.quantity}</td>
                      <td className="text-right py-2">{formatCurrencyValue(item.unit_price, doc.currency)}</td>
                      <td className="text-right py-2">{item.tax_rate}%</td>
                      <td className="text-right py-2">
                        {formatCurrencyValue(
                          (parseFloat(item.quantity) * parseFloat(item.unit_price)).toString(),
                          doc.currency,
                        )}
                      </td>
                    </tr>
                  ))}
                  {fees.map((f: any) => (
                    <tr key={f.id} className="border-b">
                      <td className="py-2">{f.description}</td>
                      <td colSpan={3} className="text-right text-secondary">Fee</td>
                      <td className="text-right py-2">{formatCurrencyValue(f.amount, doc.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {doc.notes && (
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm text-secondary mb-2">Notes</h3>
              <p className="text-sm text-secondary whitespace-pre-wrap">{doc.notes}</p>
            </div>
          )}

          {doc.terms && (
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm text-secondary mb-2">Terms</h3>
              <p className="text-sm text-secondary whitespace-pre-wrap">{doc.terms}</p>
            </div>
          )}

          {doc.scope_of_work && docType === "quote" && (
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm text-secondary mb-2">Scope of Work</h3>
              <p className="text-sm text-secondary whitespace-pre-wrap">
                {doc.scope_of_work}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="border rounded-lg p-4 bg-muted/30">
            <h3 className="font-medium mb-3">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Subtotal</span>
                <span>{formatCurrencyValue(doc.subtotal, doc.currency)}</span>
              </div>
              {(doc.discount_total && parseFloat(doc.discount_total) > 0) && (
                <div className="flex justify-between">
                  <span className="text-secondary">Discount</span>
                  <span className="text-red-600">
                    -{formatCurrencyValue(doc.discount_total, doc.currency)}
                  </span>
                </div>
              )}
              {(doc.tax_total && parseFloat(doc.tax_total) > 0) && (
                <div className="flex justify-between">
                  <span className="text-secondary">Tax</span>
                  <span>{formatCurrencyValue(doc.tax_total, doc.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span>{formatCurrencyValue(doc.total, doc.currency)}</span>
              </div>
              {docType === "invoice" && (
                <>
                  {(doc.amount_paid && parseFloat(doc.amount_paid) > 0) && (
                    <div className="flex justify-between pt-2">
                      <span className="text-secondary">Paid</span>
                      <span className="text-green-600">
                        {formatCurrencyValue(doc.amount_paid, doc.currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium pt-2">
                    <span>Balance Due</span>
                    <span
                      className={
                        parseFloat(doc.amount_due || "0") > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }
                    >
                      {formatCurrencyValue(doc.amount_due || doc.total, doc.currency)}
                    </span>
                  </div>
                </>
              )}
              {docType === "quote" && doc.expiry_date && (
                <div className="flex justify-between pt-2">
                  <span className="text-secondary">Expires</span>
                  <span>{doc.expiry_date}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {!doc.is_finalized && (
              <button
                onClick={() => finalizeMutation.mutate()}
                className="w-full px-3 py-2 bg-primary-action text-on-primary rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
              >
                Finalize
              </button>
            )}

            {doc.is_finalized && docType === "invoice" && (
              <>
                <button
                  onClick={() => sendMutation.mutate()}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Send
                </button>

                 {parseFloat(doc.amount_due || "0") > 0 && (
                   <button
                     onClick={() => setShowPaymentModal(true)}
                     className="w-full px-3 py-2 border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
                   >
                     <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8m0 0l-3-3m3 3l3-3" />
                     </svg>
                     Record Payment
                   </button>
                 )}
              </>
            )}

            {doc.is_finalized && docType === "quote" && doc.status !== "accepted" && doc.status !== "converted" && (
              <button
                onClick={() => acceptQuoteMutation.mutate()}
                className="w-full px-3 py-2 border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Accept
              </button>
            )}

            {doc.is_finalized && docType === "quote" && doc.status === "accepted" && (
              <button
                onClick={() => convertMutation.mutate()}
                className="w-full px-3 py-2 border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 9h10a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4a2 2 0 012-2z" />
                </svg>
                Convert to Invoice
              </button>
            )}

            {doc.is_finalized && (
              <button
                onClick={downloadPdf}
                className="w-full px-3 py-2 border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {eventsData?.events && eventsData.events.length > 0 && (
        <div className="border rounded-lg p-4">
          <h2 className="font-medium mb-3">Activity Log</h2>
          <div className="space-y-2">
            {eventsData.events.map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-secondary">
                  {e.created_at?.slice(0, 19) || e.timestamp?.slice(0, 19)}
                </span>
                <span>{e.description || e.action || JSON.stringify(e)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    {showPaymentModal && doc && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Record Payment</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                max={doc.amount_due || doc.total}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={formatCurrencyValue(doc.amount_due || doc.total || "0", doc.currency)}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <div className="text-xs text-secondary mt-1">
                Balance due: {formatCurrencyValue(doc.amount_due || doc.total || "0", doc.currency)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="manual">Manual</option>
                <option value="card">Card</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="check">Check</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reference (optional)</label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. Transaction ID, Check #"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
          <div className="p-4 border-t flex justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setShowPaymentModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleRecordPayment}>
              Record Payment
            </Button>
          </div>
        </div>
      </div>
    )}

    {showShareModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Share {docType === "invoice" ? "Invoice" : "Quote"}</h2>
          </div>
          <div className="p-6 space-y-4">
            {shareLink ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Shareable Link</label>
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <a
                  href={shareLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                >
                  Open Public Link
                </a>
              </>
            ) : (
              <p className="text-sm text-secondary">
                Generate a shareable link to this {docType === "invoice" ? "invoice" : "quote"} that customers can view and pay online.
              </p>
            )}
          </div>
          <div className="p-4 border-t flex justify-end gap-3">
            {!shareLink && (
              <Button variant="secondary" size="sm" onClick={handleGenerateShareLink} disabled={isGeneratingShare}>
                {isGeneratingShare ? "Generating…" : "Generate Link"}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowShareModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
