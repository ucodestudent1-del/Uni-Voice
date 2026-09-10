import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import OnboardingProgress from "../components/OnboardingProgress";
import {
  useAuth,
} from "../contexts/AuthContext";
import type { OnboardingProgress as OnboardingProgressType } from "../types/api";

const STEP_COMPONENTS: Record<string, JSX.Element> = {
  welcome: (
    <div className="text-center py-6">
      <h2 className="text-xl font-semibold text-slate-900 mb-2">Welcome aboard!</h2>
      <p className="text-slate-600">Let's get your business set up in just a few steps.</p>
    </div>
  ),
  business: (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Tell us about your business</h2>
      <p className="text-slate-600">
        You can update your business details in Settings at any time.
      </p>
      <button
        onClick={() => alert("This feature is coming soon!")}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        Open Business Profile
      </button>
    </div>
  ),
  customer: (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Add your first customer</h2>
      <p className="text-slate-600">
        Customers help you create invoices faster and track who owes what.
      </p>
      <button
        onClick={() => alert("This feature is coming soon!")}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        Add Customer
      </button>
    </div>
  ),
  product: (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Add a product or service</h2>
      <p className="text-slate-600">
        Save line items so you can add them to invoices quickly.
      </p>
      <button
        onClick={() => alert("This feature is coming soon!")}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        Add Product/Service
      </button>
    </div>
  ),
  invoice: (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Create your first invoice</h2>
      <p className="text-slate-600">
        Send your first invoice to a customer to start tracking income.
      </p>
      <button
        onClick={() => alert("This feature is coming soon!")}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        New Invoice
      </button>
    </div>
  ),
  complete: (
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.616 1.4L12 22l-6.384-5.4" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">You're all set!</h2>
      <p className="text-slate-600 mb-6">
        Your business is fully configured. Let's start creating invoices.
      </p>
      <button
        onClick={() => {
          console.log("Onboarding complete, redirecting to dashboard");
        }}
        className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
      >
        Go to Dashboard
      </button>
    </div>
  ),
};

export default function OnboardingWizard() {
  const { user, onboarding, refreshOnboarding, completeStep } = useAuth();
  const [progress, setProgress] = useState<OnboardingProgressType | null>(onboarding);
  const [isCompleting, setIsCompleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (progress?.isComplete) {
      navigate("/");
    }
  }, [progress?.isComplete, navigate]);

  useEffect(() => {
    if (!progress) return;
    const currentStep = progress.currentStep;
    const step = progress.steps.find((s) => s.step === currentStep);
    if (step?.status === "completed" && currentStep !== "complete") {
      refreshOnboarding();
    }
  }, [progress, refreshOnboarding]);

  const handleComplete = useCallback(async () => {
    if (!progress) return;
    const currentStep = progress.currentStep;
    try {
      setIsCompleting(true);
      const newProgress = await completeStep(currentStep);
      setProgress(newProgress);
      if (newProgress.isComplete && newProgress.currentStep === "complete") {
        const completeStepData = newProgress.steps.find((s) => s.step === "complete");
        if (completeStepData?.status !== "completed") {
          await completeStep("complete");
        }
      }
    } catch (err) {
      console.error("Failed to complete step:", err);
    } finally {
      setIsCompleting(false);
    }
  }, [progress, completeStep]);

  const handleFinish = useCallback(async () => {
    try {
      setIsCompleting(true);
      const newProgress = await completeStep(progress?.currentStep ?? "");
      setProgress(newProgress);
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
    } finally {
      setIsCompleting(false);
    }
  }, [progress, completeStep]);

  if (!progress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-slate-500 mt-2">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  const currentStepData = progress.steps.find((s) => s.step === progress.currentStep);
  const currentTitle = currentStepData?.title ?? progress.currentStep;
  const stepContent = STEP_COMPONENTS[progress.currentStep] ?? STEP_COMPONENTS.welcome;
  const isLastStep = progress.currentStep === "complete";

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Getting Started</h1>
          <p className="text-slate-500 mt-1">
            Step {progress.completedSteps + 1} of {progress.totalSteps}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-6 md:p-8 mb-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">{currentTitle}</h2>
          {stepContent}
        </div>

        <OnboardingProgress progress={progress} />

        <div className="flex justify-between mt-8">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 text-slate-600 hover:text-slate-900"
          >
            Skip Onboarding
          </button>
          <div className="flex gap-3">
            {progress.currentStep !== "welcome" && progress.currentStep !== "complete" && (
              <button
                onClick={handleFinish}
                disabled={isCompleting}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {isCompleting ? "Saving..." : "Skip Step"}
              </button>
            )}
            <button
              onClick={handleComplete}
              disabled={isCompleting}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {isLastStep
                ? "Go to Dashboard"
                : isCompleting
                  ? "Saving..."
                  : "Mark as Complete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
