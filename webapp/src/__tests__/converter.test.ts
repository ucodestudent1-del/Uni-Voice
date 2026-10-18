import { describe, it, expect } from "vitest";
import { invoiceDocumentSchema } from "../document-model/schemas";
import { initializeRegistry } from "../document-model";
import { receiptToDocument, purchaseOrderToDocument, getDefaultDocument } from "../document-model/converter";
import type { ApiReceipt } from "../api/client";
import type { ApiPurchaseOrder, ApiBusiness } from "../types/api";

initializeRegistry();

describe("converter", () => {
  const mockBusiness: ApiBusiness = {
    id: "biz-1",
    name: "Test Business",
    email: "test@business.com",
    phone: "+1234567890",
    website: "https://test.com",
    addressLine1: "123 Main St",
    addressLine2: "Suite 100",
    city: "Anytown",
    stateOrRegion: "CA",
    postalCode: "12345",
    countryCode: "US",
    logoUrl: "https://test.com/logo.png",
    currency: "USD",
    taxId: "12-3456789",
  } as ApiBusiness;

  const mockReceipt: ApiReceipt = {
    id: "receipt-1",
    invoice_id: "inv-1",
    business_id: "biz-1",
    payment_id: "pay-1",
    receipt_number: "RCPT-001",
    amount: "100.00",
    currency: "USD",
    status: "issued",
    provider: "manual",
    sent_to: "customer@example.com",
    issued_at: "2024-01-15T00:00:00Z",
    created_at: "2024-01-15T00:00:00Z",
    updated_at: "2024-01-15T00:00:00Z",
    invoice_number: "INV-001",
    customer_name: "John Doe",
    customer_email: "john@example.com",
    business_name: "Test Business",
  };

  const mockPurchaseOrder: ApiPurchaseOrder = {
    id: "po-1",
    business_id: "biz-1",
    supplier_id: "sup-1",
    purchase_order_number: "PO-001",
    status: "draft",
    issue_date: "2024-01-15",
    due_date: "2024-02-15",
    delivery_date: "2024-01-20",
    currency: "USD",
    supplier_name: "Supplier Co",
    supplier_email: "supplier@example.com",
    supplier_phone: "+1987654321",
    supplier_address_line_1: "456 Supplier St",
    supplier_city: "Supplier City",
    supplier_state_or_region: "NY",
    supplier_postal_code: "67890",
    supplier_country_code: "US",
    supplier_tax_id: "98-7654321",
    reference_number: "REF-123",
    notes: "Please deliver to loading dock.",
    terms: "Net 30",
    subtotal: "500.00",
    tax_total: "40.00",
    total: "540.00",
    amount_due: "540.00",
    is_finalized: false,
    finalized_at: null,
    sent_at: null,
  };

  describe("receiptToDocument", () => {
    it("produces a valid InvoiceDocument", () => {
      const doc = receiptToDocument(mockReceipt, mockBusiness);
      expect(invoiceDocumentSchema.safeParse(doc).success).toBe(true);
    });

    it("has correct document name and businessId", () => {
      const doc = receiptToDocument(mockReceipt, mockBusiness);
      expect(doc.name).toBe("Receipt");
      expect(doc.businessId).toBe("biz-1");
    });

    it("contains business info, line items, total, and signature components", () => {
      const doc = receiptToDocument(mockReceipt, mockBusiness);
      const types = Object.values(doc.components).map((c) => c.type);
      expect(types).toContain("businessInfo");
      expect(types).toContain("lineItems");
      expect(types).toContain("total");
      expect(types).toContain("signature");
    });

    it("includes customer info when customer_name is present", () => {
      const doc = receiptToDocument(mockReceipt, mockBusiness);
      const types = Object.values(doc.components).map((c) => c.type);
      expect(types).toContain("customerInfo");
    });

    it("does not include customer info when customer_name is missing", () => {
      const receiptNoCustomer = { ...mockReceipt, customer_name: null };
      const doc = receiptToDocument(receiptNoCustomer, mockBusiness);
      const customerInfoComponents = Object.values(doc.components).filter((c) => c.type === "customerInfo");
      expect(customerInfoComponents.length).toBe(0);
    });
  });

  describe("purchaseOrderToDocument", () => {
    it("produces a valid InvoiceDocument", () => {
      const doc = purchaseOrderToDocument(mockPurchaseOrder, mockBusiness, {
        name: mockPurchaseOrder.supplier_name!,
        email: mockPurchaseOrder.supplier_email,
      });
      expect(invoiceDocumentSchema.safeParse(doc).success).toBe(true);
    });

    it("has correct document name and businessId", () => {
      const doc = purchaseOrderToDocument(mockPurchaseOrder, mockBusiness, null);
      expect(doc.name).toBe("Purchase Order");
      expect(doc.businessId).toBe("biz-1");
    });

    it("contains business info, line items, subtotal, tax, total, and signature", () => {
      const doc = purchaseOrderToDocument(mockPurchaseOrder, mockBusiness, null);
      const types = Object.values(doc.components).map((c) => c.type);
      expect(types).toContain("businessInfo");
      expect(types).toContain("lineItems");
      expect(types).toContain("subtotal");
      expect(types).toContain("tax");
      expect(types).toContain("total");
      expect(types).toContain("signature");
    });

    it("includes supplier info when supplier name is provided", () => {
      const doc = purchaseOrderToDocument(mockPurchaseOrder, mockBusiness, {
        name: "Supplier Co",
        email: "supplier@example.com",
      });
      const types = Object.values(doc.components).map((c) => c.type);
      expect(types).toContain("customerInfo");
    });

    it("includes notes when provided", () => {
      const doc = purchaseOrderToDocument(mockPurchaseOrder, mockBusiness, null);
      const notesComponents = Object.values(doc.components).filter((c) => c.type === "notes");
      expect(notesComponents.length).toBe(1);
    });

    it("includes delivery date when provided", () => {
      const doc = purchaseOrderToDocument(mockPurchaseOrder, mockBusiness, null);
      const dateComponents = Object.values(doc.components).filter((c) => c.type === "date");
      expect(dateComponents.length).toBeGreaterThanOrEqual(2);
      const deliveryDate = dateComponents.find((c) => c.props?.dateType === "custom");
      expect(deliveryDate).toBeDefined();
    });
  });

  describe("getDefaultDocument", () => {
    it("produces a valid InvoiceDocument", () => {
      const doc = getDefaultDocument("biz-1");
      expect(invoiceDocumentSchema.safeParse(doc).success).toBe(true);
    });

    it("has correct name and businessId", () => {
      const doc = getDefaultDocument("biz-1");
      expect(doc.name).toBe("New Invoice");
      expect(doc.businessId).toBe("biz-1");
    });

    it("contains core invoice components", () => {
      const doc = getDefaultDocument("biz-1");
      const types = Object.values(doc.components).map((c) => c.type);
      expect(types).toContain("businessInfo");
      expect(types).toContain("customerInfo");
      expect(types).toContain("lineItems");
      expect(types).toContain("subtotal");
      expect(types).toContain("total");
      expect(types).toContain("amountDue");
    });
  });
});
