import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from "recharts";

interface PaymentStatusSegment {
  label: string;
  value: number;
  color: string;
}

interface PaymentStatusPieProps {
  data?: PaymentStatusSegment[];
}

export default function PaymentStatusPie({ data = [] }: PaymentStatusPieProps) {
  const segments = data.filter((segment) => segment.value > 0);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="bg-surface rounded-xl border border-color p-5">
      <h3 className="text-sm font-semibold text-primary mb-4">Payment Status</h3>

      {total === 0 ? (
        <div className="h-40 flex items-center justify-center border border-dashed border-color-subtle rounded-lg">
          <p className="text-sm text-tertiary">No invoices yet</p>
        </div>
      ) : (
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
                  background: "rgb(var(--color-surface))",
                  border: "none",
                  borderRadius: "8px",
                  color: "rgb(var(--color-text))",
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
                  fill: "rgb(var(--color-text))",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 space-y-1">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between py-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: segment.color }} />
              <span className="text-secondary">{segment.label}</span>
            </div>
            <span className="font-medium text-primary">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
