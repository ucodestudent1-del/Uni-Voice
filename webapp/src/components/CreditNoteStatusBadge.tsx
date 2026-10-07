import { forwardRef } from "react";
import { StatusBadge, creditNoteStatusConfig, type StatusBadgeProps } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

export type { StatusBadgeProps };

const CreditNoteStatusBadgeInner = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  function CreditNoteStatusBadge({ status, className }, ref) {
    return (
      <StatusBadge
        ref={ref}
        status={status}
        showIcon={false}
        showLabel={true}
        size="md"
        config={creditNoteStatusConfig}
        className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", className)}
      />
    );
  }
);

CreditNoteStatusBadgeInner.displayName = "CreditNoteStatusBadge";

export default CreditNoteStatusBadgeInner;
