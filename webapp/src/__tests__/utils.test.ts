import { describe, it, expect } from "vitest";
import { cn, clsx, formatCurrencyValue } from "../lib/utils";
import { Decimal } from "decimal.js";

describe("cn (className utility)", () => {
  it("joins multiple string classes", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters out null values", () => {
    expect(cn("a", null, "b")).toBe("a b");
  });

  it("filters out undefined values", () => {
    expect(cn("a", undefined, "b")).toBe("a b");
  });

  it("filters out false values", () => {
    expect(cn("a", false, "b")).toBe("a b");
  });

  it("converts numbers to strings", () => {
    expect(cn("a", 42, "b")).toBe("a 42 b");
  });

  it("filters out empty strings", () => {
    expect(cn("a", "", "b")).toBe("a b");
  });

  it("handles object values (truthy filters included)", () => {
    expect(cn("a", { b: true, c: false, d: true }, "e")).toBe("a b d e");
  });

  it("handles mixed input types", () => {
    expect(cn("px-2", null, undefined, false, "", "py-1", { "font-bold": true, "text-red": false })).toBe(
      "px-2 py-1 font-bold"
    );
  });

  it("returns empty string for falsy-only inputs", () => {
    expect(cn(null, undefined, false, "")).toBe("");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});

describe("clsx alias", () => {
  it("is the same function as cn", () => {
    expect(clsx("a", "b")).toBe(cn("a", "b"));
  });

  it("joins classes correctly", () => {
    expect(clsx("btn", "active", { disabled: true })).toBe("btn active disabled");
  });
});

describe("formatCurrencyValue", () => {
  it("formats USD with default 2 decimal places", () => {
    expect(formatCurrencyValue(1234.56, "USD")).toBe("$1,234.56");
  });

  it("defaults to USD when no currency provided", () => {
    expect(formatCurrencyValue(100)).toBe("$100.00");
  });

  it("handles string input", () => {
    expect(formatCurrencyValue("99.99", "USD")).toBe("$99.99");
  });

  it("handles Decimal input", () => {
    expect(formatCurrencyValue(new Decimal("42.5"), "USD")).toBe("$42.50");
  });

  it("handles null input as 0", () => {
    expect(formatCurrencyValue(null, "USD")).toBe("$0.00");
  });

  it("handles undefined input as 0", () => {
    expect(formatCurrencyValue(undefined, "USD")).toBe("$0.00");
  });

  it("handles zero input", () => {
    expect(formatCurrencyValue(0, "USD")).toBe("$0.00");
  });

  it("handles negative amounts", () => {
    expect(formatCurrencyValue(-100, "USD")).toBe("-$100.00");
  });

  it("rounds to specified decimal places", () => {
    expect(formatCurrencyValue(99.999, "USD", 2)).toBe("$100.00");
  });

  it("handles JPY with 0 decimal places", () => {
    expect(formatCurrencyValue(1500, "JPY", 0)).toBe("¥1,500");
  });

  it("falls back to $ when currency formatting fails", () => {
    // Use a currency that Intl might not recognize
    const result = formatCurrencyValue(50, "XX", 2);
    expect(result).toBe("$50.00");
  });

  it("handles 0 decimal places for USD", () => {
    expect(formatCurrencyValue(1234.56, "USD", 0)).toBe("$1,235");
  });
});
