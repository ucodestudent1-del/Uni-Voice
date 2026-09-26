import { useAuth } from "../contexts/AuthContext";
import { skipOnboardingStep } from "../api/client";
import type { OnboardingStep, OnboardingProgress as OnboardingProgressType } from "../types/api";

interface OnboardingProgressProps {
  progress: OnboardingProgressType | null;
}

const STEP_TITLES: Record<string, string> = {
  welcome: "Welcome",
  business: "Business Profile",
  customer: "Add Customer",
  product: "Add Product or Service",
  invoice: "Create Invoice",
  complete: "Done!",
};

const STEP_LABELS: Record<string, string> = {
  welcome: "★",
  business: "🏢",
  customer: "👤",
  product: "📦",
  invoice: "📄",
  complete: "✓",
};

export default function OnboardingProgress({ progress }: OnboardingProgressProps) {
  const { completeStep, refreshOnboarding } = useAuth();
  const steps = progress?.steps ?? [];

  const handleSkip = async (step: string) => {
    try {
      await skipOnboardingStep(step);
      await refreshOnboarding();
    } catch (err) {
      console.error("Failed to skip onboarding step:", err);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-secondary mb-2">
          <span>{progress?.completedSteps ?? 0} of {progress?.totalSteps ?? 0} steps completed</span>
          <span>{progress?.percentComplete ?? 0}%</span>
        </div>
        <div className="w-full bg-surface-alt rounded-full h-2">
          <div
            className="bg-primary-action h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress?.percentComplete ?? 0}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((s: OnboardingStep) => {
          const isCurrent = progress?.currentStep === s.step;
          const isCompleted = s.status === "completed";
          const isSkipped = s.status === "skipped";
          const isPending = s.status === "pending";
          const isInProgress = s.status === "in_progress";

          return (
            <div
              key={s.step}
              className={`border rounded-lg p-4 transition-colors ${
                isCompleted
                  ? "status-success-border status-success-bg"
                  : isInProgress
                    ? "border-primary-200 bg-primary-bg"
                    : isSkipped
                      ? "border-color-subtle bg-surface-alt"
                      : "border-color-subtle bg-surface"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-full p-2 flex-shrink-0 ${
                    isCompleted
                      ? "status-success-bg status-success-text"
                      : isInProgress
                        ? "bg-primary-bg text-primary-brand"
                        : "bg-surface-alt text-secondary"
                  }`}
                >
                   {s.step === "complete" && isCompleted ? (
                    <span className="text-sm">✓</span>
                   ) : (
                    <span className="text-sm">
                      {STEP_LABELS[s.step] ?? "○"}
                    </span>
                   )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-primary">{s.title}</h3>
                  {s.description && <p className="text-sm text-secondary mt-1">{s.description}</p>}

                  {isInProgress && (
                    <button
                      onClick={() => completeStep(s.step).catch(() => {})}
                      className="mt-2 text-sm text-primary-brand hover:text-primary-brand font-medium"
                    >
                      Mark as done
                    </button>
                  )}

                  {(isPending || isSkipped) && !isCurrent && s.step !== "welcome" && s.step !== "complete" && (
                    <button
                      onClick={() => handleSkip(s.step)}
                      className="mt-2 text-xs text-secondary hover:text-secondary"
                    >
                      Skip this step
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}





