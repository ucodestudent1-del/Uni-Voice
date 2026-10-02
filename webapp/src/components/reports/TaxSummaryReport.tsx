import { useMemo } from "react";
import { Receipt, Download } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { KPICard } from "@/components/ui";
import type { ApiTaxSummaryReport } from "@/types/api";
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

interface TaxSummaryReportProps {
  data: ApiTaxSummaryReport | null;
  loading: boolean;
  currency: string;
  onExport: () => void;
}

export default function TaxSummaryReport({ data, loading, currency, onExport }: TaxSummaryReportProps) {
  const byPeriod = data?.byPeriod ?? [];
  const byRate = data?.byRate ?? [];
  const summary = data?.summary ?? null;

  const periodChartData = useMemo(() => {
    return byPeriod.map((p) => ({
      period: p.period,
      tax: Number(p.tax_collected),
      taxable: Number(p.taxable_amount),
      count: p.invoice_count,
    }));
  }, [byPeriod]);

  const rateChartData = useMemo(() => {
    return byRate.map((r) => ({
      rate: `${Number(r.rate).toFixed(0)}%`,
      name: r.name,
      tax: Number(r.tax_collected),
      taxable: Number(r.taxable_basis),
      count: r.invoice_count,
    }));
  }, [byRate]);

  const totalTaxCollected = useMemo(() => {
    return byPeriod.reduce((sum, p) => sum + Number(p.tax_collected), 0);
  }, [byPeriod]);

  const totalTaxable = useMemo(() => {
    return byPeriod.reduce((sum, p) => sum + Number(p.taxable_amount), 0);
  }, [byPeriod]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-color p-5 h-24" />
          ))}
        </div>
        <div className="h-64 bg-surface rounded-xl border border-color" />
        <div className="h-64 bg-surface rounded-xl border border-color" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-secondary">
        <Receipt className="w-12 h-12 text-tertiary mx-auto mb-3" />
        <p>No tax data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">Tax Summary</h2>
        <button
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-lg border border-color px-4 py-2.5 text-sm font-medium text-secondary hover:bg-surface-alt transition-colors min-h-[44px]"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KPICard
          title="Tax Collected"
          value={summary?.totalTaxCollected ?? "0"}
          currency={currency}
          subtitle="Total sales tax"
          icon={<Receipt className="w-5 h-5" />}
          iconBackground="bg-info-bg text-info-text"
        />
        <KPICard
          title="Taxable Amount"
          value={summary?.totalTaxableAmount ?? "0"}
          currency={currency}
          subtitle="Net taxable sales"
          icon={<Receipt className="w-5 h-5" />}
          iconBackground="bg-success-bg text-success-text"
        />
        <KPICard
          title="Invoices Taxed"
          value={byPeriod.reduce((sum, p) => sum + p.invoice_count, 0)}
          subtitle="Invoiced with tax"
          icon={<Receipt className="w-5 h-5" />}
          iconBackground="bg-warning-bg text-warning-text"
        />
      </div>

      <div className="bg-surface rounded-xl border border-color p-5">
        <h3 className="text-sm font-semibold text-primary mb-4">Tax Collected by Month</h3>
        {periodChartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="taxBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(59 130 246)" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="rgb(59 130 246)" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-color-subtle" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 12, fill: "rgb(var(--chart-text))" }}
                  tickLine={false}
                  axisLine={{ stroke: "rgb(var(--chart-border))" }}
                  minTickGap={15}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "rgb(var(--chart-text))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCurrencyCompact(v, currency)}
                  width={60}
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
                  formatter={(value, name) => [formatCurrencyCompact(Number(value ?? 0), currency), name]}
                  labelStyle={{ color: "rgb(var(--chart-text-secondary))", marginBottom: "4px" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px", color: "rgb(var(--chart-text-secondary))" }}
                    iconType="circle"
                    iconSize={8}
                    verticalAlign="top"
                    align="right"
                  />
                  <Bar dataKey="tax" name="Tax Collected" fill="url(#taxBar)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center border border-dashed border-color-subtle rounded-lg">
              <p className="text-sm text-tertiary">No tax data for this period</p>
            </div>
          )}
        </div>

      {byRate.length > 0 && (
        <div className="bg-surface rounded-xl border border-color overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-sm font-semibold text-primary">Tax by Rate</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-alt border-b border-color">
                   <th className="text-left text-xs font-medium text-secondary uppercase py-3.5 px-4">Rate</th>
                   <th className="text-left text-xs font-medium text-secondary uppercase py-3.5 px-4">Name</th>
                   <th className="text-right text-xs font-medium text-secondary uppercase py-3.5 px-4">Taxable Basis</th>
                   <th className="text-right text-xs font-medium text-secondary uppercase py-3.5 px-4">Tax Collected</th>
                   <th className="text-right text-xs font-medium text-secondary uppercase py-3.5 px-4">Invoices</th>
                </tr>
              </thead>
              <tbody>
                {byRate.map((r) => (
                  <tr key={r.rate} className="border-b border-color-subtle last:border-b-0 hover:bg-surface-alt">
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-primary">{Number(r.rate).toFixed(0)}%</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-secondary">{r.name}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-tabular-nums text-secondary">
                      {formatCurrencyValue(r.taxable_basis, currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-tabular-nums text-primary">
                      {formatCurrencyValue(r.tax_collected, currency)}
                    </td>
                   <td className="py-3.5 px-4 text-right text-sm text-secondary">{r.invoice_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {byPeriod.length > 0 && (
        <div className="bg-surface rounded-xl border border-color overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-sm font-semibold text-primary">Monthly Tax Detail</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-alt border-b border-color">
                   <th className="text-left text-xs font-medium text-secondary uppercase py-3.5 px-4">Month</th>
                   <th className="text-right text-xs font-medium text-secondary uppercase py-3.5 px-4">Taxable Amount</th>
                   <th className="text-right text-xs font-medium text-secondary uppercase py-3.5 px-4">Tax Collected</th>
                   <th className="text-right text-xs font-medium text-secondary uppercase py-3.5 px-4">Invoices</th>
                </tr>
              </thead>
              <tbody>
                {byPeriod.map((p) => (
                  <tr key={p.period} className="border-b border-color-subtle last:border-b-0 hover:bg-surface-alt">
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-primary">{p.period}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-tabular-nums text-secondary">
                      {formatCurrencyValue(p.taxable_amount, currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-tabular-nums text-primary">
                      {formatCurrencyValue(p.tax_collected, currency)}
                    </td>
                     <td className="py-3.5 px-4 text-right text-sm text-secondary">{p.invoice_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
