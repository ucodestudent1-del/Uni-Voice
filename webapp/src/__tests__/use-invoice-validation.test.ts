import { describe, it, expect } from "vitest";
import { validateInvoiceSync, type ValidationInput } from "../hooks/useInvoiceValidation";

function makeValidInput(overrides: Partial<ValidationInput> = {}): ValidationInput {
  return {
    customerId: "cust-1",
    customer: { name: "John Doe", email: "john@example.com" },
    currency: "USD",
    issueDate: "2026-09-01",
    dueDate: "2026-09-30",
    paymentInstructions: "Bank transfer to account 1234",
    notes: "Thank you for your business.",
    items: [
      {
        description: "Web dev",
        quantity: "2",
        unit: "each",
        unitPrice: "100",
        discount: "0",
        discountType: "fixed",
        taxRate: "0.1",
        isTaxInclusive: false,
      },
    ],
    fees: [],
    ...overrides,
  };
}

function findIssue(issues: ReturnType<typeof validateInvoiceSync>, code: string) {
  return issues.find((i) => i.code === code);
}

describe("useInvoiceValidation – client-side validation", () => {
  describe("valid invoice", () => {
    it("returns no issues for a complete, valid invoice", () => {
      const issues = validateInvoiceSync(makeValidInput());
      expect(issues).toHaveLength(0);
    });

    it("does not flag when due date equals issue date", () => {
      const issues = validateInvoiceSync(
        makeValidInput({ issueDate: "2026-09-01", dueDate: "2026-09-01" }),
      );
      expect(findIssue(issues, "INVALID_DUE_DATE")).toBeUndefined();
    });

    it("does not flag when due date is after issue date", () => {
      const issues = validateInvoiceSync(
        makeValidInput({ issueDate: "2026-09-01", dueDate: "2026-09-15" }),
      );
      expect(findIssue(issues, "INVALID_DUE_DATE")).toBeUndefined();
    });
  });

  describe("missing customer", () => {
    it("flags missing customer as error", () => {
      const issues = validateInvoiceSync(makeValidInput({ customerId: null }));
      expect(findIssue(issues, "MISSING_CUSTOMER")).toMatchObject({
        code: "MISSING_CUSTOMER",
        severity: "error",
        field: "customerId",
      });
    });

    it("flags missing customer name as warning", () => {
      const issues = validateInvoiceSync(
        makeValidInput({ customerId: "cust-1", customer: { name: null, email: null } }),
      );
      expect(findIssue(issues, "MISSING_CUSTOMER_NAME")).toMatchObject({
        code: "MISSING_CUSTOMER_NAME",
        severity: "warning",
      });
    });
  });

  describe("dates", () => {
    it("flags missing issue date as error", () => {
      const issues = validateInvoiceSync(makeValidInput({ issueDate: undefined }));
      expect(findIssue(issues, "MISSING_ISSUE_DATE")).toMatchObject({
        code: "MISSING_ISSUE_DATE",
        severity: "error",
        field: "issueDate",
      });
    });

    it("flags due date before issue date as error", () => {
      const issues = validateInvoiceSync(
        makeValidInput({ issueDate: "2026-09-30", dueDate: "2026-09-01" }),
      );
      expect(findIssue(issues, "INVALID_DUE_DATE")).toMatchObject({
        code: "INVALID_DUE_DATE",
        severity: "error",
        field: "dueDate",
      });
    });
  });

  describe("line items", () => {
    it("flags empty line items as error", () => {
      const issues = validateInvoiceSync(makeValidInput({ items: [] }));
      expect(findIssue(issues, "EMPTY_LINE_ITEMS")).toMatchObject({
        code: "EMPTY_LINE_ITEMS",
        severity: "error",
        field: "items",
      });
    });

    it("flags zero quantity as error", () => {
      const issues = validateInvoiceSync(
        makeValidInput({
          items: [{ description: "Test", quantity: "0", unit: "each", unitPrice: "100", discount: "0", discountType: "fixed", taxRate: "0.1", isTaxInclusive: false }],
        }),
      );
      expect(findIssue(issues, "INVALID_QUANTITY")).toBeDefined();
    });

    it("flags negative quantity as error", () => {
      const issues = validateInvoiceSync(
        makeValidInput({
          items: [{ description: "Test", quantity: "-2", unit: "each", unitPrice: "100", discount: "0", discountType: "fixed", taxRate: "0.1", isTaxInclusive: false }],
        }),
      );
      expect(findIssue(issues, "INVALID_QUANTITY")).toBeDefined();
    });

    it("flags negative unit price as error", () => {
      const issues = validateInvoiceSync(
        makeValidInput({
          items: [{ description: "Test", quantity: "1", unit: "each", unitPrice: "-10", discount: "0", discountType: "fixed", taxRate: "0.1", isTaxInclusive: false }],
        }),
      );
      expect(findIssue(issues, "NEGATIVE_UNIT_PRICE")).toBeDefined();
    });

    it("flags missing description as error", () => {
      const issues = validateInvoiceSync(
        makeValidInput({
          items: [{ description: "", quantity: "1", unit: "each", unitPrice: "100", discount: "0", discountType: "fixed", taxRate: "0.1", isTaxInclusive: false }],
        }),
      );
      expect(findIssue(issues, "MISSING_ITEM_DESCRIPTION")).toBeDefined();
    });
  });

  describe("currency", () => {
    it("flags unsupported currency as error", () => {
      const issues = validateInvoiceSync(makeValidInput({ currency: "XYZ" }));
      expect(findIssue(issues, "UNSUPPORTED_CURRENCY")).toMatchObject({
        code: "UNSUPPORTED_CURRENCY",
        severity: "error",
        field: "currency",
      });
    });

    it("accepts lowercase currency code", () => {
      const issues = validateInvoiceSync(makeValidInput({ currency: "usd" }));
      expect(findIssue(issues, "UNSUPPORTED_CURRENCY")).toBeUndefined();
    });
  });

  describe("payment instructions", () => {
    it("flags missing payment instructions as warning", () => {
      const issues = validateInvoiceSync(makeValidInput({ paymentInstructions: null }));
      expect(findIssue(issues, "MISSING_PAYMENT_INSTRUCTIONS")).toMatchObject({
        code: "MISSING_PAYMENT_INSTRUCTIONS",
        severity: "warning",
        field: "paymentInstructions",
      });
    });

    it("flags empty payment instructions as warning", () => {
      const issues = validateInvoiceSync(makeValidInput({ paymentInstructions: "   " }));
      expect(findIssue(issues, "MISSING_PAYMENT_INSTRUCTIONS")).toBeDefined();
    });
  });

  describe("calculation check", () => {
    it("flags calculation error for negative quantity (matches backend)", () => {
      const issues = validateInvoiceSync(
        makeValidInput({
          items: [{ description: "Test", quantity: "-5", unit: "each", unitPrice: "100", discount: "0", discountType: "fixed", taxRate: "0.1", isTaxInclusive: false }],
        }),
      );
      expect(findIssue(issues, "INVALID_QUANTITY")).toBeDefined();
    });
  });

  describe("fix suggestions", () => {
    it("includes fix suggestions for error issues", () => {
      const issues = validateInvoiceSync(makeValidInput({ customerId: null }));
      const issue = findIssue(issues, "MISSING_CUSTOMER");
      expect(issue?.fix).toBeDefined();
      expect(issue?.fix).toContain("customer");
    });
  });

  describe("severity separation", () => {
    it("errors make the invoice invalid", () => {
      const issues = validateInvoiceSync(makeValidInput({ customerId: null }));
      expect(issues.some((i) => i.severity === "error")).toBe(true);
    });

    it("warnings do not block validation", () => {
      const issues = validateInvoiceSync(makeValidInput({ paymentInstructions: null, notes: null }));
      expect(issues.some((i) => i.severity === "error")).toBe(false);
      expect(issues.some((i) => i.severity === "warning")).toBe(true);
    });
  });
});
