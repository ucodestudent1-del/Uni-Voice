import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from "recharts";

interface StatusSegment {
  label: string;
  value: number;
  color: string;
}

interface StatusBreakdownProps {
  data?: StatusSegment[];
}

const defaultSegments: StatusSegment[] = [
  { label: "Draft", value: 3, color: "#94a3b8" },
  { label: "Sent", value: 7, color: "#3b82f6" },
  { label: "Viewed", value: 4, color: "#6366f1" },
  { label: "Paid", value: 23, color: "#22c55e" },
  { label: "Overdue", value: 2, color: "#ef4444" },
];

export default function StatusBreakdown({ data }: StatusBreakdownProps) {
  const segments = data ?? defaultSegments;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Invoice Status</h3>

      <div className="relative h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segments}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={65}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {segments.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => {
                const segment = segments.find((s) => s.label === name);
                const pct = total > 0 ? Math.round((Number(value) / total) * 100) : 0;
                return [`${value} (${pct}%)`, name];
              }}
              contentStyle={{
                background: "#0f172a",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "12px",
                padding: "8px 12px",
              }}
            />
            <Label
              value={total}
              position="center"
              style={{
                fontSize: "24px",
                fontWeight: 700,
                fill: "#0f172a",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 space-y-1">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between py-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: segment.color }} />
              <span className="text-slate-600">{segment.label}</span>
            </div>
            <span className="font-medium text-slate-900">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
