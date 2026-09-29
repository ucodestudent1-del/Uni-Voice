import { useMemo } from "react";
import { Decimal } from "decimal.js";
import {
  DollarSign,
  TrendingUp,
  Clock,
  FileText,
  AlertCircle,
  ShoppingCart,
} from "lucide-react";
import { KPICard } from "@/components/ui";
import type { ApiDashboardSummary, ApiPaymentMetrics } from "@/types/api";

interface ReportKPICardsProps {
  summary: ApiDashboardSummary | null;
  paymentMetrics: ApiPaymentMetrics | null;
  volumeTrend?: Array<{ period: string; invoiced: string; paid: string; count: number }>;
}

export default function ReportKPICards({
  summary,
  paymentMetrics,
  volumeTrend = [],
}: ReportKPICardsProps) {
  const revenueTrend = useMemo(() => {
    if (volumeTrend.length < 2) return undefined;
    const current = new Decimal(volumeTrend[volumeTrend.length - 1].invoiced);
    const previous = new Decimal(volumeTrend[volumeTrend.length - 2].invoiced);
    if (previous.isZero()) return undefined;
    const pct = current.sub(previous).div(previous).mul(100).toNumber();
    return {
      value: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
      direction: (pct >= 0 ? "up" : "down") as "up" | "down",
    };
  }, [volumeTrend]);

  const paidTrend = useMemo(() => {
    if (volumeTrend.length < 2) return undefined;
    const current = new Decimal(volumeTrend[volumeTrend.length - 1].paid);
    const previous = new Decimal(volumeTrend[volumeTrend.length - 2].paid);
    if (previous.isZero()) return undefined;
    const pct = current.sub(previous).div(previous).mul(100).toNumber();
    return {
      value: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
      direction: (pct >= 0 ? "up" : "down") as "up" | "down",
    };
  }, [volumeTrend]);

  const netIncome = useMemo(() => {
    if (!summary) return "0";
    return new Decimal(summary.totalRevenue).minus(new Decimal(summary.expenses)).toFixed(2);
  }, [summary]);

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
      <KPICard
        title="Total Revenue"
        value={summary?.totalRevenue ?? "0"}
        currency={summary?.currency ?? "USD"}
        subtitle="Gross revenue earned"
        icon={<DollarSign className="w-5 h-5" />}
        iconBackground="bg-success-bg text-success-text"
        trend={revenueTrend}
      />
      <KPICard
        title="Payments Received"
        value={summary?.paymentsReceived ?? "0"}
        currency={summary?.currency ?? "USD"}
        subtitle="Payments this period"
        icon={<FileText className="w-5 h-5" />}
        iconBackground="bg-info-bg text-info-text"
        trend={paidTrend}
      />
      <KPICard
        title="Outstanding"
        value={summary?.totalOutstanding ?? "0"}
        currency={summary?.currency ?? "USD"}
        subtitle="Unpaid invoices total"
        icon={<DollarSign className="w-5 h-5" />}
        iconBackground="bg-warning-bg text-warning-text"
      />
      <KPICard
        title="Overdue"
        value={summary?.totalOverdue ?? "0"}
        currency={summary?.currency ?? "USD"}
        subtitle="Past due amounts"
        icon={<AlertCircle className="w-5 h-5" />}
        iconBackground="bg-error-bg text-error-text"
      />
      <KPICard
        title="Expenses"
        value={summary?.expenses ?? "0"}
        currency={summary?.currency ?? "USD"}
        subtitle="Total business spend"
        icon={<ShoppingCart className="w-5 h-5" />}
        iconBackground="bg-tertiary-bg text-tertiary-text"
      />
      <KPICard
        title="Net Income"
        value={netIncome}
        currency={summary?.currency ?? "USD"}
        subtitle="Revenue minus expenses"
        icon={<TrendingUp className="w-5 h-5" />}
        iconBackground={
          summary && new Decimal(netIncome).gte(0)
            ? "bg-success-bg text-success-text"
            : "bg-error-bg text-error-text"
        }
      />
    </div>
  );
}
