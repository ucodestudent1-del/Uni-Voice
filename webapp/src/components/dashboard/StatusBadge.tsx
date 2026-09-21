import type { ReactNode } from "react";

interface StatusBadgeProps {
  status: string;
  isOverdue?: boolean;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "status-warning-bg status-warning-text" },
  sent: { label: "Sent", className: "status-info-bg status-info-text" },
  viewed: { label: "Viewed", className: "status-info-bg status-info-text" },
  partially_paid: { label: "Partially Paid", className: "status-warning-bg status-warning-text" },
  paid: { label: "Paid", className: "status-success-bg status-success-text" },
  overdue: { label: "Overdue", className: "status-error-bg status-error-text" },
  cancelled: { label: "Cancelled", className: "status-tertiary-bg status-tertiary-text" },
  void: { label: "Void", className: "status-tertiary-bg status-tertiary-text" },
};

export default function StatusBadge({ status, isOverdue, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.draft;
  const effectiveStatus = isOverdue && status !== "paid" ? "overdue" : status;
  const effectiveConfig = statusConfig[effectiveStatus] ?? config;
  const baseClasses = `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${effectiveConfig.className}`;
  return className ? <span className={`${baseClasses} ${className}`}>{effectiveConfig.label}</span> : <span className={baseClasses}>{effectiveConfig.label}</span>;
}

export { statusConfig };
export function statusColors(status: string): string {
  return statusConfig[status]?.className ?? statusConfig.draft.className;
}
