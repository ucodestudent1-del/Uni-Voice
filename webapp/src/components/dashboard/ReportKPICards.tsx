import {
  DollarSign,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { KPICard } from "@/components/ui";
import type { ApiVolumeTrend } from "../../types/api";

interface ReportKPICardsProps {
  currency: string;
  totalRevenue: string;
  totalOutstanding: string;
  avgPaymentDays: number | null;
  paidThisMonth: string;
}

export default function ReportKPICards({
  currency,
  totalRevenue,
  totalOutstanding,
  avgPaymentDays,
  paidThisMonth,
}: ReportKPICardsProps) {

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Total Revenue"
        value={totalRevenue}
        currency={currency}
        subtitle="Gross revenue earned"
        icon={<DollarSign className="w-5 h-5" />}
        iconBackground="bg-success-bg text-success-text"
      />
      <KPICard
        title="Outstanding Receivables"
        value={totalOutstanding}
        currency={currency}
        subtitle="Outstanding payments"
        icon={<ArrowUpRight className="w-5 h-5" />}
        iconBackground="bg-warning-bg text-warning-text"
      />
      <KPICard
        title="Avg. Time to Payment"
        value={avgPaymentDays !== null ? `${avgPaymentDays} days` : "—"}
        subtitle="Payments cleared within"
        icon={<Clock className="w-5 h-5" />}
        iconBackground="bg-info-bg text-info-text"
      />
      <KPICard
        title="Paid This Month"
        value={paidThisMonth}
        currency={currency}
        subtitle="Payments received"
        icon={<DollarSign className="w-5 h-5" />}
        iconBackground="bg-success-bg text-success-text"
      />
    </div>
  );
}
