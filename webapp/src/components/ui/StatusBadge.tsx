import { forwardRef, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import type { StatusBadgeProps, StatusConfig } from "@/types/components";

export type { StatusBadgeProps, StatusConfig };

interface InternalStatusConfig extends StatusConfig {
  icon?: ComponentType<{ className?: string }>;
}

type StatusConfigRecord = Record<string, InternalStatusConfig>;

interface StatusBadgeConfig {
  getConfig: (status: string) => InternalStatusConfig;
  configs: StatusConfigRecord;
}

export function createStatusBadgeConfig(configs: StatusConfigRecord, defaultKey: string): StatusBadgeConfig {
  return {
    getConfig: (status: string): InternalStatusConfig => {
      return configs[status] ?? configs[defaultKey];
    },
    configs,
  };
}

export const invoiceStatusConfig = createStatusBadgeConfig(
  {
    draft: { label: "Draft", className: "status-warning-bg status-warning-text", description: "Invoice has not been sent to the customer." },
    sent: { label: "Sent", className: "status-info-bg status-info-text", description: "Invoice has been sent to the customer." },
    viewed: { label: "Viewed", className: "status-info-bg status-info-text", description: "Customer has viewed the invoice." },
    partially_paid: { label: "Partially Paid", className: "status-warning-bg status-warning-text", description: "Partial payment has been received." },
    paid: { label: "Paid", className: "status-success-bg status-success-text", description: "Invoice has been fully paid." },
    overdue: { label: "Overdue", className: "status-error-bg status-error-text", description: "Invoice is past its due date." },
    cancelled: { label: "Cancelled", className: "status-tertiary-bg status-tertiary-text", description: "Invoice has been cancelled." },
    void: { label: "Void", className: "status-tertiary-bg status-tertiary-text", description: "Invoice has been voided." },
    pending: { label: "Pending", className: "status-info-bg status-info-text", description: "Invoice is awaiting processing." },
    failed: { label: "Failed", className: "status-error-bg status-error-text", description: "Invoice payment failed." },
    refunded: { label: "Refunded", className: "status-tertiary-bg status-tertiary-text", description: "Invoice has been refunded." },
  },
  "draft"
);

export const paymentStatusConfig = createStatusBadgeConfig(
  {
    paid: { label: "Paid", className: "status-success-bg status-success-text", icon: () => null, description: "Payment was successfully processed." },
    pending: { label: "Pending", className: "status-info-bg status-info-text", icon: () => null, description: "Payment is awaiting processing." },
    failed: { label: "Failed", className: "status-error-bg status-error-text", icon: () => null, description: "Payment attempt failed." },
    refunded: { label: "Refunded", className: "status-tertiary-bg status-tertiary-text", icon: () => null, description: "Payment has been refunded." },
    partially_paid: { label: "Partially Paid", className: "status-warning-bg status-warning-text", icon: () => null, description: "A partial payment has been received." },
    cancelled: { label: "Cancelled", className: "status-tertiary-bg status-tertiary-text", icon: () => null, description: "Payment was cancelled." },
    requires_action: { label: "Action Required", className: "status-warning-bg status-warning-text", icon: () => null, description: "Customer action is required to complete payment." },
  },
  "pending"
);

export const projectStatusConfig = createStatusBadgeConfig(
  {
    planning: { label: "Planning", className: "status-tertiary-bg status-tertiary-text" },
    active: { label: "Active", className: "status-info-bg status-info-text" },
    on_hold: { label: "On Hold", className: "status-warning-bg status-warning-text" },
    completed: { label: "Completed", className: "status-success-bg status-success-text" },
    archived: { label: "Archived", className: "status-tertiary-bg status-tertiary-text" },
  },
  "planning"
);

export const customerStatusConfig = createStatusBadgeConfig(
  {
    active: { label: "Active", className: "status-success-bg status-success-text" },
    inactive: { label: "Inactive", className: "status-tertiary-bg status-tertiary-text" },
    archived: { label: "Archived", className: "status-info-bg status-info-text" },
  },
  "active"
);

export function isOverdueStatus(status: string, dueDate?: string | null): boolean {
  if (status === "overdue") return true;
  if (status === "paid" || status === "void" || status === "cancelled") return false;
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

export function getStatusBadgeClassName(config: InternalStatusConfig, size: "sm" | "md" = "md"): string {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";
  return cn(
    "inline-flex items-center gap-1 rounded-full font-medium",
    config.className,
    sizeClasses
  );
}

interface StatusBadgeComponentProps extends StatusBadgeProps {
  config?: StatusBadgeConfig;
  showLabel?: boolean;
}

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeComponentProps>(
  function StatusBadge(
    {
      status,
      isOverdue,
      showIcon = false,
      showLabel = true,
      size = "md",
      className,
      config = invoiceStatusConfig,
    },
    ref
  ) {
    const effectiveStatus = isOverdue && status !== "paid" ? "overdue" : status;
    const configItem = config.getConfig(effectiveStatus);
    const sizeClasses = size === "sm" ? "px-2 py-1 text-xs" : "px-2.5 py-1 text-xs";
    const iconClass = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-medium",
          configItem.className,
          sizeClasses,
          className
        )}
        title={configItem.description}
        aria-label={`${status} ${configItem.description}`}
      >
        {showIcon && configItem.icon && <configItem.icon className={iconClass} aria-hidden="true" />}
        {showLabel && configItem.label}
      </span>
    );
  }
);

StatusBadge.displayName = "StatusBadge";

export default StatusBadge;