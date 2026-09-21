interface ProjectStatusBadgeProps {
  status: "planning" | "active" | "on_hold" | "completed" | "archived";
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  planning: { label: "Planning", className: "bg-surface-alt text-primary" },
  active: { label: "Active", className: "status-info-bg status-info-text" },
  on_hold: { label: "On Hold", className: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Completed", className: "status-success-bg status-success-text" },
  archived: { label: "Archived", className: "bg-surface-alt text-secondary" },
};

export default function ProjectStatusBadge({ status, className = "" }: ProjectStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.planning;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}



