import { describe, it, expect } from "vitest";
import { Decimal } from "decimal.js";
import { CalculationEngine, calculationEngine, discountAmount } from "../utils/calculation";

function makeLineItem(overrides: Record<string, unknown> = {}) {
  return {
    description: "Test Item",
    quantity: new Decimal(1),
    unit: "each",
    unitPrice: new Decimal(100),
    taxRate: new Decimal(0.0),
    isTaxInclusive: false,
    discount: undefined,
    sortOrder: 0,
    ...overrides,
  };
}

function fixed(d: Decimal | Decimal.Value): string {
  return new Decimal(d).toFixed(2);
}

describe("discountAmount", () => {
  it("returns 0 for undefined discount", () => {
    expect(fixed(discountAmount(undefined, new Decimal(100), "USD"))).toBe("0.00");
  });

  it("calculates percentage discount", () => {
    const result = discountAmount({ type: "percentage", value: new Decimal(10) }, new Decimal(100), "USD");
    expect(fixed(result)).toBe("10.00");
  });

  it("calculates fixed discount", () => {
    const result = discountAmount({ type: "fixed", value: new Decimal(25) }, new Decimal(100), "USD");
    expect(fixed(result)).toBe("25.00");
  });

  it("caps percentage discount at 100%", () => {
    const result = discountAmount({ type: "percentage", value: new Decimal(150) }, new Decimal(100), "USD");
    expect(fixed(result)).toBe("100.00");
  });

  it("caps fixed discount at base amount", () => {
    const result = discountAmount({ type: "fixed", value: new Decimal(150) }, new Decimal(100), "USD");
    expect(fixed(result)).toBe("100.00");
  });

  it("returns 0 for negative discount", () => {
    const result = discountAmount({ type: "fixed", value: new Decimal(-10) }, new Decimal(100), "USD");
    expect(fixed(result)).toBe("0.00");
  });

  it("rounds to currency decimal places", () => {
    const result = discountAmount({ type: "percentage", value: new Decimal(33.333) }, new Decimal(100), "USD");
    expect(fixed(result)).toBe("33.33");
  });
});

