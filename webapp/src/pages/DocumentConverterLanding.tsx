import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Quote as QuoteIcon,
  CreditCard,
  Receipt,
  ShoppingCart,
  RefreshCw,
  Search,
  ArrowRightLeft,
} from "lucide-react";
import { Button, useToast, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/ui";
import { useMetaTags } from "@/hooks/useMetaTags";
import {
  getInvoices,
  getQuotes,
  getCreditNotes,
  getReceipts,
  getPurchaseOrders,
  getGenericDocuments,
  getAvailableConversions,
  convertDocument,
  type DocumentTypeParam,
  type ConvertDocumentResult,
} from "@/api/client";
import type {
  ApiInvoiceListItem,
  ApiQuoteListItem,
  ApiCreditNoteListItem,
  ApiPurchaseOrderListItem,
} from "@/types/api";
import type { ApiReceipt } from "@/api/client";
import type { GenericDocument } from "@/api/client";

type DocType = DocumentTypeParam;

interface DocItem {
  id: string;
  type: DocType;
  label: string;
  number?: string | null;
  status: string;
  date?: string | null;
  total?: string | null;
  currency?: string | null;
  icon: React.ReactNode;
}

const DOC_TYPE_CONFIG: Record<DocType, { label: string; icon: React.ReactNode }> = {
  invoice: { label: "Invoice", icon: <FileText className="w-5 h-5" /> },
  quote: { label: "Quote", icon: <QuoteIcon className="w-5 h-5" /> },
  "credit-note": { label: "Credit Note", icon: <CreditCard className="w-5 h-5" /> },
  "debit-note": { label: "Debit Note", icon: <FileText className="w-5 h-5" /> },
  "payment-voucher": { label: "Payment Voucher", icon: <Receipt className="w-5 h-5" /> },
  receipt: { label: "Receipt", icon: <Receipt className="w-5 h-5" /> },
  "purchase-order": { label: "Purchase Order", icon: <ShoppingCart className="w-5 h-5" /> },
  "recurring-invoice": { label: "Recurring Invoice", icon: <RefreshCw className="w-5 h-5" /> },
  "delivery-note": { label: "Delivery Note", icon: <FileText className="w-5 h-5" /> },
  "packing-slip": { label: "Packing Slip", icon: <FileText className="w-5 h-5" /> },
  "pro-forma-invoice": { label: "Pro Forma Invoice", icon: <FileText className="w-5 h-5" /> },
  estimate: { label: "Estimate", icon: <FileText className="w-5 h-5" /> },
};

const TABS: { key: string; label: string; docTypes: DocType[] }[] = [
  {
    key: "invoices",
    label: "Invoices",
    docTypes: ["invoice", "recurring-invoice", "pro-forma-invoice"],
  },
  {
    key: "sales",
    label: "Sales",
    docTypes: ["quote", "estimate", "delivery-note", "packing-slip"],
  },
  {
    key: "purchases",
    label: "Purchases",
    docTypes: ["purchase-order", "credit-note", "debit-note", "payment-voucher"],
  },
  {
    key: "receipts",
    label: "Receipts",
    docTypes: ["receipt"],
  },
];

export default function DocumentConverterLanding() {
  useMetaTags({
    title: "Document Converter — DocForge",
    description:
      "Convert documents between types (invoice to quote, credit note from invoice, etc.) or export in PDF, CSV, HTML, or Markdown.",
    noIndex: true,
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("invoices");
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [availableConversions, setAvailableConversions] = useState<DocType[]>([]);
  const [loadingConversions, setLoadingConversions] = useState(false);
  const [targetType, setTargetType] = useState<DocType | "">("");
  const [converting, setConverting] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        getInvoices({ limit: 100 }),
        getQuotes({ limit: 100 }),
        getCreditNotes({ limit: 100 }),
        getReceipts({ limit: 100 }),
        getPurchaseOrders({ limit: 100 }),
        getGenericDocuments("recurring-invoice", { limit: 100 }),
        getGenericDocuments("delivery-note", { limit: 100 }),
        getGenericDocuments("packing-slip", { limit: 100 }),
        getGenericDocuments("pro-forma-invoice", { limit: 100 }),
        getGenericDocuments("estimate", { limit: 100 }),
      ]);

      const items: DocItem[] = [];

      if (results[0].status === "fulfilled") {
        results[0].value.invoices.forEach((doc: ApiInvoiceListItem) => {
          items.push({
            id: doc.id,
            type: "invoice",
            label: "Invoice",
            number: doc.invoice_number,
            status: doc.status,
            date: doc.issue_date,
            total: doc.total,
            currency: doc.currency,
            icon: DOC_TYPE_CONFIG.invoice.icon,
          });
        });
      }

      if (results[1].status === "fulfilled") {
        results[1].value.quotes.forEach((doc: ApiQuoteListItem) => {
          items.push({
            id: doc.id,
            type: "quote",
            label: "Quote",
            number: doc.quote_number,
            status: doc.status,
            date: doc.issue_date,
            total: doc.total,
            currency: doc.currency,
            icon: DOC_TYPE_CONFIG.quote.icon,
          });
        });
      }

      if (results[2].status === "fulfilled") {
        results[2].value.creditNotes.forEach((doc: ApiCreditNoteListItem) => {
          items.push({
            id: doc.id,
            type: "credit-note",
            label: "Credit Note",
            number: doc.credit_note_number,
            status: doc.status,
            date: doc.created_at,
            icon: DOC_TYPE_CONFIG["credit-note"].icon,
          });
        });
      }

      if (results[3].status === "fulfilled") {
        results[3].value.receipts.forEach((doc: ApiReceipt) => {
          items.push({
            id: doc.id,
            type: "receipt",
            label: "Receipt",
            number: doc.receipt_number,
            status: doc.status || "issued",
            date: doc.created_at,
            icon: DOC_TYPE_CONFIG.receipt.icon,
          });
        });
      }

      if (results[4].status === "fulfilled") {
        results[4].value.purchaseOrders.forEach((doc: ApiPurchaseOrderListItem) => {
          items.push({
            id: doc.id,
            type: "purchase-order",
            label: "Purchase Order",
            number: doc.purchase_order_number,
            status: doc.status,
            date: doc.created_at,
            total: doc.total,
            currency: doc.currency,
            icon: DOC_TYPE_CONFIG["purchase-order"].icon,
          });
        });
      }

      const genericTypes: { result: any; type: DocType }[] = [
        { result: results[5], type: "recurring-invoice" },
        { result: results[6], type: "delivery-note" },
        { result: results[7], type: "packing-slip" },
        { result: results[8], type: "pro-forma-invoice" },
        { result: results[9], type: "estimate" },
      ];

      for (const { result, type } of genericTypes) {
        if (result.status === "fulfilled") {
          result.value.documents.forEach((doc: GenericDocument) => {
            items.push({
              id: doc.id,
              type,
              label: DOC_TYPE_CONFIG[type].label,
              number: doc.id.slice(0, 8),
              status: (doc.status as string) || "draft",
              date: (doc.created_at as string | null | undefined) ?? null,
              icon: DOC_TYPE_CONFIG[type].icon,
            });
          });
        }
      }

      setDocuments(items);
    } catch (err: any) {
      toast(err?.message ?? "Failed to load documents", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const filteredDocs = documents.filter((doc) => {
    const tab = TABS.find((t) => t.key === activeTab);
    if (!tab) return false;
    if (!tab.docTypes.includes(doc.type)) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        (doc.number?.toLowerCase().includes(query) ?? false) ||
        doc.label.toLowerCase().includes(query) ||
        doc.id.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleSelectDoc = async (doc: DocItem) => {
    setSelectedDoc(doc);
    setTargetType("");
    setLoadingConversions(true);
    try {
      const res = await getAvailableConversions(doc.type, doc.id);
      setAvailableConversions(res.conversions);
      if (res.conversions.length === 0) {
        toast(`No conversions available for this ${doc.label.toLowerCase()}.`, {
          type: "info",
        });
      } else {
        setTargetType(res.conversions[0]);
      }
    } catch (err: any) {
      toast(err?.message ?? "Failed to load available conversions", {
        type: "error",
      });
      setAvailableConversions([]);
    } finally {
      setLoadingConversions(false);
    }
  };

  const handleConvert = async () => {
    if (!selectedDoc || !targetType) return;

    setConverting(true);
    try {
      const result: ConvertDocumentResult = await convertDocument({
        docType: selectedDoc.type,
        docId: selectedDoc.id,
        targetType,
        copyItems: true,
        copyCustomer: true,
      });

      const targetLabel = DOC_TYPE_CONFIG[targetType]?.label ?? targetType;
      toast(`Converted to ${targetLabel} successfully`, { type: "success" });

      const typeMap: Record<string, string> = {
        invoice: "invoices",
        quote: "quotes",
        "credit-note": "credit-notes",
        "debit-note": "debit-notes",
        "payment-voucher": "payment-vouchers",
        receipt: "receipts",
        "purchase-order": "purchase-orders",
        "recurring-invoice": "recurring-invoices",
        "delivery-note": "delivery-notes",
        "packing-slip": "packing-slips",
        "pro-forma-invoice": "pro-forma-invoices",
        estimate: "estimates",
      };

      const prefix = typeMap[result.targetDocumentType] || result.targetDocumentType;
      navigate(`/app/${prefix}/${result.targetDocumentId}/edit`);
    } catch (err: any) {
      toast(err?.message ?? "Failed to convert document", { type: "error" });
    } finally {
      setConverting(false);
    }
  };

  const handleExport = async () => {
    if (!selectedDoc) return;

    const format = prompt("Enter export format (pdf, csv, html, markdown, xml):", "pdf");

    if (!format) return;

    try {
      const response = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType: selectedDoc.type,
          docId: selectedDoc.id,
          format: format.toLowerCase(),
        }),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedDoc.type}-${selectedDoc.id}.${format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast(`Exported as ${format.toLowerCase()}`, { type: "success" });
    } catch {
      toast("Failed to export document", { type: "error" });
    }
  };

  const handleBack = () => {
    setSelectedDoc(null);
    setTargetType("");
    setAvailableConversions([]);
    setSearchQuery("");
  };

  const canConvert = !!targetType && availableConversions.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Converter"
        breadcrumbs={[
          { label: "Documents", to: "/app/documents" },
          { label: "Document Converter" },
        ]}
        description="Convert documents between types (e.g., invoice to quote, credit note from invoice) or export in PDF, CSV, HTML, or Markdown."
        primaryAction={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={fetchDocuments}
            loading={loading}
          >
            Refresh
          </Button>
        }
      />

      {!selectedDoc ? (
        <>
          <div className="mb-4">
            <div className="flex gap-2 mb-4 overflow-x-auto border-b border-color-subtle">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.key
                      ? "border-primary-brand text-primary-brand"
                      : "border-transparent text-tertiary hover:text-primary"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary" />
              <input
                type="text"
                placeholder="Search by number or name..."
                className="form-input pl-10 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 bg-surface-alt rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredDocs.length === 0 ? (
            <EmptyState
              title="No documents found"
              description="No documents match your search criteria. Try adjusting your search or select a different category."
              icon={<ArrowRightLeft className="h-8 w-8" />}
              actionLabel="Clear search"
              onAction={() => setSearchQuery("")}
            />
          ) : (
            <div className="border border-color-subtle rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-alt border-b border-color-subtle">
                    <th className="text-left py-3 px-4 font-medium text-tertiary">Document</th>
                    <th className="text-left py-3 px-4 font-medium text-tertiary">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-tertiary">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-tertiary">Amount</th>
                    <th className="py-3 px-4 text-center font-medium text-tertiary">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => (
                    <tr
                      key={`${doc.type}-${doc.id}`}
                      className="border-b border-color-subtle hover:bg-surface-alt transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {doc.icon}
                          <div>
                            <div className="font-medium text-primary">
                              {doc.label} #{doc.number ?? doc.id.slice(0, 8)}
                            </div>
                            <div className="text-xs text-tertiary">{doc.date ? new Date(doc.date).toLocaleDateString() : ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-secondary">{doc.label}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-surface-alt text-tertiary">
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {doc.total ? (
                          <span className="text-primary">
                            {doc.total} {doc.currency?.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-tertiary">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<ArrowRightLeft className="h-4 w-4" />}
                          onClick={() => handleSelectDoc(doc)}
                          disabled={loadingConversions}
                        >
                          Convert
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="text-sm text-tertiary hover:text-primary transition-colors"
            >
              ← Back to all documents
            </button>
          </div>

          <div className="border border-color-subtle rounded-lg p-6 bg-surface-alt">
            <div className="flex items-center gap-4">
              {selectedDoc.icon}
              <div>
                <h3 className="text-lg font-semibold text-primary">
                  {selectedDoc.label} #{selectedDoc.number ?? selectedDoc.id.slice(0, 8)}
                </h3>
                <p className="text-sm text-secondary">
                  Status: {selectedDoc.status} · Date: {selectedDoc.date ? new Date(selectedDoc.date).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Convert to
              </label>
              {loadingConversions ? (
                <div className="h-10 bg-surface-alt rounded animate-pulse" />
              ) : availableConversions.length > 0 ? (
                <select
                  className="form-select w-full"
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as DocType)}
                  disabled={converting}
                >
                  <option value="">Select a target document type...</option>
                  {availableConversions.map((type) => (
                    <option key={type} value={type}>
                      {DOC_TYPE_CONFIG[type]?.label ?? type}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-tertiary">No conversion targets available for this document type.</p>
              )}

              {availableConversions.length > 0 && (
                <p className="text-xs text-tertiary mt-1">
                  Creates a new draft document of the selected type with fields mapped from this document.
                </p>
              )}
            </div>

            {canConvert && (
              <div className="flex gap-2">
                <Button
                  onClick={handleConvert}
                  loading={converting}
                  icon={<ArrowRightLeft className="h-4 w-4" />}
                >
                  Convert to {DOC_TYPE_CONFIG[targetType as DocType]?.label ?? targetType}
                </Button>
                <Button variant="secondary" onClick={handleExport}>
                  Export as PDF
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
