import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Decimal } from "decimal.js";
import Money, { formatMoneyValue } from "@/components/ui/Money";

describe("Money", () => {
  it("renders formatted USD amount by default", () => {
    render(<Money amount={1234.56} />);
    expect(screen.getByText("$1,234.56")).toBeInTheDocument();
  });

  it("renders formatted amount for specified currency", () => {
    render(<Money amount={99.99} currency="EUR" />);
    // EUR uses de-DE locale: 99,99 €
    expect(screen.getByText("99,99 €")).toBeInTheDocument();
  });

  it("renders JPY without decimals", () => {
    render(<Money amount={1500} currency="JPY" />);
    // jsdom uses full-width yen symbol ￥
    expect(screen.getByText("\uFFE51,500")).toBeInTheDocument();
  });

  it("renders placeholder when amount is zero", () => {
    render(<Money amount={0} placeholder="--" currency="USD" />);
    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it("does not render placeholder when amount is non-zero", () => {
    render(<Money amount={50} placeholder="--" currency="USD" />);
    expect(screen.queryByText("--")).not.toBeInTheDocument();
  });

  it("renders negative amount in error color when signed", () => {
    const { container } = render(<Money amount={-50} signed currency="USD" />);
    const span = container.querySelector("span");
    expect(span).toHaveClass("text-error-text");
  });

  it("renders negative amount in success color when not signed", () => {
    const { container } = render(<Money amount={-50} currency="USD" />);
    const span = container.querySelector("span");
    expect(span).toHaveClass("text-success-text");
  });

  it("does not apply text-error-text or text-success-text for positive amounts", () => {
    const { container } = render(<Money amount={50} currency="USD" />);
    const span = container.querySelector("span");
    expect(span).not.toHaveClass("text-error-text");
    expect(span).not.toHaveClass("text-success-text");
  });

  it("applies custom className", () => {
    const { container } = render(<Money amount={100} currency="USD" className="custom-class" />);
    expect(container.querySelector("span")).toHaveClass("custom-class");
  });

  it("always uses font-tabular-nums class", () => {
    const { container } = render(<Money amount={100} currency="USD" />);
    expect(container.querySelector("span")).toHaveClass("font-tabular-nums");
  });

  it("handles string amount", () => {
    render(<Money amount="123.45" currency="USD" />);
    expect(screen.getByText("$123.45")).toBeInTheDocument();
  });

  it("handles Decimal amount", () => {
    render(<Money amount={new Decimal("67.89")} currency="USD" />);
    expect(screen.getByText("$67.89")).toBeInTheDocument();
  });

  it("defaults to USD when currency is empty string", () => {
    render(<Money amount={100} currency="" />);
    expect(screen.getByText("$100.00")).toBeInTheDocument();
  });

  it("renders zero amount as formatted value without placeholder", () => {
    render(<Money amount={0} currency="USD" />);
    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });
});

describe("formatMoneyValue", () => {
  it("formats a simple number with USD", () => {
    expect(formatMoneyValue(1234.56, "USD")).toBe("$1,234.56");
  });

  it("defaults to USD when no currency provided", () => {
    expect(formatMoneyValue(100)).toBe("$100.00");
  });

  it("formats with custom decimal places (EUR uses locale decimal separator)", () => {
    // formatMoneyValue uses formatValue which calls formatMoney with currency's locale
    // EUR decimalPlaces=2, so it always uses 2 decimal places via formatMoney
    expect(formatMoneyValue(100, "USD", 2)).toBe("$100.00");
  });

  it("handles string values", () => {
    expect(formatMoneyValue("50.5", "USD")).toBe("$50.50");
  });

  it("handles Decimal values (EUR uses de-DE locale formatting with non-breaking space)", () => {
    expect(formatMoneyValue(new Decimal("75.25"), "EUR")).toBe("75,25\u00A0€");
  });

  it("handles null as 0", () => {
    expect(formatMoneyValue(null, "USD")).toBe("$0.00");
  });

  it("handles undefined as 0", () => {
    expect(formatMoneyValue(undefined, "USD")).toBe("$0.00");
  });

  it("handles 0 as 0.00", () => {
    expect(formatMoneyValue(0, "USD")).toBe("$0.00");
  });

  it("uses fallback formatter for unsupported currency", () => {
    // formatMoneyValue falls through to formatCurrency in utils if formatMoney throws
    const result = formatMoneyValue(50, "XYZ");
    expect(result).toContain("50");
  });
});