describe("CalculationEngine", () => {
  const engine = new CalculationEngine();

  describe("calculate - basic", () => {
    it("calculates a simple invoice without tax", () => {
      const result = engine.calculate({
        currency: "USD",
        lineItems: [makeLineItem({ taxRate: new Decimal(0.0) })],
        fees: [],
        invoiceDiscount: undefined,
        amountPaid: undefined,
      });

      expect(fixed(result.subtotal)).toBe("100.00");
      expect(fixed(result.taxTotal)).toBe("0.00");
      expect(fixed(result.total)).toBe("100.00");
      expect(fixed(result.amountDue)).toBe("100.00");
      expect(fixed(result.amountPaid)).toBe("0.00");
    });

    it("calculates tax-exclusive invoice correctly", () => {
      const result = engine.calculate({
        currency: "USD",
        lineItems: [makeLineItem({ taxRate: new Decimal(0.1) })],
        fees: [],
        invoiceDiscount: undefined,
        amountPaid: undefined,
      });

      expect(fixed(result.subtotal)).toBe("100.00");
      expect(fixed(result.taxTotal)).toBe("10.00");
      expect(fixed(result.total)).toBe("110.00");
      expect(fixed(result.amountDue)).toBe("110.00");
    });

    it("calculates tax-inclusive invoice correctly", () => {
      const result = engine.calculate({
        currency: "USD",
        lineItems: [
          makeLineItem({
            taxRate: new Decimal(0.1),
            isTaxInclusive: true,
          }),
        ],
        fees: [],
        invoiceDiscount: undefined,
        amountPaid: undefined,
      });

      // For tax-inclusive: tax = total * (rate / (1 + rate)) = 100 * (0.1/1.1) = 9.0909... → 9.09
      expect(fixed(result.taxTotal)).toBe("9.09");
      // Total stays at 100 (tax was already included)
      expect(fixed(result.total)).toBe("100.00");
      expect(fixed(result.lineItems[0].taxableAmount)).toBe("90.91");
    });
  });

  describe("calculate - discounts", () => {
    it("applies percentage invoice discount", () => {
      const result = engine.calculate({
        currency: "USD",
        lineItems: [makeLineItem({ unitPrice: new Decimal(200), taxRate: new Decimal(0) })],
        fees: [],
        invoiceDiscount: { type: "percentage", value: new Decimal(10) },
        amountPaid: undefined,
      });

      // 10% of 200 = 20 discount, total = 200 - 20 = 180
      expect(fixed(result.discountTotal)).toBe("20.00");
      expect(fixed(result.total)).toBe("180.00");
    });

    it("applies fixed invoice discount", () => {
      const result = engine.calculate({
        currency: "USD",
        lineItems: [makeLineItem({ unitPrice: new Decimal(200), taxRate: new Decimal(0) })],
        fees: [],
        invoiceDiscount: { type: "fixed", value: new Decimal(50) },
        amountPaid: undefined,
      });

      // 50 discount, total = 200 - 50 = 150
      expect(fixed(result.discountTotal)).toBe("50.00");
      expect(fixed(result.total)).toBe("150.00");
    });

    it("applies line item discount", () => {
      const result = engine.calculate({
        currency: "USD",
        lineItems: [
          makeLineItem({
            unitPrice: new Decimal(100),
            taxRate: new Decimal(0.1),
            discount: { type: "fixed", value: new Decimal(20) },
          }),
        ],
        fees: [],
        invoiceDiscount: undefined,
        amountPaid: undefined,
      });

      expect(fixed(result.lineItems[0].discountAmount)).toBe("20.00");
      // Net = 100 - 20 = 80, tax = 80 * 0.1 = 8, total = 88
      expect(fixed(result.subtotal)).toBe("100.00");
      expect(fixed(result.taxTotal)).toBe("8.00");
      expect(fixed(result.total)).toBe("88.00");
    });
  });

  describe("calculate - fees", () => {
    it("calculates fees with tax", () => {
      const result = engine.calculate({
        currency: "USD",
        lineItems: [makeLineItem({ taxRate: new Decimal(0) })],
        fees: [
          {
            description: "Shipping",
            amount: new Decimal(10),
            taxRate: new Decimal(0.1),
            sortOrder: 0,
          },
        ],
        invoiceDiscount: undefined,
        amountPaid: undefined,
      });

      // Subtotal = 100, fee = 10, feeTax = 1, taxTotal = 1, total = 100 + 10 + 1 = 111
      expect(fixed(result.feeTotal)).toBe("10.00");
      expect(fixed(result.taxTotal)).toBe("1.00");
      expect(fixed(result.total)).toBe("111.00");
    });

    it("handles multiple fees", () => {
      const result = engine.calculate({
        currency: "USD",
        lineItems: [makeLineItem({ taxRate: new Decimal(0) })],
        fees: [
          { description: "Fee 1", amount: new Decimal(5), taxRate: new Decimal(0), sortOrder: 0 },
          { description: "Fee 2", amount: new Decimal(15), taxRate: new Decimal(0.1), sortOrder: 1 },
        ],
        invoiceDiscount: undefined,
        amountPaid: undefined,
      });

      // feeTotal = 5 + 15 = 20, feeTax = 0 + 1.50 = 1.50, total = 100 + 20 + 1.50 = 121.50
      expect(result.fees).toHaveLength(2);
      expect(fixed(result.feeTotal)).toBe("20.00");
      expect(fixed(result.taxTotal)).toBe("1.50");
      expect(fixed(result.total)).toBe("121.50");
    });

    it("throws for negative fee amount", () => {
      expect(() =>
        engine.calculate({
          currency: "USD",
          lineItems: [makeLineItem()],
          fees: [{ description: "Bad Fee", amount: new Decimal(-5), taxRate: new Decimal(0), sortOrder: 0 }],
          invoiceDiscount: undefined,
          amountPaid: undefined,
        })
      ).toThrow("Fee amount must be >= 0");
    });
  });

  describe("calculate - payments", () => {
    it("calculates amountDue after payment", () => {
      const result = engine.calculate({
        currency: "USD",
        lineItems: [makeLineItem({ unitPrice: new Decimal(200), taxRate: new Decimal(0.1) })],
        fees: [],
        invoiceDiscount: undefined,
        amountPaid: new Decimal(50),
      });

      // Total = 200 + 20 = 220, paid = 50, due = 170
      expect(fixed(result.total)).toBe("220.00");
      expect(fixed(result.amountPaid)).toBe("50.00");
      expect(fixed(result.amountDue)).toBe("170.00");
    });

    it("throws for negative payment amount", () => {
      expect(() =>
        engine.calculate({
          currency: "USD",
          lineItems: [makeLineItem()],
          fees: [],
          invoiceDiscount: undefined,
          amountPaid: new Decimal(-10),
        })
      ).toThrow("Amount paid must be >= 0");
    });
  });

  describe("calculate - multiple line items", () => {
    it("calculates total for multiple items", () => {
      const result = engine.calculate({
        currency: "USD",
        lineItems: [
          makeLineItem({ description: "Item 1", quantity: new Decimal(2), unitPrice: new Decimal(50), taxRate: new Decimal(0.1) }),
          makeLineItem({ description: "Item 2", quantity: new Decimal(1), unitPrice: new Decimal(100), taxRate: new Decimal(0.2) }),
        ],
        fees: [],
        invoiceDiscount: undefined,
        amountPaid: undefined,
      });

      // Item 1: 2 * 50 = 100, tax = 10, lineTotal = 110
      // Item 2: 1 * 100 = 100, tax = 20, lineTotal = 120
      // Subtotal = 200, taxTotal = 30, total = 230
      expect(fixed(result.subtotal)).toBe("200.00");
      expect(fixed(result.taxTotal)).toBe("30.00");
      expect(fixed(result.total)).toBe("230.00");
    });
  });

  describe("calculate - no fees", () => {
    it("defaults to empty fees array when fees not provided", () => {
      const result = engine.calculate({
        currency: "USD",
        lineItems: [makeLineItem()],
        invoiceDiscount: undefined,
        amountPaid: undefined,
      });

      expect(result.fees).toEqual([]);
    });
  });

  describe("calculationEngine singleton", () => {
    it("is an instance of CalculationEngine", () => {
      expect(calculationEngine).toBeInstanceOf(CalculationEngine);
    });

    it("can calculate a simple invoice", () => {
      const result = calculationEngine.calculate({
        currency: "USD",
        lineItems: [makeLineItem({ unitPrice: new Decimal(100), taxRate: new Decimal(0.1) })],
        fees: [],
        invoiceDiscount: undefined,
        amountPaid: undefined,
      });

      // Total = 100 + 10 = 110
      expect(fixed(result.total)).toBe("110.00");
    });
  });
});
