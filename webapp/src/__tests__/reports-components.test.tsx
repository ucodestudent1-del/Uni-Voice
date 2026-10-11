import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PaymentsReport from "../components/reports/PaymentsReport";
import type { ApiPaymentsReport } from "@/types/api";

const mockPaymentsReport: ApiPaymentsReport = {
  payments: [],
  summary: {
    totalPayments: 5,
    totalAmount: "2500.00",
    totalPaid: "2500.00",
    totalPending: "0",
    totalFailed: "0",
    totalRefunded: "0",
    paymentsThisMonth: "2500.00",
    currency: "USD",
    providerBreakdown: [
      { provider: "stripe", count: 3, amount: "1500.00" },
      { provider: "manual", count: 2, amount: "1000.00" },
    ],
    methodBreakdown: [
      { method: "card", count: 3, amount: "1500.00" },
      { method: "bank", count: 2, amount: "1000.00" },
    ],
    dailyTrend: [
      { date: "2026-09-01", amount: "1000.00", count: 2 },
      { date: "2026-09-15", amount: "1500.00", count: 3 },
    ],
  },
};

describe("PaymentsReport", () => {
  it("renders KPI cards with summary values", () => {
    render(
      <PaymentsReport
        data={mockPaymentsReport}
        loading={false}
        currency="USD"
        onExport={vi.fn()}
      />
    );

    expect(screen.getByText("Total Payments")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Total Amount")).toBeInTheDocument();
    expect(screen.getAllByText("$2,500.00").length).toBeGreaterThan(0);
  });

  it("renders empty state when data is null", () => {
    render(
      <PaymentsReport
        data={null}
        loading={false}
        currency="USD"
        onExport={vi.fn()}
      />
    );

    expect(screen.getByText("No payment data available")).toBeInTheDocument();
  });
});
