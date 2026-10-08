import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import QuotePreviewV2, { type PreviewQuote } from "@/components/QuotePreviewV2";

function makeBaseQuote(overrides: Partial<PreviewQuote> = {}): PreviewQuote {
  return {
    businessName: "Acme Corp",
    businessLegalName: "Acme Corporation Ltd.",
    businessEmail: "billing@acme.com",
    businessPhone: "+1 (555) 123-4567",
    businessWebsite: "https://acme.com",
    businessAddress: "123 Main St\nAnytown, CA 90210",
    businessLogo: "https://example.com/logo.png",
    businessTaxId: "12-3456789",
    quoteNumber: "Q-001",
    quoteTitle: "QUOTATION",
    issueDate: "2024-01-15",
    dueDate: "2099-02-14",
    expiryDate: "2099-03-15",
    currency: "USD",
    poNumber: "PO-12345",
    projectName: "Website Redesign",
    terms: "Payment due within 30 days.",
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
    notes: "Thank you for considering our services!",
    paymentInstructions: "Bank transfer preferred.",
    scopeOfWork: "Design and implement a responsive website.",
    paymentMethods: [
      {
        type: "bank",
        label: "Bank Transfer",
        details: "Account: 123456789\nRouting: 987654321",
      },
    ],
    bankDetails: "Account: 123456789\nRouting: 987654321\nBank: First National Bank",
    paymentLink: "https://acme.com/pay/quote-001",
    status: "sent",
    isFinalized: true,
    ...overrides,
  };
}

