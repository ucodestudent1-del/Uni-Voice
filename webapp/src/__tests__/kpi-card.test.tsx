import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KPICard } from "@/components/ui";
import { DollarSign } from "lucide-react";

describe("KPICard", () => {
  it("renders title and formatted value", () => {
    render(
      <KPICard
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
      <KPICard
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
      <KPICard
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
      <KPICard
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

  it("renders stat variant with icon next to title", () => {
    render(
      <KPICard
        title="Revenue"
        value="1234.56"
        currency="USD"
        icon={<DollarSign className="w-5 h-5" />}
        iconBackground="bg-success-bg text-success-text"
        variant="stat"
      />
    );
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("$1,234.56")).toBeInTheDocument();
  });

  it("renders tinted variant with success state", () => {
    render(
      <KPICard
        title="Paid"
        value="1000"
        currency="USD"
        icon={<DollarSign className="w-5 h-5" />}
        iconBackground="bg-success-bg text-success-text"
        variant="tinted"
        state="success"
      />
    );
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("renders inline variant with sparkline", () => {
    render(
      <KPICard
        title="Pending"
        value="500"
        currency="USD"
        icon={<DollarSign className="w-5 h-5" />}
        iconBackground="bg-warning-bg text-warning-text"
        variant="inline"
        sparkline={[{ value: 10 }, { value: 30 }, { value: 20 }, { value: 50 }]}
        sparklineColor="rgb(245, 158, 11)"
      />
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("renders trend variant with trend indicator", () => {
    render(
      <KPICard
        title="Revenue"
        value="1234.56"
        currency="USD"
        icon={<DollarSign className="w-5 h-5" />}
        variant="trend"
        trend={{ value: "12.5%", direction: "up" }}
      />
    );
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("↑ 12.5%")).toBeInTheDocument();
  });

  it("renders progress bar when progressPct is provided (stat variant)", () => {
    const { container } = render(
      <KPICard
        title="Collection"
        value="85"
        icon={<DollarSign className="w-5 h-5" />}
        iconBackground="bg-info-bg text-info-text"
        variant="stat"
        progressPct={85}
      />
    );
    const bar = container.querySelector('div[aria-label="85% progress"]');
    expect(bar).toBeInTheDocument();
  });
});
