import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import InvoiceStatus from "@/components/ui/InvoiceStatus";
import type { StatusBadgeProps } from "@/types/components";

export { StatusBadgeProps };

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

export const statusConfigExport = statusConfig;

const InvoiceStatusBadgeInner = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  function InvoiceStatusBadge({ status, isOverdue, className }, ref) {
    return (
      <InvoiceStatus
        ref={ref}
        status={status}
        isOverdue={isOverdue}
        showIcon={false}
        className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", className)}
      />
    );
  }
);

InvoiceStatusBadgeInner.displayName = "InvoiceStatusBadge";

export default InvoiceStatusBadgeInner;
