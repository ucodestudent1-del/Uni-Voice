import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  getPaymentsByBusiness,
  getPaymentSummary,
  type ApiPaymentSummary,
} from "../api/client";
import { formatCurrencyValue } from "../lib/utils";
import { formatDate } from "../utils/format";
import { Button } from "../components/ui/Button";
import {
  Download,
  RefreshCw,
  ExternalLink,
  Search,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { DataTable, type ColumnDef } from "../components/ui/DataTable";
import KPICard from "../components/ui/KPICard";
import PaymentStatus from "../components/ui/PaymentStatus";
import { type ApiPaymentWithInvoice } from "../types/api";

const STATUS_FILTERS = [
  { value: "all", label: "All Statuses" },
  { value: "succeeded", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const PROVIDER_OPTIONS = [
  { value: "all", label: "All Providers" },
  { value: "stripe", label: "Stripe" },
  { value: "stub", label: "Manual/Stub" },
  { value: "manual", label: "Manual" },
];

export default function Payments() {
  const [payments, setPayments] = useState<ApiPaymentWithInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<ApiPaymentSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const currency = summary?.currency || "USD";

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await getPaymentSummary();
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPaymentsByBusiness({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        status: statusFilter === "all" ? undefined : statusFilter,
        provider: providerFilter === "all" ? undefined : providerFilter,
        search: searchTerm || undefined,
      });
      setPayments(data.payments ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load payments");
      setPayments([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, providerFilter, searchTerm]);

  useEffect(() => {
    loadPayments();
    loadSummary();
  }, [loadPayments, loadSummary]);

  const columns = useMemo<ColumnDef<ApiPaymentWithInvoice>[]>(
    () => [
      {
        header: "Payment ID",
        accessor: "id",
        cell: (row) => {
          const p = row as ApiPaymentWithInvoice;
          return (
            <span className="text-xs font-mono text-tertiary">
              {p.id.slice(0, 8)}
            </span>
          );
        },
        sortable: false,
        align: "left",
      },
      {
        header: "Client",
        accessor: "customer_name",
        cell: (row) => {
          const p = row as ApiPaymentWithInvoice;
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-primary">
                {p.customer_name || "—"}
              </span>
              {p.customer_email && (
                <span className="text-xs text-tertiary truncate">{p.customer_email}</span>
              )}
            </div>
          );
        },
        sortable: false,
        align: "left",
      },
      {
        header: "Invoice",
        accessor: "invoice_number",
        cell: (row) => {
          const p = row as ApiPaymentWithInvoice;
          return (
            <Link
              to={`/app/invoices/${p.invoice_id}`}
              className="text-sm font-medium text-primary-brand hover:text-primary-hover"
            >
              {p.invoice_number || `#${p.invoice_id.slice(0, 8)}`}
            </Link>
          );
        },
        sortable: false,
        align: "left",
      },
      {
        header: "Date",
        accessor: "paid_at",
        cell: (row) => {
          const p = row as ApiPaymentWithInvoice;
          return (
            <span className="text-sm text-secondary">
              {p.paid_at ? formatDate(new Date(p.paid_at)) : "—"}
            </span>
          );
        },
        sortable: false,
        align: "left",
      },
      {
        header: "Payment Method",
        accessor: "method",
        cell: (row) => {
          const p = row as ApiPaymentWithInvoice;
          const method = p.method || p.provider || "—";
          const label = method === "manual" || method === "stub"
            ? "Manual"
            : method.charAt(0).toUpperCase() + method.slice(1);
          return <span className="text-sm text-secondary capitalize">{label}</span>;
        },
        sortable: false,
        align: "left",
      },
      {
        header: "Amount",
        accessor: "amount",
        cell: (row) => {
          const p = row as ApiPaymentWithInvoice;
          return (
            <span className="text-sm font-medium text-primary font-tabular-nums">
              {formatCurrencyValue(p.amount, p.currency)}
            </span>
          );
        },
        sortable: false,
        align: "right",
      },
      {
        header: "Status",
        accessor: "status",
        cell: (row) => <PaymentStatus status={(row as ApiPaymentWithInvoice).status} showIcon showLabel size="sm" />,
        sortable: false,
        align: "center",
      },
      {
        header: "",
        accessor: "id",
        cell: (row) => {
          const p = row as ApiPaymentWithInvoice;
          return (
            <Link
              to={`/app/payments/${p.id}`}
              className="text-xs text-secondary hover:text-primary"
              title="View payment"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          );
        },
        sortable: false,
        align: "center",
      },
    ],
    []
  );

  const hasActiveFilters = searchTerm || statusFilter !== "all" || providerFilter !== "all";

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(total / pageSize)) return;
    setPage(newPage);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const handleRefresh = () => {
    loadPayments();
    loadSummary();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description={`${total} payment${total !== 1 ? "s" : ""} recorded`}
        primaryAction={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={<Download className="h-4 w-4" />}
              onClick={() => {}}
            >
              Export
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Total Payments"
          value={summary?.totalPayments ?? "0"}
          currency={currency}
          subtitle={`${summary?.totalPaymentCount ?? 0} payments`}
          icon={<CheckCircle className="w-5 h-5" />}
          iconBackground="status-success-bg status-success-text"
          isLoading={summaryLoading}
        />
        <KPICard
          title="Payments This Month"
          value={summary?.paymentsThisMonth ?? "0"}
          currency={currency}
          subtitle="Last 30 days"
          icon={<Clock className="w-5 h-5" />}
          iconBackground="status-info-bg status-info-text"
          isLoading={summaryLoading}
        />
        <KPICard
          title="Pending Payments"
          value={summary?.pendingPayments ?? "0"}
          currency={currency}
          subtitle={`${summary?.pendingCount ?? 0} payments`}
          icon={<Clock className="w-5 h-5" />}
          iconBackground="status-warning-bg status-warning-text"
          isLoading={summaryLoading}
        />
        <KPICard
          title="Failed Payments"
          value={summary?.failedPayments ?? "0"}
          currency={currency}
          subtitle={`${summary?.failedCount ?? 0} payments`}
          icon={<XCircle className="w-5 h-5" />}
          iconBackground="status-error-bg status-error-text"
          isLoading={summaryLoading}
        />
        <KPICard
          title="Refunds"
          value={summary?.refunds ?? "0"}
          currency={currency}
          subtitle={`${summary?.refundCount ?? 0} refunds`}
          icon={<RefreshCw className="w-5 h-5" />}
          iconBackground="status-tertiary-bg status-tertiary-text"
          isLoading={summaryLoading}
        />
      </div>

      {/* Filters */}
      <div className="bg-surface rounded-xl border border-color-subtle p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary" />
              <input
                type="text"
                placeholder="Search by invoice number, customer name, or provider reference..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-input-border bg-input px-3 py-2 pl-10 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={providerFilter}
              onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 status-error-bg border status-error-border rounded-lg">
            <p className="text-sm status-error-text">{error}</p>
          </div>
        )}

        <div className="mt-4">
          <DataTable
            columns={columns}
            data={payments}
            totalRows={total}
            pageSize={pageSize}
            currentPage={page}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            isLoading={loading}
            emptyMessage={
              hasActiveFilters ? (
                <span>No payments match your filters. Try adjusting your search.</span>
              ) : (
                <span>
                  No payments recorded yet.
                  <br />
                  Payments received for invoices will appear here.
                </span>
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
