import { forwardRef } from "react";
import type { ReactNode } from "react";
import { Decimal } from "decimal.js";
import { cn } from "@/lib/utils";
import { formatCurrencyValue } from "@/lib/utils";

export type KpiCardVariant = "default" | "stat" | "inline" | "tinted" | "trend";

export type KpiCardState = "default" | "success" | "warning" | "error" | "info";

export interface SparklinePoint {
  value: number;
}

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  iconBackground?: string;
  currency?: string;
  trend?: { value: string; direction: "up" | "down" };
  isLoading?: boolean;
  variant?: KpiCardVariant;
  state?: KpiCardState;
  progressPct?: number;
  sparkline?: SparklinePoint[];
  sparklineColor?: string;
  className?: string;
}

const stateTintClasses: Record<KpiCardState, string> = {
  default: "bg-surface",
  success: "bg-success-bg",
  warning: "bg-warning-bg",
  error: "bg-error-bg",
  info: "bg-info-bg",
};

const stateBorderClasses: Record<KpiCardState, string> = {
  default: "border-color",
  success: "border-success-border",
  warning: "border-warning-border",
  error: "border-error-border",
  info: "border-info-border",
};

function formatValue(value: string | number, currency: string, hasTrend: boolean): string {
  const d = new Decimal(value ?? 0);
  if (d.isZero() && !hasTrend) return "—";
  return formatCurrencyValue(value, currency);
}

