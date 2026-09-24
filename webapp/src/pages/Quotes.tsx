import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getQuotes,
  getQuoteById,
  getQuotePdf,
  convertQuote,
  sendQuote,
  deleteQuote,
  type QuoteSearchParams,
  type ApiQuoteListItem,
} from "../api/client";
import { formatCurrencyValue } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { Download, Search, Eye, Send, Copy, Trash2, Plus } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { DataTable, type ColumnDef } from "../components/ui/DataTable";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";

const STATUS_FILTERS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

export default function Quotes() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<ApiQuoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  // Debounce search so we don't fire an API request on every keystroke.
  const debouncedSetSearchTerm = useDebouncedCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSetSearchTerm(e.target.value);
  };

  const currentParams: QuoteSearchParams = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      status: statusFilter === "all" ? undefined : statusFilter,
      search: searchTerm || undefined,
    }),
    [page, pageSize, searchTerm, statusFilter]
  );

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQuotes(currentParams);
      setQuotes(data.quotes ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load quotes");
      setQuotes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [currentParams]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const handleDownloadPdf = useCallback(async (id: string) => {
    try {
      const blob = await getQuotePdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quote-${id.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to download quote PDF");
    }
  }, [setError]);

  const handleView = useCallback((id: string) => {
    navigate(`/app/quotes/${id}`);
  }, [navigate]);

  const handleConvert = useCallback(async (id: string) => {
    if (!window.confirm("Convert this quote to an invoice?")) return;
    try {
      const result = await convertQuote(id);
      setActionMessage(`Quote converted to invoice #${result.invoiceId?.slice(0, 8)}`);
      loadQuotes();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to convert quote");
    }
  }, [loadQuotes, setActionMessage, setError]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm("Delete this quote? This cannot be undone.")) return;
    try {
      await deleteQuote(id);
      setActionMessage("Quote deleted");
      loadQuotes();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete quote");
    }
  }, [loadQuotes, setActionMessage, setError]);

  const columns = useMemo<ColumnDef<ApiQuoteListItem>[]>(
    () => [
      {
        header: "Quote #",
        accessor: "quote_number",
        cell: (row) => {
          const q = row as ApiQuoteListItem;
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-primary">
                {q.quote_number || `#${String(q.id).slice(0, 8)}`}
              </span>
              <span className="text-xs text-tertiary">{q.created_at ? new Date(q.created_at).toLocaleDateString() : "—"}</span>
            </div>
          );
        },
        sortable: false,
        align: "left",
      },
      {
        header: "Customer",
        accessor: "customer_name",
        cell: (row) => {
          const q = row as ApiQuoteListItem;
          return (
            <div className="flex flex-col">
              <span className="text-sm text-secondary">{q.customer_name || "—"}</span>
              {q.customer_email && <span className="text-xs text-tertiary">{q.customer_email}</span>}
            </div>
          );
        },
        sortable: false,
        align: "left",
      },
      {
        header: "Status",
        accessor: "status",
        cell: (row) => {
          const q = row as ApiQuoteListItem;
          return (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium status-info-bg status-info-text capitalize">
              {q.status}
            </span>
          );
        },
        sortable: false,
        align: "center",
      },
      {
        header: "Total",
        accessor: "total",
        cell: (row) => (
          <span className="text-sm font-medium text-primary">
            {formatCurrencyValue(Number((row as ApiQuoteListItem).total), (row as ApiQuoteListItem).currency)}
          </span>
        ),
        sortable: false,
        align: "right",
      },
      {
        header: "Due",
        accessor: "due_date",
        cell: (row) => {
          const q = row as ApiQuoteListItem;
          return <span className="text-sm text-secondary">{q.due_date ? new Date(q.due_date).toLocaleDateString() : "—"}</span>;
        },
        sortable: false,
        align: "left",
      },
      {
        header: "",
        accessor: "id",
        cell: (row) => {
          const q = row as ApiQuoteListItem;
          return (
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => handleView(q.id)}
                className="text-xs text-secondary hover:text-primary"
                title="View quote"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              {q.status === "sent" || q.status === "accepted" || q.status === "sent" ? (
                <button
                  onClick={() => handleConvert(q.id)}
                  className="text-xs text-secondary hover:text-primary"
                  title="Convert to invoice"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                onClick={() => handleDownloadPdf(q.id)}
                className="text-xs text-secondary hover:text-primary"
                title="Download PDF"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(q.id)}
                className="text-xs text-secondary hover:text-primary"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        },
        sortable: false,
        align: "center",
      },
    ],
    [handleView, handleConvert, handleDownloadPdf, handleDelete]
  );

  const hasActiveFilters = searchTerm || statusFilter !== "all";

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        breadcrumbs={[{ label: "Home", to: "/app" }, { label: "Quotes" }]}
        description={`${total} quote${total !== 1 ? "s" : ""} total`}
        primaryAction={
          <Link to="/app/quotes/new">
            <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
              New Quote
            </Button>
          </Link>
        }
      />

      <div className="bg-surface rounded-xl border border-color-subtle p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary" />
              <input
                type="text"
                placeholder="Quote #, customer name..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 pl-10 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={clearFilters}
              className="text-sm font-medium text-secondary hover:text-primary"
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
        {actionMessage && (
          <div className="mt-3 p-3 status-success-bg border status-success-border rounded-lg">
            <p className="text-sm status-success-text">{actionMessage}</p>
          </div>
        )}
      </div>

      <div className="bg-surface rounded-xl border border-color-subtle overflow-hidden">
        <DataTable
          columns={columns}
          data={quotes}
          totalRows={total}
          pageSize={pageSize}
          currentPage={page}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          isLoading={loading}
          emptyMessage={
            hasActiveFilters ? (
              <span>No quotes match your filters.</span>
            ) : (
              <span>No quotes found. Create your first quote to get started.</span>
            )
          }
        />
      </div>
    </div>
  );
}
