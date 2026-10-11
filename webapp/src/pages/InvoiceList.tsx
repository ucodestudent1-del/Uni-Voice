import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getInvoices,
  type InvoiceSearchParams,
} from "@/api/client";
import {
  PageHeader,
  StatusBadge,
  invoiceStatusConfig,
  Money,
  EmptyState,
  DataTable,
} from "@/components/ui";
import { Button } from "@/components/ui/Button";
import {
  Plus,
  Search,
  FileText,
} from "lucide-react";
import { formatDate } from "@/utils/format";
import type { ApiInvoiceListItem } from "@/types/api";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
  { value: "void", label: "Void" },
];

export default function InvoiceList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoices, setInvoices] = useState<ApiInvoiceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params: InvoiceSearchParams = {
    limit,
    offset,
    status: searchParams.get("status") ?? undefined,
    search: searchParams.get("search") ?? undefined,
  };

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getInvoices(params);
      setInvoices(data.invoices);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load invoices";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

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
      header: "Invoice",
      accessor: (row: ApiInvoiceListItem) => row,
      cell: (row: ApiInvoiceListItem) => (
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-tertiary" />
          <div>
            <div className="font-medium text-primary">{row.invoice_number ?? "—"}</div>
            <div className="text-xs text-tertiary">{row.issue_date ? formatDate(row.issue_date) : ""}</div>
          </div>
        </div>
      ),
      sortable: false,
    },
    {
      header: "Customer",
      accessor: (row: ApiInvoiceListItem) => row.customer_name,
      sortable: false,
    },
    {
      header: "Status",
      accessor: (row: ApiInvoiceListItem) => row.status,
      cell: (row: ApiInvoiceListItem) => (
        <StatusBadge status={row.status} config={invoiceStatusConfig} />
      ),
      sortable: true,
    },
    {
      header: "Total",
      accessor: (row: ApiInvoiceListItem) => row.total,
      cell: (row: ApiInvoiceListItem) => (
        <Money amount={row.total} currency={row.currency} />
      ),
      align: "right" as const,
      sortable: true,
    },
    {
      header: "Outstanding",
      accessor: (row: ApiInvoiceListItem) => row.amount_due,
      cell: (row: ApiInvoiceListItem) => (
        <Money amount={row.amount_due} currency={row.currency} />
      ),
      align: "right" as const,
      sortable: false,
    },
    {
      header: "Due Date",
      accessor: (row: ApiInvoiceListItem) => row.due_date,
      cell: (row: ApiInvoiceListItem) => (
        <span className="text-sm text-tertiary">{row.due_date ? formatDate(row.due_date) : "—"}</span>
      ),
      align: "right" as const,
      sortable: true,
    },
  ];

  const activeFilter = searchParams.get("status") ?? "";

  return (
    <div className="page-container">
      <PageHeader
        title="Invoices"
        description="Track and manage all customer invoices."
        primaryAction={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate("/app/invoices/new")}>
            New Invoice
          </Button>
        }
      />

      <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary" />
          <input
            type="text"
            placeholder="Search invoices..."
            className="pl-10 pr-3 py-2 w-full text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={searchParams.get("search") ?? ""}
            onChange={(e) => handleSearch(e.target.value)}
          />
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

      {invoices.length === 0 && !isLoading && (
        <EmptyState
          title="No invoices yet"
          description="Create your first invoice to get started."
          icon={<FileText className="h-8 w-8" />}
          actionLabel="Create Invoice"
          onAction={() => navigate("/app/invoices/new")}
        />
      )}

      {invoices.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <DataTable
            columns={columns}
            data={invoices}
            totalRows={total}
            pageSize={limit}
            currentPage={Math.floor(offset / limit) + 1}
            onPageChange={(page) => setOffset((page - 1) * limit)}
            isLoading={isLoading}
            emptyMessage="No invoices found"
            rowKey="id"
            onRowClick={(row) => navigate(`/app/invoices/${row.id}`)}
            rowClassName={(row) =>
              row.status === "cancelled" || row.status === "void"
                ? "opacity-60"
                : row.status === "overdue"
                ? "bg-error/5"
                : ""
            }
          />
        </div>
      )}
    </div>
  );
}
