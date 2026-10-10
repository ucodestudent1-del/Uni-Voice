import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getCreditNotes,
  type CreditNoteSearchParams,
} from "../api/client";
import { Plus, Send, FileText } from "lucide-react";
import { formatCurrency } from "../utils/format";
import { creditNoteStatusConfig } from "@/components/ui";
import PageHeader from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";
import type { ApiCreditNoteListItem } from "../types/api";
import { useSubscription } from "@/contexts/SubscriptionContext";

const CREDIT_NOTE_STATUS_FILTERS = [
  "all",
  "draft",
  "finalized",
  "cancelled",
  "void",
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

function getCreditNoteStatusColor(status: string): string {
  const config = creditNoteStatusConfig.getConfig(status);
  return config.className;
}

function getCreditNoteStatusLabel(status: string): string {
  const config = creditNoteStatusConfig.getConfig(status);
  return config.label;
}

export default function CreditNotes() {
  const { plan } = useSubscription();
  const navigate = useNavigate();
  const [creditNotes, setCreditNotes] = useState<ApiCreditNoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const debouncedSetSearchTerm = useDebouncedCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSetSearchTerm(e.target.value);
  };

  const currentParams: CreditNoteSearchParams = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      search: searchTerm || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    }),
    [page, pageSize, searchTerm, statusFilter]
  );

  const loadCreditNotes = useCallback(
    async (params: CreditNoteSearchParams) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCreditNotes(params);
        setCreditNotes(data.creditNotes ?? []);
        setTotal(data.total ?? 0);
      } catch (err: unknown) {
        setError(
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error || "Failed to load credit notes"
        );
        setCreditNotes([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadCreditNotes(currentParams);
  }, [currentParams, loadCreditNotes]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  }

  function handleNewCreditNote() {
    navigate("/app/invoices");
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setPage(1);
  }

  const hasActiveFilters = searchTerm || statusFilter !== "all";

  if (loading && creditNotes.length === 0) {
    return <div className="text-center py-20 text-secondary">Loading credit notes…</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit Notes"
        breadcrumbs={[
          { label: "Home", to: "/app" },
          { label: "Credit Notes" },
        ]}
        description={`${total} credit note${total !== 1 ? "s" : ""} total`}
        primaryAction={
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleNewCreditNote}
          >
            New Credit Note
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
                placeholder="Credit note #, customer name, email..."
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
              {CREDIT_NOTE_STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-4 flex items-end justify-end gap-2">
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
              <th className="th">Credit Note #</th>
              <th className="th">Customer</th>
              <th className="th text-center">Status</th>
              <th className="th text-right">Total</th>
              <th className="th text-right">Applied</th>
              <th className="th text-center">Issue Date</th>
              <th className="th text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {creditNotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <p className="text-sm text-secondary">
                    {hasActiveFilters
                      ? "No credit notes match your filters"
                      : "No credit notes yet"}
                  </p>
                  {!hasActiveFilters && (
                    <Button
                      variant="primary"
                      size="md"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={handleNewCreditNote}
                      className="ml-2"
                    >
                      Create your first credit note
                    </Button>
                  )}
                </td>
              </tr>
            ) : (
              creditNotes.map((cn) => {
                return (
                  <tr
                    key={cn.id}
                    className="border-t border-color-subtle last:border-b-0 hover:bg-hover"
                  >
                    <td className="td">
                      <div className="flex flex-col leading-tight">
                        <Link
                          to={`/app/credit-notes/${cn.id}`}
                          className="text-sm font-medium text-primary hover:text-primary-brand"
                        >
                          {cn.credit_note_number || `Draft #${cn.id.slice(0, 8)}`}
                        </Link>
                        <span className="text-xs text-tertiary">
                          {cn.reference_invoice_number
                            ? `Orig: ${cn.reference_invoice_number}`
                            : ""}
                        </span>
                      </div>
                    </td>
                    <td className="td text-sm text-secondary">
                      {cn.customer_name || "—"}
                      {cn.customer_email && (
                        <span className="text-xs text-tertiary block">
                          {cn.customer_email}
                        </span>
                      )}
                    </td>
                    <td className="td text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${getCreditNoteStatusColor(cn.status)}`}
                      >
                        {getCreditNoteStatusLabel(cn.status)}
                      </span>
                    </td>
                    <td className="td text-right text-sm font-medium text-primary font-tabular-nums">
                      {formatCurrency(cn.total, cn.currency)}
                    </td>
                    <td className="td text-right text-sm font-tabular-nums text-secondary">
                      {formatCurrency(cn.applied_total || "0", cn.currency)}
                    </td>
                    <td className="td text-center text-sm text-secondary font-tabular-nums">
                      {cn.issue_date
                        ? new Date(cn.issue_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="td text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link to={`/app/credit-notes/${cn.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<FileText className="w-3.5 h-3.5" />}
                            title="View"
                          />
                        </Link>
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
              Page {page} of {totalPages} · {total} credit notes
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
