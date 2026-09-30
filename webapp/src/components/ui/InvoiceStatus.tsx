import { StatusBadge, invoiceStatusConfig, isOverdueStatus } from "./StatusBadge";
import type { InvoiceStatusType, InvoiceStatusProps } from "@/types/components";

export type { InvoiceStatusType, InvoiceStatusProps };
export { isOverdueStatus };

export const InvoiceStatus = StatusBadge;

export default InvoiceStatus;