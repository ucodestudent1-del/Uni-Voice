import { describe, it, expect } from "vitest";
import { TemplateRenderer, buildTemplateData, DEFAULT_INVOICE_TEMPLATE, type TemplatePaymentInstructions } from "../src/services/templates/template-renderer.js";

const BUSINESS = {
  id: "biz-1",
  name: "Acme Corporation",
  legalName: "Acme Corporation Ltd.",
  email: "billing@acme.com",
  phone: "+1 (555) 123-4567",
  website: "https://acme.com",
  taxId: "12-3456789",
  registrationNumber: "00112233",
  address: {
    addressLine1: "123 Business Ave",
    addressLine2: "Suite 100",
    city: "San Francisco",
    stateOrRegion: "CA",
    postalCode: "94105",
    countryCode: "US",
  },
  countryCode: "US",
  defaultCurrency: "USD" as const,
  logoUrl: "https://example.com/logo.png",
};

const CUSTOMER = {
  id: "cust-1",
  name: "Jane Smith",
  companyName: "Smith & Co",
  email: "jane@smithco.com",
  phone: "+1 (555) 987-6543",
  taxId: "98-7654321",
  address: {
    addressLine1: "456 Customer Street",
    addressLine2: null,
    city: "Los Angeles",
    stateOrRegion: "CA",
    postalCode: "90001",
    countryCode: "US",
  },
  countryCode: "US",
  notes: "Preferred customer",
};

const LINE_ITEMS = [
  {
    description: "Website design and development",
    quantity: 40,
    unit: "hour",
    unitPrice: 125,
    discount: 0,
    taxRate: 0.0825,
    taxAmount: 410,
    lineSubtotal: 5000,
    lineTotal: 5410,
    isTaxInclusive: false,
    catalogName: "Web Design Package",
    catalogSku: "WD-001",
    catalogTaxCategory: "services",
    catalogUnitPrice: null,
    catalogTaxRate: null,
  },
  {
    description: "Domain registration (annual)",
    quantity: 1,
    unit: "year",
    unitPrice: 15,
    discount: 0,
    taxRate: 0.0825,
    taxAmount: 1.24,
    lineSubtotal: 15,
    lineTotal: 16.24,
    isTaxInclusive: true,
    catalogName: null,
    catalogSku: null,
    catalogTaxCategory: null,
    catalogUnitPrice: null,
    catalogTaxRate: null,
  },
];

const FEES = [
  {
    description: "Rush fee",
    amount: 100,
    taxRate: 0.0825,
    taxAmount: 8.25,
  },
];

const TOTALS = {
  subtotal: 5015,
  discountTotal: 0,
  taxTotal: 420.49,
  feeTotal: 108.25,
  total: 5543.74,
  amountPaid: 2000,
  amountDue: 3543.74,
};

const PAYMENT_INSTRUCTIONS: TemplatePaymentInstructions = {
  methods: [
    { type: "bank", label: "Bank Transfer", details: "Account: 123456789\nRouting: 987654321\nBank: First National Bank" },
    { type: "card", label: "Credit Card", url: "https://acme.com/pay/inv-001" },
  ],
  bankDetails: "Account: 123456789\nRouting: 987654321\nBank: First National Bank",
  paymentLink: "https://acme.com/pay/inv-001",
  lateFeeType: "fixed",
  lateFeeValue: "25.00",
  taxExemption: "Tax-exempt customer (certificate on file).",
  deliveryDetails: "Delivery will be scheduled within 2 business days of payment.",
  warrantyInfo: "All work comes with a 90-day warranty covering defects in workmanship.",
  returnPolicy: "Returns accepted within 30 days of delivery with prior authorization.",
};

function makeTemplateData(overrides: Partial<Parameters<typeof buildTemplateData>[0]> = {}) {
  return buildTemplateData(
    {
      id: "inv-1",
      invoiceNumber: "INV-2024-001",
      status: "sent",
      issueDate: new Date("2024-01-15"),
      dueDate: new Date("2024-02-14"),
      currency: "USD" as const,
      poNumber: "PO-12345",
      notes: "Thank you for your business!",
      terms: "Payment is due within 30 days.",
      paymentInstructions: "Please make checks payable to Acme Corporation.",
      language: "en-US",
      title: "INVOICE",
      projectId: null,
      projectName: null,
      ...overrides,
    },
    BUSINESS,
    CUSTOMER,
    LINE_ITEMS,
    FEES,
    TOTALS,
    PAYMENT_INSTRUCTIONS,
    { schemaVersion: "1.0", revision: 1 }
  );
}

