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
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-premium hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
      <div className="flex items-center gap-3">
        <span className={`rounded-lg p-2 flex-shrink-0 ${iconBackground}`} aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 truncate">{value}</p>
          {(subtitle || trend) && (
            <div className="flex items-center gap-2 mt-1">
              {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
              {trend && (
                <span
                  className={`text-xs font-medium flex items-center gap-0.5 ${
                    trend.direction === "up" ? "text-green-600" : "text-red-600"
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
