import { cn } from "@/lib/utils";
import React from "react";

export interface CreditNoteLifecycleStep {
  key: string;
  label: string;
  description: string;
}

interface StepColor {
  bg: string;
  text: string;
  dotVar: string;
}

const MAIN_STEPS: CreditNoteLifecycleStep[] = [
  { key: "draft", label: "Draft", description: "Credit note has been created but not yet finalized" },
  { key: "finalized", label: "Issued", description: "Credit note has been finalized and issued" },
  { key: "sent", label: "Sent", description: "Credit note has been sent to the customer" },
  { key: "applied", label: "Applied", description: "Full credit has been applied to invoice(s)" },
  { key: "refunded", label: "Refunded", description: "Credit has been refunded to the customer" },
];

const ALTERNATE_STEPS: CreditNoteLifecycleStep[] = [
  { key: "partially_applied", label: "Partially Applied", description: "A portion of the credit has been applied" },
  { key: "partially_refunded", label: "Partially Refunded", description: "A portion of the credit has been refunded" },
  { key: "cancelled", label: "Cancelled", description: "Credit note has been cancelled" },
  { key: "void", label: "Void", description: "Credit note has been voided" },
];

const STEP_COLORS: Record<string, StepColor> = {
  draft: { bg: "status-tertiary-bg", text: "status-tertiary-text", dotVar: "--color-text-tertiary" },
  finalized: { bg: "status-info-bg", text: "status-info-text", dotVar: "--color-info" },
  sent: { bg: "status-info-bg", text: "status-info-text", dotVar: "--color-info" },
  partially_applied: { bg: "status-warning-bg", text: "status-warning-text", dotVar: "--color-warning" },
  applied: { bg: "status-success-bg", text: "status-success-text", dotVar: "--color-success" },
  partially_refunded: { bg: "status-warning-bg", text: "status-warning-text", dotVar: "--color-warning" },
  refunded: { bg: "status-success-bg", text: "status-success-text", dotVar: "--color-success" },
  cancelled: { bg: "status-tertiary-bg", text: "status-tertiary-text", dotVar: "--color-text-tertiary" },
  void: { bg: "status-error-bg", text: "status-error-text", dotVar: "--color-error" },
};

const DEFAULT_COLOR: StepColor = { bg: "bg-surface-alt", text: "text-tertiary", dotVar: "--color-text-tertiary" };

export { MAIN_STEPS as CREDIT_NOTE_LIFECYCLE_STEPS, ALTERNATE_STEPS as CREDIT_NOTE_LIFECYCLE_ALTERNATE_STEPS };

export interface CreditNoteLifecycleProps {
  status: string;
  className?: string;
  compact?: boolean;
}

export function getCreditNoteLifecycleStatus(status: string): string {
  return status || "draft";
}

export function isCreditNoteCancelledOrVoided(status: string): boolean {
  return status === "cancelled" || status === "void";
}

export function CreditNoteLifecycle({
  status,
  className,
  compact = false,
}: CreditNoteLifecycleProps) {
  const effectiveStatus = getCreditNoteLifecycleStatus(status);
  const isAlternate = ALTERNATE_STEPS.some((s) => s.key === effectiveStatus);

  const mainStatusMap: Record<string, number> = {
    draft: 0,
    finalized: 1,
    sent: 2,
    applied: 3,
    partially_applied: 2,
    partially_refunded: 3,
    refunded: 4,
  };
  const currentStepIndex = mainStatusMap[effectiveStatus] ?? 0;

  return (
    <div
      className={cn("flex items-start gap-2", className)}
      role="img"
      aria-label={`Credit note lifecycle status: ${effectiveStatus}`}
    >
      {MAIN_STEPS.map((step, idx) => {
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
            {idx < MAIN_STEPS.length - 1 && (
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

export default CreditNoteLifecycle;
