import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  DollarSign,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Plus,
} from "lucide-react";
import { getDashboardData, getEnhancedDashboard } from "../api/client";
import type { ApiDashboardData, ApiEnhancedDashboard } from "../types/api";
import KPICard from "../components/KPICard";
import RevenueChart from "../components/dashboard/RevenueChart";
import StatusBreakdown from "../components/dashboard/StatusBreakdown";
import InvoiceTable from "../components/dashboard/InvoiceTable";
import UpcomingPayments from "../components/dashboard/UpcomingPayments";
import RecentActivity from "../components/dashboard/RecentActivity";
import { formatCurrency } from "../utils/format";

export default function Dashboard() {
  const { plan } = useSubscription();

  const [dashboard, setDashboard] = useState<ApiDashboardData | null>(null);
  const [enhanced, setEnhanced] = useState<ApiEnhancedDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [dashRes, enhRes] = await Promise.all([
        getDashboardData(),
        getEnhancedDashboard().catch(() => null),
      ]);
      setDashboard(dashRes.data ?? dashRes);
      setEnhanced(enhRes?.data ?? enhRes ?? null);
    } catch {
      setDashboard(null);
      setEnhanced(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-28" />
          ))}
        </div>
      </div>
    );
  }

  const summary = dashboard?.summary ?? {
    totalOutstanding: "0",
    totalOverdue: "0",
    totalPaidThisMonth: "0",
    totalRevenue: "0",
    draftCount: 0,
    overdueCount: 0,
    sentCount: 0,
    paidCount: 0,
    totalInvoices: 0,
  };

  const currency = "USD";
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          {plan && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1 ml-3 bg-primary-100 text-primary-800">
              {plan.name} Plan
            </span>
          )}
        </div>
        <Link
          to="/app/invoices/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          New Invoice
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Outstanding"
          value={formatCurrency(summary.totalOutstanding, currency)}
          subtitle={`${summary.draftCount + summary.sentCount + summary.overdueCount} unpaid invoices`}
          icon={<DollarSign className="w-5 h-5" />}
          iconBackground="bg-blue-50 text-blue-600"
        />
        <KPICard
          title="Overdue"
          value={formatCurrency(summary.totalOverdue, currency)}
          subtitle={`${summary.overdueCount} overdue invoices`}
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBackground="bg-red-50 text-red-600"
        />
        <KPICard
          title="Paid This Month"
          value={formatCurrency(summary.totalPaidThisMonth, currency)}
          subtitle={`${summary.paidCount} paid invoices`}
          icon={<CheckCircle className="w-5 h-5" />}
          iconBackground="bg-green-50 text-green-600"
        />
        <KPICard
          title="Monthly Revenue"
          value={formatCurrency(summary.totalRevenue, currency)}
          subtitle={`${summary.totalInvoices} total invoices`}
          icon={<TrendingUp className="w-5 h-5" />}
          iconBackground="bg-primary-50 text-primary-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div>
          <StatusBreakdown />
        </div>
      </div>

      {/* Data Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <InvoiceTable items={dashboard?.requiringAttention} title="Recent Invoices" />
        </div>
        <div>
          <UpcomingPayments />
        </div>
      </div>

      {/* Activity Feed */}
      <RecentActivity />
    </div>
  );
}
