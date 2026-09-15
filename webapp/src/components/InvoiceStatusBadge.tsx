interface InvoiceStatusBadgeProps {
  status: string;
  isOverdue?: boolean;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-800" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-800" },
  viewed: { label: "Viewed", className: "bg-indigo-100 text-indigo-800" },
  partially_paid: { label: "Partially Paid", className: "bg-yellow-100 text-yellow-800" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-800" },
  void: { label: "Void", className: "bg-slate-100 text-slate-800" },
};

export default function InvoiceStatusBadge({ status, isOverdue, className }: InvoiceStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.draft;
  const effectiveStatus = isOverdue && status !== "paid" ? "overdue" : status;
  const effectiveConfig = statusConfig[effectiveStatus] ?? config;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${effectiveConfig.className} ${className}`}
    >
      {effectiveConfig.label}
    </span>
  );
}
