import { StatusBadge as SharedStatusBadge, invoiceStatusConfig, type StatusBadgeProps as SharedStatusBadgeProps } from "@/components/ui/StatusBadge";

export type StatusBadgeProps = SharedStatusBadgeProps;

export const statusConfig = invoiceStatusConfig.configs;

export default function StatusBadge({ status, isOverdue, className }: StatusBadgeProps) {
  return (
    <SharedStatusBadge
      status={status}
      isOverdue={isOverdue}
      config={invoiceStatusConfig}
      showIcon={false}
      showLabel={true}
      size="md"
      className={className}
    />
  );
}

export function statusColors(status: string): string {
  return invoiceStatusConfig.getConfig(status).className;
}