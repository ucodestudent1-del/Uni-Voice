import { useEffect, useState, useCallback, useMemo } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import {
  getDashboardSummary,
  getEnhancedDashboard,
  getVolumeTrendReport,
  getRevenueReport,
  getPaymentsReport,
  getClientsReport,
  getTaxSummaryReport,
   getProfitLossReport,
   exportReportCsv,
  type ReportFiltersParams,
} from "@/api/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ReportKPICards,
  ReportFilters,
  RevenueReport,
  PaymentsReport,
  ClientsReport,
  TaxSummaryReport,
  ProfitLossReport,
} from "@/components/reports";
import MonthlyTrendChart from "@/components/dashboard/MonthlyTrendChart";
import EmptyState from "@/components/ui/EmptyState";
import { Download } from "lucide-react";

type ReportTab = "dashboard" | "revenue" | "payments" | "clients" | "tax" | "profit-loss";

const REPORT_TABS: Array<{ id: ReportTab; label: string; icon?: React.ReactNode }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "revenue", label: "Revenue" },
  { id: "payments", label: "Payments" },
  { id: "clients", label: "Clients" },
  { id: "tax", label: "Tax Summary" },
  { id: "profit-loss", label: "Profit & Loss" },
];

const TAB_FILTERS: Record<ReportTab, { showDateRange: boolean; showCustomer: boolean; showProject: boolean; showStatus: boolean; showCategory: boolean; showProvider: boolean; showSearch: boolean; presets: boolean }> = {
  dashboard: { showDateRange: false, showCustomer: false, showProject: false, showStatus: false, showCategory: false, showProvider: false, showSearch: false, presets: false },
  revenue: { showDateRange: true, showCustomer: false, showProject: false, showStatus: false, showCategory: false, showProvider: false, showSearch: false, presets: true },
  payments: { showDateRange: true, showCustomer: false, showProject: false, showStatus: false, showCategory: false, showProvider: true, showSearch: true, presets: true },
  clients: { showDateRange: true, showCustomer: false, showProject: false, showStatus: false, showCategory: false, showProvider: false, showSearch: true, presets: true },
  tax: { showDateRange: true, showCustomer: false, showProject: false, showStatus: false, showCategory: false, showProvider: false, showSearch: false, presets: true },
  "profit-loss": { showDateRange: true, showCustomer: false, showProject: false, showStatus: false, showCategory: false, showProvider: false, showSearch: false, presets: true },
};

