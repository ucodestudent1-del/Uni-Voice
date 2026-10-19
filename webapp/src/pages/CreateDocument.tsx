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

type DocType =
  | "invoice"
  | "quote"
  | "credit-note"
  | "payment-voucher"
  | "debit-note"
  | "purchase-order";

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
];

export default function CreateDocument() {
  useMetaTags({
    title: "Create Document — DocForge",
    description: "Create a new invoice, quote, credit note, debit note, payment voucher, or purchase order.",
    noIndex: true,
  });

  const navigate = useNavigate();

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

      <div className="pt-4">
        <Button variant="secondary" onClick={() => navigate("/app/documents")}>
          Browse existing documents
        </Button>
      </div>
    </div>
  );
}
