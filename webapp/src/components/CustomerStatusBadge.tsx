import { StatusBadge, customerStatusConfig, type StatusBadgeProps } from "@/components/ui/StatusBadge";

export { StatusBadgeProps as CustomerStatusBadgeProps };

export default function CustomerStatusBadge({ status, className = "", ...props }: StatusBadgeProps) {
  return (
    <StatusBadge
      status={status}
      config={customerStatusConfig}
      showIcon={false}
      showLabel={true}
      size="md"
      className={className}
      {...props}
    />
  );
}