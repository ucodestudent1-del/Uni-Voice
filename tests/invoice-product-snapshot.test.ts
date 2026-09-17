import { describe, it, expect, beforeEach } from "vitest";
import { invoiceService } from "../src/services/invoice-service.js";
import { productServiceRepository } from "../src/repositories/product-service.repo.js";
import { truncateTestDb, createTestBusiness, createTestCustomer } from "./helpers/db.js";

describe("Invoice product snapshot", () => {
  let businessId: string;

  beforeEach(async () => {
    await truncateTestDb();
    const biz = await createTestBusiness();
    businessId = biz.id;
  }, 60000);

  it("snapshots product data when creating a draft with productId", async () => {
    const product = await productServiceRepository.create(businessId, {
      type: "product",
      name: "Widget Pro",
      description: "A premium widget",
      sku: "WID-001",
      unit: "each",
      unitPrice: "49.99",
      taxCategory: "standard",
      currency: "USD",
      status: "active",
      discountType: "percentage",
      discountValue: "0",
    });

    const invoiceId = await invoiceService.createDraft(
      {
        items: [
          {
            description: "Widget Pro",
            quantity: 2,
            unit: "each",
            unitPrice: 49.99,
            discount: 0,
            discountType: "fixed",
            taxRate: 0.1,
            isTaxInclusive: false,
            productId: product.id,
          },
        ],
      },
      businessId,
      "11111111-1111-1111-1111-111111111111"
    );

    const summary = await invoiceService.getInvoice(businessId, invoiceId);
    const item = summary.items[0];

    expect(item.productId).toBe(product.id);
    expect(item.catalogName).toBe("Widget Pro");
    expect(item.catalogSku).toBe("WID-001");
    expect(item.catalogTaxCategory).toBe("standard");
    expect(item.catalogUnitPrice).toBe(product.unitPrice);
    expect(Number(item.catalogTaxRate)).toBeCloseTo(Number(product.defaultTaxRate), 4);
  });

  it("snapshots product data when setting items with productId", async () => {
    const product = await productServiceRepository.create(businessId, {
      type: "product",
      name: "Service Package",
      description: "Consulting service",
      sku: "SVC-001",
      unit: "hour",
      unitPrice: "125.00",
      taxCategory: "services",
      currency: "USD",
      status: "active",
      discountType: "percentage",
      discountValue: "0",
    });

    const invoiceId = await invoiceService.createDraft({}, businessId, "11111111-1111-1111-1111-111111111111");

    await invoiceService.setItems(
      businessId,
      invoiceId,
      [
        {
          description: "Service Package",
          quantity: 5,
          unit: "hour",
          unitPrice: 125,
          discount: 0,
          discountType: "fixed",
          taxRate: 0.15,
          isTaxInclusive: false,
          productId: product.id,
        },
      ],
      "11111111-1111-1111-1111-111111111111"
    );

    const summary = await invoiceService.getInvoice(businessId, invoiceId);
    const item = summary.items[0];

    expect(item.productId).toBe(product.id);
    expect(item.catalogName).toBe("Service Package");
    expect(item.catalogSku).toBe("SVC-001");
    expect(item.catalogTaxCategory).toBe("services");
    expect(item.catalogUnitPrice).toBe(product.unitPrice);
    expect(Number(item.catalogTaxRate)).toBeCloseTo(Number(product.defaultTaxRate), 4);
  });

  it("uses stored snapshot values for calculation, not re-fetched product values", async () => {
    const product = await productServiceRepository.create(businessId, {
      type: "product",
      name: "Original Product",
      description: "test",
      sku: "ORIG-001",
      unit: "each",
      unitPrice: "10.00",
      taxCategory: "standard",
      currency: "USD",
      status: "active",
      discountType: "percentage",
      discountValue: "0",
    });

    const invoiceId = await invoiceService.createDraft(
      {
        items: [
          {
            description: "Original Product",
            quantity: 1,
            unit: "each",
            unitPrice: 10,
            discount: 0,
            discountType: "fixed",
            taxRate: 0.1,
            isTaxInclusive: false,
            productId: product.id,
          },
        ],
      },
      businessId,
      "11111111-1111-1111-1111-111111111111"
    );

    // Update product price and tax category
    await productServiceRepository.update(businessId, product.id, {
      name: "Renamed Product",
      unitPrice: "999.99",
      taxCategory: "zero-rated",
    });

    // Snapshot should still reflect old values
    const summary = await invoiceService.getInvoice(businessId, invoiceId);
    const item = summary.items[0];

    expect(item.catalogName).toBe("Original Product");
    expect(item.catalogUnitPrice).toBe(product.unitPrice);
    expect(Number(item.catalogTaxRate)).toBeCloseTo(Number(product.defaultTaxRate), 4);
    expect(item.catalogTaxCategory).toBe("standard");
  });

  it("preserves catalog fields for items without productId", async () => {
    const invoiceId = await invoiceService.createDraft(
      {
        items: [
          {
            description: "Custom Service",
            quantity: 3,
            unit: "each",
            unitPrice: 50,
            discount: 0,
            discountType: "fixed",
            taxRate: 0.05,
            isTaxInclusive: false,
            catalogName: "Catalog Reference",
            catalogSku: "CUSTOM-001",
            catalogTaxCategory: "premium",
            catalogUnitPrice: "99.99",
            catalogTaxRate: "0.08",
          } as any,
        ],
      },
      businessId,
      "11111111-1111-1111-1111-111111111111"
    );

    const summary = await invoiceService.getInvoice(businessId, invoiceId);
    const item = summary.items[0];

    expect(item.productId).toBeNull();
    expect(item.catalogName).toBe("Catalog Reference");
    expect(item.catalogSku).toBe("CUSTOM-001");
    expect(item.catalogTaxCategory).toBe("premium");
    expect(item.catalogUnitPrice).toMatch(/^99\.99/);
    expect(Number(item.catalogTaxRate)).toBeCloseTo(0.08, 4);
  });
});
