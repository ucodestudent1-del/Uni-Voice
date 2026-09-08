import { describe, it, expect } from "vitest";
import { Decimal } from "decimal.js";
import { CalculationEngine, discountAmount } from "../src/domain/calculation.js";

const engine = new CalculationEngine();

describe("CalculationEngine", () => {
  describe("basic line item (tax-exclusive)", () => {
    it("computes line subtotal, tax, and total", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "Web dev", quantity: 2, unit: "each", unitPrice: 100, taxRate: 0.1, isTaxInclusive: false },
        ],
      });
      expect(res.subtotal.toFixed(2)).toBe("200.00");
      expect(res.taxTotal.toFixed(2)).toBe("20.00");
      expect(res.total.toFixed(2)).toBe("220.00");
      expect(res.discountTotal.toFixed(2)).toBe("0.00");
      expect(res.amountDue.toFixed(2)).toBe("220.00");
      expect(res.lineItems[0].lineSubtotal.toFixed(2)).toBe("200.00");
      expect(res.lineItems[0].taxableAmount.toFixed(2)).toBe("200.00");
      expect(res.lineItems[0].lineTotal.toFixed(2)).toBe("220.00");
    });

    it("handles decimal quantities", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "Consulting", quantity: 1.5, unit: "hour", unitPrice: 125.5, taxRate: 0.2, isTaxInclusive: false },
        ],
      });
      expect(res.subtotal.toFixed(2)).toBe("188.25");
      expect(res.taxTotal.toFixed(2)).toBe("37.65");
      expect(res.total.toFixed(2)).toBe("225.90");
    });
  });

  describe("discounts", () => {
    it("applies a percentage discount per line", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "Widget", quantity: 1, unit: "each", unitPrice: 100, discount: { type: "percentage", value: 10 }, taxRate: 0.1, isTaxInclusive: false },
        ],
      });
      expect(res.subtotal.toFixed(2)).toBe("100.00");
      expect(res.discountTotal.toFixed(2)).toBe("10.00");
      expect(res.taxTotal.toFixed(2)).toBe("9.00");
      expect(res.total.toFixed(2)).toBe("99.00");
    });

    it("applies a fixed discount per line", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "Widget", quantity: 1, unit: "each", unitPrice: 100, discount: { type: "fixed", value: 25 }, taxRate: 0.1, isTaxInclusive: false },
        ],
      });
      expect(res.lineItems[0].discountAmount.toFixed(2)).toBe("25.00");
      expect(res.lineItems[0].taxableAmount.toFixed(2)).toBe("75.00");
      expect(res.lineItems[0].taxAmount.toFixed(2)).toBe("7.50");
      expect(res.lineItems[0].lineTotal.toFixed(2)).toBe("82.50");
      expect(res.total.toFixed(2)).toBe("82.50");
    });

    it("caps a discount at the line subtotal", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "Widget", quantity: 1, unit: "each", unitPrice: 10, discount: { type: "fixed", value: 50 }, taxRate: 0.1, isTaxInclusive: false },
        ],
      });
      expect(res.lineItems[0].discountAmount.toFixed(2)).toBe("10.00");
      expect(res.total.toFixed(2)).toBe("0.00");
    });

    it("applies invoice-level fixed discount", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "A", quantity: 1, unit: "each", unitPrice: 100, taxRate: 0.1, isTaxInclusive: false },
          { description: "B", quantity: 1, unit: "each", unitPrice: 100, taxRate: 0.1, isTaxInclusive: false },
        ],
        invoiceDiscount: { type: "fixed", value: 50 },
      });
      // subtotal 200, invoice discount 50 distributed proportionally (25 per line)
      // each line taxable 75 -> tax 7.5 each -> taxTotal 15, total 165
      expect(res.subtotal.toFixed(2)).toBe("200.00");
      expect(res.discountTotal.toFixed(2)).toBe("50.00");
      expect(res.taxTotal.toFixed(2)).toBe("15.00");
      expect(res.total.toFixed(2)).toBe("165.00");
    });

    it("applies invoice-level percentage discount", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "A", quantity: 2, unit: "each", unitPrice: 100, taxRate: 0.1, isTaxInclusive: false },
        ],
        invoiceDiscount: { type: "percentage", value: 10 },
      });
      expect(res.discountTotal.toFixed(2)).toBe("20.00");
      expect(res.taxTotal.toFixed(2)).toBe("18.00");
      expect(res.total.toFixed(2)).toBe("198.00");
    });
  });

  describe("tax-inclusive pricing", () => {
    it("extracts tax from inclusive amount", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "Inclusive", quantity: 1, unit: "each", unitPrice: 120, taxRate: 0.2, isTaxInclusive: true },
        ],
      });
      expect(res.lineItems[0].lineSubtotal.toFixed(2)).toBe("120.00");
      expect(res.lineItems[0].taxAmount.toFixed(2)).toBe("20.00");
      expect(res.lineItems[0].taxableAmount.toFixed(2)).toBe("100.00");
      expect(res.lineItems[0].lineTotal.toFixed(2)).toBe("120.00");
      expect(res.taxTotal.toFixed(2)).toBe("20.00");
      expect(res.total.toFixed(2)).toBe("120.00");
    });

    it("handles inclusive item with a fixed discount", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "Inc", quantity: 1, unit: "each", unitPrice: 120, discount: { type: "fixed", value: 10 }, taxRate: 0.2, isTaxInclusive: true },
        ],
      });
      expect(res.lineItems[0].lineSubtotal.toFixed(2)).toBe("120.00");
      expect(res.lineItems[0].discountAmount.toFixed(2)).toBe("10.00");
      expect(res.lineItems[0].taxableAmount.toFixed(2)).toBe("91.67");
      expect(res.lineItems[0].taxAmount.toFixed(2)).toBe("18.33");
      expect(res.lineItems[0].lineTotal.toFixed(2)).toBe("110.00");
    });
  });

  describe("multiple line items and taxes", () => {
    it("sums subtotals and taxes across lines with different rates", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "A", quantity: 1, unit: "each", unitPrice: 100, taxRate: 0.1, isTaxInclusive: false },
          { description: "B", quantity: 1, unit: "each", unitPrice: 50, taxRate: 0.2, isTaxInclusive: false },
        ],
      });
      expect(res.subtotal.toFixed(2)).toBe("150.00");
      expect(res.taxTotal.toFixed(2)).toBe("20.00");
      expect(res.total.toFixed(2)).toBe("170.00");
    });
  });

  describe("fees", () => {
    it("adds fees and taxes on fees", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "A", quantity: 1, unit: "each", unitPrice: 100, taxRate: 0.1, isTaxInclusive: false },
        ],
        fees: [{ description: "Shipping", amount: 10, taxRate: 0.05 }],
      });
      expect(res.feeTotal.toFixed(2)).toBe("10.00");
      expect(res.taxTotal.toFixed(2)).toBe("10.50");
      expect(res.total.toFixed(2)).toBe("120.50");
    });
  });

  describe("currency precision", () => {
    it("rounds to JPY (0 decimal places)", () => {
      const res = engine.calculate({
        currency: "JPY",
        lineItems: [
          { description: "A", quantity: 3, unit: "each", unitPrice: 100, taxRate: 0.1, isTaxInclusive: false },
        ],
      });
      expect(res.total.toFixed(0)).toBe("330");
      expect(res.lineItems[0].taxAmount.toFixed(0)).toBe("30");
    });

    it("rounds per-line before summing (avoids floating drift)", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "A", quantity: 1, unit: "each", unitPrice: 0.05, taxRate: 0.2, isTaxInclusive: false },
          { description: "B", quantity: 1, unit: "each", unitPrice: 0.05, taxRate: 0.2, isTaxInclusive: false },
          { description: "C", quantity: 1, unit: "each", unitPrice: 0.05, taxRate: 0.2, isTaxInclusive: false },
        ],
      });
      expect(res.subtotal.toFixed(2)).toBe("0.15");
      expect(res.taxTotal.toFixed(2)).toBe("0.03");
      expect(res.total.toFixed(2)).toBe("0.18");
    });
  });

  describe("large amounts", () => {
    it("handles large amounts without precision loss", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "Big", quantity: 1, unit: "each", unitPrice: "999999999.99", taxRate: 0.075, isTaxInclusive: false },
        ],
      });
      expect(res.subtotal.toFixed(2)).toBe("999999999.99");
      expect(res.taxTotal.toFixed(2)).toBe("75000000.00");
      expect(res.total.toFixed(2)).toBe("1074999999.99");
    });
  });

  describe("zero and invalid values", () => {
    it("handles zero-price line", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "Free", quantity: 1, unit: "each", unitPrice: 0, taxRate: 0.1, isTaxInclusive: false },
        ],
      });
      expect(res.total.toFixed(2)).toBe("0.00");
    });

    it("rejects zero or negative quantity", () => {
      expect(() => engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "X", quantity: 0, unit: "each", unitPrice: 10, taxRate: 0.1, isTaxInclusive: false },
        ],
      })).toThrow();
      expect(() => engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "X", quantity: -2, unit: "each", unitPrice: 10, taxRate: 0.1, isTaxInclusive: false },
        ],
      })).toThrow();
    });

    it("rejects negative unit price", () => {
      expect(() => engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "X", quantity: 1, unit: "each", unitPrice: -5, taxRate: 0.1, isTaxInclusive: false },
        ],
      })).toThrow();
    });

    it("rejects negative tax rate", () => {
      expect(() => engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "X", quantity: 1, unit: "each", unitPrice: 10, taxRate: -0.1, isTaxInclusive: false },
        ],
      })).toThrow();
    });

    it("rejects negative amount paid", () => {
      expect(() => engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "X", quantity: 1, unit: "each", unitPrice: 10, taxRate: 0, isTaxInclusive: false },
        ],
        amountPaid: -5,
      })).toThrow();
    });
  });

  describe("payments", () => {
    it("computes amount_due = total - amount_paid (partial)", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "A", quantity: 1, unit: "each", unitPrice: 100, taxRate: 0.1, isTaxInclusive: false },
        ],
        amountPaid: 50,
      });
      expect(res.total.toFixed(2)).toBe("110.00");
      expect(res.amountPaid.toFixed(2)).toBe("50.00");
      expect(res.amountDue.toFixed(2)).toBe("60.00");
    });

    it("allows overpayment (negative amount_due)", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          { description: "A", quantity: 1, unit: "each", unitPrice: 100, taxRate: 0.1, isTaxInclusive: false },
        ],
        amountPaid: 200,
      });
      expect(res.amountDue.toFixed(2)).toBe("-90.00");
    });
  });

  describe("empty invoice", () => {
    it("produces zero totals with no line items", () => {
      const res = engine.calculate({ currency: "USD", lineItems: [] });
      expect(res.subtotal.toFixed(2)).toBe("0.00");
      expect(res.total.toFixed(2)).toBe("0.00");
      expect(res.amountDue.toFixed(2)).toBe("0.00");
    });
  });
});

describe("discountAmount helper", () => {
  it("percentage discount: 10% of 200 = 20", () => {
    const d = discountAmount({ type: "percentage", value: 10 }, new Decimal(200), "USD");
    expect(d.toFixed(2)).toBe("20.00");
  });

  it("percentage discount with JPY has 0 decimals", () => {
    const d = discountAmount({ type: "percentage", value: 10 }, new Decimal(200), "JPY");
    expect(d.toFixed(0)).toBe("20");
  });

  it("fixed discount: 25 of 100 = 25", () => {
    const d = discountAmount({ type: "fixed", value: 25 }, new Decimal(100), "USD");
    expect(d.toFixed(2)).toBe("25.00");
  });

  it("caps fixed discount above base", () => {
    const d = discountAmount({ type: "fixed", value: 50 }, new Decimal(10), "USD");
    expect(d.toFixed(2)).toBe("10.00");
  });
});
