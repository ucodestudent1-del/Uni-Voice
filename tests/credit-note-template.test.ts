import { describe, it, expect } from "vitest";
import {
  creditNoteTemplateRenderer,
  buildCreditNoteTemplateData,
  type CreditNoteTemplateData,
  type CreditNoteTemplateLineItem,
  type CreditNoteTemplateFee,
  type CreditNoteTemplateTotals,
  type CreditNoteTemplateApplicationInfo,
} from "../src/services/templates/credit-note-template-renderer.js";

function makeBaseData(): CreditNoteTemplateData {
  const business = {
    id: "biz_1",
    name: "Acme Corp",
    legalName: "Acme Corporation",
    email: "info@acme.com",
    phone: "+1-555-0100",
    website: "https://acme.com",
    taxId: "TAX-123",
    address: {
      addressLine1: "123 Main St",
      addressLine2: "Suite 100",
      city: "New York",
      stateOrRegion: "NY",
      postalCode: "10001",
      countryCode: "US",
      taxId: "TAX-123",
    },
    countryCode: "US",
    defaultCurrency: "USD" as const,
    logoUrl: "https://acme.com/logo.png",
  };

  const customer = {
    id: "cust_1",
    name: "Jane Doe",
    companyName: "Doe Inc",
    email: "jane@doe.com",
    phone: "+1-555-0200",
    taxId: "CUST-TAX",
    address: {
      addressLine1: "456 Oak Ave",
      city: "Boston",
      stateOrRegion: "MA",
      postalCode: "02101",
      countryCode: "US",
      taxId: "CUST-TAX",
    },
    countryCode: "US",
    notes: "Preferred contact: email",
  };

  const lineItems: CreditNoteTemplateLineItem[] = [
    {
      description: "Consulting Services",
      quantity: 10,
      unit: "h",
      unitPrice: 100,
      discount: 0,
      taxRate: 0.1,
      taxAmount: 100,
      lineSubtotal: 1000,
      lineTotal: 1100,
      isTaxInclusive: false,
    },
  ];

  const fees: CreditNoteTemplateFee[] = [
    {
      description: "Late Fee",
      amount: 50,
      taxRate: 0.0,
      taxAmount: 0,
    },
  ];

  const totals: CreditNoteTemplateTotals = {
    subtotal: 1000,
    discountTotal: 0,
    taxTotal: 100,
    feeTotal: 50,
    total: 1150,
    appliedTotal: 500,
    amountDue: 650,
  };

  const applications: CreditNoteTemplateApplicationInfo[] = [
    {
      amount: 500,
      invoiceId: "inv_1",
      invoiceNumber: "INV-001",
      appliedAt: "2024-02-01T10:00:00Z",
    },
  ];

  return buildCreditNoteTemplateData(
    {
      id: "cn_1",
      creditNoteNumber: "CN-2024-001",
      status: "finalized",
      issueDate: new Date("2024-02-01"),
      currency: "USD",
      reason: "Service adjustment",
      notes: "Corrected billing error for hour count.",
      terms: "Credit applied to invoice INV-001.",
      referenceInvoiceId: "inv_1",
      referenceInvoiceNumber: "INV-001",
      language: "en",
    },
    business,
    customer,
    lineItems,
    fees,
    totals,
    applications,
    {}
  );
}

