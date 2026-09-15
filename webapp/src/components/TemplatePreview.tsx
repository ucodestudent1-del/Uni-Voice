import React, { useEffect, useMemo } from "react";
import { Decimal } from "decimal.js";
import {
  InvoiceDocument,
  initializeRegistry,
  renderDocumentTree,
  createRenderContext,
} from "../document-model";
import { formatCurrency } from "../utils/format";

const SAMPLE_BUSINESS = {
  id: "sample-business",
  name: "Acme Corporation",
  email: "billing@acme.com",
  phone: "+1 (555) 123-4567",
  website: "www.acme.com",
  address: "123 Business Street\nNew York, NY 10001",
  logo_url: null as string | null,
};

const SAMPLE_CUSTOMER = {
  id: "sample-customer",
  name: "Jane Cooper",
  company_name: "Globex Inc.",
  email: "jane.cooper@globex.com",
  phone: "+1 (555) 987-6543",
  address: "456 Client Avenue, Suite 200\nSan Francisco, CA 94102",
};

const SAMPLE_ITEMS = [
  {
    id: "item-1",
    description: "Professional Services - June",
    quantity: "10",
    unit: "hours",
    unitPrice: "75.00",
    discount: "0.00",
    taxRate: "0.08",
    isTaxInclusive: false,
  },
  {
    id: "item-2",
    description: "Software License (Annual)",
    quantity: "1",
    unit: "license",
    unitPrice: "200.00",
    discount: "0.00",
    taxRate: "0.08",
    isTaxInclusive: false,
  },
];

const SAMPLE_INVOICE = {
  invoiceNumber: "INV-2024-001",
  issueDate: "2024-06-15",
  dueDate: "2024-07-15",
  currency: "USD",
  items: SAMPLE_ITEMS,
  fees: [],
  notes: "Thank you for your business! Please reach out with any questions.",
  terms: "Payment is due within 30 days of the invoice date.",
  paymentInstructions: "Pay via bank transfer to account #1234-5678-90.",
};

interface TemplatePreviewProps {
  document: InvoiceDocument;
  business?: Record<string, unknown>;
  className?: string;
  compact?: boolean;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  document,
  business: businessOverride,
  className = "",
  compact = false,
}) => {
  useEffect(() => {
    initializeRegistry();
  }, []);

  const ctx = useMemo(() => {
    const calcLineTotal = (item: (typeof SAMPLE_ITEMS)[number]): string => {
      const qty = new Decimal(item.quantity);
      const price = new Decimal(item.unitPrice);
      const disc = new Decimal(item.discount);
      return qty.mul(price).sub(disc).toFixed(2);
    };

    const subtotal = SAMPLE_ITEMS.reduce((sum, item) => sum.add(calcLineTotal(item)), new Decimal(0)).toFixed(2);
    const taxRate = SAMPLE_ITEMS[0]?.taxRate || "0";
    const taxTotal = new Decimal(subtotal).mul(taxRate).toFixed(2);
    const total = new Decimal(subtotal).plus(taxTotal).toFixed(2);

    const calculations = {
      subtotal,
      discountTotal: "0.00",
      taxTotal,
      feeTotal: "0.00",
      total,
      amountDue: total,
      lineItems: SAMPLE_ITEMS.map((item) => ({
        ...item,
        lineSubtotal: new Decimal(item.quantity).mul(item.unitPrice).toFixed(2),
        lineTotal: calcLineTotal(item),
        discountAmount: "0.00",
        taxAmount: new Decimal(item.quantity).mul(item.unitPrice).mul(item.taxRate || "0").toFixed(2),
      })),
      fees: [],
      formatCurrency: (value: unknown, currency: string) =>
        formatCurrency(
          new Decimal(typeof value === "string" || typeof value === "number" ? value : 0),
          currency
        ),
      computeLineTotal: (item: any) => calcLineTotal(item),
    };

    const mergedBusiness = { ...SAMPLE_BUSINESS, ...(businessOverride ?? {}) };

    return createRenderContext(
      document,
      mergedBusiness,
      SAMPLE_CUSTOMER,
      SAMPLE_INVOICE,
      calculations,
      document.settings.currency,
      document.settings.locale,
      false
    );
  }, [document, businessOverride]);

  const rootSection = document.sections[document.rootSectionId];
  if (!rootSection) {
    return <div className={`text-slate-400 text-sm ${className}`}>Invalid template document</div>;
  }

  const content = renderDocumentTree(document, ctx, {
    isEditing: false,
    selectedComponentId: null,
    onSelect: () => {},
  });

  if (compact) {
    return (
      <div
        className={`overflow-hidden bg-white border border-slate-200 rounded-lg ${className}`}
        style={{ maxHeight: "120px" }}
      >
        <div className="scale-[0.3] origin-top-left">
          <div
            style={{
              fontFamily: document.settings.defaultFont,
              fontSize: `${document.settings.defaultFontSize}px`,
              color: document.settings.defaultColor,
              padding: `${document.settings.margins.top / 4}px ${document.settings.margins.right / 4}px`,
              width: "210mm",
            }}
          >
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-8 ${className}`}>
      {content}
    </div>
  );
};

export default TemplatePreview;
