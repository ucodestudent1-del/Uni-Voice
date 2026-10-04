import { describe, it, expect } from "vitest";
import { Decimal } from "decimal.js";
import { formatCurrency, formatDate, formatDateLong, parseDecimal, decimalToString } from "../utils/format";

describe("formatCurrency", () => {
  it("formats USD with default 2 decimal places", () => {
    expect(formatCurrency(100, "USD")).toBe("$100.00");
  });

  it("formats amounts with rounding", () => {
    expect(formatCurrency(99.999, "USD")).toBe("$100.00");
  });

  it("formats negative amounts", () => {
    expect(formatCurrency(-50.5, "USD")).toBe("-$50.50");
  });

  it("formats with custom decimal places", () => {
    expect(formatCurrency(1234.5678, "USD", 0)).toBe("$1,235");
  });

  it("handles string input", () => {
    expect(formatCurrency("250.75", "EUR")).toBe("€250.75");
  });

  it("falls back to USD for unsupported currency", () => {
    expect(formatCurrency(100, "XYZ")).toBe("$100.00");
  });

  it("handles empty string currency", () => {
    expect(formatCurrency(100, "")).toBe("$100.00");
  });

  it("formats JPY with 0 decimal places", () => {
    expect(formatCurrency(1500, "JPY", 0)).toBe("¥1,500");
  });

  it("handles null and undefined amount", () => {
    expect(formatCurrency(null as unknown as Decimal.Value, "USD")).toBe("$0.00");
    expect(formatCurrency(undefined as unknown as Decimal.Value, "USD")).toBe("$0.00");
  });

  it("handles Decimal input", () => {
    expect(formatCurrency(new Decimal("123.45"), "USD")).toBe("$123.45");
  });
});

describe("formatDate", () => {
  it("formats a date string in en-US locale (UTC)", () => {
    expect(formatDate("2024-01-15")).toBe("Jan 15, 2024");
  });

  it("returns empty string for undefined", () => {
    expect(formatDate(undefined)).toBe("");
  });

  it("returns empty string for null", () => {
    expect(formatDate(null as unknown as string)).toBe("");
  });

  it("returns empty string for invalid date", () => {
    expect(formatDate("not-a-date")).toBe("");
  });

  it("accepts Date object", () => {
    const d = new Date("2024-06-20T00:00:00Z");
    expect(formatDate(d)).toBe("Jun 20, 2024");
  });
});

describe("formatDateLong", () => {
  it("formats a date string with long month name in UTC", () => {
    expect(formatDateLong("2024-01-15")).toBe("January 15, 2024");
  });

  it("returns empty string for undefined", () => {
    expect(formatDateLong(undefined)).toBe("");
  });

  it("returns empty string for null", () => {
    expect(formatDateLong(null as unknown as string)).toBe("");
  });

  it("returns empty string for invalid date", () => {
    expect(formatDateLong("invalid")).toBe("");
  });

  it("accepts Date object", () => {
    const d = new Date("2024-03-10T00:00:00Z");
    expect(formatDateLong(d)).toBe("March 10, 2024");
  });
});

describe("parseDecimal", () => {
  it("parses a numeric string", () => {
    expect(parseDecimal("123.45").toString()).toBe("123.45");
  });

  it("parses a number", () => {
    expect(parseDecimal(99.99).toString()).toBe("99.99");
  });

  it("returns Decimal(0) for undefined", () => {
    expect(parseDecimal(undefined).toString()).toBe("0");
  });

  it("returns Decimal(0) for null", () => {
    expect(parseDecimal(null).toString()).toBe("0");
  });

  it("parses zero string", () => {
    expect(parseDecimal("0").toString()).toBe("0");
  });

  it("parses negative numbers", () => {
    expect(parseDecimal("-42.5").toString()).toBe("-42.5");
  });
});

describe("decimalToString", () => {
  it("formats a positive Decimal to 2 decimal places", () => {
    expect(decimalToString(new Decimal("123.456"))).toBe("123.46");
  });

  it("formats a negative Decimal", () => {
    expect(decimalToString(new Decimal("-99.9"))).toBe("-99.90");
  });

  it("pads zero to two decimals", () => {
    expect(decimalToString(new Decimal("5"))).toBe("5.00");
  });

  it("handles zero", () => {
    expect(decimalToString(new Decimal("0"))).toBe("0.00");
  });
});
