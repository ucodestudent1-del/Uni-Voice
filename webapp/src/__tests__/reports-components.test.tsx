import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExpensesReport from "../components/reports/ExpensesReport";
import InvoicesReport from "../components/reports/InvoicesReport";
import PaymentsReport from "../components/reports/PaymentsReport";
import type { ApiExpensesReport, ApiInvoicesReport, ApiPaymentsReport } from "@/types/api";

const mockExpensesReport: ApiExpensesReport = {
  expenses: [],
  summary: {
    total_amount: "1500.00",
    total_expenses: 12,
    billable_amount: "500.00",
    reimbursable_amount: "420.00",
    reimbursed_amount: "300.00",
    non_reimbursed_billable: "200.00",
    currency: "USD",
    category_breakdown: [
      { category: "supplies", total: "800.00", count: 5, percentage: 53.3 },
      { category: "software", total: "700.00", count: 7, percentage: 46.7 },
    ],
    monthly_trend: [
      { period: "2026-09", amount: "1500.00", count: 12 },
    ],
  },
};

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

describe("ExpensesReport", () => {
  it("renders KPI cards with correct values", () => {
    render(
      <ExpensesReport
        data={mockExpensesReport}
        loading={false}
        currency="USD"
        onExport={vi.fn()}
      />
    );

    expect(screen.getByText("Total Expenses")).toBeInTheDocument();
    expect(screen.getAllByText("$1,500.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Billable").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$500.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reimbursable").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$420.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Non-Reimbursed Billable").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$200.00").length).toBeGreaterThan(0);
  });

  it("renders empty state when data is null", () => {
    render(
      <ExpensesReport
        data={null}
        loading={false}
        currency="USD"
        onExport={vi.fn()}
      />
    );

    expect(screen.getByText("No expense data available")).toBeInTheDocument();
  });

  it("shows loading placeholders when loading", () => {
    const { container } = render(
      <ExpensesReport
        data={null}
        loading={true}
        currency="USD"
        onExport={vi.fn()}
      />
    );

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("calls onExport when export button is clicked", async () => {
    const onExport = vi.fn();
    render(
      <ExpensesReport
        data={mockExpensesReport}
        loading={false}
        currency="USD"
        onExport={onExport}
      />
    );

    await fireEvent.click(screen.getByText("Export CSV"));
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});

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