describe("QuotePreviewV2", () => {
  it("renders business name and legal name in header", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Acme Corporation Ltd.")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });

  it("renders quote title and number", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("QUOTATION")).toBeInTheDocument();
    expect(screen.getByText("#Q-001")).toBeInTheDocument();
  });

  it("renders business contact details", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("billing@acme.com")).toBeInTheDocument();
    expect(screen.getByText("+1 (555) 123-4567")).toBeInTheDocument();
    expect(screen.getByText("https://acme.com")).toBeInTheDocument();
  });

  it("renders business tax ID", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Tax ID: 12-3456789")).toBeInTheDocument();
  });

  it("renders business address", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
    expect(screen.getByText(/Anytown, CA 90210/)).toBeInTheDocument();
  });

  it("renders issue, due, and expiry dates", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("January 15, 2024")).toBeInTheDocument();
    expect(screen.getByText("February 14, 2099")).toBeInTheDocument();
    expect(screen.getByText("March 15, 2099")).toBeInTheDocument();
  });

  it("renders currency (appears in meta grid and payment info)", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getAllByText(/USD/).length).toBeGreaterThan(0);
  });

  it("renders PO number when present", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("PO-12345")).toBeInTheDocument();
  });

  it("renders project name when present", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Website Redesign")).toBeInTheDocument();
  });

  it("renders terms section", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getAllByText(/Payment due within 30 days/).length).toBeGreaterThan(0);
  });

  it("renders Bill To section with customer details", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Bill To")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Doe Industries")).toBeInTheDocument();
    expect(screen.getByText("john@doeindustries.com")).toBeInTheDocument();
    expect(screen.getByText("Tax ID: 98-7654321")).toBeInTheDocument();
  });

  it("renders 'No customer selected' when customer is missing", () => {
    const quote = makeBaseQuote({
      customerName: null,
      customerCompanyName: null,
      customerEmail: null,
      customerAddress: null,
      customerTaxId: null,
    });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("No customer selected")).toBeInTheDocument();
  });

  it("renders line items table", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Web design service")).toBeInTheDocument();
    expect(screen.getAllByText("$810.00").length).toBeGreaterThan(0);
  });

  it("renders tax breakdown section", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Tax Breakdown")).toBeInTheDocument();
    expect(screen.getAllByText(/CA Sales Tax/).length).toBeGreaterThan(0);
  });

  it("renders scope of work section when present", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Scope of Work")).toBeInTheDocument();
    expect(screen.getByText("Design and implement a responsive website.")).toBeInTheDocument();
  });

  it("renders fees table when fees exist", () => {
    const quote = makeBaseQuote({
      fees: [{ description: "Processing fee", amount: "25.00", taxRate: "0", tax_name: null, tax_amount: "0" }],
      feeTotal: "25.00",
      total: "835.00",
      amountDue: "835.00",
    });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Processing fee")).toBeInTheDocument();
    expect(screen.getByText("Fees")).toBeInTheDocument();
  });

  it("renders totals summary with subtotal, tax, total, amount due", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("Tax")).toBeInTheDocument();
    expect(screen.getByText("Estimated Total")).toBeInTheDocument();
    expect(screen.getByText("Amount Due")).toBeInTheDocument();
  });

  it("renders 'Paid in Full' when amount due is zero", () => {
    const quote = makeBaseQuote({
      amountPaid: "810.00",
      amountDue: "0",
    });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Paid in Full")).toBeInTheDocument();
  });

  it("renders 'Expired' for expired quotes", () => {
    const quote = makeBaseQuote({
      expiryDate: "2020-01-01",
      status: "sent",
      amountDue: "810.00",
    });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByText("(expired)")).toBeInTheDocument();
  });

  it("renders payment information section", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Quote Summary")).toBeInTheDocument();
  });

  it("renders notes section when present", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Thank you for considering our services!")).toBeInTheDocument();
  });

  it("renders terms and conditions section", () => {
    const quote = makeBaseQuote({
      terms: "All sales are final.",
    });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getAllByText("Terms & Conditions").length).toBeGreaterThan(0);
  });

  it("renders attachments section when present", () => {
    const quote = makeBaseQuote({
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
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Photos & Attachments")).toBeInTheDocument();
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
  });

  it("renders footer with quote number when finalized", () => {
    const quote = makeBaseQuote();
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Quote #Q-001. All rights reserved.")).toBeInTheDocument();
  });

  it("renders footer as draft when not finalized", () => {
    const quote = makeBaseQuote({ isFinalized: false, status: "draft" });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("This is a draft quote. Not yet finalized.")).toBeInTheDocument();
  });

  it("renders quote title from quoteTitle field", () => {
    const quote = makeBaseQuote({ quoteTitle: "ESTIMATE" });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("ESTIMATE")).toBeInTheDocument();
  });

  it("does not render tax breakdown when no tax", () => {
    const quote = makeBaseQuote({
      taxTotal: "0",
      items: [{ description: "Tax-free item", quantity: "1", unit: "each", unitPrice: "100.00", taxRate: "0" }],
    });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.queryByText("Tax Breakdown")).not.toBeInTheDocument();
  });

  it("does not render discount row when discount is zero", () => {
    const quote = makeBaseQuote({ discountTotal: "0" });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.queryByText("Discount")).not.toBeInTheDocument();
  });

  it("renders discount row when discount is non-zero", () => {
    const quote = makeBaseQuote({ discountTotal: "50.00", total: "760.00", amountDue: "760.00" });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Discount")).toBeInTheDocument();
  });

  it("renders multiple payment methods", () => {
    const quote = makeBaseQuote({
      paymentMethods: [
        { type: "bank", label: "Bank Transfer", details: "Account: 123" },
        { type: "card", label: "Credit Card", url: "https://pay.example.com" },
      ],
    });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Bank Transfer")).toBeInTheDocument();
    expect(screen.getByText("Credit Card")).toBeInTheDocument();
  });

  it("renders deposit info when present", () => {
    const quote = makeBaseQuote({
      depositType: "fixed",
      depositValue: "200.00",
      depositDueDate: "2024-01-20",
      depositPaymentPurpose: "Booking deposit",
      depositPaid: "0",
      depositDue: "200.00",
    });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Deposit")).toBeInTheDocument();
    expect(screen.getByText("Booking deposit")).toBeInTheDocument();
  });

  it("handles empty line items gracefully", () => {
    const quote = makeBaseQuote({ items: [] });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("No line items added yet")).toBeInTheDocument();
  });

  it("does not render scope of work when empty", () => {
    const quote = makeBaseQuote({ scopeOfWork: null });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.queryByText("Scope of Work")).not.toBeInTheDocument();
  });

  it("does not render due date section when missing", () => {
    const quote = makeBaseQuote({ dueDate: null });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.queryByText("Due date")).not.toBeInTheDocument();
  });

  it("does not render expiry date section when missing", () => {
    const quote = makeBaseQuote({ expiryDate: null });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.queryByText("Expiry date")).not.toBeInTheDocument();
  });

  it("marks expired quotes as expired when status is sent and past expiry", () => {
    const quote = makeBaseQuote({
      expiryDate: "2020-01-01",
      status: "sent",
    });
    render(<QuotePreviewV2 quote={quote} />);
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("applies data-quote-preview attribute", () => {
    const quote = makeBaseQuote();
    const { container } = render(<QuotePreviewV2 quote={quote} />);
    expect(container.querySelector('[data-quote-preview="v2"]')).toBeInTheDocument();
  });
});
