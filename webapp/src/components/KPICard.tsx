import type { ReactNode } from "react";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  iconBackground: string;
  trend?: { value: string; direction: "up" | "down" };
}

export default function KPICard({ title, value, subtitle, icon, iconBackground, trend }: KPICardProps) {
  return (
    <div className="bg-surface rounded-xl border border-color p-5 shadow hover:border-color-strong transition-colors">
      <div className="flex items-center gap-3">
        <span className={`rounded-lg p-2 flex-shrink-0 ${iconBackground}`} aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-tertiary uppercase tracking-wide">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-primary truncate">{value}</p>
          {(subtitle || trend) && (
            <div className="flex items-center gap-2 mt-1">
              {subtitle && <p className="text-xs text-tertiary truncate">{subtitle}</p>}
              {trend && (
                <span
                  className={`text-xs font-medium flex items-center gap-0.5 ${
                    trend.direction === "up" ? "text-success-text" : "text-error-text"
                  }`}
                >
                  {trend.direction === "up" ? "↑" : "↓"} {trend.value}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
