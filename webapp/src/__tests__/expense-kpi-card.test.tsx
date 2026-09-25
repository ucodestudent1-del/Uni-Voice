import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ExpenseKPICard from "@/components/expenses/ExpenseKPICard";
import { DollarSign } from "lucide-react";

describe("ExpenseKPICard", () => {
  it("renders title and formatted value", () => {
    render(
      <ExpenseKPICard
        title="Total Expenses"
        value="1234.56"
        currency="USD"
        icon={<DollarSign className="w-5 h-5" />}
        iconBackground="status-info-bg status-info-text"
      />
    );
    expect(screen.getByText("Total Expenses")).toBeInTheDocument();
    expect(screen.getByText("$1,234.56")).toBeInTheDocument();
  });

  it("renders loading placeholder when isLoading is true", () => {
    const { container } = render(
      <ExpenseKPICard
        title="Total"
        value="0"
        currency="USD"
        icon={<DollarSign className="w-5 h-5" />}
        iconBackground="bg-surface-alt"
        isLoading
      />
    );
    const pulse = container.querySelector(".animate-pulse");
    expect(pulse).toBeInTheDocument();
  });

  it("shows — for zero values without trend", () => {
    render(
      <ExpenseKPICard
        title="Zero"
        value="0"
        currency="USD"
        icon={<DollarSign className="w-5 h-5" />}
        iconBackground="bg-surface-alt"
      />
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(
      <ExpenseKPICard
        title="Billed"
        value="500.00"
        subtitle="12 items"
        currency="USD"
        icon={<DollarSign className="w-5 h-5" />}
        iconBackground="bg-surface-alt"
      />
    );
    expect(screen.getByText("12 items")).toBeInTheDocument();
  });
});
