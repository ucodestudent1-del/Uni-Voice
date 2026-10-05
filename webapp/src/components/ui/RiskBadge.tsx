import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type RiskLevel = "low" | "medium" | "high" | "critical" | "none";

export interface RiskBadgeProps {
  score: number | null | undefined;
  showScore?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function getRiskLevel(score: number | null | undefined): RiskLevel {
  if (score === null || score === undefined) return "none";
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  if (score >= 1) return "low";
  return "low";
}

export function getRiskLabel(score: number | null | undefined): string {
  if (score === null || score === undefined || score === 0) return "No Risk";
  return `${score}/100`;
}

const riskClasses: Record<RiskLevel, string> = {
  none: "status-tertiary-bg status-tertiary-text",
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export const RiskBadge = forwardRef<HTMLSpanElement, RiskBadgeProps>(
  function RiskBadge(
    {
      score,
      showScore = true,
      showLabel = true,
      size = "md",
      className,
    },
    ref
  ) {
    const level = getRiskLevel(score);
    const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-medium",
          riskClasses[level],
          sizeClasses,
          className
        )}
        title={getRiskLabel(score)}
        aria-label={`Payment risk score ${score ?? "not scored"}`}
      >
        {showScore && score !== null && score !== undefined && score > 0 && (
          <span
            className={cn(
              "inline-flex items-center justify-center rounded-full font-semibold",
              level === "critical" ? "bg-red-800 text-white" :
              level === "high" ? "bg-orange-800 text-white" :
              level === "medium" ? "bg-amber-800 text-white" :
              level === "low" ? "bg-green-800 text-white" :
              "bg-gray-400 text-white"
            )}
            style={{ width: size === "sm" ? "1rem" : "1.125rem", height: size === "sm" ? "1rem" : "1.125rem" }}
          >
            {score}
          </span>
        )}
        {showLabel && (
          <span>{getRiskLabel(score)}</span>
        )}
      </span>
    );
  }
);

RiskBadge.displayName = "RiskBadge";

export default RiskBadge;
