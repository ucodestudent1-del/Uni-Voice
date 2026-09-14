import { describe, it, expect } from "vitest";
import { Decimal } from "decimal.js";
import {
  InvoiceValidationService,
  type InvoiceValidationInput,
  type ValidationIssue,
} from "../src/services/validation/invoice-validation.js";
import { calculationEngine } from "../src/domain/calculation.js";

const service = new InvoiceValidationService();

function makeValidInput(overrides: Partial<InvoiceValidationInput> = {}): InvoiceValidationInput {
  const calc = calculationEngine.calculate({
    currency: "USD",
    lineItems: [
      { description: "Web dev", quantity: 2, unit: "each", unitPrice: 100, taxRate: 0.1, isTaxInclusive: false },
    ],
    fees: [],
  });

  return {
    customerId: "cust-1",
    currency: "USD",
    issueDate: new Date("2026-09-01"),
    dueDate: new Date("2026-09-30"),
    paymentInstructions: "Bank transfer to account 1234",
    notes: "Thank you for your business.",
    subtotal: calc.subtotal,
    discountTotal: calc.discountTotal,
    taxTotal: calc.taxTotal,
    feeTotal: calc.feeTotal,
    total: calc.total,
    amountPaid: calc.amountPaid,
    amountDue: calc.amountDue,
    items: [
      {
        description: "Web dev",
        quantity: 2,
        unit: "each",
        unitPrice: 100,
        discount: "0",
        discountType: "fixed",
        taxRate: 0.1,
        isTaxInclusive: false,
      },
    ],
    fees: [],
    ...overrides,
  };
}

function findIssue(issues: ValidationIssue[], code: string): ValidationIssue | undefined {
  return issues.find((i) => i.code === code);
}

