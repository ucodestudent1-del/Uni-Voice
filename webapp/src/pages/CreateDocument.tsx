import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Quote as QuoteIcon,
  CreditCard,
  Receipt,
  ShoppingCart,
} from "lucide-react";
import { Button, PageHeader } from "@/components/ui";
import { useMetaTags } from "@/hooks/useMetaTags";
import { getDocumentTemplates } from "@/api/client";
import type { ApiTemplate } from "@/types/api";

type DocType =
  | "invoice"
  | "quote"
  | "credit-note"
  | "payment-voucher"
  | "debit-note"
  | "purchase-order"
  | "recurring-invoice"
  | "delivery-note"
  | "packing-slip"
  | "pro-forma-invoice"
  | "estimate";

interface CreateOption {
  type: DocType;
  label: string;
  description: string;
  icon: React.ReactNode;
  path: string;
}

const createOptions: CreateOption[] = [
  {
    type: "invoice",
    label: "Invoice",
    description: "Bill a customer for goods or services",
    icon: <FileText className="w-6 h-6" />,
    path: "/app/invoices/new",
  },
  {
    type: "quote",
    label: "Quotation",
    description: "Provide a price estimate to a customer",
    icon: <QuoteIcon className="w-6 h-6" />,
    path: "/app/quotes/new",
  },
  {
    type: "credit-note",
    label: "Credit Note",
    description: "Issue a credit or refund to a customer",
    icon: <CreditCard className="w-6 h-6" />,
    path: "/app/credit-notes/new",
  },
  {
    type: "debit-note",
    label: "Debit Note",
    description: "Charge a customer for an additional amount owed",
    icon: <FileText className="w-6 h-6" />,
    path: "/app/debit-notes/new",
  },
  {
    type: "payment-voucher",
    label: "Payment Voucher",
    description: "Record a business payment to a payee",
    icon: <Receipt className="w-6 h-6" />,
    path: "/app/payment-vouchers/new",
  },
  {
    type: "purchase-order",
    label: "Purchase Order",
    description: "Record a purchase order to a supplier",
    icon: <ShoppingCart className="w-6 h-6" />,
    path: "/app/purchase-orders/new",
  },
  {
    type: "recurring-invoice",
    label: "Recurring Invoice",
    description: "Set up automated recurring billing",
    icon: <FileText className="w-6 h-6" />,
    path: "/app/recurring-invoices/new",
  },
  {
    type: "delivery-note",
    label: "Delivery Note",
    description: "Document goods shipped to a customer",
    icon: <FileText className="w-6 h-6" />,
    path: "/app/delivery-notes/new",
  },
  {
    type: "packing-slip",
    label: "Packing Slip",
    description: "Detail items in a shipment",
    icon: <FileText className="w-6 h-6" />,
    path: "/app/packing-slips/new",
  },
  {
    type: "pro-forma-invoice",
    label: "Pro Forma Invoice",
    description: "Issue a preliminary invoice for international trade",
    icon: <FileText className="w-6 h-6" />,
    path: "/app/pro-forma-invoices/new",
  },
  {
    type: "estimate",
    label: "Estimate",
    description: "Provide an estimated price to a customer",
    icon: <FileText className="w-6 h-6" />,
    path: "/app/estimates/new",
  },
];

export default function CreateDocument() {
  useMetaTags({
    title: "Create Document — DocForge",
    description: "Create a new invoice, quote, credit note, debit note, payment voucher, or purchase order.",
    noIndex: true,
  });

  const navigate = useNavigate();
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await getDocumentTemplates({ limit: 50 });
      setTemplates(data.templates ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }

  const customTemplateMap = templates.filter((t) => t.config?.type === "custom").reduce(
    (acc, t) => {
      const docType = t.config?.documentType as string | undefined;
      if (docType && !acc[docType]) acc[docType] = [];
      if (docType) acc[docType].push(t);
      return acc;
    },
    {} as Record<string, ApiTemplate[]>,
  );

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {createOptions.map((option) => (
          <button
            key={option.type}
            onClick={() => navigate(option.path)}
            className="flex items-start gap-4 p-5 rounded-xl border border-color-subtle bg-surface hover:border-color-strong hover:bg-surface-alt transition-colors text-left group"
          >
            <span className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary-bg text-primary-brand group-hover:scale-105 transition-transform">
              {option.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-primary">{option.label}</div>
              <div className="mt-1 text-sm text-secondary line-clamp-2">
                {option.description}
              </div>
            </div>
          </button>
        ))}
      </div>

      {!templatesLoading && Object.keys(customTemplateMap).length > 0 && (
        <div className="pt-4">
          <h3 className="text-sm font-medium text-tertiary mb-3">Quick Templates</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(customTemplateMap).map(([docType, docs]) =>
              docs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/app/${getRoutePrefix(docType)}/new?template=${t.id}`)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-color-subtle bg-surface hover:bg-surface-alt transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-primary truncate">{t.name}</div>
                    <div className="text-xs text-tertiary truncate">{getDocTypeLabel(docType)}</div>
                  </div>
                </button>
              )),
            )}
          </div>
        </div>
      )}

      <div className="pt-4">
        <Button variant="secondary" onClick={() => navigate("/app/documents")}>
          Browse existing documents
        </Button>
      </div>
    </div>
  );
}

function getRoutePrefix(docType: string): string {
  const map: Record<string, string> = {
    invoice: "invoices",
    quote: "quotes",
    "credit-note": "credit-notes",
    "debit-note": "debit-notes",
    "payment-voucher": "payment-vouchers",
    receipt: "receipts",
    "purchase-order": "purchase-orders",
  };
  return map[docType] ?? docType;
}

function getDocTypeLabel(docType: string): string {
  const map: Record<string, string> = {
    invoice: "Invoice",
    quote: "Quote",
    "credit-note": "Credit Note",
    "debit-note": "Debit Note",
    "payment-voucher": "Payment Voucher",
    receipt: "Receipt",
    "purchase-order": "Purchase Order",
  };
  return map[docType] ?? docType;
}
