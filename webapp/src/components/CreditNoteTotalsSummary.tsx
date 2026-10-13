import { cn } from "@/lib/utils";
import { Money } from "@/components/ui";
import { formatCurrencyValue } from "@/lib/utils";
import { Decimal } from "decimal.js";
import type { ApiCreditNote } from "@/types/api";

interface CreditNoteTotalsSummaryProps {
  creditNote: ApiCreditNote;
  className?: string;
  showApplied?: boolean;
}

export default function CreditNoteTotalsSummary({
  creditNote,
  className,
  showApplied = true,
}: CreditNoteTotalsSummaryProps) {
  const currency = creditNote.currency ?? "USD";
  const total = new Decimal(creditNote.total ?? 0);
  const applied = new Decimal(creditNote.applied_total ?? 0);
  const balanceDue = new Decimal(creditNote.amount_due ?? total.minus(applied));
  const hasDiscount = !new Decimal(creditNote.discount_total ?? 0).isZero();
  const hasFees = (creditNote.fees?.length ?? 0) > 0;

  const remainingPct = total.gt(0)
    ? Math.round(
        (applied.dividedBy(total).times(100).toNumber() / 1) * 1,
      )
    : 0;

  return (
    <div
      className={cn("flex flex-col gap-2 text-sm", className)}
      aria-label="Credit note totals summary"
    >
      <div className="flex justify-between text-tertiary">
        <span>Subtotal</span>
        <Money amount={creditNote.subtotal} currency={currency} />
      </div>
      {hasDiscount && (
        <div className="flex justify-between text-tertiary">
          <span>Discount</span>
          <span className="text-success-text">
            −<Money amount={creditNote.discount_total} currency={currency} />
          </span>
        </div>
      )}
      <div className="flex justify-between text-tertiary">
        <span>Tax</span>
        <Money amount={creditNote.tax_total} currency={currency} />
      </div>
      {hasFees && (
        <div className="flex justify-between text-tertiary">
          <span>Fees</span>
          <Money amount={creditNote.fee_total} currency={currency} />
        </div>
      )}

      <div className="border-t-2 border-border pt-3 mt-2">
        <div className="flex justify-between">
          <span className="text-base font-semibold text-secondary">
            Total Credit
          </span>
          <span className="text-2xl font-bold text-error-text font-tabular-nums">
            −{formatCurrencyValue(total.toFixed(), currency)}
          </span>
        </div>
      </div>

      {showApplied && (
        <>
          <div className="mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-tertiary">Applied</span>
              <span className="text-success-text font-medium">
                −{formatCurrencyValue(applied.toFixed(), currency)}
              </span>
            </div>
            {!applied.isZero() && (
              <div className="mt-1 h-2 w-full bg-surface-alt rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${remainingPct}%` }}
                  aria-label={`${remainingPct}% applied`}
                />
              </div>
            )}
          </div>

          <div className="flex justify-between border-t border-border pt-2">
            <span className="text-lg font-semibold text-secondary">
              Amount Remaining
            </span>
            <span
              className={cn(
                "text-xl font-bold font-tabular-nums",
                balanceDue.isZero()
                  ? "text-success-text"
                  : "text-warning-text",
              )}
            >
              −{formatCurrencyValue(balanceDue.toFixed(), currency)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
