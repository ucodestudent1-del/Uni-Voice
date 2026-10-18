import { describe, it, expect } from "vitest";
import {
  buildDocumentTemplateData,
  type BuildReceiptInput,
  type BuildPurchaseOrderInput,
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
    const data = buildDocumentTemplateData("invoice", input);
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
    const data = buildDocumentTemplateData("receipt", input);
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
    const data = buildDocumentTemplateData("purchase-order", input);
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

  it("throws for unknown document type", () => {
    expect(() => buildDocumentTemplateData("unknown" as any, {} as any)).toThrow(
      "Unknown document type"
    );
  });
});
