import { useMemo } from "react";
import { FileText, Download } from "lucide-react";
import { DataTable, type ColumnDef, StatusBadge, invoiceStatusConfig } from "@/components/ui";
import type { ApiInvoicesReport, ApiInvoiceReportItem } from "@/types/api";
import { formatCurrencyValue } from "@/lib/utils";

interface InvoicesReportProps {
  data: ApiInvoicesReport | null;
  loading: boolean;
  currency: string;
  onExport: () => void;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  totalRows?: number;
  onSort?: (column: string) => void;
  sortColumn?: string | null;
  sortOrder?: "asc" | "desc";
}

export default function InvoicesReport({
  data,
  loading,
  currency,
  onExport,
  pageSize = 25,
  currentPage = 1,
  totalRows,
  onPageChange,
  onSort,
  sortColumn,
  sortOrder,
}: InvoicesReportProps) {
  const invoices = data?.invoices ?? [];
  const summary = data?.summary ?? null;

  const columns: ColumnDef<ApiInvoiceReportItem>[] = [
    {
      header: "Invoice",
      accessor: "invoice_number",
      cell: (row) => {
        const inv = row as ApiInvoiceReportItem;
        return (
          <span className="text-sm font-medium text-primary truncate max-w-[120px] block">
            {inv.invoice_number || `#${inv.id.slice(0, 8)}`}
          </span>
        );
      },
    },
    {
      header: "Customer",
      accessor: "customer_name",
      cell: (_row, value) => (
        <span className="text-sm text-secondary truncate max-w-[140px] block">
          {value ? String(value) : "—"}
        </span>
      ),
    },
    {
      header: "Status",
      accessor: "status",
      cell: (_row, value) => <StatusBadge status={value as string} config={invoiceStatusConfig} showLabel size="sm" />,
      sortable: false,
    },
    {
      header: "Issue Date",
      accessor: "issue_date",
      cell: (_row, value) => (
        <span className="text-sm text-secondary">
          {value ? new Date(value as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
        </span>
      ),
      sortable: false,
    },
    {
      header: "Due Date",
      accessor: "due_date",
      cell: (row) => {
        const inv = row as ApiInvoiceReportItem;
        const isOverdue = inv.days_overdue > 0;
        return (
          <span className={`text-sm ${isOverdue ? "text-error-text font-medium" : "text-secondary"}`}>
            {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
          </span>
        );
      },
      sortable: false,
    },
    {
      header: "Total",
      accessor: "total",
      align: "right",
      cell: (_row, value) => <span className="text-sm font-tabular-nums text-primary">{formatCurrencyValue(value as string | number | null | undefined, currency)}</span>,
    },
    {
      header: "Paid",
      accessor: "amount_paid",
      align: "right",
      cell: (_row, value) => <span className="text-sm font-tabular-nums text-success-text">{formatCurrencyValue(value as string | number | null | undefined, currency)}</span>,
    },
    {
      header: "Due",
      accessor: "amount_due",
      align: "right",
      cell: (_row, value) => <span className="text-sm font-tabular-nums text-warning-text">{formatCurrencyValue(value as string | number | null | undefined, currency)}</span>,
    },
  ];

  const statusBreakdown = summary?.statusBreakdown ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">Invoices Report</h2>
        <button
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-lg border border-color px-4 py-2.5 text-sm font-medium text-secondary hover:bg-surface-alt transition-colors min-h-[44px]"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          <ReportStatCard title="Total Invoices" value={summary.totalInvoices.toString()} icon={<FileText className="w-5 h-5" />} iconBg="bg-info-bg text-info-text" />
          <ReportStatCard title="Total Invoiced" value={formatCurrencyValue(summary.totalInvoiced, currency)} icon={<FileText className="w-5 h-5" />} iconBg="bg-success-bg text-success-text" subtitle={currency} />
          <ReportStatCard title="Total Paid" value={formatCurrencyValue(summary.totalPaid, currency)} icon={<FileText className="w-5 h-5" />} iconBg="bg-success-bg text-success-text" subtitle={currency} />
          <ReportStatCard title="Outstanding" value={formatCurrencyValue(summary.totalOutstanding, currency)} icon={<FileText className="w-5 h-5" />} iconBg="bg-warning-bg text-warning-text" subtitle={currency} />
          <ReportStatCard title="Overdue" value={formatCurrencyValue(summary.totalOverdue, currency)} icon={<FileText className="w-5 h-5" />} iconBg="bg-error-bg text-error-text" subtitle={currency} />
        </div>
      )}

      {statusBreakdown.length > 0 && (
        <div className="bg-surface rounded-xl border border-color p-5">
          <h3 className="text-sm font-semibold text-primary mb-3">Status Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {statusBreakdown.map((s) => (
              <div key={s.status} className="bg-surface-alt rounded-lg p-3 text-center">
                <StatusBadge status={s.status} config={invoiceStatusConfig} showLabel size="sm" />
                <div className="mt-1 text-xs text-tertiary">{s.count} invoices</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-color overflow-hidden">
        <DataTable
          columns={columns}
          data={invoices}
          totalRows={totalRows ?? invoices.length}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={onPageChange}
          onSort={onSort}
          sortColumn={sortColumn ?? null}
          sortOrder={sortOrder ?? "asc"}
          isLoading={loading}
          emptyMessage="No invoices match your filters"
          rowKey="id"
        />
      </div>
    </div>
  );
}

function ReportStatCard({
  title,
  value,
  subtitle,
  icon,
  iconBg,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-color p-4">
      <div className="flex items-center gap-2">
        <span className={`rounded-lg p-1.5 flex-shrink-0 ${iconBg}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-tertiary uppercase">{title}</p>
          <p className="text-lg font-bold text-primary truncate font-tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-tertiary">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
