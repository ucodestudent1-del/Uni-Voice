import { StatusBadge, projectStatusConfig, type StatusBadgeProps } from "@/components/ui/StatusBadge";

export { StatusBadgeProps as ProjectStatusBadgeProps };

export default function ProjectStatusBadge({ status, className = "", ...props }: StatusBadgeProps) {
  return (
    <StatusBadge
      status={status}
      config={projectStatusConfig}
      showIcon={false}
      showLabel={true}
      size="md"
      className={className}
      {...props}
    />
  );
}