import { describe, it, expect } from "vitest";
import {
  renderDefaultTerms,
  resolveInvoiceTerms,
  DEFAULT_INVOICE_TERMS_TEMPLATE,
  DEFAULT_JURISDICTION,
  DEFAULT_BILLING_EMAIL,
  DEFAULT_TOS_URL,
} from "../src/services/terms.js";

describe("terms service", () => {
  describe("renderDefaultTerms", () => {
    it("resolves placeholder tokens with default context", () => {
      const result = renderDefaultTerms();
      expect(result.plainText).toContain(DEFAULT_JURISDICTION);
      expect(result.plainText).toContain(DEFAULT_TOS_URL);
      expect(result.plainText).toContain(DEFAULT_BILLING_EMAIL);
    });

    it("resolves placeholder tokens with provided context", () => {
      const result = renderDefaultTerms({
        jurisdiction: "State of New York",
        tosUrl: "https://company.example.com/terms",
        billingEmail: "billing@company.example.com",
      });
      expect(result.plainText).toContain("State of New York");
      expect(result.plainText).not.toContain(DEFAULT_JURISDICTION);
      expect(result.plainText).toContain("https://company.example.com/terms");
      expect(result.plainText).not.toContain(DEFAULT_TOS_URL);
      expect(result.plainText).toContain("billing@company.example.com");
    });

    it("contains all required SaaS terms sections", () => {
      const result = renderDefaultTerms();
      expect(result.plainText).toContain("Payment Terms");
      expect(result.plainText).toContain("Late Payment");
      expect(result.plainText).toContain("Taxes");
      expect(result.plainText).toContain("Refund Policy");
      expect(result.plainText).toContain("Dispute Resolution");
      expect(result.plainText).toContain("Terms of Service");
      expect(result.plainText).toContain("Governing Law");
      expect(result.plainText).toContain("Contact");
    });

    it("states payment is due within the period on the invoice", () => {
      const result = renderDefaultTerms();
      expect(result.plainText).toContain("due within the period specified on the invoice");
    });

    it("notes late fees are subject to legal permissions", () => {
      const result = renderDefaultTerms();
      expect(result.plainText).toContain("to the fullest extent permitted by law");
    });

    it("states customer is responsible for taxes", () => {
      const result = renderDefaultTerms();
      expect(result.plainText).toContain("responsible for all applicable taxes");
    });

    it("states payments are non-refundable except as required by law", () => {
      const result = renderDefaultTerms();
      expect(result.plainText).toContain("non-refundable except as required by applicable law");
    });

    it("requires disputes within 30 days", () => {
      const result = renderDefaultTerms();
      expect(result.plainText).toContain("within 30 days of the invoice date");
    });

    it("directs to Terms of Service rather than reproducing it", () => {
      const result = renderDefaultTerms();
      expect(result.plainText).toContain("subject to our Terms of Service");
      expect(result.plainText).toContain(DEFAULT_TOS_URL);
    });

    it("states governing law jurisdiction", () => {
      const result = renderDefaultTerms();
      expect(result.plainText).toContain("governed by the laws of");
      expect(result.plainText).toContain(DEFAULT_JURISDICTION);
    });

    it("directs billing inquiries to the billing contact", () => {
      const result = renderDefaultTerms();
      expect(result.plainText).toContain("Direct all billing inquiries");
      expect(result.plainText).toContain(DEFAULT_BILLING_EMAIL);
    });

    it("produces html with paragraph wrappers", () => {
      const result = renderDefaultTerms();
      expect(result.html).toContain("<p>");
      expect(result.html).toContain("</p>");
    });
  });

  describe("resolveInvoiceTerms", () => {
    it("prefers input terms over business default and SaaS default", () => {
      const result = resolveInvoiceTerms(
        "Custom per-invoice terms",
        "Business default terms",
        { jurisdiction: "CA" }
      );
      expect(result).not.toBeNull();
      expect(result!.plainText).toBe("Custom per-invoice terms");
    });

    it("falls back to business default terms when input is null", () => {
      const result = resolveInvoiceTerms(null, "Business default terms");
      expect(result).not.toBeNull();
      expect(result!.plainText).toBe("Business default terms");
    });

    it("falls back to business default terms when input is empty string", () => {
      const result = resolveInvoiceTerms("", "Business default terms");
      expect(result).not.toBeNull();
      expect(result!.plainText).toBe("Business default terms");
    });

    it("falls back to SaaS default when both input and business are null", () => {
      const result = resolveInvoiceTerms(null, null);
      expect(result).not.toBeNull();
      expect(result!.plainText).toContain("Payment Terms");
    });

    it("falls back to SaaS default when business default is empty", () => {
      const result = resolveInvoiceTerms(undefined, "");
      expect(result).not.toBeNull();
      expect(result!.plainText).toContain("Governing Law");
    });
  });

  describe("DEFAULT_INVOICE_TERMS_TEMPLATE", () => {
    it("contains placeholder tokens", () => {
      expect(DEFAULT_INVOICE_TERMS_TEMPLATE).toContain("{{tosUrl}}");
      expect(DEFAULT_INVOICE_TERMS_TEMPLATE).toContain("{{jurisdiction}}");
      expect(DEFAULT_INVOICE_TERMS_TEMPLATE).toContain("{{billingEmail}}");
    });
  });
});
