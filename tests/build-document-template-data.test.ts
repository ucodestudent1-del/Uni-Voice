import { describe, it, expect } from "vitest";
import {
  buildDocumentTemplateData,
  type BuildReceiptInput,
  type BuildPurchaseOrderInput,
  type BuildRecurringInvoiceInput,
  type BuildDeliveryNoteInput,
  type BuildPackingSlipInput,
  type BuildProFormaInvoiceInput,
  type BuildEstimateInput,
  type UnifiedBuildInvoiceInput,
  type DocumentTemplateData,
} from "../src/services/templates/template-renderer.js";
import { Decimal } from "decimal.js";

function makeBusiness() {
  return {
    id: "biz-1",
    name: "Acme Corp",
    legalName: "Acme Corp LLC",
    email: "hello@acme.com",
    phone: "+1-555-0100",
    website: "https://acme.com",
    taxId: "12-3456789",
    registrationNumber: "REG-001",
    address: {
      addressLine1: "123 Main St",
      addressLine2: "Suite 100",
      city: "New York",
      stateOrRegion: "NY",
      postalCode: "10001",
      countryCode: "US",
    },
    countryCode: "US",
    defaultCurrency: "USD" as const,
    logoUrl: null,
  };
}

function makeTotals() {
  return {
    subtotal: new Decimal("100.00"),
    discountTotal: new Decimal("0"),
    taxTotal: new Decimal("10.00"),
    feeTotal: new Decimal("0"),
    total: new Decimal("110.00"),
    amountPaid: new Decimal("0"),
    amountDue: new Decimal("110.00"),
  };
}

