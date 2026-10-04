import { describe, it, expect } from "vitest";
import { Decimal } from "decimal.js";
import { getCurrencyMetadata, getDefaultCurrency, formatMoney, SUPPORTED_CURRENCIES } from "../types/currency";

describe("currency utilities", () => {
  describe("SUPPORTED_CURRENCIES", () => {
    it("includes the major currencies", () => {
      expect(SUPPORTED_CURRENCIES).toContain("USD");
      expect(SUPPORTED_CURRENCIES).toContain("EUR");
      expect(SUPPORTED_CURRENCIES).toContain("GBP");
      expect(SUPPORTED_CURRENCIES).toContain("JPY");
    });

    it("includes 29 currencies total", () => {
      expect(SUPPORTED_CURRENCIES).toHaveLength(29);
    });

    it("includes currencies for Japan, South Korea, and Vietnam", () => {
      expect(SUPPORTED_CURRENCIES).toContain("JPY");
      expect(SUPPORTED_CURRENCIES).toContain("KRW");
      expect(SUPPORTED_CURRENCIES).toContain("VND");
    });
  });

  describe("getCurrencyMetadata", () => {
    it("returns metadata for USD", () => {
      const meta = getCurrencyMetadata("USD");
      expect(meta.code).toBe("USD");
      expect(meta.name).toBe("US Dollar");
      expect(meta.symbol).toBe("$");
      expect(meta.decimalPlaces).toBe(2);
    });

    it("returns metadata for JPY (0 decimal places)", () => {
      const meta = getCurrencyMetadata("JPY");
      expect(meta.decimalPlaces).toBe(0);
    });

    it("is case-insensitive for supported currency", () => {
      expect(getCurrencyMetadata("usd")).toEqual(getCurrencyMetadata("USD"));
      expect(getCurrencyMetadata("EUR".toLowerCase())).toEqual(getCurrencyMetadata("EUR"));
    });

    it("throws for unsupported currency", () => {
      expect(() => getCurrencyMetadata("XYZ")).toThrow("Unsupported currency: XYZ");
    });

    it("throws for lowercase unsupported currency with uppercase message", () => {
      expect(() => getCurrencyMetadata("abc")).toThrow("Unsupported currency: ABC");
    });
  });

  describe("getDefaultCurrency", () => {
    it("returns USD", () => {
      expect(getDefaultCurrency()).toBe("USD");
    });
  });

  describe("formatMoney", () => {
    it("formats USD correctly", () => {
      expect(formatMoney(1234.56, "USD")).toBe("$1,234.56");
    });

    it("formats JPY without decimals (jsdom uses full-width yen symbol)", () => {
      expect(formatMoney(1500, "JPY")).toBe("\uFFE51,500");
    });

    it("formats negative amounts", () => {
      expect(formatMoney(-100, "USD")).toBe("-$100.00");
    });

    it("uses custom locale when provided (non-breaking space separator)", () => {
      const result = formatMoney(100, "USD", "de-DE");
      expect(result).toContain("100,00");
      expect(result).toContain("$");
    });

    it("handles Decimal input", () => {
      expect(formatMoney(new Decimal("99.99"), "USD")).toBe("$99.99");
    });

    it("handles string input", () => {
      expect(formatMoney("50.50", "USD")).toBe("$50.50");
    });
  });
});
