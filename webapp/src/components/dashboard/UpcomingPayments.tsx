import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../utils/format";
import { getInvoices } from "../../api/client";
import type { ApiInvoiceListItem } from "../../types/api";
import SectionCard from "../SectionCard";

interface UpcomingPaymentsProps {
  items?: ApiInvoiceListItem[];
}

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-800",
  sent: "bg-blue-100 text-blue-800",
  viewed: "bg-indigo-100 text-indigo-800",
  partially_paid: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-800",
  void: "bg-slate-100 text-slate-800",
};

export default function UpcomingPayments({ items: propItems }: UpcomingPaymentsProps) {
  return (
    <SectionCard
      title="Upcoming Payments"
      action={
        <Link to="/app/invoices" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
          View All
        </Link>
      }
    >
      <UpcomingPaymentsList preloadedItems={propItems} />
    </SectionCard>
  );
}

function UpcomingPaymentsList({ preloadedItems }: { preloadedItems?: ApiInvoiceListItem[] }) {
  const [items, setItems] = useState<ApiInvoiceListItem[]>(preloadedItems ?? []);

  if (!preloadedItems) {
    useEffect(() => {
      getInvoices({ status: "sent", limit: 5 }).then((res: any) => {
        const data = (res.data as any).invoices ?? (res.data as any).data ?? [];
        setItems(data);
      }).catch(() => setItems([]));
    }, []);
  }

  const sorted = [...items].sort((a, b) => {
    const dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return dateA - dateB;
  });

  if (sorted.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        <p>No upcoming payments</p>
      </div>
    );
  }

  return (
    <div>
      {sorted.slice(0, 5).map((inv) => (
        <div key={inv.id} className="py-3 border-b border-slate-100 last:border-b-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">
              {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
            </span>
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusColors[inv.status] || statusColors.draft}`}>
              {inv.status}
            </span>
          </div>
          <Link to={`/app/invoices/${inv.id}`} className="text-sm font-medium text-slate-900 hover:text-primary-600 block truncate">
            {inv.customer_name || "—"}
          </Link>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-xs text-slate-500">
              {inv.invoice_number || `#${inv.id.slice(0, 8)}`}
            </span>
            <span className="text-sm font-medium text-slate-900">
              {formatCurrency(inv.amount_due || inv.total, inv.currency)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
