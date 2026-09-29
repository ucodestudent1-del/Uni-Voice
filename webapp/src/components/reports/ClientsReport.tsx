import { useMemo } from "react";
import { Users, Download } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { DataTable, type ColumnDef, KPICard } from "@/components/ui";
import type { ApiClientsReport, ApiClientReportItem } from "@/types/api";
import { formatCurrencyValue } from "@/lib/utils";

function formatCurrencyCompact(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `$${value}`;
  }
}

const STATUS_COLORS = [
  "rgb(59 130 246)",
  "rgb(37 99 232)",
  "rgb(168 185 230)",
  "rgb(100 116 139)",
  "rgb(245 158 11)",
];

interface ClientsReportProps {
  data: ApiClientsReport | null;
  loading: boolean;
  currency: string;
  onExport: () => void;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  totalRows?: number;
}

export default function ClientsReport({
  data,
  loading,
  currency,
  onExport,
  pageSize = 25,
  currentPage = 1,
  totalRows,
  onPageChange,
}: ClientsReportProps) {
  const clients = data?.clients ?? [];
  const summary = data?.summary ?? null;

  const columns: ColumnDef<ApiClientReportItem>[] = [
    {
      header: "Client",
      accessor: "name",
      cell: (row) => {
        const c = row as ApiClientReportItem;
        return (
          <div className="flex flex-col min-w-[120px]">
            <span className="text-sm font-medium text-primary truncate">
              {c.name || "—"}
            </span>
            {c.company_name && (
              <span className="text-xs text-tertiary truncate">{c.company_name}</span>
            )}
          </div>
        );
      },
    },
    {
      header: "Email",
      accessor: "email",
      cell: (_row, value) => (
        <span className="text-sm text-secondary truncate max-w-[160px] block">
          {value ? String(value) : "—"}
        </span>
      ),
    },
    {
      header: "Country",
      accessor: "country_code",
      cell: (_row, value) => (
        <span className="text-sm text-secondary">{value ? String(value).toUpperCase() : "—"}</span>
      ),
    },
    {
      header: "Invoices",
      accessor: "invoice_count",
      align: "right",
      cell: (_row, value) => <span className="text-sm text-primary">{(value as number | null | undefined) ?? 0}</span>,
    },
    {
      header: "Total Invoiced",
      accessor: "total_invoiced",
      align: "right",
      cell: (_row, value) => <span className="text-sm font-tabular-nums text-primary">{formatCurrencyValue(value as string | number | null | undefined, currency)}</span>,
    },
    {
      header: "Total Paid",
      accessor: "total_paid",
      align: "right",
      cell: (_row, value) => <span className="text-sm font-tabular-nums text-success-text">{formatCurrencyValue(value as string | number | null | undefined, currency)}</span>,
    },
    {
      header: "Outstanding",
      accessor: "total_outstanding",
      align: "right",
      cell: (_row, value) => <span className="text-sm font-tabular-nums text-warning-text">{formatCurrencyValue(value as string | number | null | undefined, currency)}</span>,
    },
  ];

  const topClientsData = useMemo(() => {
    return clients.slice(0, 10).map((c, i) => ({
      name: c.name.length > 16 ? c.name.slice(0, 16) + "..." : c.name,
      invoiced: Number(c.total_invoiced),
      color: STATUS_COLORS[i % STATUS_COLORS.length],
    }));
  }, [clients]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-color p-5 h-24" />
          ))}
        </div>
        <div className="h-64 bg-surface rounded-xl border border-color" />
        <div className="h-96 bg-surface rounded-xl border border-color" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-secondary">
        <Users className="w-12 h-12 text-tertiary mx-auto mb-3" />
        <p>No client data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">Clients Report</h2>
        <button
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-lg border border-color px-4 py-2.5 text-sm font-medium text-secondary hover:bg-surface-alt transition-colors min-h-[44px]"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KPICard
            title="Total Clients"
            value={summary.totalClients.toString()}
            subtitle="Active customers"
            icon={<Users className="w-5 h-5" />}
            iconBackground="bg-info-bg text-info-text"
          />
          <KPICard
            title="Total Invoiced"
            value={summary.totalInvoiced}
            currency={currency}
            subtitle={`Avg: ${formatCurrencyValue(summary.averageInvoiceValue, currency)}`}
            icon={<Users className="w-5 h-5" />}
            iconBackground="bg-success-bg text-success-text"
          />
          <KPICard
            title="Total Paid"
            value={summary.totalPaid}
            currency={currency}
            subtitle="Payments received"
            icon={<Users className="w-5 h-5" />}
            iconBackground="bg-success-bg text-success-text"
          />
          <KPICard
            title="Outstanding"
            value={summary.totalOutstanding}
            currency={currency}
            subtitle="Unpaid receivables"
            icon={<Users className="w-5 h-5" />}
            iconBackground="bg-warning-bg text-warning-text"
          />
        </div>
      )}

      <div className="bg-surface rounded-xl border border-color p-5">
        <h3 className="text-sm font-semibold text-primary mb-4">Top 10 Clients by Revenue</h3>
        {topClientsData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topClientsData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="clientBar" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="5%" stopColor="rgb(59 130 246)" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="rgb(59 130 246)" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-color-subtle" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "rgb(var(--chart-text))" }}
                  tickLine={false}
                  axisLine={{ stroke: "rgb(var(--chart-border))" }}
                  tickFormatter={(v) => formatCurrencyCompact(v, currency)}
                  width={60}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "rgb(var(--chart-text))" }}
                  tickLine={false}
                  axisLine={false}
                  width={140}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgb(var(--color-surface))",
                    border: "none",
                    borderRadius: "8px",
                    color: "rgb(var(--color-text))",
                    fontSize: "12px",
                    padding: "8px 12px",
                  }}
                  formatter={(value) => [formatCurrencyCompact(Number(value ?? 0), currency), "Invoiced"]}
                  labelStyle={{ color: "rgb(var(--chart-text-secondary))", marginBottom: "4px" }}
                  />
                  <Bar dataKey="invoiced" name="Invoiced" radius={[0, 4, 4, 0]}>
                    {topClientsData.map((_entry, index) => (
                      <Cell key={`client-cell-${index}`} fill={topClientsData[index].color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center border border-dashed border-color-subtle rounded-lg">
              <p className="text-sm text-tertiary">No client data</p>
            </div>
          )}
        </div>

      <div className="bg-surface rounded-xl border border-color overflow-hidden">
        <DataTable
          columns={columns}
          data={clients}
          totalRows={totalRows ?? clients.length}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={onPageChange}
          isLoading={loading}
          emptyMessage="No clients match your filters"
          rowKey="id"
        />
      </div>
    </div>
  );
}