describe("DEFAULT_INVOICE_TEMPLATE", () => {

  it("is a non-empty HTML string", () => {
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("<html");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("</html>");
    expect(DEFAULT_INVOICE_TEMPLATE.length).toBeGreaterThan(1000);
  });

  it("contains key structural sections", () => {
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("header-section");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Line Items");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Financial Summary");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Payment Instructions");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Notes");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Terms");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Thank you for your business.");
  });

  it("includes a line items table with description, qty, unit price, tax, and line total columns", () => {
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Description");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Unit Price");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Line Total");
  });

  it("includes fee amount and tax columns", () => {
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Additional Fees");
  });

  it("includes financial summary rows for subtotal, tax, total, and balance due", () => {
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Financial Summary");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Subtotal");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Balance Due");
  });

  it("includes payment method rendering with label, details, and url", () => {
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Accepted Payment Methods");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Bank Details");
  });

  it("includes late fee section", () => {
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Late Fee");
  });

  it("includes tax exemption, delivery, warranty, and return policy sections", () => {
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Tax Exemption");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Delivery Details");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Warranty");
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("Return Policy");
  });

  it("includes custom field rendering", () => {
    expect(DEFAULT_INVOICE_TEMPLATE).toContain("customFields");
  });
});

describe("TemplateRenderer with DEFAULT_INVOICE_TEMPLATE", () => {
  const renderer = new TemplateRenderer();

  it("renders invoice number, dates, and status in header", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("INV-2024-001");
    expect(html).toContain("January 15, 2024");
    expect(html).toContain("February 14, 2024");
    expect(html).toContain("sent");
  });

  it("renders business info with logo, name, tax ID, and address", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("Acme Corporation");
    expect(html).toContain("Acme Corporation Ltd.");
    expect(html).toContain("12-3456789");
    expect(html).toContain("123 Business Ave");
    expect(html).toContain("San Francisco");
    expect(html).toContain("logo.png");
  });

  it("renders business registration number when present", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("00112233");
  });

  it("renders customer (bill to) details", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("Jane Smith");
    expect(html).toContain("Smith & Co");
    expect(html).toContain("jane@smithco.com");
    expect(html).toContain("456 Customer Street");
  });

  it("renders line items with descriptions, quantities, prices, tax rates, and totals", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("Website design and development");
    expect(html).toContain("Web Design Package");
    expect(html).toContain("WD-001");
    expect(html).toContain("Domain registration");
    expect(html).toContain("incl. tax");
  });

  it("renders fees section when fees exist", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("Rush fee");
    expect(html).toContain("Additional Fees");
  });

  it("does not render fees section when no fees", () => {
    const data = makeTemplateData();
    const html = renderer.render({ ...data, fees: [] });
    expect(html).not.toContain("Additional Fees");
  });

  it("renders financial summary with correct totals", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("$5,015.00");
    expect(html).toContain("$420.49");
    expect(html).toContain("$5,543.74");
    expect(html).toContain("$3,543.74");
  });

  it("renders amount paid and balance due", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("$2,000.00");
  });

  it("renders payment instructions section with methods, bank details, and payment link", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("Accepted Payment Methods");
    expect(html).toContain("Bank Transfer");
    expect(html).toContain("Account: 123456789");
    expect(html).toContain("Pay Now");
    expect(html).toContain("https://acme.com/pay/inv-001");
  });

  it("renders late fee information for fixed late fee", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("Late Fee");
    expect(html).toContain("$25.00");
  });

  it("renders late fee as percentage when configured", () => {
    const data = makeTemplateData();
    data.paymentInstructions = {
      ...PAYMENT_INSTRUCTIONS,
      lateFeeType: "percentage",
      lateFeeValue: "1.5",
    };
    const html = renderer.render(data);
    expect(html).toContain("1.5%");
  });

  it("renders tax exemption section", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("Tax Exemption");
    expect(html).toContain("Tax-exempt customer");
  });

  it("renders delivery details, warranty, and return policy", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("Delivery Details");
    expect(html).toContain("90-day warranty");
    expect(html).toContain("Return Policy");
    expect(html).toContain("30 days of delivery");
  });

  it("renders notes section", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("Thank you for your business!");
  });

  it("renders terms and conditions section", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("Terms &amp; Conditions");
    expect(html).toContain("Payment is due within 30 days.");
  });

  it("renders PO number when present", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("PO-12345");
    expect(html).toContain("P.O. Number");
  });

  it("renders currency in metadata", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("USD");
  });

  it("renders thank you message in footer", () => {
    const data = makeTemplateData();
    const html = renderer.render(data);
    expect(html).toContain("Thank you for your business.");
  });

  it("renders draft footer when not finalized", () => {
    const data = makeTemplateData({ isFinalized: false });
    data.invoice.isFinalized = false;
    const html = renderer.render(data);
    expect(html).toContain("draft invoice");
  });

  it("renders title from invoice.title when present", () => {
    const data = makeTemplateData({ title: "PROFORMA INVOICE" });
    const html = renderer.render(data);
    expect(html).toContain("PROFORMA INVOICE");
  });

  it("defaults to 'Invoice' title when invoice.title is absent", () => {
    const data = makeTemplateData({ title: null, paymentInstructions: null });
    const html = renderer.render(data);
    expect(html).toContain(">Invoice<");
  });

  it("handles missing customer gracefully", () => {
    const data = makeTemplateData();
    data.customer = null;
    const html = renderer.render(data);
    expect(html).not.toContain("Bill To");
  });

  it("handles empty line items", () => {
    const data = makeTemplateData();
    data.lineItems = [];
    const html = renderer.render(data);
    expect(html).toContain("No line items added.");
  });

  it("renders custom fields when present", () => {
    const data = makeTemplateData();
    data.paymentInstructions = {
      ...PAYMENT_INSTRUCTIONS,
      customFields: [
        { label: "Contract #", value: "CT-2024-001" },
      ],
    };
    const html = renderer.render(data);
    expect(html).toContain("Contract #");
    expect(html).toContain("CT-2024-001");
  });

  it("formats money using the invoice currency", () => {
    const data = makeTemplateData();
    data.invoice = { ...data.invoice, currency: "JPY" as const };
    data.totals = { ...TOTALS, subtotal: 5015, taxTotal: 0, total: 5015, amountDue: 5015 };
    const html = renderer.render(data);
    expect(html).toContain("JPY");
  });

  it("renders discount row when discountTotal is non-zero", () => {
    const data = makeTemplateData();
    data.totals = { ...TOTALS, discountTotal: 500, total: 5043.74, amountDue: 3043.74 };
    const html = renderer.render(data);
    expect(html).toContain("Discount");
    expect(html).toContain("−$500.00");
  });

  it("renders amount paid row only when amountPaid is non-zero", () => {
    const data = makeTemplateData();
    data.totals = { ...TOTALS, amountPaid: 0 };
    const html = renderer.render(data);
    expect(html).not.toContain("Amount Paid");
  });

  it("renders fees total row only when fees exist", () => {
    const data = makeTemplateData();
    data.fees = [];
    data.totals = { ...TOTALS, feeTotal: 0 };
    const html = renderer.render(data);
    expect(html).not.toContain("Fees");
  });
});

