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
    description: "Monthly retainer — January services",
    quantity: "10",
    unit: "hour",
    unitPrice: "150.00",
    discount: "0.00",
    taxRate: "0.0825",
    isTaxInclusive: false,
  },
  {
    id: "item-2",
    description: "Research and consultation",
    quantity: "5",
    unit: "hour",
    unitPrice: "200.00",
    discount: "0.00",
    taxRate: "0.0825",
    isTaxInclusive: false,
  },
];

const SAMPLE_FEES = [
  { description: "Filing fee", amount: "350.00", taxRate: "0.0825" },
  { description: "Service fee", amount: "50.00", taxRate: "0.0825" },
];

const SAMPLE_CUSTOM_FIELDS: Record<string, string> = {
  hours: "10",
  rate: "150.00",
  court_costs: "350.00",
  retainer_balance: "2000.00",
  retainer: "2000.00",
  milestone: "Design",
  case_number: "CV-2024-1234",
  project: "Website Redesign",
  property_address: "456 Oak Avenue",
  frequency: "Monthly",
  service_location: "Main Building",
  vin: "1HGBH41JXMN109186",
  service_type: "Maintenance",
  order_number: "ORD-7742",
  project_code: "PRJ-2024-09",
  platform_fee: "75.00",
  warranty: "12 months parts, 90 days labor",
  property_access: "Leave keys with building management",
  delivery_date: "2024-12-25",
  job_site: "123 Main St, Suite 100",
  job_number: "JOB-001",
  retention: "5",
  deposit: "500.00",
};

const SAMPLE_INVOICE = {
  invoiceNumber: "INV-000001",
  issueDate: "2024-09-15",
  dueDate: "2024-10-15",
  currency: "USD",
  items: SAMPLE_ITEMS,
  fees: SAMPLE_FEES,
  customFields: SAMPLE_CUSTOM_FIELDS,
  notes: "Thank you for your business. Please let us know if you have any questions.",
  terms: "Payment is due within 30 days. A 2% late fee applies to overdue balances.",
  paymentInstructions: "Pay via bank transfer to account #1234-5678-9012. Reference invoice number.",
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
    const taxTotal = SAMPLE_ITEMS.reduce(
      (sum, item) => sum.add(new Decimal(calcLineTotal(item)).mul(item.taxRate || "0")),
      new Decimal(0)
    ).toFixed(2);
    const feeTotal = SAMPLE_FEES.reduce(
      (sum, fee) => sum.add(new Decimal(fee.amount).mul(new Decimal(1).plus(fee.taxRate || "0"))),
      new Decimal(0)
    ).toFixed(2);
    const total = new Decimal(subtotal).plus(taxTotal).plus(feeTotal).toFixed(2);

    const calculations = {
      subtotal,
      discountTotal: "0.00",
      taxTotal,
      feeTotal,
      total,
      amountDue: total,
      lineItems: SAMPLE_ITEMS.map((item) => ({
        ...item,
        lineSubtotal: new Decimal(item.quantity).mul(item.unitPrice).toFixed(2),
        lineTotal: calcLineTotal(item),
        discountAmount: "0.00",
        taxAmount: new Decimal(item.quantity).mul(item.unitPrice).mul(item.taxRate || "0").toFixed(2),
      })),
      fees: SAMPLE_FEES,
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
    return <div className={`text-tertiary text-sm ${className}`}>Invalid template document</div>;
  }

  const content = renderDocumentTree(document, ctx, {
    isEditing: false,
    selectedComponentId: null,
    onSelect: () => {},
  });

  if (compact) {
    return (
      <div
        className={`overflow-hidden bg-surface border border-color-subtle rounded-lg ${className}`}
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
    <div className={`bg-surface border border-color-subtle rounded-xl p-8 ${className}`}>
      {content}
    </div>
  );
};

export default TemplatePreview;



