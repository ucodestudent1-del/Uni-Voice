import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getQuotes,
  type QuoteSearchParams,
} from "@/api/client";
import {
  PageHeader,
  StatusBadge,
  quoteStatusConfig,
  Money,
  EmptyState,
  DataTable,
} from "@/components/ui";
import { Button } from "@/components/ui/Button";
import {
  Plus,
  Search,
  FileText,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { formatDate } from "@/utils/format";
import type { ApiQuoteListItem } from "@/types/api";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
  { value: "converted", label: "Converted" },
];

function isQuoteExpiringSoon(expiryDate?: string | null): boolean {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return expiry < sevenDaysFromNow && expiry > new Date();
}

export default function Quotes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quotes, setQuotes] = useState<ApiQuoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params: QuoteSearchParams = useMemo(() => ({
    limit,
    offset,
    status: searchParams.get("status") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  }), [limit, offset, searchParams]);

  const fetchQuotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getQuotes(params);
      setQuotes(data.quotes);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load quotes";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const handleStatusFilter = (status: string) => {
    if (status) {
      setSearchParams({ status, search: searchParams.get("search") ?? "" });
    } else {
      setSearchParams({});
    }
    setOffset(0);
  };

  const handleSearch = (q: string) => {
    setSearchParams({ search: q, status: searchParams.get("status") ?? "" });
    setOffset(0);
  };

  const columns = [
    {
      header: "Quote",
      accessor: (row: ApiQuoteListItem) => row,
      cell: (row: ApiQuoteListItem) => (
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-tertiary" />
          <div>
            <div className="font-medium text-primary">{row.quote_number ?? "—"}</div>
            <div className="text-xs text-tertiary">{row.issue_date ? formatDate(row.issue_date) : ""}</div>
          </div>
        </div>
      ),
      sortable: false,
    },
    {
      header: "Customer",
      accessor: (row: ApiQuoteListItem) => row.customer_name,
      sortable: false,
    },
    {
      header: "Status",
      accessor: (row: ApiQuoteListItem) => row.status,
      cell: (row: ApiQuoteListItem) => (
        <StatusBadge status={row.status} config={quoteStatusConfig} />
      ),
      sortable: true,
    },
    {
      header: "Total",
      accessor: (row: ApiQuoteListItem) => row.total,
      cell: (row: ApiQuoteListItem) => (
        <Money amount={row.total} currency={row.currency} />
      ),
      align: "right" as const,
      sortable: true,
    },
    {
      header: "Expires",
      accessor: (row: ApiQuoteListItem) => row.expiry_date,
      cell: (row: ApiQuoteListItem) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.expiry_date ? formatDate(row.expiry_date) : "—"}
          {isQuoteExpiringSoon(row.expiry_date) && row.status !== "expired" && row.status !== "accepted" && row.status !== "converted" && (
            <span title="Expiring soon (less than 7 days)">
              <AlertCircle className="h-4 w-4 text-error shrink-0" />
            </span>
          )}
        </div>
      ),
      align: "right" as const,
      sortable: true,
    },
  ];

  const activeFilter = searchParams.get("status") ?? "";

  return (
    <div className="page-container">
      <PageHeader
        title="Quotes"
        description="Track and manage all customer quotes."
        primaryAction={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate("/app/quotes/new")}>
            New Quote
          </Button>
        }
      />

      <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary" />
          <input
            type="text"
            placeholder="Search quotes..."
            className="pl-10 pr-3 py-2 w-full text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={searchParams.get("search") ?? ""}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-tertiary">
            <Calendar className="h-3 w-3" />
            <span>Date range:</span>
          </div>
          <input
            type="date"
            className="px-2 py-1 text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={searchParams.get("dateFrom") ?? ""}
            onChange={(e) => {
              setSearchParams({
                search: searchParams.get("search") ?? "",
                status: searchParams.get("status") ?? "",
                dateFrom: e.target.value,
                dateTo: searchParams.get("dateTo") ?? "",
              });
              setOffset(0);
            }}
          />
          <span className="text-xs text-tertiary">to</span>
          <input
            type="date"
            className="px-2 py-1 text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={searchParams.get("dateTo") ?? ""}
            onChange={(e) => {
              setSearchParams({
                search: searchParams.get("search") ?? "",
                status: searchParams.get("status") ?? "",
                dateFrom: searchParams.get("dateFrom") ?? "",
                dateTo: e.target.value,
              });
              setOffset(0);
            }}
          />
          {(searchParams.get("dateFrom") || searchParams.get("dateTo")) && (
            <button
              type="button"
              onClick={() => {
                setSearchParams({
                  search: searchParams.get("search") ?? "",
                  status: searchParams.get("status") ?? "",
                });
                setOffset(0);
              }}
              className="text-xs text-tertiary hover:text-primary underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleStatusFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap border",
                activeFilter === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-tertiary hover:bg-accent"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-error/10 text-error-text text-sm">
          {error}
        </div>
      )}

      {quotes.length === 0 && !isLoading && (
        <EmptyState
          title="No quotes yet"
          description="Create your first quote to get started."
          icon={<FileText className="h-8 w-8" />}
          actionLabel="Create Quote"
          onAction={() => navigate("/app/quotes/new")}
        />
      )}

      {quotes.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <DataTable
            columns={columns}
            data={quotes}
            totalRows={total}
            pageSize={limit}
            currentPage={Math.floor(offset / limit) + 1}
            onPageChange={(page) => setOffset((page - 1) * limit)}
            isLoading={isLoading}
            emptyMessage="No quotes found"
            rowKey="id"
            onRowClick={(row) => navigate(`/app/quotes/${row.id}`)}
            rowClassName={(row) =>
              row.status === "cancelled" || row.status === "rejected" || row.status === "expired"
                ? "opacity-60"
                : row.status === "accepted"
                ? "bg-success/5"
                : ""
            }
          />
        </div>
      )}
    </div>
  );
}
