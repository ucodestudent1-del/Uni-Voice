import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SectionCard from "@/components/SectionCard";
import { getDocumentRoutePrefix, docTypeLabel } from "@/components/document";
import { getRelatedDocuments, type ApiRelatedDocument, type DocumentTypeParam } from "@/api/client";
import { Loader2, ExternalLink, FileText, CreditCard, Receipt, FileInput, FileOutput, ClipboardList } from "lucide-react";

const docTypeIconMap: Record<string, React.ElementType> = {
  "invoice": FileText,
  "quote": FileInput,
  "credit-note": CreditCard,
  "debit-note": FileOutput,
  "payment-voucher": Receipt,
  "receipt": Receipt,
  "purchase-order": ClipboardList,
};

const docTypeLabelMap: Record<string, string> = {
  "invoice": "Invoice",
  "quote": "Quote",
  "credit-note": "Credit Note",
  "debit-note": "Debit Note",
  "payment-voucher": "Payment Voucher",
  "receipt": "Receipt",
  "purchase-order": "Purchase Order",
};

interface RelatedDocumentsProps {
  docType: DocumentTypeParam;
  docId: string;
}

export function RelatedDocuments({ docType, docId }: RelatedDocumentsProps) {
  const [related, setRelated] = useState<ApiRelatedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!docId) return;
    const fetchRelated = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getRelatedDocuments(docType, docId);
        setRelated(res.related);
      } catch (e: any) {
        setError(e.message || "Failed to load related documents");
      } finally {
        setLoading(false);
      }
    };
    fetchRelated();
  }, [docType, docId]);

  const handleNavigate = (relDoc: ApiRelatedDocument) => {
    const routePrefix = getDocumentRoutePrefix(relDoc.docType as any);
    navigate(`/app/${routePrefix}/${relDoc.id}`);
  };

  if (loading && related.length === 0) {
    return (
      <SectionCard title="Related Documents">
        <div className="p-5">
          <div className="flex items-center space-x-2 text-sm text-tertiary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading related documents…</span>
          </div>
        </div>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard title="Related Documents">
        <div className="p-5">
          <p className="text-sm text-error">{error}</p>
        </div>
      </SectionCard>
    );
  }

  if (related.length === 0) {
    return (
      <SectionCard title="Related Documents">
        <div className="p-5">
          <p className="text-sm text-tertiary">No related documents found.</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Related Documents">
      <div className="p-5">
        <div className="space-y-3">
          {related.map((rel) => {
            const Icon = docTypeIconMap[rel.docType] ?? FileText;
            const label = docTypeLabelMap[rel.docType] ?? rel.docType;
            const statusColor = rel.isFinalized
              ? "text-success"
              : rel.status === "sent" || rel.status === "paid"
                ? "text-info"
                : "text-warning";

            return (
              <div
                key={`${rel.docType}-${rel.id}`}
                className="flex items-center justify-between p-3 rounded-lg border border-color-subtle hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={() => handleNavigate(rel)}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-tertiary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{label}</span>
                      <span className={`text-xs font-medium capitalize ${statusColor}`}>{rel.status}</span>
                      {rel.relationType && (
                        <span className="text-xs text-tertiary">· {rel.relationType}</span>
                      )}
                    </div>
                    {rel.docNumber && (
                      <p className="text-sm text-tertiary mt-0.5">#{rel.docNumber}</p>
                    )}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-tertiary" />
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
