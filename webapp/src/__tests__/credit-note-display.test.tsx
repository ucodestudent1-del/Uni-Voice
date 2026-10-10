import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CreditNoteDisplay, { type CreditNoteDesign } from "@/components/CreditNoteDisplay";

function makeBaseCreditNote(overrides: Partial<CreditNoteDesign> = {}): CreditNoteDesign {
  return {
    businessName: "ABC BUSINESS SOLUTIONS LTD.",
    businessLegalName: "ABC Business Solutions Limited",
    businessEmail: "accounts@example.com",
    businessPhone: "+1 (555) 123-4567",
    businessWebsite: "https://abcbusiness.example.com",
    businessAddress: "123 Business Street\nLos Angeles, CA 90001",
    businessLogo: "https://example.com/logo.png",
    businessTaxId: "12-3456789",
    businessRegistrationNumber: "REG-123456",

    creditNoteNumber: "CN-2026-001",
    issueDate: "2026-10-09",
    currency: "USD",
    status: "finalized",

    customerName: "XYZ Trading Company",
    customerCompanyName: "XYZ Trading Co.",
    customerEmail: "contact@xyztrading.com",
    customerAddress: "456 Customer Avenue\nLos Angeles, CA 90002",
    customerPhone: "+1 (555) 987-6543",
    customerTaxId: "98-7654321",

    referenceInvoiceNumber: "INV-2026-105",
    referenceInvoiceDate: "2026-09-30",

    reason: "Price adjustment due to an overcharge on the original invoice.",
    notes: "Thank you for your continued business.",
    terms: "This credit will be applied to the customer's outstanding account balance.",

    items: [
      {
        description: "Price adjustment",
        quantity: "1",
        unit: "each",
        unitPrice: "200.00",
        taxRate: "0",
        isTaxInclusive: false,
      },
    ],
    fees: [],
    subtotal: "200.00",
    discountTotal: "0",
    taxTotal: "20.00",
    feeTotal: "0",
    total: "220.00",
    appliedTotal: "0",
    amountDue: "220.00",
    applications: [],

    authorizationName: "Accounts Department",
    authorizationTitle: "Authorized Signatory",

    notesForCustomer: "This credit note has been issued as per our adjustment policy.",
    isFinalized: true,
    ...overrides,
  };
}

