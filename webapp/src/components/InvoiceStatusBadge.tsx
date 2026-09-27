import { forwardRef } from "react";
import { StatusBadge, invoiceStatusConfig, type StatusBadgeProps } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

export { StatusBadgeProps };

const InvoiceStatusBadgeInner = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  function InvoiceStatusBadge({ status, isOverdue, className }, ref) {
    return (
      <StatusBadge
        ref={ref}
        status={status}
        isOverdue={isOverdue}
        showIcon={false}
        showLabel={true}
        size="md"
        config={invoiceStatusConfig}
        className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", className)}
      />
    );
  }
);

InvoiceStatusBadgeInner.displayName = "InvoiceStatusBadge";

export default InvoiceStatusBadgeInner;