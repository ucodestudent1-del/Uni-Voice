import { StatusBadge, invoiceStatusConfig, isOverdueStatus } from "./StatusBadge";
import type { InvoiceStatusType, InvoiceStatusProps } from "@/types/components";

export { InvoiceStatusType, InvoiceStatusProps, isOverdueStatus };

export const InvoiceStatus = StatusBadge;

export default InvoiceStatus;