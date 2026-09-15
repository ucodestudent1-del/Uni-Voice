interface ProjectStatusBadgeProps {
  status: "planning" | "active" | "on_hold" | "completed" | "archived";
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  planning: { label: "Planning", className: "bg-slate-100 text-slate-800" },
  active: { label: "Active", className: "bg-blue-100 text-blue-800" },
  on_hold: { label: "On Hold", className: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800" },
  archived: { label: "Archived", className: "bg-slate-100 text-slate-600" },
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
