import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText, Quote as QuoteIcon, CreditCard, Receipt, ShoppingCart } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";
import { useMetaTags } from "@/hooks/useMetaTags";
import { getDocumentTemplates } from "@/api/client";
import type { ApiTemplate } from "@/types/api";
import { docTypeLabel as docTypeLabelFn } from "@/components/document/document-handlers";
import type { DocumentType } from "@/components/document/document-types";

interface DocTypeOption {
  type: Exclude<DocumentType, "receipt">;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const docTypeOptions: DocTypeOption[] = [
  {
    type: "invoice",
    label: "Invoice",
    description: "Bill a customer for goods or services",
    icon: <FileText className="w-6 h-6" />,
  },
  {
    type: "quote",
    label: "Quotation",
    description: "Provide a price estimate to a customer",
    icon: <QuoteIcon className="w-6 h-6" />,
  },
  {
    type: "credit-note",
    label: "Credit Note",
    description: "Issue a credit or refund to a customer",
    icon: <CreditCard className="w-6 h-6" />,
  },
  {
    type: "debit-note",
    label: "Debit Note",
    description: "Charge a customer for an additional amount owed",
    icon: <FileText className="w-6 h-6" />,
  },
  {
    type: "payment-voucher",
    label: "Payment Voucher",
    description: "Record a business payment to a payee",
    icon: <Receipt className="w-6 h-6" />,
  },
  {
    type: "purchase-order",
    label: "Purchase Order",
    description: "Record a purchase order to a supplier",
    icon: <ShoppingCart className="w-6 h-6" />,
  },
];

export default function CreateDocumentFlow() {
  useMetaTags({
    title: "Create Document - DocForge",
    description: "Create a new invoice, quote, credit note, debit note, payment voucher, or purchase order.",
    noIndex: true,
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") as DocumentType | null;

  const [selectedType, setSelectedType] = useState<DocumentType | null>(initialType);
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await getDocumentTemplates({ limit: 50 });
      const allTemplates = data.templates ?? [];
      const customTemplates = allTemplates.filter(
        (t: ApiTemplate) => t.config?.type === "custom" || t.config?.documentType,
      );
      setTemplates(customTemplates);
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }

  const getRoutePrefix = (docType: DocumentType): string => {
    const map: Record<DocumentType, string> = {
      "invoice": "invoices",
      "quote": "quotes",
      "credit-note": "credit-notes",
      "debit-note": "debit-notes",
      "payment-voucher": "payment-vouchers",
      "receipt": "receipts",
      "purchase-order": "purchase-orders",
    };
    return map[docType] ?? docType;
  };

  const handleCreate = (docType: DocumentType, templateId?: string) => {
    const prefix = getRoutePrefix(docType);
    const params = templateId ? `?template=${templateId}` : "";
    navigate(`/app/${prefix}/new${params}`);
  };

  const templatesForType = selectedType
    ? templates.filter(
        (t) =>
          t.config?.documentType === selectedType ||
          t.config?.documentType === mapDocTypeBackend(selectedType),
      )
    : [];

  const hasTemplatesForSelected = templatesForType.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Document"
        breadcrumbs={[
          { label: "Home", to: "/app" },
          { label: "Create Document" },
        ]}
        description="Choose the type of document you want to create."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <h3 className="text-sm font-medium text-tertiary mb-3">Document Type</h3>
          <div className="space-y-2">
            {docTypeOptions.map((opt) => (
              <button
                key={opt.type}
                onClick={() => setSelectedType(opt.type)}
                className={`w-full flex items-center gap-3 p-4 rounded-lg border text-left transition-colors ${
                  selectedType === opt.type
                    ? "border-color-strong bg-primary-bg text-primary"
                    : "border-color-subtle bg-surface hover:border-color-strong hover:bg-surface-alt"
                }}`}
              >
                <span
                  className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                    selectedType === opt.type
                      ? "bg-primary-action text-on-primary"
                      : "bg-primary-bg text-primary-brand"
                  }`}
                >
                  {opt.icon}
                </span>
                <div>
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs opacity-70">{opt.description}</div>
                </div>
              </button>
            ))}
          </div>

          {selectedType && !hasTemplatesForSelected && !templatesLoading && (
            <Button
              variant="primary"
              size="md"
              onClick={() => handleCreate(selectedType!)}
              className="w-full mt-6"
            >
              Create New {docTypeLabelFn(selectedType!)}
            </Button>
          )}
        </div>

        {selectedType && (
          <div className="lg:col-span-2">
            <h3 className="text-sm font-medium text-tertiary mb-3">
              Choose a Template
            </h3>

            {templatesLoading ? (
              <div className="text-center py-10 text-tertiary">
                Loading templates...
              </div>
            ) : hasTemplatesForSelected ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templatesForType.map((template) => (
                  <div
                    key={template.id}
                    className="border border-color-subtle rounded-lg p-4 bg-surface hover:border-color-strong hover:bg-surface-alt transition-colors cursor-pointer"
                    onClick={() => handleCreate(selectedType!, template.id)}
                  >
                    <div className="font-medium text-primary">{template.name}</div>
                    {"layout" in (template.config ?? {}) && (
                      <div className="text-xs text-tertiary mt-1">
                        Theme: {String((template.config as any)?.layout?.style?.theme ?? "Modern")}
                      </div>
                    )}
                    {!template.is_default && (
                      <span className="text-xs text-primary">Custom</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-color-subtle border-dashed rounded-lg p-8 text-center bg-surface-alt">
                <FileText className="w-8 h-8 mx-auto mb-3 text-tertiary opacity-50" />
                <h4 className="font-medium text-primary mb-1">No custom templates yet</h4>
                <p className="text-sm text-tertiary mb-4">
                  Create a document and save its layout as a template, or use the Default option below.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<FileText className="w-4 h-4" />}
                  onClick={() => handleCreate(selectedType!)}
                >
                  Use Default Template
                </Button>
              </div>
            )}

            {hasTemplatesForSelected && (
              <button
                type="button"
                onClick={() => handleCreate(selectedType!)}
                className="w-full text-center py-3 mt-4 text-sm text-primary hover:text-primary/80 hover:bg-surface-alt rounded-lg border border-color-subtle"
              >
                + Create with Default Template
              </button>
            )}
          </div>
        )}
      </div>

      <div className="pt-4">
        <Button variant="secondary" onClick={() => navigate("/app/documents")}>
          Browse existing documents
        </Button>
      </div>
    </div>
  );
}

function mapDocTypeBackend(docType: DocumentType): string {
  const map: Record<DocumentType, string> = {
    "invoice": "invoice",
    "quote": "quote",
    "credit-note": "credit_note",
    "debit-note": "debit_note",
    "payment-voucher": "payment_voucher",
    "receipt": "receipt",
    "purchase-order": "purchase_order",
  };
  return map[docType] ?? docType;
}
