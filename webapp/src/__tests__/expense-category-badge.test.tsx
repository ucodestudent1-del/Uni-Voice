import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ExpenseCategoryBadge, {
  EXPENSE_CATEGORY_CONFIG,
  EXPENSE_CATEGORY_OPTIONS,
} from "@/components/expenses/ExpenseCategoryBadge";

describe("ExpenseCategoryBadge", () => {
  it("renders the label for a known category", () => {
    render(<ExpenseCategoryBadge category="supplies" />);
    expect(screen.getByText("Supplies")).toBeInTheDocument();
  });

  it("renders the label for professional_fees", () => {
    render(<ExpenseCategoryBadge category="professional_fees" />);
    expect(screen.getByText("Professional Fees")).toBeInTheDocument();
  });

  it("falls back to 'other' for an unknown category", () => {
    render(<ExpenseCategoryBadge category={"unknown" as any} />);
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("includes the icon emoji", () => {
    render(<ExpenseCategoryBadge category="meals" />);
    const badge = screen.getByText("Meals").parentElement;
    expect(badge?.innerHTML).toContain("🍽");
  });

  it("EXPENSE_CATEGORY_OPTIONS matches the config keys", () => {
    expect(EXPENSE_CATEGORY_OPTIONS.length).toBe(
      Object.keys(EXPENSE_CATEGORY_CONFIG).length
    );
    const configKeys = Object.keys(EXPENSE_CATEGORY_CONFIG).sort();
    const optionValues = EXPENSE_CATEGORY_OPTIONS.map((o) => o.value).sort();
    expect(optionValues).toEqual(configKeys);
  });
});