describe("InvoiceValidationService", () => {
  describe("valid invoice", () => {
    it("passes validation for a complete, valid invoice", () => {
      const result = service.validate(makeValidInput());
      expect(result.valid).toBe(true);
      expect(result.hasErrors).toBe(false);
      expect(result.hasWarnings).toBe(false);
      expect(result.issues).toHaveLength(0);
    });

    it("passes validation when due date equals issue date", () => {
      const result = service.validate(
        makeValidInput({
          issueDate: new Date("2026-09-01"),
          dueDate: new Date("2026-09-01"),
        }),
      );
      expect(findIssue(result.issues, "INVALID_DUE_DATE")).toBeUndefined();
    });
  });

  describe("missing customer", () => {
    it("flags missing customer as error", () => {
      const result = service.validate(makeValidInput({ customerId: null }));
      expect(result.valid).toBe(false);
      expect(findIssue(result.issues, "MISSING_CUSTOMER")).toMatchObject({
        code: "MISSING_CUSTOMER",
        severity: "error",
        field: "customerId",
      });
    });

    it("flags undefined customer as error", () => {
      const result = service.validate(makeValidInput({ customerId: undefined }));
      expect(findIssue(result.issues, "MISSING_CUSTOMER")).toBeDefined();
    });
  });

  describe("dates", () => {
    it("flags missing issue date as error", () => {
      const result = service.validate(makeValidInput({ issueDate: null }));
      expect(result.hasErrors).toBe(true);
      expect(findIssue(result.issues, "MISSING_ISSUE_DATE")).toMatchObject({
        code: "MISSING_ISSUE_DATE",
        severity: "error",
        field: "issueDate",
      });
    });

    it("flags due date before issue date as error", () => {
      const result = service.validate(
        makeValidInput({
          issueDate: new Date("2026-09-30"),
          dueDate: new Date("2026-09-01"),
        }),
      );
      expect(findIssue(result.issues, "INVALID_DUE_DATE")).toMatchObject({
        code: "INVALID_DUE_DATE",
        severity: "error",
        field: "dueDate",
      });
    });

    it("does not flag when due date is after issue date", () => {
      const result = service.validate(
        makeValidInput({
          issueDate: new Date("2026-09-01"),
          dueDate: new Date("2026-09-15"),
        }),
      );
      expect(findIssue(result.issues, "INVALID_DUE_DATE")).toBeUndefined();
    });
  });

  describe("line items", () => {
    it("flags empty line items as error", () => {
      const result = service.validate(
        makeValidInput({
          items: [],
          subtotal: "0",
          discountTotal: "0",
          taxTotal: "0",
          feeTotal: "0",
          total: "0",
          amountPaid: "0",
          amountDue: "0",
        }),
      );
      expect(findIssue(result.issues, "EMPTY_LINE_ITEMS")).toMatchObject({
        code: "EMPTY_LINE_ITEMS",
        severity: "error",
        field: "items",
      });
    });

    it("flags zero quantity as error", () => {
      const result = service.validate(
        makeValidInput({
          items: [
            {
              description: "Test item",
              quantity: 0,
              unit: "each",
              unitPrice: 100,
              discount: "0",
              discountType: "fixed",
              taxRate: 0.1,
              isTaxInclusive: false,
            },
          ],
        }),
      );
      expect(findIssue(result.issues, "INVALID_QUANTITY")).toMatchObject({
        code: "INVALID_QUANTITY",
        severity: "error",
      });
    });

    it("flags negative quantity as error", () => {
      const result = service.validate(
        makeValidInput({
          items: [
            {
              description: "Test item",
              quantity: -2,
              unit: "each",
              unitPrice: 100,
              discount: "0",
              discountType: "fixed",
              taxRate: 0.1,
              isTaxInclusive: false,
            },
          ],
        }),
      );
      expect(findIssue(result.issues, "INVALID_QUANTITY")).toMatchObject({
        code: "INVALID_QUANTITY",
        severity: "error",
      });
    });

    it("flags negative unit price as error", () => {
      const result = service.validate(
        makeValidInput({
          items: [
            {
              description: "Test item",
              quantity: 1,
              unit: "each",
              unitPrice: -10,
              discount: "0",
              discountType: "fixed",
              taxRate: 0.1,
              isTaxInclusive: false,
            },
          ],
        }),
      );
      expect(findIssue(result.issues, "NEGATIVE_UNIT_PRICE")).toMatchObject({
        code: "NEGATIVE_UNIT_PRICE",
        severity: "error",
      });
    });

    it("flags missing item description as error", () => {
      const result = service.validate(
        makeValidInput({
          items: [
            {
              description: "",
              quantity: 1,
              unit: "each",
              unitPrice: 100,
              discount: "0",
              discountType: "fixed",
              taxRate: 0.1,
              isTaxInclusive: false,
            },
          ],
        }),
      );
      expect(findIssue(result.issues, "MISSING_ITEM_DESCRIPTION")).toMatchObject({
        code: "MISSING_ITEM_DESCRIPTION",
        severity: "error",
      });
    });
  });

  describe("currency", () => {
    it("flags unsupported currency as error", () => {
      const result = service.validate(makeValidInput({ currency: "XYZ" }));
      expect(result.hasErrors).toBe(true);
      expect(findIssue(result.issues, "UNSUPPORTED_CURRENCY")).toMatchObject({
        code: "UNSUPPORTED_CURRENCY",
        severity: "error",
        field: "currency",
      });
    });

    it("flags missing currency as error", () => {
      const result = service.validate(makeValidInput({ currency: undefined as unknown as string }));
      expect(findIssue(result.issues, "UNSUPPORTED_CURRENCY")).toBeDefined();
    });

    it("accepts lowercase currency code", () => {
      const result = service.validate(makeValidInput({ currency: "usd" }));
      expect(findIssue(result.issues, "UNSUPPORTED_CURRENCY")).toBeUndefined();
    });
  });

  describe("payment instructions", () => {
    it("flags missing payment instructions as warning, not error", () => {
      const result = service.validate(makeValidInput({ paymentInstructions: null }));
      expect(findIssue(result.issues, "MISSING_PAYMENT_INSTRUCTIONS")).toMatchObject({
        code: "MISSING_PAYMENT_INSTRUCTIONS",
        severity: "warning",
      });
      expect(result.hasErrors).toBe(false);
      expect(result.valid).toBe(true);
    });

    it("flags empty payment instructions as warning", () => {
      const result = service.validate(makeValidInput({ paymentInstructions: "   " }));
      expect(findIssue(result.issues, "MISSING_PAYMENT_INSTRUCTIONS")).toBeDefined();
      expect(result.hasErrors).toBe(false);
    });
  });

  describe("calculation discrepancy", () => {
    it("flags mismatched total as calculation discrepancy error", () => {
      const result = service.validate(makeValidInput({ total: "999.99" }));
      const discrepancy = findIssue(result.issues, "CALCULATION_DISCREPANCY");
      expect(discrepancy).toBeDefined();
      expect(discrepancy?.field).toBe("total");
    });

    it("flags mismatched subtotal as calculation discrepancy error", () => {
      const result = service.validate(makeValidInput({ subtotal: "999.99" }));
      expect(findIssue(result.issues, "CALCULATION_DISCREPANCY")).toBeDefined();
    });

    it("flags mismatched tax total as calculation discrepancy error", () => {
      const result = service.validate(makeValidInput({ taxTotal: "999.99" }));
      expect(findIssue(result.issues, "CALCULATION_DISCREPANCY")).toBeDefined();
    });

    it("does not flag discrepancy when stored totals are all zero", () => {
      const result = service.validate(
        makeValidInput({
          subtotal: "0",
          discountTotal: "0",
          taxTotal: "0",
          feeTotal: "0",
          total: "0",
          amountPaid: "0",
          amountDue: "0",
        }),
      );
      expect(findIssue(result.issues, "CALCULATION_DISCREPANCY")).toBeUndefined();
    });

    it("matches multiple discrepancy fields independently", () => {
      const result = service.validate(
        makeValidInput({
          subtotal: "999.99",
          total: "999.99",
        }),
      );
      const discrepancies = result.issues.filter((i) => i.code === "CALCULATION_DISCREPANCY");
      expect(discrepancies.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("fix suggestions", () => {
    it("includes fix suggestion for missing customer", () => {
      const result = service.validate(makeValidInput({ customerId: null }));
      const issue = findIssue(result.issues, "MISSING_CUSTOMER");
      expect(issue?.fix).toBeDefined();
      expect(issue?.fix).toContain("customer");
    });

    it("includes fix suggestion for unsupported currency", () => {
      const result = service.validate(makeValidInput({ currency: "XYZ" }));
      const issue = findIssue(result.issues, "UNSUPPORTED_CURRENCY");
      expect(issue?.fix).toBeDefined();
      expect(issue?.fix).toContain("USD");
    });
  });

  describe("result structure", () => {
    it("returns valid=true when only warnings exist", () => {
      const result = service.validate(
        makeValidInput({ paymentInstructions: null, notes: null }),
      );
      expect(result.hasErrors).toBe(false);
      expect(result.hasWarnings).toBe(true);
      expect(result.valid).toBe(true);
    });

    it("returns valid=false when errors exist", () => {
      const result = service.validate(makeValidInput({ customerId: null }));
      expect(result.hasErrors).toBe(true);
      expect(result.valid).toBe(false);
    });

    it("includes severity on all issues", () => {
      const result = service.validate(makeValidInput({ customerId: null, paymentInstructions: null }));
      for (const issue of result.issues) {
        expect(issue.severity).toMatch(/^(error|warning)$/);
      }
    });
  });
});
