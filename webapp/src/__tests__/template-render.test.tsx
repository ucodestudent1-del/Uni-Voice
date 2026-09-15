import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TemplateRender } from "../components/TemplateRender";
import { createEmptyDocument, type InvoiceDocument } from "../document-model/types";
import type { RenderContext } from "../../../src/services/templates/structured-renderer";

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
      defaultCurrency: "USD" as any,
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
      currency: "USD" as any,
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

describe("TemplateRender (frontend)", () => {
  it("renders a basic text component", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_text"] = {
      id: "comp_text",
      type: "text",
      props: { content: "Hello World" },
      style: {},
      visible: true,
    };
    doc.sections["root_section"].children = ["comp_text"];

    const ctx = makeBaseContext();
    const { container } = render(
      <TemplateRender
        document={doc as any}
        business={ctx.business}
        customer={ctx.customer}
        invoice={ctx.invoice}
        lineItems={ctx.lineItems}
        fees={ctx.fees}
        totals={ctx.totals}
        currency="USD"
        locale="en-US"
      />
    );

    expect(container.textContent).toContain("Hello World");
  });

  it("renders business info", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_biz"] = {
      id: "comp_biz",
      type: "businessInfo",
      props: {
        showName: true,
        showEmail: true,
        showPhone: false,
        showWebsite: false,
        showAddress: false,
        showLogo: false,
        label: "From",
      },
      style: {},
      visible: true,
    };
    doc.sections["root_section"].children = ["comp_biz"];

    const ctx = makeBaseContext();
    const { container } = render(
      <TemplateRender
        document={doc as any}
        business={ctx.business}
        customer={ctx.customer}
        invoice={ctx.invoice}
        lineItems={ctx.lineItems}
        fees={ctx.fees}
        totals={ctx.totals}
        currency="USD"
        locale="en-US"
      />
    );

    expect(container.textContent).toContain("Acme Corp");
    expect(container.textContent).toContain("From");
  });

  it("renders invoice number", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_inv"] = {
      id: "comp_inv",
      type: "invoiceNumber",
      props: { prefix: "#", label: "Invoice" },
      style: {},
      visible: true,
    };
    doc.sections["root_section"].children = ["comp_inv"];

    const ctx = makeBaseContext();
    const { container } = render(
      <TemplateRender
        document={doc as any}
        business={ctx.business}
        customer={ctx.customer}
        invoice={ctx.invoice}
        lineItems={ctx.lineItems}
        fees={ctx.fees}
        totals={ctx.totals}
        currency="USD"
        locale="en-US"
      />
    );

    expect(container.textContent).toContain("INV-001");
    expect(container.textContent).toContain("#");
  });

  it("renders hidden components as not-visible", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_hidden"] = {
      id: "comp_hidden",
      type: "text",
      props: { content: "Hidden content" },
      style: {},
      visible: false,
    };
    doc.sections["root_section"].children = ["comp_hidden"];

    const ctx = makeBaseContext();
    const { container } = render(
      <TemplateRender
        document={doc as any}
        business={ctx.business}
        customer={ctx.customer}
        invoice={ctx.invoice}
        lineItems={ctx.lineItems}
        fees={ctx.fees}
        totals={ctx.totals}
        currency="USD"
        locale="en-US"
      />
    );

    expect(container.textContent).not.toContain("Hidden content");
  });

  it("renders totals components", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_total"] = {
      id: "comp_total",
      type: "total",
      props: { label: "Total", currency: "USD" },
      style: {},
      visible: true,
    };
    doc.components["comp_due"] = {
      id: "comp_due",
      type: "amountDue",
      props: { label: "Amount Due", currency: "USD" },
      style: {},
      visible: true,
    };
    doc.sections["root_section"].children = ["comp_total", "comp_due"];

    const ctx = makeBaseContext();
    const { container } = render(
      <TemplateRender
        document={doc as any}
        business={ctx.business}
        customer={ctx.customer}
        invoice={ctx.invoice}
        lineItems={ctx.lineItems}
        fees={ctx.fees}
        totals={ctx.totals}
        currency="USD"
        locale="en-US"
      />
    );

    expect(container.textContent).toContain("Total");
    expect(container.textContent).toContain("Amount Due");
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
    doc.sections["root_section"].children = ["comp_items"];

    const ctx = makeBaseContext();
    const { container } = render(
      <TemplateRender
        document={doc as any}
        business={ctx.business}
        customer={ctx.customer}
        invoice={ctx.invoice}
        lineItems={ctx.lineItems}
        fees={ctx.fees}
        totals={ctx.totals}
        currency="USD"
        locale="en-US"
      />
    );

    expect(container.textContent).toContain("Web Design");
    expect(container.textContent).toContain("Description");
    expect(container.textContent).toContain("Qty");
  });

  it("renders divider and spacer", () => {
    const doc = createEmptyDocument("biz_1", "Test Invoice");
    doc.components["comp_div"] = {
      id: "comp_div",
      type: "divider",
      props: { thickness: 1, color: "#ccc", style: "solid" },
      style: {},
      visible: true,
    };
    doc.components["comp_sp"] = {
      id: "comp_sp",
      type: "spacer",
      props: { height: 16 },
      style: {},
      visible: true,
    };
    doc.sections["root_section"].children = ["comp_div", "comp_sp"];

    const ctx = makeBaseContext();
    const { container } = render(
      <TemplateRender
        document={doc as any}
        business={ctx.business}
        customer={ctx.customer}
        invoice={ctx.invoice}
        lineItems={ctx.lineItems}
        fees={ctx.fees}
        totals={ctx.totals}
        currency="USD"
        locale="en-US"
      />
    );

    const div = container.querySelector("hr");
    expect(div).not.toBeNull();
    const spacer = container.querySelector("div[data-component='comp_sp']");
    expect(spacer).not.toBeNull();
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
    doc.sections["root_section"].children = ["comp_sig"];

    const ctx = makeBaseContext();
    const { container } = render(
      <TemplateRender
        document={doc as any}
        business={ctx.business}
        customer={ctx.customer}
        invoice={ctx.invoice}
        lineItems={ctx.lineItems}
        fees={ctx.fees}
        totals={ctx.totals}
        currency="USD"
        locale="en-US"
      />
    );

    expect(container.textContent).toContain("Authorized Signature");
    expect(container.textContent).toContain("____");
  });
});
