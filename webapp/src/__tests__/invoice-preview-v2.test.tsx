import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import InvoicePreviewV2, { type PreviewInvoice } from "@/components/InvoicePreviewV2";

function makeBaseInvoice(overrides: Partial<PreviewInvoice> = {}): PreviewInvoice {
  return {
    businessName: "Acme Corp",
    businessLegalName: "Acme Corporation Ltd.",
    businessEmail: "billing@acme.com",
    businessPhone: "+1 (555) 123-4567",
    businessWebsite: "https://acme.com",
    businessAddress: "123 Main St\nAnytown, CA 90210",
    businessLogo: "https://example.com/logo.png",
    businessTaxId: "12-3456789",
    invoiceNumber: "INV-001",
    invoiceTitle: "INVOICE",
    issueDate: "2024-01-15",
    dueDate: "2099-02-14",
    currency: "USD",
    poNumber: "PO-12345",
    projectName: "Website Redesign",
    terms: "Net 30",
    customerName: "John Doe",
    customerCompanyName: "Doe Industries",
    customerEmail: "john@doeindustries.com",
    customerAddress: "456 Oak Ave\nSomewhere, CA 90210",
    customerPhone: "+1 (555) 987-6543",
    customerTaxId: "98-7654321",
    items: [
      {
        description: "Web design service",
        quantity: "10",
        unit: "hour",
        unitPrice: "75.00",
        taxRate: "0.08",
        tax_name: "CA Sales Tax",
        isTaxInclusive: false,
      },
    ],
    fees: [],
    subtotal: "750.00",
    discountTotal: "0",
    taxTotal: "60.00",
    feeTotal: "0",
    total: "810.00",
    amountPaid: "0",
    amountDue: "810.00",
    status: "sent",
    isFinalized: true,
    notes: "Thank you for your business!",
    paymentInstructions: "Bank transfer preferred.",
    paymentMethods: [
      {
        type: "bank",
        label: "Bank Transfer",
        details: "Account: 123456789\nRouting: 987654321",
      },
    ],
    bankDetails: "Account: 123456789\nRouting: 987654321\nBank: First National Bank",
    paymentLink: "https://acme.com/pay/inv-001",
    ...overrides,
  };
}

