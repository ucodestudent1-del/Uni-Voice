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
    });

    it("returns conversions for quote", () => {
      const conversions = converter.getAvailableConversions("quote");
      expect(conversions).toContain("invoice");
      expect(conversions).toContain("purchase-order");
      expect(conversions).toContain("credit-note");
      expect(conversions).toContain("debit-note");
    });

    it("returns conversions for purchase-order", () => {
      const conversions = converter.getAvailableConversions("purchase-order");
      expect(conversions).toContain("invoice");
      expect(conversions).toContain("debit-note");
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
    });

    it("returns false for invalid conversion", () => {
      expect(converter.canConvert("receipt", "invoice")).toBe(false);
      expect(converter.canConvert("purchase-order", "receipt")).toBe(false);
    });
  });

  describe("AVAILABLE_CONVERSIONS map", () => {
    it("includes all document types as keys", () => {
      const expectedTypes: DocumentTypeKey[] = [
        "invoice", "quote", "credit-note", "debit-note",
        "payment-voucher", "receipt", "purchase-order",
      ];
      for (const type of expectedTypes) {
        expect(AVAILABLE_CONVERSIONS).toHaveProperty(type);
      }
    });
  });
});
