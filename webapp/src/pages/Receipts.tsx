import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  getReceipts,
  getReceiptPdf,
  getReceiptSummary,
  getVolumeTrendReport,
  type ReceiptSearchParams,
  type ApiReceipt,
  type ApiReceiptSummary,
} from "../api/client";
import { type ApiVolumeTrend } from "../types/api";
import { formatCurrencyValue } from "../lib/utils";
import { formatDate } from "../utils/format";
import { Button } from "../components/ui/Button";
import {
  Download,
  Search,
  Eye,
  ExternalLink,
  Mail,
  RefreshCw,
  ChevronDown,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { DataTable, type ColumnDef } from "../components/ui/DataTable";
import KPICard from "../components/ui/KPICard";
import PaymentStatus from "../components/ui/PaymentStatus";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";
import { useToast } from "../components/ui/ToastProvider";
import EmailReceiptModal from "../components/EmailReceiptModal";

const STATUS_FILTERS = [
  { value: "all", label: "All Statuses" },
  { value: "issued", label: "Issued" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];

const PROVIDER_FILTERS = [
  { value: "all", label: "All Providers" },
  { value: "stripe", label: "Stripe" },
  { value: "stub", label: "Stub" },
];

const SORT_OPTIONS = [
  { value: "created_at", label: "Date (newest first)" },
  { value: "created_at:asc", label: "Date (oldest first)" },
  { value: "amount", label: "Amount (highest first)" },
  { value: "amount:asc", label: "Amount (lowest first)" },
  { value: "receipt_number", label: "Receipt # (A-Z)" },
  { value: "receipt_number:desc", label: "Receipt # (Z-A)" },
];

export default function Receipts() {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<ApiReceipt[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<ApiReceiptSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [volumeTrend, setVolumeTrend] = useState<ApiVolumeTrend[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [emailModalReceipt, setEmailModalReceipt] = useState<ApiReceipt | null>(null);

  const debouncedSetSearchTerm = useDebouncedCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSetSearchTerm(e.target.value);
  };

  const [sortColumn, sortOrder] = sortBy.includes(":")
    ? sortBy.split(":") as [string, "asc" | "desc"]
    : ([sortBy, "desc"] as [string, "asc" | "desc"]);

  const currentParams: ReceiptSearchParams = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      status: statusFilter === "all" ? undefined : statusFilter,
      provider: providerFilter === "all" ? undefined : providerFilter,
      search: searchTerm || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortBy: sortColumn,
      sortOrder: sortOrder,
    }),
    [page, pageSize, searchTerm, statusFilter, providerFilter, dateFrom, dateTo, sortColumn, sortOrder]
  );

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReceipts(currentParams);
      setReceipts(data.receipts ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load receipts");
      setReceipts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [currentParams]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await getReceiptSummary();
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadVolumeTrend = useCallback(async () => {
    try {
      const data = await getVolumeTrendReport({ period: "day", months: 1 });
      const trendData = Array.isArray(data) ? data : data?.data ?? [];
      setVolumeTrend(Array.isArray(trendData) ? trendData : []);
    } catch {
      setVolumeTrend([]);
    }
  }, []);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadVolumeTrend();
  }, [loadVolumeTrend]);

  const handleDownloadPdf = useCallback(async (receiptId: string) => {
    try {
      const blob = await getReceiptPdf(receiptId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${receiptId.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to download receipt PDF", { type: "error" });
    }
  }, [toast]);

  const navigate = useNavigate();

  const handleViewReceipt = useCallback((receiptId: string) => {
    navigate(`/app/receipts/${receiptId}`);
  }, [navigate]);

  const handleEmailReceipt = useCallback((receipt: ApiReceipt) => {
    setEmailModalReceipt(receipt);
  }, []);

  const handleEmailSent = () => {
    loadReceipts();
    loadSummary();
    setEmailModalReceipt(null);
  };

  const handleRefresh = () => {
    loadReceipts();
    loadSummary();
    loadVolumeTrend();
  };

  const columns = useMemo<ColumnDef<ApiReceipt>[]>(
    () => [
      {
        header: "Receipt #",
        accessor: "receipt_number",
        cell: (row) => {
          const r = row as ApiReceipt;
          return (
            <div className="flex flex-col">
              <Link
                to={`/app/receipts/${r.id}`}
                className="text-sm font-medium text-primary-brand hover:underline"
                title="View receipt"
              >
                {r.receipt_number || `#${String(r.id).slice(0, 8)}`}
              </Link>
              <span className="text-xs text-tertiary">
                {r.issued_at ? new Date(r.issued_at).toLocaleDateString() : r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
              </span>
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
          const r = row as ApiReceipt;
          return (
            <div className="flex flex-col">
              <Link
                to={r.invoice_id ? `/app/invoices/${r.invoice_id}` : "#"}
                className={`text-sm font-medium ${r.invoice_id ? "text-primary-brand hover:underline" : "text-secondary"}`}
              >
                {r.invoice_number || "—"}
              </Link>
              {r.customer_name && (
                <span className="text-xs text-tertiary">{r.customer_name}</span>
              )}
            </div>
          );
        },
        sortable: false,
        align: "left",
      },
      {
        header: "Date",
        accessor: "issued_at",
        cell: (row) => {
          const r = row as ApiReceipt;
          const date = r.issued_at || r.created_at;
          return (
            <span className="text-sm text-secondary">
              {date ? formatDate(date) : "—"}
            </span>
          );
        },
        sortable: false,
        align: "left",
      },
      {
        header: "Amount",
        accessor: "amount",
        cell: (row) => (
          <span className="text-sm font-medium text-primary font-tabular-nums">
            {formatCurrencyValue(Number((row as ApiReceipt).amount), (row as ApiReceipt).currency)}
          </span>
        ),
        sortable: false,
        align: "right",
      },
      {
        header: "Provider",
        accessor: "provider",
        cell: (row) => (
          <span className="text-sm text-secondary capitalize">
            {(row as ApiReceipt).provider || "—"}
          </span>
        ),
        sortable: false,
        align: "left",
      },
      {
        header: "Sent To",
        accessor: "sent_to",
        cell: (row) => (
          <span className="text-sm text-secondary truncate max-w-[180px] inline-block">
            {(row as ApiReceipt).sent_to || "—"}
          </span>
        ),
        sortable: false,
        align: "left",
      },
      {
        header: "Status",
        accessor: "status",
        cell: (row) => <PaymentStatus status={(row as ApiReceipt).status} showIcon showLabel />,
        sortable: false,
        align: "center",
      },
      {
        header: "",
        accessor: "id",
        cell: (row) => {
          const r = row as ApiReceipt;
          return (
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => handleViewReceipt(r.id)}
                className="text-xs text-secondary hover:text-primary"
                title="View receipt"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleEmailReceipt(r)}
                className="text-xs text-secondary hover:text-primary"
                title="Email receipt"
              >
                <Mail className="h-3.5 w-3.5" />
              </button>
              {r.provider_receipt_url && (
                <a
                  href={r.provider_receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-secondary hover:text-primary"
                  title="Open in provider"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                onClick={() => handleDownloadPdf(r.id)}
                className="text-xs text-secondary hover:text-primary"
                title="Download PDF"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        },
        sortable: false,
        align: "center",
      },
    ],
    [handleViewReceipt, handleDownloadPdf, handleEmailReceipt]
  );

  const hasActiveFilters = searchTerm || statusFilter !== "all" || providerFilter !== "all" || dateFrom || dateTo;

  const sparklinePoints = useMemo(() => {
    return volumeTrend.slice(-7).map((d) => ({ value: Number(d.paid) }));
  }, [volumeTrend]);

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setProviderFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  async function handleExportCsv() {
    try {
      const csvRows = [
        ["Receipt #", "Invoice", "Customer", "Date", "Amount", "Currency", "Provider", "Status", "Created"],
      ];
      for (const r of receipts) {
        csvRows.push([
          r.receipt_number || "",
          r.invoice_number || "",
          r.customer_name || "",
          r.issued_at ? new Date(r.issued_at).toLocaleDateString() : r.created_at ? new Date(r.created_at).toLocaleDateString() : "",
          r.amount || "",
          r.currency,
          r.provider || "",
          r.status || "",
          r.created_at ? new Date(r.created_at).toLocaleDateString() : "",
        ]);
      }
      const csv = csvRows.map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipts-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast(err.message || "Failed to export", { type: "error" });
    }
  }

  async function handleExportJson() {
    try {
      const json = JSON.stringify(receipts, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipts-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast(err.message || "Failed to export", { type: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receipts"
        breadcrumbs={[{ label: "Home", to: "/app" }, { label: "Receipts" }]}
        description={`${total} receipt${total !== 1 ? "s" : ""} total`}
        primaryAction={
          <Button
            variant="primary"
            size="md"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportCsv}
          >
            Export CSV
          </Button>
        }
        secondaryActions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={handleExportJson}
              title="Export JSON"
            >
              JSON
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Refresh
            </Button>
          </>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Total Receipts"
          value={summary?.totalReceipts ?? "0"}
          currency={summary?.currency || "USD"}
          subtitle={`${summary?.totalCount ?? 0} receipts`}
          icon={<CheckCircle className="w-5 h-5" />}
          iconBackground="status-success-bg status-success-text"
          variant="tinted"
          state="success"
          isLoading={summaryLoading}
        />
        <KPICard
          title="Receipts This Month"
          value={summary?.receiptsThisMonth ?? "0"}
          currency={summary?.currency || "USD"}
          subtitle="Last 30 days"
          icon={<Clock className="w-5 h-5" />}
          iconBackground="status-info-bg status-info-text"
          variant="stat"
          state="info"
          sparkline={sparklinePoints}
          sparklineColor="rgb(var(--color-info))"
          isLoading={summaryLoading}
        />
        <KPICard
          title="Issued"
          value={summary?.issuedAmount ?? "0"}
          currency={summary?.currency || "USD"}
          subtitle={`${summary?.issuedCount ?? 0} receipts`}
          icon={<Clock className="w-5 h-5" />}
          iconBackground="status-info-bg status-info-text"
          variant="inline"
          isLoading={summaryLoading}
        />
        <KPICard
          title="Sent"
          value={summary?.sentAmount ?? "0"}
          currency={summary?.currency || "USD"}
          subtitle={`${summary?.sentCount ?? 0} receipts`}
          icon={<CheckCircle className="w-5 h-5" />}
          iconBackground="status-success-bg status-success-text"
          variant="inline"
          isLoading={summaryLoading}
        />
        <KPICard
          title="Failed"
          value={summary?.failedAmount ?? "0"}
          currency={summary?.currency || "USD"}
          subtitle={`${summary?.failedCount ?? 0} receipts`}
          icon={<XCircle className="w-5 h-5" />}
          iconBackground="status-error-bg status-error-text"
          variant="tinted"
          state="error"
          isLoading={summaryLoading}
        />
      </div>

      {/* Filters */}
      <div className="filter-container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4">
            <label className="filter-label">Search</label>
            <div className="relative">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Receipt #, invoice #, customer name..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="filter-input pl-10"
              />
            </div>
          </div>
          <div className="lg:col-span-2">
            <label className="filter-label">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="filter-select"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="filter-label">Provider</label>
            <select
              value={providerFilter}
              onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
              className="filter-select"
            >
              {PROVIDER_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="filter-label">Date Range</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="filter-input"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="filter-input"
              />
            </div>
          </div>
      <div className="lg:col-span-2 flex items-end">
        <div className="relative w-full">
          <label className="filter-label">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={clearFilters}
              className="filter-clear"
            >
              Clear All
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 status-error-bg border status-error-border rounded-lg">
            <p className="text-sm status-error-text">{error}</p>
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-surface rounded-xl border border-color-subtle overflow-hidden">
        <DataTable
          columns={columns}
          data={receipts}
          totalRows={total}
          pageSize={pageSize}
          currentPage={page}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          isLoading={loading}
          emptyMessage={
            hasActiveFilters ? (
              <span>No receipts match your filters.</span>
            ) : (
              <span>No receipts found. Receipts are generated automatically when payments are recorded.</span>
            )
          }
        />
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="text-center py-10 text-tertiary">
            <div className="inline-flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading…
            </div>
          </div>
        ) : receipts.length === 0 ? (
          <div className="bg-surface rounded-xl border border-color-subtle p-8 text-center">
            <p className="text-sm text-tertiary">
              {hasActiveFilters
                ? "No receipts match your filters."
                : "No receipts found. Receipts are generated automatically when payments are recorded."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map((r) => (
              <div key={r.id} className="bg-surface rounded-xl border border-color-subtle p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <Link
                      to={`/app/receipts/${r.id}`}
                      className="text-sm font-medium text-primary-brand hover:underline"
                    >
                      {r.receipt_number || `#${String(r.id).slice(0, 8)}`}
                    </Link>
                    <Link
                      to={r.invoice_id ? `/app/invoices/${r.invoice_id}` : "#"}
                      className="text-xs text-secondary block mt-0.5"
                    >
                      {r.invoice_number || "—"}
                    </Link>
                    {r.customer_name && (
                      <span className="text-xs text-tertiary">{r.customer_name}</span>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-medium text-primary font-tabular-nums">
                      {formatCurrencyValue(Number(r.amount), r.currency)}
                    </span>
                    <PaymentStatus status={r.status} showIcon size="sm" />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-tertiary">
                    {r.issued_at ? formatDate(r.issued_at) : r.created_at ? formatDate(r.created_at) : "—"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewReceipt(r.id)}
                      className="p-2 text-secondary hover:text-primary hover:bg-surface-alt rounded-lg"
                      title="View receipt"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEmailReceipt(r)}
                      className="p-2 text-secondary hover:text-primary hover:bg-surface-alt rounded-lg"
                      title="Email receipt"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDownloadPdf(r.id)}
                      className="p-2 text-secondary hover:text-primary hover:bg-surface-alt rounded-lg"
                      title="Download PDF"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mobile Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-center gap-4 py-4 text-sm">
            <button
              onClick={() => setPage(Math.max(page - 1, 1))}
              disabled={page === 1}
              className="px-3 py-1 text-secondary disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-tertiary">Page {page} of {Math.ceil(total / pageSize)}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(total / pageSize)}
              className="px-3 py-1 text-secondary disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        {/* Mobile page size selector */}
        <div className="flex justify-center py-2">
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="form-control-sm"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>
      </div>

      {/* Email Receipt Modal */}
      {emailModalReceipt && (
        <EmailReceiptModal
          open={!!emailModalReceipt}
          onClose={() => setEmailModalReceipt(null)}
          onEmailSent={handleEmailSent}
          receipt={emailModalReceipt as unknown as Parameters<typeof EmailReceiptModal>[0]["receipt"]}
        />
      )}
    </div>
  );
}
