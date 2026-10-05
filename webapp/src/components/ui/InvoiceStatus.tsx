import { StatusBadge, invoiceStatusConfig, isOverdueStatus } from "./StatusBadge";
import { RiskBadge, getRiskLevel, getRiskLabel } from "./RiskBadge";
import type { InvoiceStatusType, InvoiceStatusProps } from "@/types/components";

export type { InvoiceStatusType, InvoiceStatusProps };
export { isOverdueStatus };
export { RiskBadge, getRiskLevel, getRiskLabel };

export const InvoiceStatus = StatusBadge;

export default InvoiceStatus;