import { describe, it, expect, beforeEach, vi } from "vitest";
import { aiService } from "../src/services/ai-service.js";

const BUSINESS_ID = "00000000-0000-0000-0000-000000000001";

describe("AiService", () => {
  describe("parseDocument", () => {
    it("returns empty result for empty text", async () => {
      const result = await aiService.parseDocument("", { businessId: BUSINESS_ID });

      expect(result.fields.items).toHaveLength(0);
      expect(result.fields.fees).toHaveLength(0);
      expect(result.confidence).toBe(0);
      expect(result.matchedCustomer).toBeNull();
      expect(result.matchedProducts).toHaveLength(0);
    });

    it("parses simple line item with quantity and price", async () => {
      const text = "5 hours consulting at $100";
      const result = await aiService.parseDocument(text, { businessId: BUSINESS_ID });

      expect(result.fields.items).toHaveLength(1);
      expect(result.fields.items[0].description).toMatch(/consulting/);
      expect(result.fields.items[0].quantity).toBe(5);
      expect(result.fields.items[0].unitPrice).toBe(100);
      expect(result.fields.items[0].unit).toBe("hour");
    });

    it("extracts currency from text", async () => {
      const text = "10 widgets at $50, paid in EUR";
      const result = await aiService.parseDocument(text, { businessId: BUSINESS_ID });

      expect(result.fields.currency).toBe("EUR");
    });

    it("extracts tax rate from text", async () => {
      const text = "10 items at $25, 10% tax";
      const result = await aiService.parseDocument(text, { businessId: BUSINESS_ID });

      expect(result.fields.taxRate).toBe(10);
    });

    it("extracts fees from text", async () => {
      const text = "5 hours consulting at $100, plus $50 setup fee";
      const result = await aiService.parseDocument(text, { businessId: BUSINESS_ID });

      expect(result.fields.fees).toHaveLength(1);
      expect(result.fields.fees[0].amount).toBe(50);
      expect(result.fields.fees[0].description).toContain("setup");
    });

    it("handles 'X items totaling $Y' pattern", async () => {
      const text = "3 widgets totaling $150 for Acme Corp";
      const result = await aiService.parseDocument(text, { businessId: BUSINESS_ID });

      expect(result.fields.items).toHaveLength(1);
      expect(result.fields.items[0].quantity).toBe(3);
      expect(result.fields.items[0].unitPrice).toBe(50);
    });

    it("handles 'X item: $Y x Z' pattern", async () => {
      const text = "Consulting: $200 x 3";
      const result = await aiService.parseDocument(text, { businessId: BUSINESS_ID });

      expect(result.fields.items).toHaveLength(1);
      expect(result.fields.items[0].unitPrice).toBe(200);
      expect(result.fields.items[0].quantity).toBe(3);
    });

    it("detects tax-inclusive flag", async () => {
      const text = "10 hours labor at $50 (tax inclusive)";
      const result = await aiService.parseDocument(text, { businessId: BUSINESS_ID });

      expect(result.fields.items[0].isTaxInclusive).toBe(true);
    });

    it("infers hour unit from description", async () => {
      const text = "3 hours design at $75";
      const result = await aiService.parseDocument(text, { businessId: BUSINESS_ID });

      expect(result.fields.items[0].unit).toBe("hour");
    });

    it("infers day unit from description", async () => {
      const text = "2 days training at $500";
      const result = await aiService.parseDocument(text, { businessId: BUSINESS_ID });

      expect(result.fields.items[0].unit).toBe("day");
    });

    it("includes suggestions in result", async () => {
      const text = "Some random text without clear items";
      const result = await aiService.parseDocument(text, { businessId: BUSINESS_ID });

      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("does not throw on malformed input", async () => {
      const text = "$$$, ###, ???";
      const result = await aiService.parseDocument(text, { businessId: BUSINESS_ID });

      expect(result.fields.items).toHaveLength(0);
    });
  });

  describe("applyTemplate", () => {
    it("returns default fields when template has no config", async () => {
      const template: any = {
        id: "tmpl-1",
        businessId: BUSINESS_ID,
        name: "Test",
        config: {},
      };
      const result = await aiService.applyTemplate(template);

      expect(result.items).toHaveLength(0);
      expect(result.fees).toHaveLength(0);
      expect(result.currency).toBe("USD");
      expect(result.taxRate).toBe(0);
    });

    it("applies template config to fields", async () => {
      const template: any = {
        id: "tmpl-2",
        businessId: BUSINESS_ID,
        name: "Standard Service",
        config: {
          currency: "USD",
          defaultTaxRate: 8.5,
          items: [
            {
              description: "Consulting",
              quantity: 5,
              unitPrice: 100,
              taxRate: 8.5,
            },
          ],
          fees: [
            {
              description: "Processing fee",
              amount: 25,
              taxRate: 0,
            },
          ],
        },
      };
      const result = await aiService.applyTemplate(template);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].description).toBe("Consulting");
      expect(result.items[0].quantity).toBe(5);
      expect(result.fees).toHaveLength(1);
      expect(result.fees[0].amount).toBe(25);
      expect(result.taxRate).toBe(8.5);
    });

    it("allows overrides to take precedence over template config", async () => {
      const template: any = {
        id: "tmpl-3",
        businessId: BUSINESS_ID,
        name: "Standard",
        config: { currency: "USD", defaultTaxRate: 8.5 },
      };
      const result = await aiService.applyTemplate(template, {
        currency: "EUR",
        taxRate: 20,
      });

      expect(result.currency).toBe("EUR");
      expect(result.taxRate).toBe(20);
    });
  });
});
