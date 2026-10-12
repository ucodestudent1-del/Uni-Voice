import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCreditNotes } from "@/api/client";
import {
  PageHeader,
  StatusBadge,
  creditNoteStatusConfig,
  Money,
  EmptyState,
  DataTable,
} from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { Plus, Search, FileText } from "lucide-react";
import { formatDate } from "@/utils/format";
import type { ApiCreditNoteListItem } from "@/types/api";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "finalized", label: "Finalized" },
  { value: "sent", label: "Sent" },
  { value: "partially_applied", label: "Partially Applied" },
  { value: "applied", label: "Applied" },
  { value: "partially_refunded", label: "Partially Refunded" },
  { value: "refunded", label: "Refunded" },
  { value: "cancelled", label: "Cancelled" },
  { value: "void", label: "Void" },
];

export default function CreditNotes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creditNotes, setCreditNotes] = useState<ApiCreditNoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCreditNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCreditNotes({
        limit,
        offset,
        invoiceId: searchParams.get("invoiceId") ?? undefined,
      });
      setCreditNotes(data.creditNotes);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load credit notes";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [limit, offset, searchParams]);

  useEffect(() => {
    fetchCreditNotes();
  }, [fetchCreditNotes]);

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
      header: "Credit Note",
      accessor: (row: ApiCreditNoteListItem) => row,
      cell: (row: ApiCreditNoteListItem) => (
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-tertiary" />
          <div>
            <div className="font-medium text-primary">{row.credit_note_number ?? "—"}</div>
            <div className="text-xs text-tertiary">
              {row.issue_date ? formatDate(row.issue_date) : ""}
            </div>
          </div>
        </div>
      ),
      sortable: false,
    },
    {
      header: "Customer",
      accessor: (row: ApiCreditNoteListItem) => row.customer_name,
      cell: (row: ApiCreditNoteListItem) => (
        <span className="text-sm text-primary">{row.customer_name ?? "—"}</span>
      ),
      sortable: false,
    },
    {
      header: "Reference Invoice",
      accessor: (row: ApiCreditNoteListItem) => row.reference_invoice_number,
      cell: (row: ApiCreditNoteListItem) => (
        <span className="text-sm text-primary">{row.reference_invoice_number ?? "—"}</span>
      ),
      sortable: false,
    },
    {
      header: "Status",
      accessor: (row: ApiCreditNoteListItem) => row.status,
      cell: (row: ApiCreditNoteListItem) => (
        <StatusBadge status={row.status} config={creditNoteStatusConfig} />
      ),
      sortable: true,
    },
    {
      header: "Total",
      accessor: (row: ApiCreditNoteListItem) => row.total,
      cell: (row: ApiCreditNoteListItem) => (
        <Money amount={row.total} currency={row.currency} signed />
      ),
      align: "right" as const,
      sortable: true,
    },
    {
      header: "Applied",
      accessor: (row: ApiCreditNoteListItem) => row.applied_total,
      cell: (row: ApiCreditNoteListItem) => (
        <Money amount={row.applied_total ?? 0} currency={row.currency} />
      ),
      align: "right" as const,
      sortable: false,
    },
    {
      header: "Balance",
      accessor: (row: ApiCreditNoteListItem) => row.amount_due,
      cell: (row: ApiCreditNoteListItem) => (
        <Money amount={row.amount_due} currency={row.currency} signed />
      ),
      align: "right" as const,
      sortable: false,
    },
  ];

  const activeFilter = searchParams.get("status") ?? "";

  return (
    <div className="page-container">
      <PageHeader
        title="Credit Notes"
        description="View and manage credit notes issued to customers."
        primaryAction={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate("/app/credit-notes/new")}>
            New Credit Note
          </Button>
        }
      />

      <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary" />
          <input
            type="text"
            placeholder="Search credit notes..."
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
                  : "border-border text-tertiary hover:bg-surface-alt"
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

      {creditNotes.length === 0 && !isLoading && (
        <EmptyState
          title="No credit notes yet"
          description="Create your first credit note to get started."
          icon={<FileText className="h-8 w-8" />}
          actionLabel="Create Credit Note"
          onAction={() => navigate("/app/credit-notes/new")}
        />
      )}

      {creditNotes.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden bg-surface">
          <DataTable
            columns={columns}
            data={creditNotes}
            totalRows={total}
            pageSize={limit}
            currentPage={Math.floor(offset / limit) + 1}
            onPageChange={(page) => setOffset((page - 1) * limit)}
            isLoading={isLoading}
            emptyMessage="No credit notes found"
            rowKey="id"
            onRowClick={(row) => navigate(`/app/credit-notes/${row.id}`)}
            rowClassName={(row) =>
              row.status === "cancelled" || row.status === "void" || row.status === "refunded"
                ? "opacity-60"
                : ""
            }
          />
        </div>
      )}
    </div>
  );
}
