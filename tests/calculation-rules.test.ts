import { describe, it, expect, beforeEach } from "vitest";
import { Decimal } from "decimal.js";
import {
  CalculationEngine,
  type TaxRuleInput,
  type DiscountRuleInput,
  type TaxRuleContext,
} from "../src/domain/calculation.js";

const engine = new CalculationEngine();

function makeTaxRule(overlaps: Partial<TaxRuleInput> = {}): TaxRuleInput {
  return {
    id: "tax-rule-1",
    name: "VAT",
    rate: "0.2",
    type: "percentage",
    isCompound: false,
    conditions: [],
    ...overlaps,
  };
}

function makeDiscountRule(overlaps: Partial<DiscountRuleInput> = {}): DiscountRuleInput {
  return {
    id: "discount-rule-1",
    name: "Bulk Discount",
    type: "percentage",
    value: "10",
    scope: "invoice",
    appliesTo: null,
    minAmount: null,
    maxDiscount: null,
    startsAt: null,
    endsAt: null,
    ...overlaps,
  };
}

describe("CalculationEngine with rules", () => {
  describe("tax rules", () => {
    it("applies tax rule when line item has zero tax rate", () => {
      const rules: TaxRuleInput[] = [makeTaxRule({ rate: "0.1", name: "Std Rate" })];
      const res = engine.calculateWithRules({
        currency: "USD",
        lineItems: [
          {
            description: "Service",
            quantity: 1,
            unit: "each",
            unitPrice: 100,
            taxRate: 0,
            tax_name: null,
            isTaxInclusive: false,
          },
        ],
        taxRules: rules,
        taxRuleContext: { currency: "USD" },
      });
      expect(res.taxTotal.toFixed(2)).toBe("10.00");
      expect(res.total.toFixed(2)).toBe("110.00");
    });

    it("does not override explicit tax rate with rule", () => {
      const rules: TaxRuleInput[] = [makeTaxRule({ rate: "0.2", name: "VAT" })];
      const res = engine.calculateWithRules({
        currency: "USD",
        lineItems: [
          {
            description: "Service",
            quantity: 1,
            unit: "each",
            unitPrice: 100,
            taxRate: "0.05",
            tax_name: null,
            isTaxInclusive: false,
          },
        ],
        taxRules: rules,
      });
      expect(res.taxTotal.toFixed(2)).toBe("5.00");
      expect(res.total.toFixed(2)).toBe("105.00");
    });

    it("keeps zero tax when no rules match", () => {
      const rules: TaxRuleInput[] = [
        makeTaxRule({
          rate: "0.2",
          conditions: [{ field: "customer_country", operator: "equals", value: "US" }],
        }),
      ];
      const res = engine.calculateWithRules({
        currency: "USD",
        lineItems: [
          {
            description: "Service",
            quantity: 1,
            unit: "each",
            unitPrice: 100,
            taxRate: 0,
            tax_name: null,
            isTaxInclusive: false,
          },
        ],
        taxRules: rules,
        taxRuleContext: { customerCountry: "GB", currency: "USD" },
      });
      expect(res.taxTotal.toFixed(2)).toBe("0.00");
      expect(res.total.toFixed(2)).toBe("100.00");
    });

    it("applies rule with matching condition", () => {
      const rules: TaxRuleInput[] = [
        makeTaxRule({
          rate: "0.2",
          conditions: [{ field: "customer_country", operator: "equals", value: "US" }],
        }),
      ];
      const res = engine.calculateWithRules({
        currency: "USD",
        lineItems: [
          {
            description: "Service",
            quantity: 1,
            unit: "each",
            unitPrice: 100,
            taxRate: 0,
            tax_name: null,
            isTaxInclusive: false,
          },
        ],
        taxRules: rules,
        taxRuleContext: { customerCountry: "US", currency: "USD" },
      });
      expect(res.taxTotal.toFixed(2)).toBe("20.00");
      expect(res.total.toFixed(2)).toBe("120.00");
    });

    it("applies condition with greater_than operator for total_amount", () => {
      const rules: TaxRuleInput[] = [
        makeTaxRule({
          rate: "0.15",
          conditions: [{ field: "total_amount_min", operator: "greater_than", value: "100" }],
        }),
      ];
      const res = engine.calculateWithRules({
        currency: "USD",
        lineItems: [
          {
            description: "Service",
            quantity: 1,
            unit: "each",
            unitPrice: 150,
            taxRate: 0,
            tax_name: null,
            isTaxInclusive: false,
          },
        ],
        taxRules: rules,
        taxRuleContext: { totalAmount: "150", currency: "USD" },
      });
      expect(res.taxTotal.toFixed(2)).toBe("22.50");
    });
  });

  describe("discount rules", () => {
    it("applies invoice-level percentage discount rule", () => {
      const rules: DiscountRuleInput[] = [
        makeDiscountRule({ type: "percentage", value: "10", scope: "invoice" }),
      ];
      const res = engine.calculateWithRules({
        currency: "USD",
        lineItems: [
          {
            description: "Service",
            quantity: 1,
            unit: "each",
            unitPrice: 100,
            taxRate: 0,
            tax_name: null,
            isTaxInclusive: false,
          },
        ],
        discountRules: rules,
      });
      expect(res.discountTotal.toFixed(2)).toBe("10.00");
      expect(res.total.toFixed(2)).toBe("90.00");
    });

    it("does not apply discount when minAmount not met", () => {
      const rules: DiscountRuleInput[] = [
        makeDiscountRule({ minAmount: "500", scope: "invoice", value: "20" }),
      ];
      const res = engine.calculateWithRules({
        currency: "USD",
        lineItems: [
          {
            description: "Service",
            quantity: 1,
            unit: "each",
            unitPrice: 100,
            taxRate: 0,
            tax_name: null,
            isTaxInclusive: false,
          },
        ],
        discountRules: rules,
      });
      expect(res.discountTotal.toFixed(2)).toBe("0.00");
    });

    it("applies discount when minAmount is met", () => {
      const rules: DiscountRuleInput[] = [
        makeDiscountRule({ minAmount: "50", scope: "invoice", value: "20" }),
      ];
      const res = engine.calculateWithRules({
        currency: "USD",
        lineItems: [
          {
            description: "Service",
            quantity: 1,
            unit: "each",
            unitPrice: 100,
            taxRate: 0,
            tax_name: null,
            isTaxInclusive: false,
          },
        ],
        discountRules: rules,
      });
      expect(res.discountTotal.toFixed(2)).toBe("20.00");
    });

    it("caps discount at maxDiscount", () => {
      const rules: DiscountRuleInput[] = [
        makeDiscountRule({ maxDiscount: "10", scope: "invoice", value: "20" }),
      ];
      const res = engine.calculateWithRules({
        currency: "USD",
        lineItems: [
          {
            description: "Service",
            quantity: 1,
            unit: "each",
            unitPrice: 100,
            taxRate: 0,
            tax_name: null,
            isTaxInclusive: false,
          },
        ],
        discountRules: rules,
      });
      expect(res.discountTotal.toFixed(2)).toBe("10.00");
    });
  });

  describe("backward compatibility", () => {
    it("calculate() still works without rules", () => {
      const res = engine.calculate({
        currency: "USD",
        lineItems: [
          {
            description: "Web dev",
            quantity: 2,
            unit: "each",
            unitPrice: 100,
            taxRate: 0.1,
            isTaxInclusive: false,
          },
        ],
      });
      expect(res.total.toFixed(2)).toBe("220.00");
      expect(res.taxTotal.toFixed(2)).toBe("20.00");
    });
  });
});
