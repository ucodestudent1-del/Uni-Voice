import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { getPaymentsByBusiness } from "../api/client";
import { formatCurrencyValue } from "../lib/utils";
import { formatDate } from "../utils/format";
import { Button } from "../components/ui/Button";
import { Plus, Download, RefreshCw, ExternalLink } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { DataTable, type ColumnDef } from "../components/ui/DataTable";
import PaymentStatus from "../components/ui/PaymentStatus";
import { type ApiPaymentWithInvoice } from "../types/api";

const STATUS_FILTERS = ["all", "succeeded", "pending", "failed", "refunded"];

export default function Payments() {
  const [payments, setPayments] = useState<ApiPaymentWithInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPaymentsByBusiness({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        status: statusFilter === "all" ? undefined : statusFilter,
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
  }, [page, pageSize, statusFilter, searchTerm]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const columns = useMemo<ColumnDef<ApiPaymentWithInvoice>[]>(
    () => [
      {
        header: "Date",
        accessor: "paid_at",
        cell: (row) => (
          <span className="text-sm text-secondary">
            {(row as ApiPaymentWithInvoice).paid_at ? formatDate(new Date((row as ApiPaymentWithInvoice).paid_at as string)) : "—"}
          </span>
        ),
        sortable: false,
        align: "left",
      },
      {
        header: "Invoice",
        accessor: "invoice_id",
        cell: (row) => {
          const p = row as ApiPaymentWithInvoice;
          return (
            <div className="flex flex-col">
              <Link
                to={`/app/invoices/${p.invoice_id}`}
                className="text-sm font-medium text-primary-brand hover:text-primary-hover"
              >
                {p.invoice_number || `#${String(p.invoice_id).slice(0, 8)}`}
              </Link>
              <span className="text-xs text-tertiary">{p.customer_name || "—"}</span>
            </div>
          );
        },
        sortable: false,
        align: "left",
      },
      {
        header: "Amount",
        accessor: "amount",
        cell: (row) => (
          <span className="text-sm font-medium text-primary">
            {formatCurrencyValue((row as ApiPaymentWithInvoice).amount, (row as ApiPaymentWithInvoice).currency)}
          </span>
        ),
        sortable: false,
        align: "right",
      },
      {
        header: "Method",
        accessor: "method",
        cell: (row) => (
          <span className="text-sm text-secondary capitalize">
            {(row as ApiPaymentWithInvoice).method || (row as ApiPaymentWithInvoice).provider || "—"}
          </span>
        ),
        sortable: false,
        align: "left",
      },
      {
        header: "Provider",
        accessor: "provider",
        cell: (row) => (
          <span className="text-sm text-tertiary">{(row as ApiPaymentWithInvoice).provider || "—"}</span>
        ),
        sortable: false,
        align: "left",
      },
      {
        header: "Status",
        accessor: "status",
        cell: (row) => <PaymentStatus status={(row as ApiPaymentWithInvoice).status} showIcon />,
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
              to={`/app/invoices/${p.invoice_id}`}
              className="text-xs text-secondary hover:text-primary"
              title="View invoice"
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

  const hasActiveFilters = searchTerm || statusFilter !== "all";

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(total / pageSize)) return;
    setPage(newPage);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description={`${total} payment${total !== 1 ? "s" : ""} recorded`}
        primaryAction={
          <Button
            variant="secondary"
            size="md"
            icon={<Download className="h-4 w-4" />}
            onClick={() => {}}
          >
            Export
          </Button>
        }
      />

      <div className="bg-surface rounded-xl border border-color-subtle p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <input
              type="text"
              placeholder="Search by invoice number, customer name, or provider reference..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
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
