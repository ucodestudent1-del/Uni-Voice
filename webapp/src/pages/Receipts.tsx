import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  getReceipts,
  getReceiptById,
  getReceiptPdf,
  type ReceiptSearchParams,
  type ApiReceipt,
} from "../api/client";
import { formatCurrency } from "../utils/format";
import { formatCurrencyValue } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { Download, Search, Eye, ExternalLink } from "lucide-react";
import PageHeader from "../components/primitives/PageHeader";
import { DataTable, type ColumnDef } from "../components/primitives/DataTable";
import PaymentStatus from "../components/primitives/PaymentStatus";

const STATUS_FILTERS = [
  { value: "all", label: "All Statuses" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const PROVIDER_FILTERS = [
  { value: "all", label: "All Providers" },
  { value: "stripe", label: "Stripe" },
  { value: "stub", label: "Stub" },
];

export default function Receipts() {
  const [receipts, setReceipts] = useState<ApiReceipt[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const currentParams: ReceiptSearchParams = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      status: statusFilter === "all" ? undefined : statusFilter,
      provider: providerFilter === "all" ? undefined : providerFilter,
      search: searchTerm || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [page, pageSize, searchTerm, statusFilter, providerFilter, dateFrom, dateTo]
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

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  const columns = useMemo<ColumnDef<ApiReceipt>[]>(
    () => [
      {
        header: "Receipt #",
        accessor: "receipt_number",
        cell: (row) => {
          const r = row as ApiReceipt;
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-primary">
                {r.receipt_number || `#${String(r.id).slice(0, 8)}`}
              </span>
              <span className="text-xs text-tertiary">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</span>
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
              <span className="text-sm text-secondary">
                {r.invoice_number || "—"}
              </span>
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
        header: "Amount",
        accessor: "amount",
        cell: (row) => (
          <span className="text-sm font-medium text-primary">
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
    []
  );

  async function handleDownloadPdf(receiptId: string) {
    try {
      const blob = await getReceiptPdf(receiptId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${receiptId.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to download receipt PDF");
    }
  }

  async function handleViewReceipt(receiptId: string) {
    try {
      const { receipt } = await getReceiptById(receiptId);
      const url = window.URL.createObjectURL(
        new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${receipt.id.slice(0, 8)}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load receipt");
    }
  }

  async function handleExportCsv() {
    try {
      const csvRows = [
        ["Receipt #", "Invoice", "Customer", "Amount", "Currency", "Provider", "Status", "Created"],
      ];
      for (const r of receipts) {
        csvRows.push([
          r.receipt_number || "",
          r.invoice_number || "",
          r.customer_name || "",
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
      setError(err.message || "Failed to export");
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
      setError(err.message || "Failed to export");
    }
  }

  const hasActiveFilters = searchTerm || statusFilter !== "all" || providerFilter !== "all" || dateFrom || dateTo;

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setProviderFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
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
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportJson}
            title="Export JSON"
          >
            JSON
          </Button>
        }
      />

      <div className="bg-surface rounded-xl border border-color-subtle p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-secondary mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary" />
              <input
                type="text"
                placeholder="Receipt #, invoice #, customer name..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
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
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Provider</label>
            <select
              value={providerFilter}
              onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {PROVIDER_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Date Range</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="rounded-lg border border-input-border bg-surface-alt px-2 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="rounded-lg border border-input-border bg-surface-alt px-2 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
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
      </div>

      <div className="bg-surface rounded-xl border border-color-subtle overflow-hidden">
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
              <span>No receipts found. Receipts are generated when payments are recorded.</span>
            )
          }
        />
      </div>
    </div>
  );
}
