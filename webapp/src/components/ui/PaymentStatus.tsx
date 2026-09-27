import { StatusBadge, paymentStatusConfig } from "./StatusBadge";
import {
  Circle,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { ComponentType } from "react";
import type { PaymentStatusType, PaymentStatusProps } from "@/types/components";

export { PaymentStatusType, PaymentStatusProps };

const paymentStatusConfigWithIcons = {
  ...paymentStatusConfig,
  getConfig: (status: string) => {
    const config = paymentStatusConfig.getConfig(status);
    const icons: Record<string, ComponentType<{ className?: string }>> = {
      paid: CheckCircle,
      pending: Clock,
      failed: XCircle,
      refunded: RefreshCw,
      partially_paid: Circle,
      cancelled: XCircle,
      requires_action: AlertCircle,
    };
    return {
      ...config,
      icon: icons[status] ?? null,
    };
  },
};

export function getPaymentStatusConfig(status: string) {
  return paymentStatusConfigWithIcons.getConfig(status);
}

export const PaymentStatus = StatusBadge;

export default PaymentStatus;