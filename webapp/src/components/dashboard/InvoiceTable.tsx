import { Link } from "react-router-dom";
import { formatCurrency } from "../../utils/format";
import { statusConfig } from "./StatusBadge";
import type { ApiInvoiceListItem } from "../../types/api";
import SectionCard from "../SectionCard";

interface InvoiceTableProps {
  items?: ApiInvoiceListItem[];
  title?: string;
}

export default function InvoiceTable({ items: propItems, title = "Recent Invoices" }: InvoiceTableProps) {
  return (
    <SectionCard
      title={title}
      action={
        <Link to="/app/invoices" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
          View All
        </Link>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Invoice</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Customer</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase py-3 px-4">Amount</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase py-3 px-4">Due Date</th>
              <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {(propItems ?? []).map((inv) => (
              <tr key={inv.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4">
                  <Link to={`/app/invoices/${inv.id}`} className="text-sm font-medium text-slate-900 hover:text-primary-600">
                    {inv.invoice_number || `#${inv.id.slice(0, 8)}`}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ""}
                  </p>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600">{inv.customer_name || "—"}</td>
                <td className="py-3 px-4 text-right text-sm font-medium text-slate-900">
                  {formatCurrency(inv.amount_due || inv.total, inv.currency)}
                </td>
                <td className={`py-3 px-4 text-right text-sm ${inv.status === "overdue" ? "text-red-600 font-medium" : "text-slate-600"}`}>
                  {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig[inv.status]?.className ?? statusConfig.draft.className}`}>
                          {statusConfig[inv.status]?.label ?? inv.status}
                        </span>
                      </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(propItems ?? []).length === 0 && (
          <div className="py-8 text-center text-sm text-slate-400">
            <p>No invoices found</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
