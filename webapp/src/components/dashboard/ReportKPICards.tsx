import { useMemo } from "react";
import { Decimal } from "decimal.js";
import {
  DollarSign,
  TrendingUp,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import KPICard from "../KPICard";
import { formatCurrencyValue } from "../../lib/utils";
import type { ApiVolumeTrend } from "../../types/api";

interface ReportKPICardsProps {
  currency: string;
  totalRevenue: string;
  totalOutstanding: string;
  avgPaymentDays: number | null;
  churnRate: number | null;
  volumeTrend: ApiVolumeTrend[];
  paidThisMonth: string;
}

export default function ReportKPICards({
  currency,
  totalRevenue,
  totalOutstanding,
  avgPaymentDays,
  churnRate,
  volumeTrend,
  paidThisMonth,
}: ReportKPICardsProps) {
  const revenueTrend = useMemo(() => {
    if (volumeTrend.length < 2) return null;
    const current = new Decimal(volumeTrend[volumeTrend.length - 1].invoiced);
    const previous = new Decimal(volumeTrend[volumeTrend.length - 2].invoiced);
    if (previous.isZero()) return undefined;
    const pct = current.sub(previous).div(previous).mul(100).toNumber();
    return { value: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, direction: (pct >= 0 ? "up" : "down") as "up" | "down" };
  }, [volumeTrend]);

  const paymentTrend = useMemo(() => {
    if (volumeTrend.length < 2) return undefined;
    const currentPaid = new Decimal(volumeTrend[volumeTrend.length - 1].paid);
    const previousPaid = new Decimal(volumeTrend[volumeTrend.length - 2].paid);
    if (previousPaid.isZero()) return undefined;
    const pct = currentPaid.sub(previousPaid).div(previousPaid).mul(100).toNumber();
    return { value: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, direction: (pct >= 0 ? "up" : "down") as "up" | "down" };
  }, [volumeTrend]);

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Total Revenue"
        value={formatCurrencyValue(totalRevenue, currency)}
        subtitle="Gross revenue earned"
        icon={<DollarSign className="w-5 h-5" />}
        iconBackground="bg-success-bg text-success-text"
        trend={revenueTrend}
      />
      <KPICard
        title="Outstanding Receivables"
        value={formatCurrencyValue(totalOutstanding, currency)}
        subtitle="Unpaid invoices total"
        icon={<ArrowUpRight className="w-5 h-5" />}
        iconBackground="bg-warning-bg text-warning-text"
      />
      <KPICard
        title="Avg. Time to Payment"
        value={avgPaymentDays !== null ? `${avgPaymentDays} days` : "—"}
        subtitle="Invoices paid within"
        icon={<Clock className="w-5 h-5" />}
        iconBackground="bg-info-bg text-info-text"
      />
      <KPICard
        title="Churn Rate"
        value={churnRate !== null ? `${churnRate}%` : "—"}
        subtitle="Customer loss this period"
        icon={<TrendingUp className="w-5 h-5" />}
        iconBackground="bg-error-bg text-error-text"
        trend={paymentTrend}
      />
    </div>
  );
}