describe("CreditNoteTemplateRenderer", () => {
  describe("render", () => {
    it("renders a complete credit note HTML document", () => {
      const data = makeBaseData();
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Credit Note");
      expect(html).toContain("CN-2024-001");
      expect(html).toContain("Acme Corp");
      expect(html).toContain("Acme Corporation");
      expect(html).toContain("info@acme.com");
      expect(html).toContain("Jane Doe");
      expect(html).toContain("Doe Inc");
      expect(html).toContain("jane@doe.com");
      expect(html).toContain("Consulting Services");
      expect(html).toContain("123 Main St");
      expect(html).toContain("TAX-123");
      expect(html).toContain("CUST-TAX");
    });

    it("includes credit note number and status in the header", () => {
      const data = makeBaseData();
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("CN-2024-001");
      expect(html).toContain("finalized");
    });

    it("includes business and customer addresses", () => {
      const data = makeBaseData();
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("123 Main St");
      expect(html).toContain("Suite 100");
      expect(html).toContain("New York");
      expect(html).toContain("456 Oak Ave");
      expect(html).toContain("Boston");
    });

    it("includes financial summary with totals", () => {
      const data = makeBaseData();
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("Credit Note Total");
      expect(html).toContain("Amount Applied");
      expect(html).toContain("Amount Remaining");
    });

    it("includes reason section when present", () => {
      const data = makeBaseData();
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("Service adjustment");
      expect(html).toContain("Reason:");
    });

    it("includes notes and terms sections", () => {
      const data = makeBaseData();
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("Corrected billing error");
      expect(html).toContain("Credit applied to invoice INV-001");
    });

    it("includes reference invoice number", () => {
      const data = makeBaseData();
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("INV-001");
      expect(html).toContain("Related Invoice");
    });

    it("includes applications table when applications exist", () => {
      const data = makeBaseData();
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("Applied To Invoices");
      expect(html).toContain("$500.00");
    });

    it("renders line items with formatted values", () => {
      const data = makeBaseData();
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("Consulting Services");
      expect(html).toContain("10");
      expect(html).toContain("h");
    });

    it("renders fees section when fees exist", () => {
      const data = makeBaseData();
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("Additional Fees");
      expect(html).toContain("Late Fee");
    });
  });

  describe("render with missing optional fields", () => {
    it("renders with null customer", () => {
      const data = makeBaseData();
      data.customer = null;
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("CN-2024-001");
      expect(html).toContain("Acme Corp");
      expect(html).not.toContain("Bill To");
    });

    it("renders with no line items", () => {
      const data = makeBaseData();
      data.lineItems = [];
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("Credit Note");
      expect(html).toContain("CN-2024-001");
    });

    it("renders with no reason", () => {
      const data = makeBaseData();
      data.creditNote.reason = null;
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).not.toContain("Reason:");
    });

    it("renders with no notes or terms", () => {
      const data = makeBaseData();
      data.creditNote.notes = null;
      data.creditNote.terms = null;
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).not.toContain("Notes");
      expect(html).not.toContain("Terms &amp; Conditions");
    });

    it("renders with no applications", () => {
      const data = makeBaseData();
      data.applications = [];
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).not.toContain("Applied To Invoices");
    });

    it("renders with no fees", () => {
      const data = makeBaseData();
      data.fees = [];
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).not.toContain("Additional Fees");
    });

    it("renders with no reference invoice", () => {
      const data = makeBaseData();
      data.creditNote.referenceInvoiceNumber = null;
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).not.toContain("Related Invoice");
    });

    it("renders with no logo", () => {
      const data = makeBaseData();
      data.business.logoUrl = null;
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("Acme Corp");
      expect(html).not.toContain('<img class="logo"');
    });
  });

  describe("build", () => {
    it("returns a compiled template delegate", () => {
      const data = makeBaseData();
      const template = creditNoteTemplateRenderer.build(data);
      expect(typeof template).toBe("function");
      const rendered = template({
        ...data,
        meta: { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2, minorUnitName: "cent", localeKey: "en-US" },
        appBaseUrl: "https://app.example.com",
      });
      expect(rendered).toContain("CN-2024-001");
    });
  });

  describe("custom template", () => {
    it("renders a custom HTML template passed via config", () => {
      const data = makeBaseData();
      const customHtml = `<html><body>Custom: {{creditNote.creditNoteNumber}}</body></html>`;
      data.config = { htmlTemplate: customHtml };
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("Custom: CN-2024-001");
      expect(html).not.toContain("Credit Note Total");
    });
  });

  describe("currency formatting", () => {
    it("formats money values using the credit note currency", () => {
      const data = makeBaseData();
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("$1,150.00");
      expect(html).toContain("$500.00");
    });

    it("formats with EUR currency", () => {
      const data = makeBaseData();
      data.creditNote.currency = "EUR";
      const html = creditNoteTemplateRenderer.render(data);

      expect(html).toContain("€")
      expect(html).toContain("1.150,00")
    });
  });
});
