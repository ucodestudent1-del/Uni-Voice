import { describe, it, expect } from "vitest";
import { normalizeDocumentTypeKey } from "../src/domain/schemas/invoice-template.js";

describe("normalizeDocumentTypeKey", () => {
  it("maps quote to quote (not credit_note)", () => {
    expect(normalizeDocumentTypeKey("quote")).toBe("quote");
  });

  it("maps invoice to invoice", () => {
    expect(normalizeDocumentTypeKey("invoice")).toBe("invoice");
  });

  it("maps credit-note to credit_note", () => {
    expect(normalizeDocumentTypeKey("credit-note")).toBe("credit_note");
  });

  it("maps debit-note to debit_note", () => {
    expect(normalizeDocumentTypeKey("debit-note")).toBe("debit_note");
  });

  it("maps payment-voucher to payment_voucher", () => {
    expect(normalizeDocumentTypeKey("payment-voucher")).toBe("payment_voucher");
  });

  it("maps receipt to receipt", () => {
    expect(normalizeDocumentTypeKey("receipt")).toBe("receipt");
  });

  it("maps purchase-order to purchase_order", () => {
    expect(normalizeDocumentTypeKey("purchase-order")).toBe("purchase_order");
  });

  it("maps recurring-invoice to recurring_invoice", () => {
    expect(normalizeDocumentTypeKey("recurring-invoice")).toBe("recurring_invoice");
  });

  it("maps delivery-note to delivery_note", () => {
    expect(normalizeDocumentTypeKey("delivery-note")).toBe("delivery_note");
  });

  it("maps packing-slip to packing_slip", () => {
    expect(normalizeDocumentTypeKey("packing-slip")).toBe("packing_slip");
  });

  it("maps pro-forma-invoice to pro_forma_invoice", () => {
    expect(normalizeDocumentTypeKey("pro-forma-invoice")).toBe("pro_forma_invoice");
  });

  it("maps estimate to estimate", () => {
    expect(normalizeDocumentTypeKey("estimate")).toBe("estimate");
  });
});
