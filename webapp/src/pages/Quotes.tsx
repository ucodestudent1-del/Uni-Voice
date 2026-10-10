import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getQuotes,
  type QuoteSearchParam,
} from "../api/client";
import { Plus, FileText, Copy, Send } from "lucide-react";
import { formatCurrency } from "../utils/format";
import { Decimal } from "decimal.js";
import { quoteStatusConfig } from "@/components/ui";
import StatusBadge from "@/components/ui/StatusBadge";
import PageHeader from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import KPICard from "@/components/ui/KPICard";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import type { ApiQuote } from "../types/api";

const QUOTE_STATUS_FILTERS = [
  "all",
  "draft",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const SORT_OPTIONS = [
  { value: "created_at:desc", label: "Created (Newest)" },
  { value: "created_at:asc", label: "Created (Oldest)" },
  { value: "issue_date:desc", label: "Issue Date (Newest)" },
  { value: "issue_date:asc", label: "Issue Date (Oldest)" },
  { value: "expiry_date:asc", label: "Expiry Date (Earliest)" },
  { value: "total:desc", label: "Total (Highest)" },
  { value: "total:asc", label: "Total (Lowest)" },
];

const DATE_FILTERS = [
  { value: "", label: "All Time" },
  { value: "this_month", label: "This Month" },
  { value: "last_30", label: "Last 30 Days" },
  { value: "last_90", label: "Last 90 Days" },
];

function computeDateRange(value: string): { dateFrom: string; dateTo: string } | null {
  if (!value) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (value === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { dateFrom: start.toISOString().split("T")[0], dateTo: end.toISOString().split("T")[0] };
  }
  if (value === "last_30") {
    const start = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
    return { dateFrom: start.toISOString().split("T")[0], dateTo: today.toISOString().split("T")[0] };
  }
  if (value === "last_90") {
    const start = new Date(today.getTime() - 89 * 24 * 60 * 60 * 1000);
    return { dateFrom: start.toISOString().split("T")[0], dateTo: today.toISOString().split("T")[0] };
  }
  return null;
}

function getQuoteStatusLabel(status: string): string {
  const config = quoteStatusConfig.getConfig(status);
  return config.label;
}

export default function Quotes() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<ApiQuote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at:desc");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const [kpis, setKpis] = useState<{ totalQuotes: number; totalValue: string; acceptedValue: string; expiredValue: string } | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  const debouncedSetSearchTerm = useDebouncedCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSetSearchTerm(e.target.value);
  };

  const sortParts = useMemo(() => {
    const [field, order] = sortBy.split(":");
    return { field: field || "created_at", order: (order === "asc" ? "asc" : "desc") as "asc" | "desc" };
  }, [sortBy]);

  const dateRange = useMemo(() => computeDateRange(dateFilter), [dateFilter]);

  const currentParams: QuoteSearchParam = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      search: searchTerm || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      sortBy: sortParts.field,
      sortOrder: sortParts.order,
      dateFrom: dateRange?.dateFrom,
      dateTo: dateRange?.dateTo,
    }),
    [page, pageSize, searchTerm, statusFilter, sortParts, dateRange]
  );

  const loadQuotes = useCallback(async (params: QuoteSearchParam) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQuotes(params);
      setQuotes(data.quotes ?? []);
      setTotal(data.total ?? 0);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to load quotes"
      );
      setQuotes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const computeKpis = useCallback((items: ApiQuote[]) => {
    const totalQuotes = items.length;
    const totalValue = items.reduce(
      (sum, q) => sum.plus(new Decimal(q.total ?? 0)),
      new Decimal(0)
    );
    const acceptedValue = items
      .filter((q) => q.status === "accepted")
      .reduce(
        (sum, q) => sum.plus(new Decimal(q.total ?? 0)),
        new Decimal(0)
      );
    const expiredValue = items
      .filter((q) => q.status === "expired" || q.status === "rejected")
      .reduce(
        (sum, q) => sum.plus(new Decimal(q.total ?? 0)),
        new Decimal(0)
      );

    return {
      totalQuotes,
      totalValue: totalValue.toFixed(2),
      acceptedValue: acceptedValue.toFixed(2),
      expiredValue: expiredValue.toFixed(2),
    };
  }, []);

  useEffect(() => {
    loadQuotes(currentParams);
  }, [currentParams, loadQuotes]);

  useEffect(() => {
    if (quotes.length > 0 || !loading) {
      setKpis(computeKpis(quotes));
      setKpiLoading(false);
    }
  }, [quotes, loading, computeKpis]);

  const totalPages = Math.ceil(total / pageSize) || 1;
  const commonCurrency = quotes.length > 0 ? quotes[0].currency : "USD";

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  }

  function handleNewQuote() {
    navigate("/app/quotes/new");
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFilter("");
    setSortBy("created_at:desc");
    setPage(1);
  }

  const hasActiveFilters = searchTerm || statusFilter !== "all" || dateFilter || sortBy !== "created_at:desc";

  if (loading && quotes.length === 0) {
    return <div className="text-center py-20 text-secondary">Loading quotes…</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        breadcrumbs={[{ label: "Home", to: "/app" }, { label: "Quotes" }]}
        description={`${total} quote${total !== 1 ? "s" : ""} total`}
        primaryAction={
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleNewQuote}
          >
            New Quote
          </Button>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Quotes"
          value={kpis?.totalQuotes ?? 0}
          subtitle="All time"
          icon={<FileText className="w-5 h-5" />}
          iconBackground="status-info-bg status-info-text"
          variant="tinted"
          state="info"
          isLoading={kpiLoading}
        />
        <KPICard
          title="Total Quote Value"
          value={kpis?.totalValue ?? "0"}
          currency={commonCurrency}
          subtitle="Sum of all quote totals"
          icon={<FileText className="w-5 h-5" />}
          iconBackground="status-tertiary-bg status-tertiary-text"
          variant="tinted"
          isLoading={kpiLoading}
        />
        <KPICard
          title="Accepted Value"
          value={kpis?.acceptedValue ?? "0"}
          currency={commonCurrency}
          subtitle="Value of accepted quotes"
          icon={<Copy className="w-5 h-5" />}
          iconBackground="status-success-bg status-success-text"
          variant="tinted"
          state="success"
          isLoading={kpiLoading}
        />
        <KPICard
          title="Expired/Rejected"
          value={kpis?.expiredValue ?? "0"}
          currency={commonCurrency}
          subtitle="Value of expired or rejected quotes"
          icon={<FileText className="w-5 h-5" />}
          iconBackground="status-warning-bg status-warning-text"
          variant="tinted"
          state="warning"
          isLoading={kpiLoading}
        />
      </div>

      {/* Filters */}
      <div className="filter-container">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-4">
            <label className="filter-label">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Quote #, customer name, email..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="filter-input pl-4"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="filter-label">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="filter-select"
            >
              {QUOTE_STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All Statuses" : getQuoteStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="filter-label">Date</label>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="filter-select"
            >
              {DATE_FILTERS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="filter-label">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="filter-select"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 flex items-end justify-end gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear All
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 status-error-bg border status-error-border rounded-lg">
          <p className="text-sm status-error-text">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-color bg-surface shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-color bg-surface-alt">
              <th className="th">Quote #</th>
              <th className="th">Customer</th>
              <th className="th text-center">Status</th>
              <th className="th text-right">Total</th>
              <th className="th text-right">Amount Due</th>
              <th className="th text-center">Issue Date</th>
              <th className="th text-center">Expiry Date</th>
              <th className="th text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <p className="text-sm text-secondary">
                    {hasActiveFilters
                      ? "No quotes match your filters"
                      : "No quotes yet"}
                  </p>
                  {!hasActiveFilters && (
                    <Button
                      variant="primary"
                      size="md"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={handleNewQuote}
                      className="ml-2"
                    >
                      Create your first quote
                    </Button>
                  )}
                </td>
              </tr>
            ) : (
              quotes.map((quote) => {
                return (
                  <tr
                    key={quote.id}
                    className="border-t border-color-subtle last:border-b-0 hover:bg-hover"
                  >
                    <td className="td">
                      <div className="flex flex-col leading-tight">
                        <Link
                          to={`/app/quotes/${quote.id}/edit`}
                          className="text-sm font-medium text-primary hover:text-primary-brand"
                        >
                          {quote.quote_number || `Draft #${quote.id.slice(0, 8)}`}
                        </Link>
                        <span className="text-xs text-tertiary">
                          {quote.created_at
                            ? new Date(quote.created_at).toLocaleDateString()
                            : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="td text-sm text-secondary">
                      {quote.customer_name || "—"}
                      {quote.customer_email && (
                        <span className="text-xs text-tertiary block">
                          {quote.customer_email}
                        </span>
                      )}
                    </td>
                    <td className="td text-center">
                      <StatusBadge
                        status={quote.status}
                        config={quoteStatusConfig}
                        showLabel={true}
                        size="sm"
                      />
                    </td>
                    <td className="td text-right text-sm font-medium text-primary font-tabular-nums">
                      {formatCurrency(quote.total, quote.currency)}
                    </td>
                    <td className="td text-right font-medium font-tabular-nums">
                      {Number(quote.amount_due || 0) > 0
                        ? formatCurrency(quote.amount_due, quote.currency)
                        : Number(quote.total || 0) > 0
                          ? quote.status === "accepted"
                            ? "Converted"
                            : formatCurrency(quote.amount_due || 0, quote.currency)
                          : formatCurrency(quote.amount_due || 0, quote.currency)}
                    </td>
                    <td className="td text-center text-sm text-secondary font-tabular-nums">
                      {quote.issue_date
                        ? new Date(quote.issue_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="td text-center text-sm text-secondary font-tabular-nums">
                      {quote.expiry_date
                        ? new Date(quote.expiry_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="td text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link to={`/app/quotes/${quote.id}/edit`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<FileText className="w-3.5 h-3.5" />}
                            title="View / Edit"
                          />
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Copy className="w-3.5 h-3.5" />}
                          onClick={() => {}}
                          title="Duplicate"
                        />
                        {quote.status === "sent" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Send className="w-3.5 h-3.5" />}
                            onClick={() => {}}
                            title="Resend"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="border-t border-color px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-secondary">
              Page {page} of {totalPages} · {total} quotes
            </p>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="form-control-sm"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
