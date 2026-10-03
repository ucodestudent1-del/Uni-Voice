import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import InvoicesReport from "../components/reports/InvoicesReport";
import PaymentsReport from "../components/reports/PaymentsReport";
import type { ApiInvoicesReport, ApiPaymentsReport } from "@/types/api";

const mockInvoicesReport: ApiInvoicesReport = {
  invoices: [],
  summary: {
    totalInvoices: 10,
    totalInvoiced: "5000.00",
    totalPaid: "3000.00",
    totalOutstanding: "2000.00",
    totalOverdue: "500.00",
    currency: "USD",
    statusBreakdown: [
      { status: "sent", count: 8, amount: "4000.00" },
      { status: "paid", count: 2, amount: "1000.00" },
    ],
    byPeriod: [
      { period: "2026-09", invoiced: "5000.00", paid: "3000.00", count: 10, currency: "USD" },
    ],
  },
};

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

describe("InvoicesReport", () => {
  it("renders KPI cards with summary values", () => {
    render(
      <InvoicesReport
        data={mockInvoicesReport}
        loading={false}
        currency="USD"
        onExport={vi.fn()}
      />
    );

    expect(screen.getByText("Total Invoices")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Total Invoiced")).toBeInTheDocument();
    expect(screen.getByText("$5,000.00")).toBeInTheDocument();
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
    expect(screen.getByText("$2,000.00")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
  });

  it("renders without crashing when data is null", () => {
    render(
      <InvoicesReport
        data={null}
        loading={false}
        currency="USD"
        onExport={vi.fn()}
      />
    );

    expect(screen.getByText("Invoices Report")).toBeInTheDocument();
  });
});

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