describe("InvoicePreviewV2", () => {
  it("renders business name and legal name in header", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Acme Corporation Ltd.")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });

  it("renders invoice title and number", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("INVOICE")).toBeInTheDocument();
    expect(screen.getByText("#INV-001")).toBeInTheDocument();
  });

  it("renders business contact details", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("billing@acme.com")).toBeInTheDocument();
    expect(screen.getByText("+1 (555) 123-4567")).toBeInTheDocument();
    expect(screen.getByText("https://acme.com")).toBeInTheDocument();
  });

  it("renders business tax ID", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Tax ID: 12-3456789")).toBeInTheDocument();
  });

  it("renders business address", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
    expect(screen.getByText(/Anytown, CA 90210/)).toBeInTheDocument();
  });

  it("renders issue and due dates", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("January 15, 2024")).toBeInTheDocument();
    expect(screen.getByText("February 14, 2099")).toBeInTheDocument();
  });

  it("renders currency (appears in meta grid and payment info)", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getAllByText("USD ($)").length).toBeGreaterThan(0);
  });

  it("renders PO number when present", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("PO-12345")).toBeInTheDocument();
  });

  it("renders project name when present", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Website Redesign")).toBeInTheDocument();
  });

  it("renders payment terms in meta grid (multiple occurrences)", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getAllByText("Net 30").length).toBeGreaterThan(0);
  });

  it("renders Bill To section with customer details", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Bill To")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Doe Industries")).toBeInTheDocument();
    expect(screen.getByText("john@doeindustries.com")).toBeInTheDocument();
    expect(screen.getByText("Tax ID: 98-7654321")).toBeInTheDocument();
  });

  it("renders 'No customer selected' when customer is missing", () => {
    const invoice = makeBaseInvoice({
      customerName: null,
      customerCompanyName: null,
      customerEmail: null,
      customerAddress: null,
      customerTaxId: null,
    });
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("No customer selected")).toBeInTheDocument();
  });

  it("renders line items table", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Web design service")).toBeInTheDocument();
    expect(screen.getAllByText("$810.00").length).toBeGreaterThan(0);
  });

  it("renders tax breakdown section", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Tax Breakdown")).toBeInTheDocument();
    expect(screen.getAllByText(/CA Sales Tax/).length).toBeGreaterThan(0);
  });

  it("renders fees table when fees exist", () => {
    const invoice = makeBaseInvoice({
      fees: [{ description: "Late fee", amount: "25.00", taxRate: "0", tax_name: null, tax_amount: "0" }],
      feeTotal: "25.00",
      total: "835.00",
      amountDue: "835.00",
    });
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Late fee")).toBeInTheDocument();
    expect(screen.getByText("Fees")).toBeInTheDocument();
  });

  it("renders totals summary with subtotal, tax, total, amount due", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("$750.00")).toBeInTheDocument();
    expect(screen.getByText("Tax")).toBeInTheDocument();
    expect(screen.getByText("$60.00")).toBeInTheDocument();
    expect(screen.getByText("Amount Due")).toBeInTheDocument();
  });

  it("renders 'Paid in Full' when amount due is zero", () => {
    const invoice = makeBaseInvoice({
      amountPaid: "810.00",
      amountDue: "0",
    });
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Paid in Full")).toBeInTheDocument();
  });

  it("renders 'Overdue' for past due invoices", () => {
    const invoice = makeBaseInvoice({
      dueDate: "2020-01-01",
      status: "sent",
      amountDue: "810.00",
    });
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("(overdue)")).toBeInTheDocument();
  });

  it("renders payment information section", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Payment Information")).toBeInTheDocument();
    expect(screen.getByText("Bank Transfer")).toBeInTheDocument();
    expect(screen.getByText("Bank Details")).toBeInTheDocument();
  });

  it("renders pay now button with payment link", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    const payButton = screen.getByText("Pay now");
    expect(payButton).toBeInTheDocument();
    expect(payButton.closest("a")).toHaveAttribute("href", "https://acme.com/pay/inv-001");
  });

  it("renders notes section when present", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Thank you for your business!")).toBeInTheDocument();
  });

  it("renders terms section when present", () => {
    const invoice = makeBaseInvoice({
      terms: "All sales are final.",
    });
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Terms & Conditions")).toBeInTheDocument();
    expect(screen.getAllByText("All sales are final.").length).toBeGreaterThan(0);
  });

  it("renders attachments section when present", () => {
    const invoice = makeBaseInvoice({
      attachments: [
        {
          id: "att-1",
          name: "photo.jpg",
          url: "https://example.com/photo.jpg",
          type: "image/jpeg",
          category: "attachment",
        },
      ],
    });
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Photos & Attachments")).toBeInTheDocument();
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
  });

  it("renders footer with invoice number when finalized", () => {
    const invoice = makeBaseInvoice();
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Invoice #INV-001. All rights reserved.")).toBeInTheDocument();
  });

  it("renders footer as draft when not finalized", () => {
    const invoice = makeBaseInvoice({ isFinalized: false, status: "draft" });
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("This is a draft invoice. Not yet finalized.")).toBeInTheDocument();
  });

  it("renders invoice title from invoiceTitle field", () => {
    const invoice = makeBaseInvoice({ invoiceTitle: "PROFORMA INVOICE" });
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("PROFORMA INVOICE")).toBeInTheDocument();
  });

  it("does not render tax breakdown when no tax", () => {
    const invoice = makeBaseInvoice({
      taxTotal: "0",
      items: [{ description: "Tax-free item", quantity: "1", unit: "each", unitPrice: "100.00", taxRate: "0" }],
    });
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.queryByText("Tax Breakdown")).not.toBeInTheDocument();
  });

  it("does not render discount row when discount is zero", () => {
    const invoice = makeBaseInvoice({ discountTotal: "0" });
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.queryByText("Discount")).not.toBeInTheDocument();
  });

  it("renders discount row when discount is non-zero", () => {
    const invoice = makeBaseInvoice({ discountTotal: "50.00", total: "760.00", amountDue: "760.00" });
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Discount")).toBeInTheDocument();
  });

  it("renders multiple payment methods", () => {
    const invoice = makeBaseInvoice({
      paymentMethods: [
        { type: "bank", label: "Bank Transfer", details: "Account: 123" },
        { type: "card", label: "Credit Card", url: "https://pay.example.com" },
      ],
    });
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Bank Transfer")).toBeInTheDocument();
    expect(screen.getByText("Credit Card")).toBeInTheDocument();
  });

  it("renders deposit info when present", () => {
    const invoice = makeBaseInvoice({
      depositType: "fixed",
      depositValue: "200.00",
      depositDueDate: "2024-01-20",
      depositPaymentPurpose: "Booking deposit",
      depositPaid: "0",
      depositDue: "200.00",
    });
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("Deposit")).toBeInTheDocument();
    expect(screen.getByText("Booking deposit")).toBeInTheDocument();
  });

  it("handles empty line items gracefully", () => {
    const invoice = makeBaseInvoice({ items: [] });
    render(<InvoicePreviewV2 invoice={invoice} />);
    expect(screen.getByText("No line items added yet")).toBeInTheDocument();
  });

  it("applies data-invoice-preview attribute", () => {
    const invoice = makeBaseInvoice();
    const { container } = render(<InvoicePreviewV2 invoice={invoice} />);
    expect(container.querySelector('[data-invoice-preview="v2"]')).toBeInTheDocument();
  });
});