export default function Reports() {
  const { plan } = useSubscription();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<ReportTab>("dashboard");
  const [filters, setFilters] = useState<ReportFiltersParams>({});
  const [retryKey, setRetryKey] = useState(0);

  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [paymentMetrics, setPaymentMetrics] = useState<any>(null);
  const [volumeTrend, setVolumeTrend] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [paymentsData, setPaymentsData] = useState<any>(null);
  const [clientsData, setClientsData] = useState<any>(null);
  const [taxData, setTaxData] = useState<any>(null);
  const [profitLossData, setProfitLossData] = useState<any>(null);

  const [loadingFlags, setLoadingFlags] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const isLoading = (key: string) => loadingFlags[key] ?? false;
  const setLoading = (key: string, val: boolean) => {
    setLoadingFlags((prev) => ({ ...prev, [key]: val }));
  };
  const setError = (key: string, val: string | null) => {
    setErrors((prev) => ({ ...prev, [key]: val }));
  };
  const clearError = (key: string) => setError(key, null);
  const getError = (key: string) => errors[key] ?? null;

  const currency = dashboardSummary?.currency ?? "USD";

  const handleExport = useCallback(async (reportType: string) => {
    try {
      const blob = await exportReportCsv(reportType, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}-report-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Report exported successfully", { type: "success" });
    } catch (err: any) {
      toast(err.response?.data?.error || "Could not export report", { type: "error" });
    }
  }, [filters, toast]);

   const loadDashboard = useCallback(async () => {
    setLoading("dashboard", true);
    try {
      const [summaryRes, dashRes, trendRes] = await Promise.all([
        getDashboardSummary().catch(() => null),
        getEnhancedDashboard(),
        getVolumeTrendReport({ period: "month", months: 3 }).catch(() => []),
      ]);

      const dash = dashRes as any;
      setDashboardSummary(summaryRes ?? dash?.summary ?? null);
      setPaymentMetrics(dash?.paymentMetrics ?? null);
      setVolumeTrend(dash?.volumeTrend ?? (Array.isArray(trendRes) ? trendRes : []));
      clearError("dashboard");
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("dashboard", err.response?.data?.error || "This report requires a Business plan. Please upgrade to continue.");
      } else {
        setError("dashboard", err.message || "Failed to load dashboard data");
      }
    } finally {
      setLoading("dashboard", false);
    }
  }, []);

  const loadRevenue = useCallback(async () => {
    setLoading("revenue", true);
    try {
      const data = await getRevenueReport(filters);
      setRevenueData(data);
      clearError("revenue");
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("revenue", err.response?.data?.error || "This report requires a Business plan. Please upgrade to continue.");
      } else {
        setError("revenue", err.message || "Failed to load revenue report");
      }
    } finally {
      setLoading("revenue", false);
    }
  }, [filters]);

  const loadPayments = useCallback(async () => {
    setLoading("payments", true);
    try {
      const data = await getPaymentsReport(filters);
      setPaymentsData(data);
      clearError("payments");
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("payments", err.response?.data?.error || "This report requires a Business plan. Please upgrade to continue.");
      } else {
        setError("payments", err.message || "Failed to load payments report");
      }
    } finally {
      setLoading("payments", false);
    }
  }, [filters]);

  const loadClients = useCallback(async () => {
    setLoading("clients", true);
    try {
      const data = await getClientsReport(filters);
      setClientsData(data);
      clearError("clients");
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("clients", err.response?.data?.error || "This report requires a Business plan. Please upgrade to continue.");
      } else {
        setError("clients", err.message || "Failed to load clients report");
      }
    } finally {
      setLoading("clients", false);
    }
  }, [filters]);

  const loadTax = useCallback(async () => {
    setLoading("tax", true);
    try {
      const data = await getTaxSummaryReport(filters);
      setTaxData(data);
      clearError("tax");
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("tax", err.response?.data?.error || "This report requires a Business plan. Please upgrade to continue.");
      } else {
        setError("tax", err.message || "Failed to load tax summary");
      }
    } finally {
      setLoading("tax", false);
    }
  }, [filters]);

  const loadProfitLoss = useCallback(async () => {
    setLoading("profit-loss", true);
    try {
      const data = await getProfitLossReport(filters);
      setProfitLossData(data);
      clearError("profit-loss");
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("profit-loss", err.response?.data?.error || "This report requires a Business plan. Please upgrade to continue.");
      } else {
        setError("profit-loss", err.message || "Failed to load profit & loss report");
      }
    } finally {
      setLoading("profit-loss", false);
    }
  }, [filters]);

  useEffect(() => {
    loadDashboard();
  }, [retryKey, loadDashboard]);

  useEffect(() => {
    if (activeTab === "dashboard") {
      return;
    }

    switch (activeTab) {
      case "revenue":
        loadRevenue();
        break;
      case "payments":
        loadPayments();
        break;
      case "clients":
        loadClients();
        break;
      case "tax":
        loadTax();
        break;
      case "profit-loss":
        loadProfitLoss();
        break;
    }
  }, [activeTab, filters, loadRevenue, loadPayments, loadClients, loadTax, loadProfitLoss]);

  const handleTabChange = (tab: ReportTab) => {
    setActiveTab(tab);
  };

  const handleFiltersChange = (newFilters: ReportFiltersParams) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({});
    setRevenueData(null);
    setPaymentsData(null);
    setClientsData(null);
    setTaxData(null);
    setProfitLossData(null);
    setErrors({});
  };

  const tabFilters = TAB_FILTERS[activeTab];

  useEffect(() => {
    if (activeTab === "dashboard") {
      return;
    }

    if (activeTab === "revenue") {
      setRevenueData(null);
    }
    if (activeTab === "tax") {
      setTaxData(null);
    }
    if (activeTab === "profit-loss") {
      setProfitLossData(null);
    }

    switch (activeTab) {
      case "revenue":
        loadRevenue();
        break;
      case "payments":
        loadPayments();
        break;
      case "clients":
        loadClients();
        break;
      case "tax":
        loadTax();
        break;
      case "profit-loss":
        loadProfitLoss();
        break;
    }
  }, [activeTab, filters, loadRevenue, loadPayments, loadClients, loadTax, loadProfitLoss]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardContent
            dashboardSummary={dashboardSummary}
            paymentMetrics={paymentMetrics}
            volumeTrend={volumeTrend}
            currency={currency}
            loading={isLoading("dashboard")}
            onRetry={() => setRetryKey((k) => k + 1)}
            error={getError("dashboard")}
          />
        );
      case "revenue":
        return (
          <RevenueReport
            data={revenueData}
            loading={isLoading("revenue")}
            currency={currency}
            onExport={() => handleExport("revenue")}
          />
        );
      case "payments":
        return (
          <PaymentsReport
            data={paymentsData}
            loading={isLoading("payments")}
            currency={currency}
            onExport={() => handleExport("payments")}
          />
        );
      case "clients":
        return (
          <ClientsReport
            data={clientsData}
            loading={isLoading("clients")}
            currency={currency}
            onExport={() => handleExport("clients")}
          />
        );
      case "tax":
        return (
          <TaxSummaryReport
            data={taxData}
            loading={isLoading("tax")}
            currency={currency}
            onExport={() => handleExport("tax-summary")}
          />
        );
      case "profit-loss":
        return (
          <ProfitLossReport
            data={profitLossData}
            loading={isLoading("profit-loss")}
            currency={currency}
            onExport={() => handleExport("profit-loss")}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Reports</h1>
          {plan && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1 ml-3 bg-primary-bg text-on-primary">
              {plan.name} Plan
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-color">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-secondary hover:text-primary hover:bg-surface-alt"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {getError(activeTab) && (
        <div className="rounded-xl border border-error-border bg-error-bg p-4 text-sm text-error-text">
          {getError(activeTab)}
        </div>
      )}

      {activeTab !== "dashboard" && tabFilters.showDateRange && (
        <ReportFilters
          filters={filters}
          onChange={handleFiltersChange}
          onReset={handleResetFilters}
          availableFilters={tabFilters}
        />
      )}

      {renderTabContent()}
    </div>
  );
}

