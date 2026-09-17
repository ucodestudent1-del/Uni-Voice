import { useState, useMemo } from "react";
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

const palette = {
  revenue: "#0284c7",
  payments: "#16a34a",
};

function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value}`;
}

export default function RevenueChart() {
  const [timeframe, setTimeframe] = useState<Timeframe>("30");
  const [data, setData] = useState<ApiVolumeTrend[] | null>(null);

  useMemo(() => {
    (async () => {
      try {
        const res = await getVolumeTrendReport({ period: "day", months: Number(timeframe) === 30 ? 1 : Number(timeframe) === 90 ? 3 : 12 });
        setData(res.data ?? res);
      } catch {
        setData(null);
      }
    })();
  }, [timeframe]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((d) => ({
      period: d.period,
      revenue: Number(d.invoiced),
      payments: Number(d.paid),
    }));
  }, [data]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-slate-900">Revenue & Payment Trends</h3>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
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
                  ? "bg-primary-50 text-primary-700"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={palette.revenue} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={palette.revenue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPayments" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={palette.payments} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={palette.payments} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
                minTickGap={30}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatCurrencyCompact(v)}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "12px",
                  padding: "8px 12px",
                }}
                formatter={(value) => [formatCurrencyCompact(Number(value) ?? 0), ""]}
                labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                iconType="circle"
                iconSize={8}
                verticalAlign="top"
                align="right"
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={palette.revenue}
                strokeWidth={2}
                fill="url(#colorRevenue)"
                name="Revenue"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="payments"
                stroke={palette.payments}
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
        <div className="h-64 flex items-center justify-center border border-dashed border-slate-300 rounded-lg">
          <p className="text-sm text-slate-400">No data available</p>
        </div>
      )}
    </div>
  );
}
