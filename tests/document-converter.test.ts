import { describe, it, expect } from "vitest";
import { DocumentConverterService } from "../src/services/document-converter-service.js";
import { AVAILABLE_CONVERSIONS } from "../src/services/document-converter-service.js";
import type { DocumentTypeKey } from "../src/services/templates/template-renderer.js";

describe("DocumentConverterService", () => {
  const mockDocumentService = {
    generateOutput: async () => ({ data: Buffer.from("test"), mimeType: "application/pdf", filename: "test.pdf", sha256: "abc", format: "pdf" as const, fromCache: false }),
    getHandler: () => ({}),
  };

  const converter = new DocumentConverterService(mockDocumentService as any);

  describe("getAvailableConversions", () => {
    it("returns conversions for invoice", () => {
      const conversions = converter.getAvailableConversions("invoice");
      expect(conversions).toContain("purchase-order");
      expect(conversions).toContain("credit-note");
      expect(conversions).toContain("debit-note");
      expect(conversions).toContain("delivery-note");
      expect(conversions).toContain("pro-forma-invoice");
    });

    it("returns conversions for quote", () => {
      const conversions = converter.getAvailableConversions("quote");
      expect(conversions).toContain("invoice");
      expect(conversions).toContain("purchase-order");
      expect(conversions).toContain("credit-note");
      expect(conversions).toContain("debit-note");
      expect(conversions).toContain("pro-forma-invoice");
      expect(conversions).toContain("estimate");
    });

    it("returns conversions for purchase-order", () => {
      const conversions = converter.getAvailableConversions("purchase-order");
      expect(conversions).toContain("invoice");
      expect(conversions).toContain("debit-note");
      expect(conversions).toContain("delivery-note");
      expect(conversions).toContain("packing-slip");
    });

    it("returns conversions for recurring-invoice", () => {
      const conversions = converter.getAvailableConversions("recurring-invoice");
      expect(conversions).toContain("invoice");
    });

    it("returns conversions for delivery-note", () => {
      const conversions = converter.getAvailableConversions("delivery-note");
      expect(conversions).toContain("invoice");
    });

    it("returns conversions for packing-slip", () => {
      const conversions = converter.getAvailableConversions("packing-slip");
      expect(conversions).toContain("purchase-order");
    });

    it("returns conversions for pro-forma-invoice", () => {
      const conversions = converter.getAvailableConversions("pro-forma-invoice");
      expect(conversions).toContain("invoice");
    });

    it("returns conversions for estimate", () => {
      const conversions = converter.getAvailableConversions("estimate");
      expect(conversions).toContain("quote");
      expect(conversions).toContain("invoice");
    });

    it("returns empty array for purchase-order", () => {
      const conversions = converter.getAvailableConversions("receipt");
      expect(conversions).toHaveLength(0);
    });
  });

  describe("canConvert", () => {
       it("returns true for valid conversion", () => {
      expect(converter.canConvert("invoice", "purchase-order")).toBe(true);
      expect(converter.canConvert("quote", "invoice")).toBe(true);
      expect(converter.canConvert("invoice", "delivery-note")).toBe(true);
      expect(converter.canConvert("quote", "estimate")).toBe(true);
      expect(converter.canConvert("recurring-invoice", "invoice")).toBe(true);
    });

    it("returns false for invalid conversion", () => {
      expect(converter.canConvert("receipt", "invoice")).toBe(false);
      expect(converter.canConvert("purchase-order", "receipt")).toBe(false);
      expect(converter.canConvert("delivery-note", "packing-slip")).toBe(false);
    });
  });

  describe("AVAILABLE_CONVERSIONS map", () => {
       it("includes all document types as keys", () => {
      const expectedTypes: DocumentTypeKey[] = [
        "invoice", "quote", "credit-note", "debit-note",
        "payment-voucher", "receipt", "purchase-order",
        "recurring-invoice", "delivery-note", "packing-slip",
        "pro-forma-invoice", "estimate",
      ];
      for (const type of expectedTypes) {
        expect(AVAILABLE_CONVERSIONS).toHaveProperty(type);
      }
    });
  });
});
