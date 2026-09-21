import { forwardRef, type ComponentType } from "react";
import { cn } from "@/lib/utils";

export type InvoiceStatusType =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "void"
  | "pending"
  | "failed"
  | "refunded";

interface StatusConfig {
  label: string;
  color: "neutral" | "blue" | "purple" | "green" | "red" | "muted" | "warning";
  icon: ComponentType<{ className?: string }>;
  description: string;
}

const statusChart: Record<InvoiceStatusType, StatusConfig> = {
  draft: { label: "Draft", color: "neutral", description: "Invoice has not been sent to the customer.", icon: () => null },
  sent: { label: "Sent", color: "blue", description: "Invoice has been sent to the customer.", icon: () => null },
  viewed: { label: "Viewed", color: "blue", description: "Customer has viewed the invoice.", icon: () => null },
  partially_paid: { label: "Partially Paid", color: "warning", description: "Partial payment has been received.", icon: () => null },
  paid: { label: "Paid", color: "green", description: "Invoice has been fully paid.", icon: () => null },
  overdue: { label: "Overdue", color: "red", description: "Invoice is past its due date.", icon: () => null },
  cancelled: { label: "Cancelled", color: "muted", description: "Invoice has been cancelled.", icon: () => null },
  void: { label: "Void", color: "muted", description: "Invoice has been voided.", icon: () => null },
  pending: { label: "Pending", color: "blue", description: "Invoice is awaiting processing.", icon: () => null },
  failed: { label: "Failed", color: "red", description: "Invoice payment failed.", icon: () => null },
  refunded: { label: "Refunded", color: "muted", description: "Invoice has been refunded.", icon: () => null },
};

const colorClasses: Record<StatusConfig["color"], string> = {
  neutral: "status-warning-bg status-warning-text",
  blue: "status-info-bg status-info-text",
  purple: "status-info-bg status-info-text",
  green: "status-success-bg status-success-text",
  red: "status-error-bg status-error-text",
  muted: "status-tertiary-bg status-tertiary-text",
  warning: "status-warning-bg status-warning-text",
};

export interface InvoiceStatusProps {
  status: InvoiceStatusType | (string & {});
  isOverdue?: boolean;
  showIcon?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function getStatusConfig(status: string): StatusConfig {
  return statusChart[status as InvoiceStatusType] ?? statusChart.draft;
}

export function isOverdueStatus(status: string, dueDate?: string | null): boolean {
  if (status === "overdue") return true;
  if (status === "paid" || status === "void" || status === "cancelled") return false;
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

export const InvoiceStatus = forwardRef<HTMLSpanElement, InvoiceStatusProps>(
  function InvoiceStatus(
    { status, isOverdue, showIcon = false, showLabel = true, size = "md", className },
    ref
  ) {
    const effectiveStatus = isOverdue && status !== "paid" ? "overdue" : status;
    const config = getStatusConfig(effectiveStatus);
    const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-xs";
    const iconClass = size === "sm" ? "w-3 h-3" : "w-4 h-4";

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-medium",
          colorClasses[config.color],
          sizeClasses,
          className
        )}
        title={config.description}
        aria-label={`${status} ${config.description}`}
      >
        {showIcon && config.icon && <config.icon className={iconClass} aria-hidden="true" />}
        {showLabel && config.label}
      </span>
    );
  }
);

export default InvoiceStatus;
