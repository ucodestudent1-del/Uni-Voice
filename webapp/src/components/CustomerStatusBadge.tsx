import type { CustomerStatusBadgeProps } from "@/types/components";

export { CustomerStatusBadgeProps };

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "status-success-bg status-success-text" },
  inactive: { label: "Inactive", className: "bg-surface-alt text-primary" },
  archived: { label: "Archived", className: "status-info-bg status-info-text" },
};

export default function CustomerStatusBadge({ status, className = "" }: CustomerStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.active;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}
