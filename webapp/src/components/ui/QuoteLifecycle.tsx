import { cn } from "@/lib/utils";
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
}

const QUOTE_STEPS: LifecycleStep[] = [
  { key: "draft", label: "Draft", description: "Quote created but not yet sent" },
  { key: "sent", label: "Sent", description: "Quote sent to customer" },
  { key: "viewed", label: "Viewed", description: "Customer has viewed the quote" },
  { key: "accepted", label: "Accepted", description: "Quote accepted by customer" },
];

const QUOTE_ALTERNATE_STEPS: LifecycleStep[] = [
  { key: "rejected", label: "Rejected", description: "Quote rejected by customer" },
  { key: "expired", label: "Expired", description: "Quote has passed its expiration date" },
  { key: "cancelled", label: "Cancelled", description: "Quote has been cancelled" },
  { key: "converted", label: "Converted", description: "Quote converted to an invoice" },
];

const STEP_COLORS: Record<string, StepColor> = {
  draft: { bg: "status-tertiary-bg", text: "status-tertiary-text", dotVar: "--color-text-tertiary" },
  sent: { bg: "status-info-bg", text: "status-info-text", dotVar: "--color-info" },
  viewed: { bg: "status-info-bg", text: "status-info-text", dotVar: "--color-info" },
  accepted: { bg: "status-success-bg", text: "status-success-text", dotVar: "--color-success" },
  rejected: { bg: "status-error-bg", text: "status-error-text", dotVar: "--color-error" },
  expired: { bg: "status-tertiary-bg", text: "status-tertiary-text", dotVar: "--color-text-tertiary" },
  cancelled: { bg: "status-tertiary-bg", text: "status-tertiary-text", dotVar: "--color-text-tertiary" },
  converted: { bg: "status-success-bg", text: "status-success-text", dotVar: "--color-success" },
};

const DEFAULT_COLOR: StepColor = { bg: "bg-surface-alt", text: "text-tertiary", dotVar: "--color-text-tertiary" };

export { QUOTE_STEPS as QUOTE_LIFECYCLE_STEPS, QUOTE_ALTERNATE_STEPS as QUOTE_LIFECYCLE_ALTERNATE_STEPS };

export interface QuoteLifecycleProps {
  status: string;
  className?: string;
  compact?: boolean;
}

export function getQuoteLifecycleStatus(status: string): string {
  return status || "draft";
}

export function QuoteLifecycle({
  status,
  className,
  compact = false,
}: QuoteLifecycleProps) {
  const effectiveStatus = getQuoteLifecycleStatus(status);
  const isAlternate = QUOTE_ALTERNATE_STEPS.some((s) => s.key === effectiveStatus);

  let currentStepIndex = QUOTE_STEPS.findIndex((s) => s.key === effectiveStatus);

  if (isAlternate) {
    currentStepIndex = QUOTE_STEPS.findIndex((s) => s.key === "sent");
  } else if (currentStepIndex === -1) {
    currentStepIndex = 0;
  }

  return (
    <div
      className={cn("flex items-start gap-2", className)}
      role="img"
      aria-label={`Quote lifecycle status: ${effectiveStatus}`}
    >
      {QUOTE_STEPS.map((step, idx) => {
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
            {idx < QUOTE_STEPS.length - 1 && (
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
          {QUOTE_ALTERNATE_STEPS.map((altStep, idx) => {
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
                {idx < QUOTE_ALTERNATE_STEPS.length - 1 && (
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

export default QuoteLifecycle;
