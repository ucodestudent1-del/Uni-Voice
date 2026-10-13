import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getCreditNotes,
  type CreditNoteSearchParams,
} from "@/api/client";
import {
  PageHeader,
  StatusBadge,
  creditNoteStatusConfig,
  Money,
  EmptyState,
  DataTable,
  CreditNoteListKPIBar,
} from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { Plus, Search, FileText, Filter, Calendar, X, ChevronDown } from "lucide-react";
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

interface DropdownItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

function ActionDropdown({
  trigger,
  items,
}: {
  trigger: React.ReactNode;
  items: DropdownItem[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-1 rounded text-tertiary hover:text-primary hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Actions"
      >
        {trigger}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-color bg-surface shadow-lg py-1">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                disabled={item.disabled}
                className={cn(
                  "block w-full text-left px-3 py-1.5 text-sm",
                  item.disabled
                    ? "opacity-50 cursor-not-allowed"
                    : item.destructive
                      ? "text-error-text hover:bg-error/10"
                      : "text-primary hover:bg-surface-alt",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function CreditNotes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creditNotes, setCreditNotes] = useState<ApiCreditNoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildParams = useCallback((): CreditNoteSearchParams => {
    const status = searchParams.get("status") ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const invoiceId = searchParams.get("invoiceId") ?? undefined;
    const dateFrom = searchParams.get("dateFrom") ?? undefined;
    const dateTo = searchParams.get("dateTo") ?? undefined;
    const sortBy = searchParams.get("sortBy") ?? undefined;
    const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" | null;

    return {
      limit,
      offset,
      ...(status && { status }),
      ...(search && { search }),
      ...(invoiceId && { invoiceId }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
      ...(sortBy && { sortBy }),
      ...(sortOrder && { sortOrder }),
    };
  }, [limit, offset, searchParams]);

  const fetchCreditNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCreditNotes(buildParams());
      setCreditNotes(data.creditNotes);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load credit notes";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchCreditNotes();
  }, [fetchCreditNotes]);

  const handleStatusFilter = (status: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (status) {
      newParams.set("status", status);
    } else {
      newParams.delete("status");
    }
    setSearchParams(newParams);
    setOffset(0);
  };

  const handleSearch = (q: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (q) {
      newParams.set("search", q);
    } else {
      newParams.delete("search");
    }
    setSearchParams(newParams);
    setOffset(0);
  };

  const handleDateFrom = (d: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (d) {
      newParams.set("dateFrom", d);
    } else {
      newParams.delete("dateFrom");
    }
    setSearchParams(newParams);
    setOffset(0);
  };

  const handleDateTo = (d: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (d) {
      newParams.set("dateTo", d);
    } else {
      newParams.delete("dateTo");
    }
    setSearchParams(newParams);
    setOffset(0);
  };

  const clearFilters = () => {
    setSearchParams({});
    setOffset(0);
  };

  const activeFilters = Array.from(searchParams.entries()).filter(
    ([k]) => k !== "sortBy" && k !== "sortOrder",
  );
  const hasActiveFilters = activeFilters.length > 0;

  const columns = useMemo(
    () => [
      {
        header: "Credit Note",
        accessor: (row: ApiCreditNoteListItem) => row.credit_note_number ?? "",
        cell: (row: ApiCreditNoteListItem) => (
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-tertiary" />
            <div>
              <div className="font-medium text-primary">
                {row.credit_note_number ?? "—"}
              </div>
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
        accessor: (row: ApiCreditNoteListItem) => row.customer_name ?? "",
        cell: (row: ApiCreditNoteListItem) => (
          <span className="text-sm text-primary">{row.customer_name ?? "—"}</span>
        ),
        sortable: false,
      },
      {
        header: "Reference Invoice",
        accessor: (row: ApiCreditNoteListItem) => row.reference_invoice_number ?? "",
        cell: (row: ApiCreditNoteListItem) => {
          if (!row.reference_invoice_id && !row.reference_invoice_number) {
            return <span className="text-sm text-tertiary">—</span>;
          }
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (row.reference_invoice_id) {
                  navigate(`/app/invoices/${row.reference_invoice_id}`);
                }
              }}
              className="text-sm text-info-text hover:underline focus:outline-none focus:underline"
              title={
                row.reference_invoice_id
                  ? `View invoice ${row.reference_invoice_number}`
                  : undefined
              }
            >
              {row.reference_invoice_number ?? "—"}
            </button>
          );
        },
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
        accessor: (row: ApiCreditNoteListItem) => row.applied_total ?? "0",
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
      {
        header: "Actions",
        accessor: (row: ApiCreditNoteListItem) => row.id,
        cell: (row: ApiCreditNoteListItem) => {
          const isCancelledOrVoid =
            row.status === "cancelled" || row.status === "void" || row.status === "refunded";
          const isDraft = row.status === "draft";
          const hasBalance =
            row.amount_due &&
            parseFloat(row.amount_due) > 0;

          const items: DropdownItem[] = [
            {
              label: "View / Edit",
              onClick: () => navigate(`/app/credit-notes/${row.id}`),
            },
            {
              label: "Finalize",
              onClick: () => navigate(`/app/credit-notes/${row.id}?action=finalize`),
              disabled: !isDraft,
            },
            {
              label: "Apply Credit",
              onClick: () => navigate(`/app/credit-notes/${row.id}?action=apply`),
              disabled: !hasBalance || isCancelledOrVoid,
            },
            {
              label: isDraft ? "Cancel Draft" : "Cancel",
              onClick: () => navigate(`/app/credit-notes/${row.id}?action=cancel`),
              disabled: !isDraft && !isCancelledOrVoid === false,
              destructive: !isDraft,
            },
          ];

          return (
            <ActionDropdown
              trigger={<ChevronDown className="h-4 w-4" />}
              items={items}
            />
          );
        },
        align: "right" as const,
        sortable: false,
      },
    ],
    [navigate],
  );

  const activeFilter = searchParams.get("status") ?? "";

  return (
    <div className="page-container">
      <PageHeader
        title="Credit Notes"
        description="View and manage credit notes issued to customers."
        primaryAction={
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate("/app/credit-notes/new")}
          >
            New Credit Note
          </Button>
        }
      />

      <CreditNoteListKPIBar creditNotes={creditNotes} isLoading={isLoading} />

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

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-tertiary" />
            <input
              type="date"
              className="px-2 py-1 text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={searchParams.get("dateFrom") ?? ""}
              onChange={(e) => handleDateFrom(e.target.value)}
              aria-label="From date"
            />
            <span className="text-tertiary">to</span>
            <input
              type="date"
              className="px-2 py-1 text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={searchParams.get("dateTo") ?? ""}
              onChange={(e) => handleDateTo(e.target.value)}
              aria-label="To date"
            />
          </div>

          <div className="flex gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-2 py-1 text-xs text-tertiary hover:text-primary hover:bg-surface-alt rounded focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Clear filters"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("status-filter-popover");
                  if (el) {
                    el.classList.toggle("hidden");
                  }
                }}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md border transition-colors",
                  activeFilter
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-tertiary hover:bg-surface-alt",
                )}
                aria-haspopup="true"
                aria-expanded={!activeFilter}
              >
                <Filter className="h-3.5 w-3.5 inline mr-1" />
                {STATUS_OPTIONS.find((o) => o.value === activeFilter)?.label ??
                  "All statuses"}
              </button>
              <div
                id="status-filter-popover"
                className="hidden absolute z-20 mt-1 w-48 rounded-md border border-color bg-surface shadow-lg py-1"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleStatusFilter(opt.value)}
                    className={cn(
                      "block w-full text-left px-3 py-1.5 text-sm",
                      activeFilter === opt.value
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-primary hover:bg-surface-alt",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-error/10 text-error-text text-sm">
          {error}
        </div>
      )}

      {creditNotes.length === 0 && !isLoading && (
        <EmptyState
          title="No credit notes found"
          description={
            hasActiveFilters
              ? "Try clearing your filters to see all credit notes."
              : "Create your first credit note to get started."
          }
          icon={<FileText className="h-8 w-8" />}
          actionLabel={hasActiveFilters ? "Clear Filters" : "Create Credit Note"}
          onAction={hasActiveFilters ? clearFilters : () => navigate("/app/credit-notes/new")}
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
            onRowClick={(row) =>
              !(
                row.status === "cancelled" ||
                row.status === "void" ||
                row.status === "refunded"
              ) && navigate(`/app/credit-notes/${row.id}`)
            }
            rowClassName={(row) =>
              row.status === "cancelled" ||
              row.status === "void" ||
              row.status === "refunded"
                ? "opacity-60"
                : ""
            }
          />
        </div>
      )}
    </div>
  );
}
