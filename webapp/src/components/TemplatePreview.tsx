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
  name: "Your Business",
  email: "billing@yourbusiness.com",
  phone: "+1 (555) 000-0000",
  website: "www.yourbusiness.com",
  address: "",
  logo_url: null as string | null,
};

const SAMPLE_CUSTOMER = {
  id: "sample-customer",
  name: "Your Customer",
  company_name: "Customer Company",
  email: "customer@customer.com",
  phone: "",
  address: "",
};

const SAMPLE_ITEMS = [
  {
    id: "item-1",
    description: "Service — Monthly Retainer",
    quantity: "1",
    unit: "month",
    unitPrice: "0.00",
    discount: "0.00",
    taxRate: "0.00",
    isTaxInclusive: false,
  },
];

const SAMPLE_INVOICE = {
  invoiceNumber: "INV-000001",
  issueDate: "",
  dueDate: "",
  currency: "USD",
  items: SAMPLE_ITEMS,
  fees: [],
  notes: "",
  terms: "",
  paymentInstructions: "",
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
