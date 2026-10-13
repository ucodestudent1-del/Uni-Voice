import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { KPICard, EmptyState } from "@/components/ui";
import { FileText, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { formatCurrencyValue } from "@/lib/utils";
import { Decimal } from "decimal.js";
import type { ApiCreditNoteListItem } from "@/types/api";

interface CreditNoteListKPIBarProps {
  creditNotes: ApiCreditNoteListItem[];
  isLoading: boolean;
  className?: string;
}

export default function CreditNoteListKPIBar({
  creditNotes,
  isLoading,
  className,
}: CreditNoteListKPIBarProps) {
  const [totalCount, setTotalCount] = useState(0);
  const [outstandingBalance, setOutstandingBalance] = useState(new Decimal(0));
  const [fullyApplied, setFullyApplied] = useState(0);
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    if (creditNotes.length === 0) {
      setTotalCount(0);
      setOutstandingBalance(new Decimal(0));
      setFullyApplied(0);
      setDraftCount(0);
      return;
    }

    const total = creditNotes.length;
    let outstanding = new Decimal(0);
    let applied = 0;
    let drafts = 0;

    for (const cn of creditNotes) {
      const balance = new Decimal(cn.amount_due ?? 0);
      if (balance.gt(0)) outstanding = outstanding.plus(balance);
      if (
        cn.status &&
        (cn.status === "applied" || cn.status === "refunded" || cn.status === "void")
      ) {
        applied++;
      }
      if (cn.status === "draft") drafts++;
    }

    setTotalCount(total);
    setOutstandingBalance(outstanding);
    setFullyApplied(applied);
    setDraftCount(drafts);
  }, [creditNotes]);

  const currency = creditNotes[0]?.currency ?? "USD";

  const kpis = useMemo(
    () => [
      {
        title: "Total Credit Notes",
        value: totalCount,
        subtitle: "All time",
        icon: <FileText className="h-4 w-4" />,
        iconBackground: "bg-info-bg text-info-text",
        state: "info" as const,
        isLoading,
      },
      {
        title: "Outstanding Balance",
        value: formatCurrencyValue(outstandingBalance.toFixed(), currency),
        subtitle: `${outstandingBalance.gt(0) ? "Unapplied credit" : "All applied"}`,
        icon: <Clock className="h-4 w-4" />,
        iconBackground: "bg-warning-bg text-warning-text",
        state: "warning" as const,
        isLoading,
      },
      {
        title: "Fully Applied",
        value: fullyApplied,
        subtitle: "Credits consumed",
        icon: <CheckCircle className="h-4 w-4" />,
        iconBackground: "bg-success-bg text-success-text",
        state: "success" as const,
        isLoading,
      },
      {
        title: "Draft Credit Notes",
        value: draftCount,
        subtitle: "Need attention",
        icon: <AlertCircle className="h-4 w-4" />,
        iconBackground: "bg-warning-bg text-warning-text",
        state: "warning" as const,
        isLoading,
      },
    ],
    [totalCount, outstandingBalance, fullyApplied, draftCount, currency, isLoading],
  );

  if (isLoading && creditNotes.length === 0) {
    return (
      <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-surface-alt rounded-xl border border-color animate-pulse" />
        ))}
      </div>
    );
  }

  if (!isLoading && creditNotes.length === 0) {
    return (
      <EmptyState
        title="No credit notes yet"
        description="Create your first credit note to get started."
        icon={<FileText className="h-8 w-8" />}
        actionLabel="Create Credit Note"
        onAction={() => window.location.assign("/app/credit-notes/new")}
        className={className}
      />
    );
  }

  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6", className)}>
      {kpis.map((kpi) => (
        <KPICard
          key={kpi.title}
          title={kpi.title}
          value={kpi.value}
          subtitle={kpi.subtitle}
          icon={kpi.icon}
          iconBackground={kpi.iconBackground}
          state={kpi.state}
          variant="stat"
          isLoading={kpi.isLoading}
        />
      ))}
    </div>
  );
}
