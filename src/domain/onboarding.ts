export type OnboardingStepStatus = "pending" | "in_progress" | "completed" | "skipped";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { step: "welcome", title: "Welcome", description: "Your account is ready. Let's get you set up.", sortOrder: 1 },
  { step: "business", title: "Business Profile", description: "Complete your business details so your invoices look professional.", sortOrder: 2 },
  { step: "customer", title: "Add Customer", description: "Add your first customer to get started.", sortOrder: 3 },
  { step: "product", title: "Add Product or Service", description: "Create a product or service you can add to invoices.", sortOrder: 4 },
  { step: "invoice", title: "Create Invoice", description: "Draft your first invoice to see how it works.", sortOrder: 5 },
  { step: "complete", title: "Done!", description: "You're all set. Start invoicing with confidence.", sortOrder: 6 },
];

export interface OnboardingStep {
  step: string;
  title: string;
  description: string;
  sortOrder: number;
}

export interface OnboardingStepRecord {
  id: string;
  businessId: string;
  step: string;
  title: string;
  description: string | null;
  status: OnboardingStepStatus;
  completedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingProgress {
  steps: OnboardingStepRecord[];
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
  percentComplete: number;
  isComplete: boolean;
}