describe("buildDocumentTemplateData", () => {
  it("builds InvoiceTemplateData for invoice type", () => {
    const input: UnifiedBuildInvoiceInput = {
      business: makeBusiness(),
      customer: null,
      items: [],
      fees: [],
      totals: makeTotals(),
      invoice: {
        id: "inv-1",
        invoiceNumber: "INV-001",
        status: "sent",
        currency: "USD",
        isFinalized: true,
      },
    };
    const data = buildDocumentTemplateData("invoice", input) as any;
    expect(data).toHaveProperty("invoice");
    expect(data.invoice.id).toBe("inv-1");
    expect(data.invoice.invoiceNumber).toBe("INV-001");
    expect(data.invoice.status).toBe("sent");
    expect(data.invoice.currency).toBe("USD");
    expect(data.invoice.isFinalized).toBe(true);
  });

  it("builds ReceiptTemplateData for receipt type", () => {
    const input: BuildReceiptInput = {
      business: makeBusiness(),
      customer: null,
      receipt: {
        id: "rcpt-1",
        receiptNumber: "RCPT-2024-000001",
        status: "paid",
        issuedAt: new Date("2024-01-15T00:00:00Z"),
        currency: "USD",
        amount: new Decimal("99.99"),
        paymentMethod: "card",
        paymentProvider: "stripe",
        providerPaymentId: "pi_123",
        invoiceNumber: "INV-001",
        referenceNumber: null,
        notes: "Payment received",
      },
      items: [],
      fees: [],
      totals: makeTotals(),
    };
    const data = buildDocumentTemplateData("receipt", input) as any;
    expect(data).toHaveProperty("receipt");
    expect(data.receipt.receiptNumber).toBe("RCPT-2024-000001");
    expect(data.receipt.status).toBe("paid");
    expect(data.receipt.issuedAt).toBe("2024-01-15");
    expect(data.receipt.amount).toEqual(new Decimal("99.99"));
    expect(data.receipt.paymentMethod).toBe("card");
    expect(data.receipt.paymentProvider).toBe("stripe");
    expect(data.receipt.providerPaymentId).toBe("pi_123");
    expect(data.receipt.invoiceNumber).toBe("INV-001");
    expect(data.receipt.notes).toBe("Payment received");
    expect(data.receipt.isFinalized).toBe(false);
  });

  it("builds PurchaseOrderTemplateData for purchase-order type", () => {
    const input: BuildPurchaseOrderInput = {
      business: makeBusiness(),
      supplier: null,
      purchaseOrder: {
        id: "po-1",
        purchaseOrderNumber: "PO-2024-001",
        status: "draft",
        issueDate: new Date("2024-01-01T00:00:00Z"),
        dueDate: new Date("2024-01-15T00:00:00Z"),
        currency: "USD",
        supplierName: "Supplier Co",
        supplierEmail: "contact@supplier.com",
        supplierPhone: null,
        referenceNumber: "RFQ-001",
        notes: "Urgent",
        terms: "Net 30",
      },
      items: [],
      fees: [],
      totals: makeTotals(),
    };
    const data = buildDocumentTemplateData("purchase-order", input) as any;
    expect(data).toHaveProperty("purchaseOrder");
    expect(data.purchaseOrder.purchaseOrderNumber).toBe("PO-2024-001");
    expect(data.purchaseOrder.status).toBe("draft");
    expect(data.purchaseOrder.issueDate).toBe("2024-01-01");
    expect(data.purchaseOrder.dueDate).toBe("2024-01-15");
    expect(data.purchaseOrder.currency).toBe("USD");
    expect(data.purchaseOrder.supplierName).toBe("Supplier Co");
    expect(data.purchaseOrder.supplierEmail).toBe("contact@supplier.com");
    expect(data.purchaseOrder.referenceNumber).toBe("RFQ-001");
    expect(data.purchaseOrder.notes).toBe("Urgent");
    expect(data.purchaseOrder.terms).toBe("Net 30");
    expect(data.purchaseOrder.isFinalized).toBe(false);
  });

  it("builds RecurringInvoiceTemplateData for recurring-invoice type", () => {
    const input: BuildRecurringInvoiceInput = {
      business: makeBusiness(),
      customer: null,
      recurringInvoice: {
        id: "ri-1",
        recurringInvoiceNumber: "RI-2024-001",
        name: "Monthly Subscription",
        status: "active",
        frequency: "monthly",
        intervalCount: 1,
        nextGenerationAt: new Date("2024-02-01T00:00:00Z"),
        endDate: null,
        currency: "USD",
        isActive: true,
        autoSend: false,
      },
      items: [],
      fees: [],
      totals: makeTotals(),
    };
    const data = buildDocumentTemplateData("recurring-invoice", input) as any;
    expect(data).toHaveProperty("recurringInvoice");
    expect(data.recurringInvoice.id).toBe("ri-1");
    expect(data.recurringInvoice.recurringInvoiceNumber).toBe("RI-2024-001");
    expect(data.recurringInvoice.name).toBe("Monthly Subscription");
    expect(data.recurringInvoice.frequency).toBe("monthly");
    expect(data.recurringInvoice.isActive).toBe(true);
  });

  it("builds DeliveryNoteTemplateData for delivery-note type", () => {
    const input: BuildDeliveryNoteInput = {
      business: makeBusiness(),
      customer: null,
      deliveryNote: {
        id: "dn-1",
        deliveryNoteNumber: "DN-2024-001",
        status: "finalized",
        issueDate: new Date("2024-01-01T00:00:00Z"),
        dueDate: new Date("2024-01-15T00:00:00Z"),
        currency: "USD",
        referenceInvoiceNumber: "INV-001",
      },
      items: [],
      fees: [],
      totals: makeTotals(),
    };
    const data = buildDocumentTemplateData("delivery-note", input) as any;
    expect(data).toHaveProperty("deliveryNote");
    expect(data.deliveryNote.deliveryNoteNumber).toBe("DN-2024-001");
    expect(data.deliveryNote.status).toBe("finalized");
    expect(data.deliveryNote.issueDate).toBe("2024-01-01");
    expect(data.deliveryNote.referenceInvoiceNumber).toBe("INV-001");
  });

  it("builds PackingSlipTemplateData for packing-slip type", () => {
    const input: BuildPackingSlipInput = {
      business: makeBusiness(),
      supplier: null,
      packingSlip: {
        id: "ps-1",
        packingSlipNumber: "PS-2024-001",
        status: "finalized",
        issueDate: new Date("2024-01-01T00:00:00Z"),
        dueDate: new Date("2024-01-15T00:00:00Z"),
        currency: "USD",
        referencePurchaseOrderNumber: "PO-2024-001",
      },
      items: [],
      fees: [],
      totals: makeTotals(),
    };
    const data = buildDocumentTemplateData("packing-slip", input) as any;
    expect(data).toHaveProperty("packingSlip");
    expect(data.packingSlip.packingSlipNumber).toBe("PS-2024-001");
    expect(data.packingSlip.status).toBe("finalized");
    expect(data.packingSlip.referencePurchaseOrderNumber).toBe("PO-2024-001");
  });

  it("builds ProFormaInvoiceTemplateData for pro-forma-invoice type", () => {
    const input: BuildProFormaInvoiceInput = {
      business: makeBusiness(),
      customer: null,
      proFormaInvoice: {
        id: "pi-1",
        proFormaInvoiceNumber: "PI-2024-001",
        status: "sent",
        issueDate: new Date("2024-01-01T00:00:00Z"),
        dueDate: new Date("2024-01-31T00:00:00Z"),
        expiryDate: new Date("2024-02-15T00:00:00Z"),
        currency: "USD",
        poNumber: "PO-123",
      },
      items: [],
      fees: [],
      totals: makeTotals(),
      paymentInstructions: null,
    };
    const data = buildDocumentTemplateData("pro-forma-invoice", input) as any;
    expect(data).toHaveProperty("proFormaInvoice");
    expect(data.proFormaInvoice.proFormaInvoiceNumber).toBe("PI-2024-001");
    expect(data.proFormaInvoice.status).toBe("sent");
    expect(data.proFormaInvoice.expiryDate).toBe("2024-02-15");
    expect(data.proFormaInvoice.poNumber).toBe("PO-123");
  });

  it("builds EstimateTemplateData for estimate type", () => {
    const input: BuildEstimateInput = {
      business: makeBusiness(),
      customer: null,
      estimate: {
        id: "est-1",
        estimateNumber: "EST-2024-001",
        status: "sent",
        issueDate: new Date("2024-01-01T00:00:00Z"),
        expiryDate: new Date("2024-02-01T00:00:00Z"),
        currency: "USD",
        poNumber: "PO-456",
        scopeOfWork: "Website development",
      },
      items: [],
      fees: [],
      totals: makeTotals(),
    };
    const data = buildDocumentTemplateData("estimate", input) as any;
    expect(data).toHaveProperty("estimate");
    expect(data.estimate.estimateNumber).toBe("EST-2024-001");
    expect(data.estimate.status).toBe("sent");
    expect(data.estimate.expiryDate).toBe("2024-02-01");
    expect(data.estimate.scopeOfWork).toBe("Website development");
  });

  it("throws for unknown document type", () => {
    expect(() => buildDocumentTemplateData("unknown" as any, {} as any)).toThrow(
      "Unknown document type"
    );
  });
});