describe("CreditNoteDisplay", () => {
  it("renders CREDIT NOTE title", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("CREDIT NOTE")).toBeInTheDocument();
  });

  it("renders credit note number", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("CN-2026-001")).toBeInTheDocument();
  });

  it("renders issue date", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("October 9, 2026")).toBeInTheDocument();
  });

  it("renders currency", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getAllByText("USD ($)").length).toBeGreaterThan(0);
  });

  it("renders status badge", () => {
    const design = makeBaseCreditNote({ status: "finalized" });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Finalized")).toBeInTheDocument();
  });

  it("renders company name in header", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("ABC Business Solutions Limited")).toBeInTheDocument();
  });

  it("renders business email", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("accounts@example.com")).toBeInTheDocument();
  });

  it("renders business phone", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("+1 (555) 123-4567")).toBeInTheDocument();
  });

  it("renders business website as link", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    const link = screen.getByText("https://abcbusiness.example.com");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "https://abcbusiness.example.com");
  });

  it("renders business tax ID", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText(/Tax ID: 12-3456789/)).toBeInTheDocument();
  });

  it("renders business address", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText(/123 Business Street/)).toBeInTheDocument();
    expect(screen.getByText(/Los Angeles, CA 90001/)).toBeInTheDocument();
  });

  it("renders Bill To section with customer details", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Bill To")).toBeInTheDocument();
    expect(screen.getByText("XYZ Trading Company")).toBeInTheDocument();
    expect(screen.getByText("XYZ Trading Co.")).toBeInTheDocument();
    expect(screen.getByText("contact@xyztrading.com")).toBeInTheDocument();
    expect(screen.getByText(/Tax ID: 98-7654321/)).toBeInTheDocument();
  });

  it("renders customer address in Bill To", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText(/456 Customer Avenue/)).toBeInTheDocument();
    expect(screen.getByText(/Los Angeles, CA 90002/)).toBeInTheDocument();
  });

  it("renders 'No customer selected' when customer is missing", () => {
    const design = makeBaseCreditNote({
      customerName: null,
      customerCompanyName: null,
      customerEmail: null,
      customerAddress: null,
      customerTaxId: null,
      customerPhone: null,
    });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("No customer selected")).toBeInTheDocument();
  });

  it("renders reason for credit section", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Reason for Credit")).toBeInTheDocument();
    expect(screen.getByText(/Price adjustment due to an overcharge/)).toBeInTheDocument();
  });

  it("does not render reason section when reason is null", () => {
    const design = makeBaseCreditNote({ reason: null });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.queryByText("Reason for Credit")).not.toBeInTheDocument();
  });

  it("renders Original Invoice traceability in meta grid", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Original Invoice")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-105")).toBeInTheDocument();
    expect(screen.getByText("Dated: September 30, 2026")).toBeInTheDocument();
  });

  it("does not render Original Invoice when no reference invoice", () => {
    const design = makeBaseCreditNote({
      referenceInvoiceNumber: null,
      referenceInvoiceDate: null,
    });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.queryByText("Original Invoice")).not.toBeInTheDocument();
  });

  it("renders line items table with description and amount", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Price adjustment")).toBeInTheDocument();
    expect(screen.getAllByText("$200.00").length).toBeGreaterThan(0);
  });

  it("renders qty, unit, and unit price columns", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Qty")).toBeInTheDocument();
    expect(screen.getByText("Unit")).toBeInTheDocument();
    expect(screen.getByText("Unit Price")).toBeInTheDocument();
  });

  it("renders tax rate column header", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Tax Rate")).toBeInTheDocument();
  });

  it("renders amount column header", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Amount")).toBeInTheDocument();
  });

  it("renders 'No line items' when items array is empty", () => {
    const design = makeBaseCreditNote({ items: [] });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("No line items")).toBeInTheDocument();
  });

  it("renders fees table when fees exist", () => {
    const design = makeBaseCreditNote({
      fees: [
        {
          description: "Handling fee",
          amount: "10.00",
          taxRate: "0",
          tax_name: null,
          tax_amount: "0",
        },
      ],
      feeTotal: "10.00",
      total: "230.00",
      amountDue: "230.00",
    });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Handling fee")).toBeInTheDocument();
    expect(screen.getByText("Fees")).toBeInTheDocument();
  });

  it("does not render fees section when fees array is empty", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.queryByText("Additional Fees")).not.toBeInTheDocument();
  });

  it("renders totals summary with subtotal, tax, and total credit", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getAllByText("$200.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Tax")).toBeInTheDocument();
    expect(screen.getAllByText("$20.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Total Credit").length).toBeGreaterThan(0);
  });

  it("renders Total Credit with prominent styling", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getAllByText("Total Credit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$220.00").length).toBeGreaterThan(0);
  });

  it("renders amount in words below total credit", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText(/two hundred.*twenty/i)).toBeInTheDocument();
  });  it("renders tax breakdown row with rate and amount", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Tax")).toBeInTheDocument();
  });

  it("does not render discount row when discount is zero", () => {
    const design = makeBaseCreditNote({ discountTotal: "0" });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.queryByText("Discount")).not.toBeInTheDocument();
  });

  it("renders discount row when discount is non-zero", () => {
    const design = makeBaseCreditNote({
      discountTotal: "50.00",
      total: "170.00",
      amountDue: "170.00",
    });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Discount")).toBeInTheDocument();
    expect(screen.getByText("−$50.00")).toBeInTheDocument();
  });

  it("renders Amount Applied when appliedTotal is non-zero", () => {
    const design = makeBaseCreditNote({
      appliedTotal: "100.00",
      amountDue: "120.00",
    });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Amount Applied")).toBeInTheDocument();
    expect(screen.getByText("Amount Remaining")).toBeInTheDocument();
  });

  it("renders applied to invoices section when applications exist", () => {
    const design = makeBaseCreditNote({
      referenceInvoiceNumber: "INV-999-999",
      applications: [
        {
          invoiceNumber: "INV-2026-105",
          amount: "100.00",
          appliedAt: "2026-10-10",
        },
      ],
    });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Applied to Invoices")).toBeInTheDocument();
    expect(screen.getAllByText("INV-2026-105").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
    expect(screen.getByText("October 10, 2026")).toBeInTheDocument();
  });

  it("does not render applied to invoices section when no applications", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.queryByText("Applied to Invoices")).not.toBeInTheDocument();
  });

  it("renders Terms & Conditions section", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Terms & Conditions")).toBeInTheDocument();
    expect(screen.getByText(/This credit will be applied to the customer/)).toBeInTheDocument();
  });

  it("renders Notes section when notesForCustomer present", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText(/This credit note has been issued/)).toBeInTheDocument();
  });

  it("renders authorization section with signature name", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Authorization")).toBeInTheDocument();
    expect(screen.getByText("Accounts Department")).toBeInTheDocument();
  });

  it("renders authorization title when present", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getAllByText("Authorized Signatory").length).toBeGreaterThan(0);
  });

  it("renders footer with credit note number when finalized", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Credit Note #CN-2026-001. All rights reserved.")).toBeInTheDocument();
  });

  it("renders footer as draft when not finalized", () => {
    const design = makeBaseCreditNote({ isFinalized: false, status: "draft" });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("This is a draft credit note. Not yet finalized.")).toBeInTheDocument();
  });

  it("renders Download PDF button when onDownloadPdf provided", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} onDownloadPdf={() => {}} />);
    expect(screen.getByText("Download PDF")).toBeInTheDocument();
  });

  it("renders Share button when onShare provided", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} onShare={() => {}} />);
    expect(screen.getByText("Share")).toBeInTheDocument();
  });

  it("does not render action bar when showActions is false", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} showActions={false} onDownloadPdf={() => {}} />);
    expect(screen.queryByText("Download PDF")).not.toBeInTheDocument();
  });

  it("renders company logo when provided", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    const logo = screen.getByAltText("ABC BUSINESS SOLUTIONS LTD.");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "https://example.com/logo.png");
  });

  it("falls back to initials when no logo", () => {
    const design = makeBaseCreditNote({
      businessLogo: null,
      businessWebsite: "https://abcbusiness.example.com",
    });
    render(<CreditNoteDisplay design={design} businessLogo={null} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders credit note number in meta grid", () => {
    const design = makeBaseCreditNote();
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getAllByText("CN-2026-001").length).toBeGreaterThan(0);
  });

  it("renders line numbers in table", () => {
    const design = makeBaseCreditNote({
      items: [
        { description: "Item A", quantity: "2", unit: "each", unitPrice: "100.00", taxRate: "0" },
        { description: "Item B", quantity: "3", unit: "each", unitPrice: "50.00", taxRate: "0" },
      ],
    });
    render(<CreditNoteDisplay design={design} />);
    const rows = screen.getAllByText("2", { exact: true });
    expect(rows.length).toBeGreaterThan(0);
  });

  it("does not render Discount in totals when zero", () => {
    const design = makeBaseCreditNote({ discountTotal: "0" });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.queryByText("Discount")).not.toBeInTheDocument();
  });

  it("does not render Fees in totals when zero", () => {
    const design = makeBaseCreditNote({ feeTotal: "0" });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.queryByText("Fees")).not.toBeInTheDocument();
  });

  it("does not render Tax in totals when zero", () => {
    const design = makeBaseCreditNote({ taxTotal: "0" });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.queryByText("Tax")).not.toBeInTheDocument();
  });

  it("renders data-credit-note-display attribute", () => {
    const design = makeBaseCreditNote();
    const { container } = render(<CreditNoteDisplay design={design} />);
    expect(container.querySelector('[data-credit-note-display="true"]')).toBeInTheDocument();
  });

  it("handles tax-inclusive line items", () => {
    const design = makeBaseCreditNote({
      items: [
        {
          description: "Tax-inclusive item",
          quantity: "1",
          unit: "each",
          unitPrice: "110.00",
          taxRate: "0.1",
          isTaxInclusive: true,
        },
      ],
      taxTotal: "10.00",
      total: "110.00",
      amountDue: "110.00",
      subtotal: "100.00",
    });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText("Tax-inclusive item")).toBeInTheDocument();
    expect(screen.getByText(/incl\. 10\.00% tax/)).toBeInTheDocument();
  });

  it("renders percentage discount display on line item", () => {
    const design = makeBaseCreditNote({
      items: [
        {
          description: "Discounted item",
          quantity: "1",
          unit: "each",
          unitPrice: "100.00",
          discount: "10",
          discountType: "percentage",
          taxRate: "0",
          isTaxInclusive: false,
        },
      ],
    });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText(/Discount −10%/)).toBeInTheDocument();
  });

  it("renders fixed discount display on line item", () => {
    const design = makeBaseCreditNote({
      items: [
        {
          description: "Discounted item",
          quantity: "1",
          unit: "each",
          unitPrice: "100.00",
          discount: "15.00",
          discountType: "fixed",
          taxRate: "0",
          isTaxInclusive: false,
        },
      ],
    });
    render(<CreditNoteDisplay design={design} />);
    expect(screen.getByText(/Discount −/)).toBeInTheDocument();
  });
});
