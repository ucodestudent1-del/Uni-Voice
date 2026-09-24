import { Link } from "react-router-dom";
import { formatCurrency } from "../../utils/format";
import type { ApiInvoiceListItem } from "../../types/api";
import SectionCard from "../SectionCard";
import InvoiceStatus, { isOverdueStatus } from "../ui/InvoiceStatus";
import { formatCurrencyValue } from "../../lib/utils";

interface InvoiceTableProps {
  items?: ApiInvoiceListItem[];
  title?: string;
}

export default function InvoiceTable({ items: propItems, title = "Recent Invoices" }: InvoiceTableProps) {
  return (
    <SectionCard
      title={title}
      action={
        <Link to="/app/invoices" className="text-xs text-primary-brand hover:text-primary-hover font-medium">
          View All
        </Link>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-color">
              <th className="text-left text-xs font-medium text-tertiary uppercase py-3 px-4">Invoice</th>
              <th className="text-left text-xs font-medium text-tertiary uppercase py-3 px-4">Customer</th>
              <th className="text-right text-xs font-medium text-tertiary uppercase py-3 px-4">Amount</th>
              <th className="text-right text-xs font-medium text-tertiary uppercase py-3 px-4">Due Date</th>
              <th className="text-center text-xs font-medium text-tertiary uppercase py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {(propItems ?? []).map((inv) => (
              <tr key={inv.id} className="border-b border-color-subtle last:border-b-0 hover:bg-surface-alt transition-colors">
                <td className="py-3 px-4">
                  <Link to={`/app/invoices/${inv.id}`} className="text-sm font-medium text-primary-brand hover:text-primary-hover">
                    {inv.invoice_number || `#${inv.id.slice(0, 8)}`}
                  </Link>
                  <p className="text-xs text-tertiary">
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ""}
                  </p>
                </td>
                <td className="py-3 px-4 text-sm text-secondary">{inv.customer_name || "—"}</td>
                <td className="py-3 px-4 text-right text-sm font-medium text-primary">
                  {formatCurrencyValue(inv.amount_due || inv.total, inv.currency)}
                </td>
                <td className={`py-3 px-4 text-right text-sm ${isOverdueStatus(inv.status, inv.due_date) ? "text-error-text font-medium" : "text-secondary"}`}>
                  {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                </td>
                <td className="py-3 px-4 text-center">
                  <InvoiceStatus status={inv.status} isOverdue={isOverdueStatus(inv.status, inv.due_date)} showIcon={false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(propItems ?? []).length === 0 && (
          <div className="py-8 text-center text-sm text-tertiary">
            <p>No invoices found</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
