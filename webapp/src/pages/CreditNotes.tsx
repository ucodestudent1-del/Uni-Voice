import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getCreditNotes,
  type CreditNoteSearchParams,
} from "../api/client";
import { Plus, FileText, Download, Send, Copy, Trash2, AlertCircle } from "lucide-react";
import { formatCurrency } from "../utils/format";
import { Decimal } from "decimal.js";
import { creditNoteStatusConfig, CreditNoteLifecycle } from "@/components/ui";
import PageHeader from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import KPICard from "@/components/ui/KPICard";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";
import type { ApiCreditNoteListItem } from "../types/api";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";

const CREDIT_NOTE_STATUS_FILTERS = [
  "all",
  "draft",
  "finalized",
  "sent",
  "partially_applied",
  "applied",
  "partially_refunded",
  "refunded",
  "cancelled",
  "void",
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const SORT_OPTIONS = [
  { value: "issue_date:desc", label: "Issue Date (Newest)" },
  { value: "issue_date:asc", label: "Issue Date (Oldest)" },
  { value: "total:desc", label: "Amount (Highest)" },
  { value: "total:asc", label: "Amount (Lowest)" },
  { value: "credit_note_number:asc", label: "Credit Note # (A-Z)" },
  { value: "created_at:desc", label: "Created (Newest)" },
];

function getCreditNoteStatusColor(status: string): string {
  const config = creditNoteStatusConfig.getConfig(status);
  return config.className;
}

function getCreditNoteStatusLabel(status: string): string {
  const config = creditNoteStatusConfig.getConfig(status);
  return config.label;
}

interface CreditNoteKPIs {
  totalCreditNotes: number;
  totalCreditsIssued: string;
  totalCreditsApplied: string;
  remainingCredits: string;
}

export default function CreditNotes() {
  const { plan } = useSubscription();
  const navigate = useNavigate();
  const [creditNotes, setCreditNotes] = useState<ApiCreditNoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<CreditNoteKPIs | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortBy, setSortBy] = useState("issue_date:desc");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [creditNoteToVoid, setCreditNoteToVoid] = useState<ApiCreditNoteListItem | null>(null);

  const debouncedSetSearchTerm = useDebouncedCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSetSearchTerm(e.target.value);
  };

  const sortParts = useMemo(() => {
    const [field, order] = sortBy.split(":");
    return { field: field || "issue_date", order: (order === "asc" ? "asc" : "desc") as "asc" | "desc" };
  }, [sortBy]);

  const currentParams: CreditNoteSearchParams = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      search: searchTerm || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      customerId: customerFilter || undefined,
      sortBy: sortParts.field,
      sortOrder: sortParts.order,
      dateFrom: dateFilter || undefined,
    }),
    [page, pageSize, searchTerm, statusFilter, customerFilter, dateFilter, sortParts]
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

  const computeKpis = useCallback((notes: ApiCreditNoteListItem[]): CreditNoteKPIs => {
    const totalCreditNotes = notes.length;
    const totalCreditsIssued = notes.reduce(
      (sum, cn) => sum.plus(new Decimal(cn.total ?? 0)),
      new Decimal(0)
    );
    const totalCreditsApplied = notes.reduce(
      (sum, cn) => sum.plus(new Decimal(cn.applied_total ?? 0)),
      new Decimal(0)
    );
    const remainingCredits = totalCreditsIssued.minus(totalCreditsApplied);

    return {
      totalCreditNotes,
      totalCreditsIssued: totalCreditsIssued.toFixed(2),
      totalCreditsApplied: totalCreditsApplied.toFixed(2),
      remainingCredits: remainingCredits.isNegative() ? "0" : remainingCredits.toFixed(2),
    };
  }, []);

  useEffect(() => {
    loadCreditNotes(currentParams);
  }, [currentParams, loadCreditNotes]);

  useEffect(() => {
    if (creditNotes.length > 0 || !loading) {
      setKpis(computeKpis(creditNotes));
      setKpisLoading(false);
    }
  }, [creditNotes, loading, computeKpis]);

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  const totalPages = Math.ceil(total / pageSize) || 1;
  const commonCurrency = creditNotes.length > 0 ? creditNotes[0].currency : "USD";

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  }

  function handleNewCreditNote() {
    navigate("/app/credit-notes/new");
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setCustomerFilter("");
    setDateFilter("");
    setSortBy("issue_date:desc");
    setPage(1);
  }

  const hasActiveFilters = searchTerm || statusFilter !== "all" || customerFilter || dateFilter || sortBy !== "issue_date:desc";

  function formatDateRange(value: string): string {
    if (!value) return "All time";
    if (value === "this_month") return "This month";
    if (value === "last_30") return "Last 30 days";
    if (value === "last_90") return "Last 90 days";
    return value;
  }

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
        description={total !== 1 ? `${total} credit notes` : `${total} credit note`}
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

      {actionMessage && (
        <div
          className="rounded-lg border status-success-border status-success-bg px-3 py-2 text-sm status-success-text"
          role="status"
          aria-live="polite"
        >
          {actionMessage}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Credit Notes"
          value={kpis?.totalCreditNotes ?? 0}
          subtitle="All time"
          icon={<FileText className="w-5 h-5" />}
          iconBackground="status-info-bg status-info-text"
          variant="tinted"
          state="info"
          isLoading={kpisLoading}
        />
        <KPICard
          title="Total Credits Issued"
          value={kpis?.totalCreditsIssued ?? "0"}
          currency={commonCurrency}
          subtitle="Gross value of all issued credits"
          icon={<FileText className="w-5 h-5" />}
          iconBackground="status-tertiary-bg status-tertiary-text"
          variant="tinted"
          isLoading={kpisLoading}
        />
        <KPICard
          title="Credits Applied"
          value={kpis?.totalCreditsApplied ?? "0"}
          currency={commonCurrency}
          subtitle="Allocated to invoices"
          icon={<Copy className="w-5 h-5" />}
          iconBackground="status-success-bg status-success-text"
          variant="tinted"
          state="success"
          isLoading={kpisLoading}
        />
        <KPICard
          title="Credits Remaining"
          value={kpis?.remainingCredits ?? "0"}
          currency={commonCurrency}
          subtitle="Available to apply or refund"
          icon={<FileText className="w-5 h-5" />}
          iconBackground="status-warning-bg status-warning-text"
          variant="tinted"
          state="warning"
          isLoading={kpisLoading}
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
                placeholder="Credit note #, customer name, invoice #..."
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
              {CREDIT_NOTE_STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All Statuses" : getCreditNoteStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="filter-label">Issue Date</label>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="filter-select"
            >
              <option value="">All Time</option>
              <option value="this_month">This Month</option>
              <option value="last_30">Last 30 Days</option>
              <option value="last_90">Last 90 Days</option>
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
              <th className="th">Credit Note #</th>
              <th className="th">Customer</th>
              <th className="th">Original Invoice</th>
              <th className="th">Issue Date</th>
              <th className="th text-right">Credit Amount</th>
              <th className="th text-right">Applied</th>
              <th className="th text-right">Remaining</th>
              <th className="th text-center">Status</th>
              <th className="th text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {creditNotes.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16">
                  <div className="flex flex-col items-center justify-center text-center">
                    <FileText className="w-12 h-12 text-tertiary mb-4" />
                    <h3 className="text-lg font-medium text-primary mb-2">No credit notes yet</h3>
                    <p className="text-sm text-secondary max-w-md mb-6">
                      Credit notes document invoice reductions, returns, refunds, and billing adjustments.
                      Create one to get started.
                    </p>
                    {!hasActiveFilters && (
                      <Button
                        variant="primary"
                        size="md"
                        icon={<Plus className="w-4 h-4" />}
                        onClick={handleNewCreditNote}
                      >
                        Create your first credit note
                      </Button>
                    )}
                    {hasActiveFilters && (
                      <Button variant="secondary" size="md" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              creditNotes.map((cn) => {
                const remaining = new Decimal(cn.total ?? 0).minus(new Decimal(cn.applied_total ?? 0));
                const isCancelled = cn.status === "cancelled" || cn.status === "void";
                const remainingStr = remaining.isNegative() ? "0" : remaining.toFixed(2);

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
                        {isCancelled && (
                          <span className="text-xs text-tertiary mt-0.5">
                            {cn.status === "void" ? "Voided" : "Cancelled"}
                          </span>
                        )}
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
                    <td className="td text-sm text-secondary">
                      {cn.reference_invoice_number ? (
                        <Link
                          to={`/app/invoices/${cn.reference_invoice_number}`}
                          className="text-primary hover:text-primary-brand"
                        >
                          {cn.reference_invoice_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="td text-sm text-secondary font-tabular-nums">
                      {cn.issue_date ? new Date(cn.issue_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="td text-right text-sm font-medium text-primary font-tabular-nums">
                      {formatCurrency(cn.total, cn.currency)}
                    </td>
                    <td className="td text-right text-sm font-tabular-nums text-secondary">
                      {formatCurrency(cn.applied_total || "0", cn.currency)}
                    </td>
                    <td className="td text-right text-sm font-tabular-nums text-secondary">
                      {formatCurrency(remainingStr, cn.currency)}
                    </td>
                    <td className="td text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${getCreditNoteStatusColor(cn.status)}`}
                        title={creditNoteStatusConfig.getConfig(cn.status).description}
                      >
                        {getCreditNoteStatusLabel(cn.status)}
                      </span>
                    </td>
                    <td className="td text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link to={`/app/credit-notes/${cn.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<FileText className="w-3.5 h-3.5" />}
                            title="View"
                          />
                        </Link>
                        {cn.status === "draft" && (
                          <Link to={`/app/credit-notes/${cn.id}/edit`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Copy className="w-3.5 h-3.5" />}
                              title="Edit"
                            />
                          </Link>
                        )}
                        {cn.is_finalized && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Download className="w-3.5 h-3.5" />}
                            title="Download PDF"
                            onClick={() => {}}
                          />
                        )}
                        {(cn.status === "finalized" || cn.status === "sent") && !isCancelled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Send className="w-3.5 h-3.5" />}
                            title="Apply Credit"
                            onClick={() => {}}
                          />
                        )}
                        {cn.status !== "draft" && !isCancelled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<AlertCircle className="w-3.5 h-3.5" />}
                            title="Void"
                            onClick={() => {
                              setCreditNoteToVoid(cn);
                              setShowVoidDialog(true);
                            }}
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

      <ConfirmationDialog
        open={showVoidDialog}
        onClose={() => setShowVoidDialog(false)}
        onConfirm={() => {
          if (creditNoteToVoid) {
            setActionMessage(`Credit note ${creditNoteToVoid.credit_note_number || creditNoteToVoid.id.slice(0, 8)} voided.`);
            setShowVoidDialog(false);
            setCreditNoteToVoid(null);
          }
        }}
        title="Void Credit Note"
        message={creditNoteToVoid ? `Voiding "${creditNoteToVoid.credit_note_number || "this credit note"}" will permanently invalidate it. This action cannot be undone.` : ""}
        confirmLabel="Void Credit Note"
        destructive
      />
    </div>
  );
}