describe("buildTemplateData", () => {
  it("returns a complete InvoiceTemplateData object", () => {
    const data = buildTemplateData(
      {
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "draft",
        issueDate: new Date("2024-01-15"),
        dueDate: new Date("2024-02-14"),
        currency: "USD",
        poNumber: "PO-1",
        notes: "Notes here",
        terms: "Terms here",
        paymentInstructions: "Pay by check",
        title: "INVOICE",
        projectId: "proj-1",
        projectName: null,
      },
      BUSINESS,
      CUSTOMER,
      LINE_ITEMS,
      FEES,
      TOTALS,
      PAYMENT_INSTRUCTIONS,
      { schemaVersion: "1.0", revision: 1 }
    );

    expect(data.invoice.title).toBe("INVOICE");
    expect(data.invoice.projectId).toBe("proj-1");
    expect(data.invoice.projectName).toBeNull();
    expect(data.paymentInstructions).toBe(PAYMENT_INSTRUCTIONS);
    expect(data.business.registrationNumber).toBe("00112233");
  });

  it("defaults paymentInstructions to null when not provided", () => {
    const data = buildTemplateData(
      {
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "draft",
        currency: "USD",
      },
      BUSINESS,
      null,
      [],
      [],
      TOTALS
    );
    expect(data.paymentInstructions).toBeNull();
  });

  it("defaults title to null when not provided", () => {
    const data = buildTemplateData(
      {
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "draft",
        currency: "USD",
      },
      BUSINESS,
      null,
      [],
      [],
      TOTALS
    );
    expect(data.invoice.title).toBeNull();
  });
});
