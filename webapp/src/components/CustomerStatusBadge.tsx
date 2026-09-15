interface CustomerStatusBadgeProps {
  status: "active" | "inactive" | "archived";
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-100 text-green-800" },
  inactive: { label: "Inactive", className: "bg-slate-100 text-slate-800" },
  archived: { label: "Archived", className: "bg-blue-100 text-blue-800" },
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
