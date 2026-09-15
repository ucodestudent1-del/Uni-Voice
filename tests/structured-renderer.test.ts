import { describe, it, expect } from "vitest";
import { structuredTemplateRenderer, type RenderContext } from "../src/services/templates/structured-renderer.js";
import { createEmptyDocument, type InvoiceDocument } from "../webapp/src/document-model/types.js";

function makeBaseContext(): RenderContext {
  return {
    business: {
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
      defaultCurrency: "USD",
      logoUrl: "https://acme.com/logo.png",
    },
    customer: {
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
    },
    invoice: {
      id: "inv_1",
      invoiceNumber: "INV-001",
      status: "sent",
      issueDate: "2024-01-15",
      dueDate: "2024-02-15",
      currency: "USD",
      notes: "Thank you for your business.",
      terms: "Net 30",
      paymentInstructions: "Pay via bank transfer",
      language: "en-US",
    },
    lineItems: [
      {
        description: "Web Design",
        quantity: 1,
        unit: "h",
        unitPrice: 100,
        discount: 0,
        taxRate: 0.1,
        taxAmount: 10,
        lineSubtotal: 100,
        lineTotal: 110,
        isTaxInclusive: false,
      },
    ],
    fees: [],
    totals: {
      subtotal: 100,
      discountTotal: 0,
      taxTotal: 10,
      feeTotal: 0,
      total: 110,
      amountPaid: 0,
      amountDue: 110,
    },
    currency: "USD",
    locale: "en-US",
  };
}

function makeSampleDocument(): InvoiceDocument {
  const doc = createEmptyDocument("biz_1", "Test Invoice");
  doc.components["cmp_1"] = {
    id: "cmp_1",
    type: "text",
    props: { content: "Hello World" },
    style: {},
    visible: true,
  };
  doc.sections["section_root"].children = ["cmp_1"];
  return doc;
}

