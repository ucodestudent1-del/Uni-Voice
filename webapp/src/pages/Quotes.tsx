import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getQuotes,
  type QuoteSearchParam,
} from "../api/client";
import { Plus, Send, Copy, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import type { ComponentType } from "react";
import { formatCurrency } from "../utils/format";
import PageHeader from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";
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

const PAGE_SIZE = 50;

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};

const QUOTE_STATUS_COLORS: Record<string, string> = {
  draft: "status-info-bg status-info-text",
  sent: "status-warning-bg status-warning-text",
  viewed: "status-warning-bg status-warning-text",
  accepted: "status-success-bg status-success-text",
  rejected: "status-error-bg status-error-text",
  expired: "status-tertiary-bg status-tertiary-text",
  cancelled: "status-tertiary-bg status-tertiary-text",
};

const QUOTE_STATUS_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  draft: Clock,
  sent: RefreshCw,
  viewed: RefreshCw,
  accepted: CheckCircle,
  rejected: XCircle,
  expired: Clock,
  cancelled: XCircle,
};

function getQuoteStatusColor(status: string): string {
  return QUOTE_STATUS_COLORS[status] ?? "status-tertiary-bg status-tertiary-text";
}

function getQuoteStatusLabel(status: string): string {
  return QUOTE_STATUS_LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

export default function Quotes() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<ApiQuote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const debouncedSetSearchTerm = useDebouncedCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    debouncedSetSearchTerm(value);
  };

  const currentParams: QuoteSearchParam = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      search: searchTerm || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    }),
    [page, searchTerm, statusFilter]
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

  useEffect(() => {
    loadQuotes(currentParams);
  }, [currentParams, loadQuotes]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

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
    setPage(1);
  }

  const hasActiveFilters = searchTerm || statusFilter !== "all";

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

      <div className="filter-container">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-5">
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
          <div className="lg:col-span-3">
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
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-4 flex items-end justify-end gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
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
                const StatusIcon = QUOTE_STATUS_ICONS[quote.status] ?? Clock;
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
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${getQuoteStatusColor(quote.status)}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {getQuoteStatusLabel(quote.status)}
                      </span>
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
