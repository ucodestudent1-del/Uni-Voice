interface StatusBadgeProps {
  status: string;
  isOverdue?: boolean;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-800" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-800" },
  viewed: { label: "Viewed", className: "bg-indigo-100 text-indigo-800" },
  partially_paid: { label: "Partially Paid", className: "bg-amber-100 text-amber-800" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-500" },
  void: { label: "Void", className: "bg-slate-100 text-slate-500" },
};

export default function StatusBadge({ status, isOverdue, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.draft;
  const effectiveStatus = isOverdue && status !== "paid" ? "overdue" : status;
  const effectiveConfig = statusConfig[effectiveStatus] ?? config;
  const baseClasses = `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${effectiveConfig.className}`;
  return className ? <span className={`${baseClasses} ${className}`}>{effectiveConfig.label}</span> : <span className={baseClasses}>{effectiveConfig.label}</span>;
}

export { statusConfig };
export function statusColors(status: string): string {
  return statusConfig[status]?.className ?? statusConfig.draft.className;
}