function DashboardContent({
  dashboardSummary,
  paymentMetrics,
  volumeTrend,
  currency,
  loading,
  onRetry,
  error,
}: {
  dashboardSummary: any;
  paymentMetrics: any;
  volumeTrend: any[];
  currency: string;
  loading: boolean;
  onRetry: () => void;
  error: string | null;
}) {
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (dashboardSummary || paymentMetrics) {
      setDataLoaded(true);
    }
  }, [dashboardSummary, paymentMetrics]);

  if (loading && !dataLoaded) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-color p-5 h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-surface rounded-xl border border-color" />
          <div className="h-80 bg-surface rounded-xl border border-color" />
        </div>
        <div className="h-64 bg-surface rounded-xl border border-color" />
      </div>
    );
  }

  if (error && !dashboardSummary) {
    return (
      <div className="rounded-xl border border-error-border bg-error-bg p-6 text-center">
        <AlertCircle className="w-10 h-10 text-error-text mx-auto mb-3" />
        <p className="text-sm font-medium text-error-text mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!dashboardSummary && !paymentMetrics && !loading) {
    return (
      <EmptyState
        title="No report data available"
        description="Generate payments and revenue to see financial reports"
        className="p-6"
      />
    );
  }

  return (
    <div className="space-y-6">
      <ReportKPICards
        summary={dashboardSummary}
        paymentMetrics={paymentMetrics}
        volumeTrend={volumeTrend}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MonthlyTrendChart currency={currency} volumeTrend={volumeTrend.length > 0 ? volumeTrend : undefined} />
        </div>
        {dashboardSummary && (
          <div>
            <QuickStats summary={dashboardSummary} currency={currency} />
          </div>
        )}
      </div>
    </div>
  );
}

function QuickStats({ summary, currency }: { summary: any; currency: string }) {
  if (!summary) return null;
  return (
    <div className="bg-surface rounded-xl border border-color p-5">
      <h3 className="text-sm font-semibold text-primary mb-4">Financial Summary</h3>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-tertiary">Draft Documents</span>
          <span className="font-medium text-primary">{summary.draftCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-tertiary">Sent Documents</span>
          <span className="font-medium text-primary">{summary.sentCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-tertiary">Paid Invoices</span>
          <span className="font-medium text-success-text">{summary.paidCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-tertiary">Overdue Invoices</span>
          <span className="font-medium text-error-text">{summary.overdueCount}</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-color-subtle">
          <span className="font-medium text-secondary">Total Invoices</span>
          <span className="font-bold text-primary">{summary.totalInvoices}</span>
        </div>
      </div>
    </div>
  );
}