describe("StructuredTemplateRenderer", () => {
  it("renders a basic document with text component", () => {
    const doc = makeSampleDocument();
    const ctx = makeBaseContext();

    const html = structuredTemplateRenderer.render(doc, ctx);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Hello World");
    expect(html).toContain("<html");
    expect(html).toContain("</body>");
  });

  it("renders business info component", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_biz"] = {
      id: "comp_biz",
      type: "businessInfo",
      props: {
        showName: true,
        showEmail: true,
        showPhone: true,
        showWebsite: true,
        showAddress: true,
        showLogo: true,
        label: "From",
      },
      style: {},
      visible: true,
    };
    doc.sections["section_root"].children = ["comp_biz"];

    const html = structuredTemplateRenderer.render(doc, makeBaseContext());

    expect(html).toContain("Acme Corp");
    expect(html).toContain("info@acme.com");
    expect(html).toContain("+1-555-0100");
    expect(html).toContain("https://acme.com");
    expect(html).toContain("123 Main St");
    expect(html).toContain("New York");
    expect(html).toContain("logo.png");
  });

  it("renders customer info component", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_cust"] = {
      id: "comp_cust",
      type: "customerInfo",
      props: {
        showName: true,
        showCompany: true,
        showEmail: true,
        showAddress: true,
        showPhone: true,
        label: "Bill To",
      },
      style: {},
      visible: true,
    };
    doc.sections["section_root"].children = ["comp_cust"];

    const html = structuredTemplateRenderer.render(doc, makeBaseContext());

    expect(html).toContain("Jane Doe");
    expect(html).toContain("Doe Inc");
    expect(html).toContain("jane@doe.com");
    expect(html).toContain("456 Oak Ave");
    expect(html).toContain("Boston");
    expect(html).toContain("Bill To");
  });

  it("renders invoice number component", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_inv"] = {
      id: "comp_inv",
      type: "invoiceNumber",
      props: { prefix: "#", label: "Invoice" },
      style: {},
      visible: true,
    };
    doc.sections["section_root"].children = ["comp_inv"];

    const html = structuredTemplateRenderer.render(doc, makeBaseContext());

    expect(html).toContain("INV-001");
    expect(html).toContain("Invoice");
  });

  it("renders date components", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_issue"] = {
      id: "comp_issue",
      type: "date",
      props: { dateType: "issue", label: "Issue Date" },
      style: {},
      visible: true,
    };
    doc.components["comp_due"] = {
      id: "comp_due",
      type: "date",
      props: { dateType: "due", label: "Due Date" },
      style: {},
      visible: true,
    };
    doc.sections["section_root"].children = ["comp_issue", "comp_due"];

    const html = structuredTemplateRenderer.render(doc, makeBaseContext());

    expect(html).toContain("Issue Date");
    expect(html).toContain("Due Date");
  });

  it("renders line items table", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_items"] = {
      id: "comp_items",
      type: "lineItems",
      props: {
        columns: [
          { key: "description", label: "Description", width: "40%", align: "left", visible: true },
          { key: "quantity", label: "Qty", width: "15%", align: "right", visible: true },
          { key: "unitPrice", label: "Rate", width: "20%", align: "right", visible: true },
          { key: "amount", label: "Amount", width: "25%", align: "right", visible: true },
        ],
        showHeader: true,
        showQuantity: true,
        showUnit: true,
        showUnitPrice: true,
        showDiscount: false,
        showTax: true,
        showLineTotal: true,
        currency: "USD",
        allowMultiPage: true,
      },
      style: {},
      visible: true,
    };
    doc.sections["section_root"].children = ["comp_items"];

    const html = structuredTemplateRenderer.render(doc, makeBaseContext());

    expect(html).toContain("Description");
    expect(html).toContain("Qty");
    expect(html).toContain("Web Design");
    expect(html).toContain("1.00");
  });

  it("renders totals components", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_subtotal"] = {
      id: "comp_subtotal",
      type: "subtotal",
      props: { label: "Subtotal", currency: "USD" },
      style: {},
      visible: true,
    };
    doc.components["comp_tax"] = {
      id: "comp_tax",
      type: "tax",
      props: { label: "Tax", currency: "USD", showBreakdown: true },
      style: {},
      visible: true,
    };
    doc.components["comp_total"] = {
      id: "comp_total",
      type: "total",
      props: { label: "Total", currency: "USD" },
      style: {},
      visible: true,
    };
    doc.sections["section_root"].children = ["comp_subtotal", "comp_tax", "comp_total"];

    const html = structuredTemplateRenderer.render(doc, makeBaseContext());

    expect(html).toContain("Subtotal");
    expect(html).toContain("Tax");
    expect(html).toContain("Total");
    expect(html).toContain("$100.00");
    expect(html).toMatch(/\$110\.00/);
  });

  it("renders structural components (section, row, column)", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["text_1"] = {
      id: "text_1",
      type: "text",
      props: { content: "Column content" },
      style: {},
      visible: true,
    };
    doc.columns["col_test"] = {
      id: "col_test",
      type: "column",
      props: { name: "Test Column", span: 6 },
      style: {},
      children: ["text_1"],
      visible: true,
    };
    doc.rows["row_test"] = {
      id: "row_test",
      type: "row",
      props: { name: "Test Row", columns: 1, columnGap: 16, rowGap: 16 },
      style: {},
      children: ["col_test"],
      visible: true,
    };
    doc.sections["section_root"].children = ["row_test"];

    const html = structuredTemplateRenderer.render(doc, makeBaseContext());

    expect(html).toContain("Column content");
    expect(html).toContain("<section");
    expect(html).toContain('class="row"');
    expect(html).toContain('class="column"');
  });

  it("renders hidden components", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_hidden"] = {
      id: "comp_hidden",
      type: "text",
      props: { content: "Should not be visible" },
      style: {},
      visible: false,
    };
    doc.sections["section_root"].children = ["comp_hidden"];

    const html = structuredTemplateRenderer.render(doc, makeBaseContext());

    expect(html).not.toContain("Should not be visible");
  });

  it("renders spacer and divider", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_spacer"] = {
      id: "comp_spacer",
      type: "spacer",
      props: { height: 24 },
      style: {},
      visible: true,
    };
    doc.components["comp_divider"] = {
      id: "comp_divider",
      type: "divider",
      props: { thickness: 2, color: "#ff0000", style: "solid" },
      style: {},
      visible: true,
    };
    doc.sections["section_root"].children = ["comp_spacer", "comp_divider"];

    const html = structuredTemplateRenderer.render(doc, makeBaseContext());

    expect(html).toContain("<hr");
    expect(html).toContain("#ff0000");
  });

  it("renders notes, terms, and payment instructions", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_notes"] = {
      id: "comp_notes",
      type: "notes",
      props: { content: "Thank you for your business.", label: "Notes" },
      style: {},
      visible: true,
    };
    doc.components["comp_terms"] = {
      id: "comp_terms",
      type: "terms",
      props: { content: "Net 30", label: "Terms" },
      style: {},
      visible: true,
    };
    doc.components["comp_pay"] = {
      id: "comp_pay",
      type: "paymentInstructions",
      props: { content: "Pay via bank transfer", label: "Payment" },
      style: {},
      visible: true,
    };
    doc.sections["section_root"].children = ["comp_notes", "comp_terms", "comp_pay"];

    const html = structuredTemplateRenderer.render(doc, makeBaseContext());

    expect(html).toContain("Thank you for your business.");
    expect(html).toContain("Net 30");
    expect(html).toContain("Pay via bank transfer");
  });

  it("renders signature component", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_sig"] = {
      id: "comp_sig",
      type: "signature",
      props: { label: "Authorized Signature", placeholder: "____", showDate: true, showName: true },
      style: {},
      visible: true,
    };
    doc.sections["section_root"].children = ["comp_sig"];

    const html = structuredTemplateRenderer.render(doc, makeBaseContext());

    expect(html).toContain("Authorized Signature");
    expect(html).toContain("____");
    expect(html).toContain("Date:");
    expect(html).toContain("Name:");
  });

  it("renders custom field component", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_cf"] = {
      id: "comp_cf",
      type: "customField",
      props: { key: "project", label: "Project", value: "PROJ-2024" },
      style: {},
      visible: true,
    };
    doc.sections["section_root"].children = ["comp_cf"];

    const html = structuredTemplateRenderer.render(doc, makeBaseContext());

    expect(html).toContain("Project");
    expect(html).toContain("PROJ-2024");
  });

  it("handles invalid document gracefully", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.sections = {};

    const html = structuredTemplateRenderer.render(doc, makeBaseContext());

    expect(html).toContain("Invalid document structure");
  });
});
