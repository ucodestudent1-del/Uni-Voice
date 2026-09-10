import { useAuth } from "../contexts/AuthContext";
import { skipOnboardingStep } from "../api/client";
import type { OnboardingStep, OnboardingProgress } from "../types/api";

interface OnboardingProgressProps {
  progress: OnboardingProgress | null;
}

const STEP_TITLES: Record<string, string> = {
  welcome: "Welcome",
  business: "Business Profile",
  customer: "Add Customer",
  product: "Add Product or Service",
  invoice: "Create Invoice",
  complete: "Done!",
};

const STEP_ICONS: Record<string, JSX.Element> = {
  welcome: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  business: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14l4 2 5-2 5-2 5 2z" />
    </svg>
  ),
  customer: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7h-.01z" />
    </svg>
  ),
  product: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10a2 2 0 01-2 2H10a2 2 0 01-2-2V7" />
    </svg>
  ),
  invoice: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m2 0a2 2 0 11-4 0 2 2 0 014 0zm3 6a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6" />
    </svg>
  ),
  complete: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.616 1.4L12 22l-6.384-5.4" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8V4a4 4 0 00-4 4h8a4 4 0 00-4-4z" />
    </svg>
  ),
};

export default function OnboardingProgress({ progress }: OnboardingProgressProps) {
  const { completeStep, refreshOnboarding } = useAuth();
  const steps = progress?.steps ?? [];

  const handleSkip = async (step: string) => {
    try {
      await skipOnboardingStep(step);
      await refreshOnboarding();
    } catch {
      // ignore
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-500 mb-2">
          <span>{progress?.completedSteps ?? 0} of {progress?.totalSteps ?? 0} steps completed</span>
          <span>{progress?.percentComplete ?? 0}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
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
                  ? "border-green-200 bg-green-50"
                  : isInProgress
                    ? "border-primary-200 bg-primary-50"
                    : isSkipped
                      ? "border-slate-200 bg-slate-50"
                      : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-full p-2 flex-shrink-0 ${
                    isCompleted
                      ? "bg-green-100 text-green-600"
                      : isInProgress
                        ? "bg-primary-100 text-primary-600"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {s.step === "complete" && isCompleted ? (
                    <CheckIcon />
                  ) : (
                    STEP_ICONS[s.step] ?? <CircleIcon />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900">{s.title}</h3>
                  {s.description && <p className="text-sm text-slate-600 mt-1">{s.description}</p>}

                  {isInProgress && (
                    <button
                      onClick={() => completeStep(s.step).catch(() => {})}
                      className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Mark as done
                    </button>
                  )}

                  {(isPending || isSkipped) && !isCurrent && s.step !== "welcome" && s.step !== "complete" && (
                    <button
                      onClick={() => handleSkip(s.step)}
                      className="mt-2 text-xs text-slate-500 hover:text-slate-700"
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

function CheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
