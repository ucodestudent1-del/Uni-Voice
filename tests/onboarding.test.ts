import { describe, it, expect, beforeEach } from "vitest";
import { onboardingService } from "../src/services/onboarding.service.js";
import { onboardingRepository } from "../src/repositories/onboarding.repo.js";
import { resetTestDb, createTestUser } from "./helpers/db.js";

describe("OnboardingService (DB integration)", () => {
  let user: { id: string; email: string; businessId: string };

  beforeEach(async () => {
    await resetTestDb();
    user = await createTestUser();
  });

  it("seeds onboarding steps for a new business", async () => {
    const progress = await onboardingService.getProgress(user.businessId);

    expect(progress.totalSteps).toBe(6);
    expect(progress.completedSteps).toBe(0);
    expect(progress.isComplete).toBe(false);
    expect(progress.currentStep).toBe("welcome");
    expect(progress.percentComplete).toBe(0);
  });

  it("completes the welcome step and advances to the next", async () => {
    await onboardingService.completeStep(user.businessId, "welcome");

    const progress = await onboardingService.getProgress(user.businessId);
    const welcome = progress.steps.find((s) => s.step === "welcome");
    expect(welcome?.status).toBe("completed");

    const business = progress.steps.find((s) => s.step === "business");
    expect(business?.status).toBe("in_progress");
    expect(progress.currentStep).toBe("business");
  });

  it("completing the invoice step marks onboarding as complete", async () => {
    for (const step of ["welcome", "business", "customer", "product", "invoice"]) {
      await onboardingService.completeStep(user.businessId, step);
    }

    const progress = await onboardingService.getProgress(user.businessId);
    expect(progress.isComplete).toBe(true);
    expect(progress.completedSteps).toBe(6);
    expect(progress.percentComplete).toBe(100);
  });

  it("skipStep marks a step as skipped", async () => {
    await onboardingService.skipStep(user.businessId, "customer");

    const progress = await onboardingService.getProgress(user.businessId);
    const customer = progress.steps.find((s) => s.step === "customer");
    expect(customer?.status).toBe("skipped");
  });

  it("isOnboardingComplete returns false initially and true after completion", async () => {
    expect(await onboardingService.isOnboardingComplete(user.businessId)).toBe(false);

    for (const step of ["welcome", "business", "customer", "product", "invoice"]) {
      await onboardingService.completeStep(user.businessId, step);
    }

    expect(await onboardingService.isOnboardingComplete(user.businessId)).toBe(true);
  });

  it("startStep sets a step to in_progress", async () => {
    const updated = await onboardingService.startStep(user.businessId, "business");
    expect(updated.status).toBe("in_progress");

    const progress = await onboardingService.getProgress(user.businessId);
    const business = progress.steps.find((s) => s.step === "business");
    expect(business?.status).toBe("in_progress");
  });

  it("completeStep on invoice auto-completes the 'complete' step", async () => {
    for (const step of ["welcome", "business", "customer", "product", "invoice"]) {
      await onboardingService.completeStep(user.businessId, step);
    }

    const completeStep = await onboardingRepository.findStep(user.businessId, "complete");
    expect(completeStep?.status).toBe("completed");
    expect(completeStep?.completedAt).not.toBeNull();
  });

  it("getProgressAfterAction completes a step and returns updated progress", async () => {
    const progress = await onboardingService.getProgressAfterAction(user.businessId, "welcome");

    const welcome = progress.steps.find((s) => s.step === "welcome");
    expect(welcome?.status).toBe("completed");
    expect(progress.completedSteps).toBe(1);
  });
});
