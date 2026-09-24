import { useMemo } from "react";
import { Decimal } from "decimal.js";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, ArrowRight, ShieldAlert } from "lucide-react";
import { formatCurrencyValue } from "../../lib/utils";
import type { ApiInvoiceListItem } from "../../types/api";

interface ReportInsightsProps {
  invoices: ApiInvoiceListItem[];
  overdueThresholdDays?: number;
  currency?: string;
}

interface InsightGroup {
  severity: "critical" | "warning" | "info";
  title: string;
  count: number;
  totalAmount: string;
  invoices: ApiInvoiceListItem[];
  icon: React.ReactNode;
}

export default function ReportInsights({ invoices, overdueThresholdDays = 30, currency = "USD" }: ReportInsightsProps) {
  const insights = useMemo(() => {
    const now = new Date();
    const critical: ApiInvoiceListItem[] = [];
    const warning: ApiInvoiceListItem[] = [];
    const info: ApiInvoiceListItem[] = [];

    const sorted = [...invoices].sort(
      (a, b) => new Date(b.due_date || 0).getTime() - new Date(a.due_date || 0).getTime()
    );

    sorted.forEach((inv) => {
      const due = inv.due_date ? new Date(inv.due_date) : null;
      if (!due) return;
      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue > overdueThresholdDays * 2) {
        critical.push(inv);
      } else if (daysOverdue > 0) {
        warning.push(inv);
      } else if (daysOverdue > -14) {
        info.push(inv);
      }
    });

    const groups: InsightGroup[] = [];

    if (critical.length > 0) {
      groups.push({
        severity: "critical",
        title: "Severely Overdue",
        count: critical.length,
        totalAmount: critical.reduce((sum, inv) => sum.plus(inv.amount_due || 0), new Decimal(0)).toFixed(2),
        invoices: critical,
        icon: <ShieldAlert className="w-4 h-4" />,
      });
    }

    if (warning.length > 0) {
      groups.push({
        severity: "warning",
        title: "Overdue",
        count: warning.length,
        totalAmount: warning.reduce((sum, inv) => sum.plus(inv.amount_due || 0), new Decimal(0)).toFixed(2),
        invoices: warning,
        icon: <AlertTriangle className="w-4 h-4" />,
      });
    }

    if (info.length > 0) {
      groups.push({
        severity: "info",
        title: "Due Soon",
        count: info.length,
        totalAmount: info.reduce((sum, inv) => sum.plus(inv.amount_due || 0), new Decimal(0)).toFixed(2),
        invoices: info,
        icon: <Clock className="w-4 h-4" />,
      });
    }

    return groups;
  }, [invoices, overdueThresholdDays]);

  const totalOverdue = useMemo(() => {
    return insights
      .filter((g) => g.severity === "critical" || g.severity === "warning")
      .reduce((sum, g) => sum.plus(new Decimal(g.totalAmount || 0)), new Decimal(0));
  }, [insights]);

  if (insights.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-color p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="h-4 w-4 text-success-text" />
          <h3 className="text-sm font-semibold text-primary">Insights & Alerts</h3>
        </div>
        <div className="py-8 text-center">
          <p className="text-sm text-secondary">No overdue invoices</p>
          <p className="text-xs text-tertiary mt-1">All invoices are current</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-color overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning-text" />
            <h3 className="text-sm font-semibold text-primary">Insights & Alerts</h3>
          </div>
          {totalOverdue.gt(0) && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-error-bg text-error-text">
              {formatCurrencyValue(totalOverdue.toFixed(2), currency)} at risk
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-color-subtle">
        {insights.map((group) => (
          <div key={group.title}>
            <div className="px-5 py-3 bg-surface-alt">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      group.severity === "critical"
                        ? "bg-error-bg text-error-text"
                        : group.severity === "warning"
                          ? "bg-warning-bg text-warning-text"
                          : "bg-info-bg text-info-text"
                    }`}
                  >
                    {group.icon}
                    {group.title}
                  </span>
                  <span className="text-xs text-tertiary">
                    {group.count} invoice{group.count !== 1 ? "s" : ""} ·{" "}
                    {formatCurrencyValue(group.totalAmount || "0", currency)}
                  </span>
                </div>
              </div>
            </div>
            {group.invoices.slice(0, 3).map((inv) => {
              const due = inv.due_date ? new Date(inv.due_date) : null;
              const daysOverdue = due ? Math.floor((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) : 0;
              return (
                <Link
                  key={inv.id}
                  to={`/app/invoices/${inv.id}`}
                  className="flex items-center justify-between px-5 py-2.5 hover:bg-surface-alt transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">
                      {inv.invoice_number || `#${inv.id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-tertiary">
                      {inv.customer_name || "Unknown"} · Due{" "}
                      {due
                        ? new Date(due).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-medium text-primary">
                      {formatCurrencyValue(inv.amount_due || inv.total, inv.currency)}
                    </span>
                    {daysOverdue > 0 && (
                      <span className="text-xs text-error-text font-medium">{daysOverdue}d</span>
                    )}
                    <ArrowRight className="w-3.5 h-3.5 text-tertiary" />
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
