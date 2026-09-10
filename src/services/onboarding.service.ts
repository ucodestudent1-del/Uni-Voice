import { onboardingRepository } from "../repositories/onboarding.repo.js";
import type { OnboardingStepRecord, OnboardingProgress } from "../domain/onboarding.js";
import { ONBOARDING_STEPS } from "../domain/onboarding.js";

export class OnboardingService {
  async ensureSteps(businessId: string): Promise<void> {
    const records = await onboardingRepository.findByBusinessId(businessId);
    if (records.length === 0) {
      await onboardingRepository.seedSteps(businessId);
    }
  }

  async getProgress(businessId: string): Promise<OnboardingProgress> {
    await this.ensureSteps(businessId);
    const records = await onboardingRepository.findByBusinessId(businessId);

    const completedSteps = records.filter((r) => r.status === "completed").length;
    const totalSteps = ONBOARDING_STEPS.length;
    const percentComplete = Math.round((completedSteps / totalSteps) * 100);
    const isComplete = records.some((r) => r.step === "complete" && r.status === "completed");
    const currentStep = this.getCurrentStep(records);

    return {
      steps: records,
      currentStep,
      completedSteps,
      totalSteps,
      percentComplete,
      isComplete,
    };
  }

  async completeStep(businessId: string, step: string): Promise<OnboardingStepRecord> {
    await this.ensureSteps(businessId);
    const updated = await onboardingRepository.completeStep(businessId, step);

    if (step === "invoice") {
      await onboardingRepository.markComplete(businessId);
    }

    const next = this.getNextStep(step);
    if (next && next !== "complete") {
      await onboardingRepository.updateStepStatus(businessId, next, "in_progress").catch(() => {});
    }

    return updated;
  }

  async startStep(businessId: string, step: string): Promise<OnboardingStepRecord> {
    await this.ensureSteps(businessId);
    return onboardingRepository.updateStepStatus(businessId, step, "in_progress");
  }

  async skipStep(businessId: string, step: string): Promise<OnboardingStepRecord> {
    await this.ensureSteps(businessId);
    return onboardingRepository.updateStepStatus(businessId, step, "skipped");
  }

  async isOnboardingComplete(businessId: string): Promise<boolean> {
    await this.ensureSteps(businessId);
    return onboardingRepository.isComplete(businessId);
  }

  async getProgressAfterAction(businessId: string, actionStep: string): Promise<OnboardingProgress> {
    await this.completeStep(businessId, actionStep);
    return this.getProgress(businessId);
  }

  private getCurrentStep(records: OnboardingStepRecord[]): string {
    const inProgress = records.find((r) => r.status === "in_progress");
    if (inProgress) return inProgress.step;

    const next = records.find((r) => r.status === "pending");
    if (next) return next.step;

    return "complete";
  }

  private getNextStep(currentStep: string): string | null {
    const idx = ONBOARDING_STEPS.findIndex((s) => s.step === currentStep);
    if (idx === -1 || idx === ONBOARDING_STEPS.length - 1) return null;
    return ONBOARDING_STEPS[idx + 1].step;
  }
}

export const onboardingService = new OnboardingService();