function Sparkline({ points, color }: { points: SparklinePoint[]; color: string }) {
  if (points.length < 2) return null;
  const maxVal = Math.max(...points.map((p) => p.value));
  if (maxVal === 0) return null;
  const w = (points.length - 1) * 4;
  const h = 16;
  const coords = points
    .map((p, i) => `${(i * w) / (points.length - 1)},${h - (p.value / maxVal) * h}`)
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="inline-block"
      aria-hidden="true"
    >
      <polyline
        points={coords}
        fill="none"
        strokeWidth={1.5}
        stroke={color}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const KPICard = forwardRef<HTMLDivElement, KPICardProps>(
  function KPICard(
    {
      title,
      value,
      subtitle,
      icon,
      iconBackground,
      currency = "USD",
      trend,
      isLoading = false,
      variant = "default",
      state = "default",
      progressPct,
      sparkline,
      sparklineColor,
      className,
    },
    ref
  ) {
    const hasTrend = !!trend;
    const formatted = formatValue(value, currency, hasTrend);

    const iconBoxClass = iconBackground ?? "bg-surface-alt text-tertiary";

    const cardClasses = cn(
      "rounded-xl border p-5 shadow-sm transition-colors",
      stateBorderClasses[state],
      variant === "tinted" ? stateTintClasses[state] : "bg-surface",
      className
    );

    const valueColorClass =
      state === "success"
        ? "text-success-text"
        : state === "warning"
          ? "text-warning-text"
          : state === "error"
            ? "text-error-text"
            : state === "info"
              ? "text-info-text"
              : "text-primary";

    function renderTrend() {
      if (!trend) return null;
      return (
        <span
          className={cn(
            "text-xs font-medium flex items-center gap-0.5",
            trend.direction === "up" ? "text-error-text" : "text-success-text"
          )}
        >
          {trend.direction === "up" ? "↑" : "↓"} {trend.value}
        </span>
      );
    }

    function renderSparkline() {
      if (!sparkline || sparkline.length < 2) return null;
      return (
        <Sparkline
          points={sparkline}
          color={sparklineColor ?? "rgb(var(--color-primary))"}
        />
      );
    }

    if (variant === "inline") {
      return (
        <div ref={ref} className={cardClasses}>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-lg p-2 flex-shrink-0 ${iconBoxClass}`}
              aria-hidden="true"
            >
              {icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-tertiary uppercase tracking-wide">
                {title}
              </p>
              {isLoading ? (
                <div className="h-5 w-20 bg-surface-alt rounded mt-1 animate-pulse" />
              ) : (
                <p className="text-lg font-bold text-primary truncate font-tabular-nums">
                  {formatted}
                </p>
              )}
              {subtitle && !isLoading && (
                <p className="text-xs text-tertiary truncate">{subtitle}</p>
              )}
            </div>
            {(trend || sparkline) && !isLoading && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {renderSparkline()}
                {renderTrend()}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (variant === "tinted") {
      return (
        <div ref={ref} className={cn(cardClasses, "border-none")}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-medium text-tertiary uppercase tracking-wide">
              {title}
            </p>
            <span
              className={`rounded-lg p-1.5 flex-shrink-0 ${iconBoxClass}`}
              aria-hidden="true"
            >
              {icon}
            </span>
          </div>
          {isLoading ? (
            <div className="h-8 w-32 bg-surface-alt/50 rounded mt-1 animate-pulse" />
          ) : (
            <p className={`text-3xl sm:text-4xl font-bold font-tabular-nums truncate ${valueColorClass}`}>
              {formatted}
            </p>
          )}
          {subtitle && !isLoading && (
            <p className="text-xs text-tertiary mt-1 truncate">{subtitle}</p>
          )}
        </div>
      );
    }

    if (variant === "stat") {
      return (
        <div ref={ref} className={cardClasses}>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-medium text-tertiary uppercase tracking-wide">
              {title}
            </p>
            <span
              className={`rounded-lg p-1.5 flex-shrink-0 ${iconBoxClass}`}
              aria-hidden="true"
            >
              {icon}
            </span>
          </div>
          {isLoading ? (
            <div className="h-9 w-36 bg-surface-alt rounded mt-1 animate-pulse" />
          ) : (
            <p className="text-3xl font-bold font-tabular-nums truncate">
              {formatted}
            </p>
          )}
          {subtitle && !isLoading && (
            <p className="text-sm text-tertiary mt-1 truncate">{subtitle}</p>
          )}
          {progressPct !== undefined && !isLoading && (
            <div className="mt-3 h-2 w-full bg-surface-alt rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, progressPct))}%`,
                  backgroundColor: sparklineColor ?? "rgb(var(--color-primary))",
                }}
                aria-label={`${Math.round(progressPct)}% progress`}
              />
            </div>
          )}
        </div>
      );
    }

    if (variant === "trend") {
      return (
        <div ref={ref} className={cardClasses}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-xs font-medium text-tertiary uppercase tracking-wide flex items-center gap-1.5">
              {icon}
              {title}
            </p>
            {hasTrend && renderTrend()}
          </div>
          {isLoading ? (
            <div className="h-9 w-36 bg-surface-alt rounded mt-1 animate-pulse" />
          ) : (
            <p className="text-3xl font-bold font-tabular-nums truncate">
              {formatted}
            </p>
          )}
          {subtitle && !isLoading && (
            <p className="text-sm text-tertiary truncate">{subtitle}</p>
          )}
          {!isLoading && (
            <div className="mt-2 flex items-center gap-2">
              {renderSparkline()}
            </div>
          )}
        </div>
      );
    }

    // Default variant — original layout preserved
    return (
      <div
        ref={ref}
        className="bg-surface rounded-xl border border-color p-5 shadow hover:border-color-strong transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className={`rounded-lg p-2 flex-shrink-0 ${iconBackground ?? "bg-surface-alt text-tertiary"}`}
            aria-hidden="true"
          >
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-tertiary uppercase tracking-wide">
              {title}
            </p>
            {isLoading ? (
              <div className="h-7 w-32 bg-surface-alt rounded mt-1 animate-pulse" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-primary truncate font-tabular-nums">
                {formatted}
              </p>
            )}
            {(subtitle || trend) && (
              <div className="flex items-center gap-2 mt-1">
                {subtitle && (
                  <p className="text-xs text-tertiary truncate">{subtitle}</p>
                )}
                {hasTrend && renderTrend()}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

KPICard.displayName = "KPICard";

export default KPICard;
