import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getVolumeTrendReport } from "../../api/client";
import type { ApiVolumeTrend } from "../../types/api";

type Timeframe = "30" | "90" | "365";

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

export default function RevenueChart({ currency = "USD" }: { currency?: string }) {
  const [timeframe, setTimeframe] = useState<Timeframe>("30");
  const [data, setData] = useState<ApiVolumeTrend[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const months = Number(timeframe) === 30 ? 1 : Number(timeframe) === 90 ? 3 : 12;

    getVolumeTrendReport({ period: "day", months })
      .then((res) => {
        const result = Array.isArray(res) ? res : res.data ?? res;
        if (!cancelled) setData(Array.isArray(result) ? result : []);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError("Could not load revenue trends");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [timeframe, retryKey]);

  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.map((d) => ({
      period: d.period,
      revenue: Number(d.invoiced),
      payments: Number(d.paid),
    }));
  }, [data]);

  return (
    <div className="bg-surface rounded-xl border border-color p-5">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-primary">Revenue & Payment Trends</h3>
        <div className="inline-flex rounded-lg border border-color overflow-hidden">
          {([
            { key: "30", label: "30 Days" },
            { key: "90", label: "90 Days" },
            { key: "365", label: "12 Months" },
          ] as { key: Timeframe; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTimeframe(t.key)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                timeframe === t.key
                  ? "bg-primary-bg text-on-primary"
                  : "text-tertiary hover:text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center border border-dashed border-color-subtle rounded-lg">
          <p className="text-sm text-tertiary">Loading trends...</p>
        </div>
      ) : error ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 border border-dashed border-error-border rounded-lg">
          <p className="text-sm text-error-text">{error}</p>
          <button
            onClick={() => setRetryKey((key) => key + 1)}
            className="rounded-lg bg-primary-action px-3 py-2 text-xs font-medium text-on-primary hover:bg-primary-hover"
          >
            Try again
          </button>
        </div>
      ) : chartData.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-revenue)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--chart-revenue)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPayments" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-payments)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--chart-payments)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-color-subtle" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 12, fill: "rgb(var(--chart-text))" }}
                tickLine={false}
                axisLine={{ stroke: "rgb(var(--chart-border))" }}
                minTickGap={30}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "rgb(var(--chart-text))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatCurrencyCompact(v, currency)}
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
                formatter={(value) => [formatCurrencyCompact(Number(value) ?? 0, currency), ""]}
                labelStyle={{ color: "rgb(var(--chart-text-secondary))", marginBottom: "4px" }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px", color: "rgb(var(--chart-text-secondary))" }}
                iconType="circle"
                iconSize={8}
                verticalAlign="top"
                align="right"
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--chart-revenue)"
                strokeWidth={2}
                fill="url(#colorRevenue)"
                name="Revenue"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="payments"
                stroke="var(--chart-payments)"
                strokeWidth={2}
                fill="url(#colorPayments)"
                name="Payments"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center border border-dashed border-color-subtle rounded-lg">
          <p className="text-sm text-tertiary">No data available</p>
        </div>
      )}
    </div>
  );
}
