import { cn } from "@/lib/utils";
import type { InvoiceStatusType } from "@/types/components";
import React from "react";

export interface LifecycleStep {
  key: string;
  label: string;
  description: string;
}

interface StepColor {
  bg: string;
  text: string;
  dotVar: string;
};

const STEPS: LifecycleStep[] = [
  { key: "draft", label: "Draft", description: "Invoice created but not yet sent" },
  { key: "sent", label: "Sent", description: "Invoice sent to customer" },
  { key: "viewed", label: "Viewed", description: "Customer has viewed the invoice" },
  { key: "partially_paid", label: "Partially Paid", description: "Partial payment received" },
  { key: "paid", label: "Paid", description: "Invoice fully paid" },
];

const ALTERNATE_STEPS: LifecycleStep[] = [
  { key: "overdue", label: "Overdue", description: "Invoice is past its due date" },
  { key: "cancelled", label: "Cancelled", description: "Invoice has been cancelled" },
  { key: "void", label: "Void", description: "Invoice has been voided" },
];

const STEP_COLORS: Record<string, StepColor> = {
  draft: { bg: "status-warning-bg", text: "status-warning-text", dotVar: "--color-warning" },
  sent: { bg: "status-info-bg", text: "status-info-text", dotVar: "--color-info" },
  viewed: { bg: "status-info-bg", text: "status-info-text", dotVar: "--color-info" },
  partially_paid: { bg: "status-warning-bg", text: "status-warning-text", dotVar: "--color-warning" },
  paid: { bg: "status-success-bg", text: "status-success-text", dotVar: "--color-success" },
  overdue: { bg: "status-error-bg", text: "status-error-text", dotVar: "--color-error" },
  cancelled: { bg: "status-tertiary-bg", text: "status-tertiary-text", dotVar: "--color-text-tertiary" },
  void: { bg: "status-tertiary-bg", text: "status-tertiary-text", dotVar: "--color-text-tertiary" },
};

const DEFAULT_COLOR: StepColor = { bg: "bg-surface-alt", text: "text-tertiary", dotVar: "--color-text-tertiary" };

export { STEPS as INVOICE_LIFECYCLE_STEPS, ALTERNATE_STEPS as INVOICE_LIFECYCLE_ALTERNATE_STEPS };

export interface InvoiceLifecycleProps {
  status: InvoiceStatusType | string;
  isOverdue?: boolean;
  className?: string;
  compact?: boolean;
}

export function getLifecycleStatus(status: InvoiceStatusType | string, isOverdue?: boolean): string {
  if (isOverdue && !["paid", "void", "cancelled", "draft"].includes(status)) {
    return "overdue";
  }
  return status || "draft";
}

export function InvoiceLifecycle({
  status,
  isOverdue,
  className,
  compact = false,
}: InvoiceLifecycleProps) {
  const effectiveStatus = getLifecycleStatus(status, isOverdue);
  const isAlternate = ["overdue", "cancelled", "void"].includes(effectiveStatus);

  let currentStepIndex = STEPS.findIndex((s) => s.key === effectiveStatus);

  if (isAlternate) {
    currentStepIndex = STEPS.findIndex((s) => s.key === "sent");
  } else if (currentStepIndex === -1) {
    currentStepIndex = 0;
  }

  return (
    <div
      className={cn("flex items-start gap-2", className)}
      role="img"
      aria-label={`Invoice lifecycle status: ${effectiveStatus}`}
    >
      {STEPS.map((step, idx) => {
        const isCurrent = idx === currentStepIndex;
        const isActive = idx <= currentStepIndex;
        const stepColor = STEP_COLORS[step.key] ?? DEFAULT_COLOR;
        const dotColor = `rgb(var(${stepColor.dotVar}))`;

        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center" title={step.description}>
              <div
                className={cn(
                  "rounded-full flex items-center justify-center border-2 transition-all",
                  compact ? "h-5 w-5 min-w-[20px]" : "h-6 w-6 min-w-[24px]",
                  isCurrent
                    ? cn("border-transparent", stepColor.bg)
                    : isActive
                      ? "border-transparent bg-primary-action"
                      : "border-color bg-surface",
                )}
              >
                <span
                  className={cn(
                    "block rounded-full bg-current",
                    compact ? "h-1.5 w-1.5" : "h-2 w-2",
                  )}
                  style={{ color: dotColor }}
                />
              </div>
              {!compact && (
                <span
                  className={cn(
                    "mt-1 text-xs font-medium",
                    isCurrent
                      ? stepColor.text
                      : isActive
                        ? "text-primary-brand"
                        : "text-tertiary",
                  )}
                >
                  {step.label}
                </span>
              )}
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "my-3 h-px flex-1",
                  compact ? "w-3" : "w-6",
                  idx < currentStepIndex ? "bg-primary-action" : "bg-border-color-subtle",
                )}
              />
            )}
          </React.Fragment>
        );
      })}

      {isAlternate && (
        <>
          <div className={cn("my-3 h-px bg-border-color-subtle", compact ? "w-3" : "w-6")} />
          {ALTERNATE_STEPS.map((altStep, idx) => {
            const isCurrent = effectiveStatus === altStep.key;
            const stepColor = STEP_COLORS[altStep.key] ?? DEFAULT_COLOR;
            const dotColor = `rgb(var(${stepColor.dotVar}))`;

            return (
              <React.Fragment key={altStep.key}>
                <div className="flex flex-col items-center" title={altStep.description}>
                  <div
                    className={cn(
                      "rounded-full flex items-center justify-center border-2 transition-all",
                      compact ? "h-5 w-5 min-w-[20px]" : "h-6 w-6 min-w-[24px]",
                      isCurrent
                        ? cn("border-transparent", stepColor.bg)
                        : "border-color bg-surface",
                    )}
                  >
                    <span
                      className={cn(
                        "block rounded-full bg-current",
                        compact ? "h-1.5 w-1.5" : "h-2 w-2",
                      )}
                      style={{ color: dotColor }}
                    />
                  </div>
                  {!compact && (
                    <span className={cn("mt-1 text-xs font-medium", stepColor.text)}>
                      {altStep.label}
                    </span>
                  )}
                </div>
                {idx < ALTERNATE_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "my-3 h-px flex-1",
                      compact ? "w-3" : "w-6",
                      "bg-border-color-subtle",
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </>
      )}
    </div>
  );
}

export default InvoiceLifecycle;
