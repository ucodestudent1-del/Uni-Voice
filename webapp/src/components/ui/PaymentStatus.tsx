import { forwardRef, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import {
  Circle,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { PaymentStatusType, PaymentStatusProps } from "@/types/components";

export { PaymentStatusType, PaymentStatusProps };

interface StatusConfig {
  label: string;
  color: "green" | "blue" | "red" | "muted" | "warning";
  icon: ComponentType<{ className?: string }>;
  description: string;
}

const statusConfig: Record<PaymentStatusType, StatusConfig> = {
  paid: { label: "Paid", color: "green", icon: CheckCircle, description: "Payment was successfully processed." },
  pending: { label: "Pending", color: "blue", icon: Clock, description: "Payment is awaiting processing." },
  failed: { label: "Failed", color: "red", icon: XCircle, description: "Payment attempt failed." },
  refunded: { label: "Refunded", color: "muted", icon: RefreshCw, description: "Payment has been refunded." },
  partially_paid: { label: "Partially Paid", color: "warning", icon: Circle, description: "A partial payment has been received." },
  cancelled: { label: "Cancelled", color: "muted", icon: XCircle, description: "Payment was cancelled." },
  requires_action: { label: "Action Required", color: "warning", icon: AlertCircle, description: "Customer action is required to complete payment." },
};

const colorClasses: Record<StatusConfig["color"], string> = {
  green: "status-success-bg status-success-text",
  blue: "status-info-bg status-info-text",
  red: "status-error-bg status-error-text",
  muted: "status-tertiary-bg status-tertiary-text",
  warning: "status-warning-bg status-warning-text",
};

export function getPaymentStatusConfig(status: string): StatusConfig {
  return statusConfig[(status as PaymentStatusType) ?? "pending"] ?? statusConfig.pending;
}

export const PaymentStatus = forwardRef<HTMLSpanElement, PaymentStatusProps>(
  function PaymentStatus({ status, showIcon = false, showLabel = true, size = "md", className }, ref) {
    const config = getPaymentStatusConfig(status);
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
        aria-label={config.label}
      >
        {showIcon && <config.icon className={iconClass} aria-hidden="true" />}
        {showLabel && config.label}
      </span>
    );
  }
);

PaymentStatus.displayName = "PaymentStatus";

export default PaymentStatus;
