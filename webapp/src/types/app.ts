import type { ReactNode } from "react";
import type { OnboardingProgress, FeatureFlag, ApiSubscription } from "./api";

export interface User {
  id: string;
  businessId?: string;
  email?: string;
}

export interface AuthContextType {
  user: User | null;
  businessId: string | undefined;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  verifyTwoFactor: (email: string, code: string) => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  onboarding: OnboardingProgress | null;
  completeStep: (step: string) => Promise<OnboardingProgress>;
  skipOnboarding: () => Promise<OnboardingProgress>;
  refreshOnboarding: () => Promise<void>;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: number;
  features?: unknown[];
}

export interface SubscriptionCache {
  plan: Plan | null;
  subscription: ApiSubscription | null;
  features: FeatureFlag[];
  timestamp: number;
}

export interface SubscriptionContextType {
  plan: Plan | null;
  subscription: ApiSubscription | null;
  features: FeatureFlag[];
  loading: boolean;
  refresh: () => Promise<void>;
  upgrade: (planCode: string) => Promise<void>;
  downgrade: (planCode: string) => Promise<void>;
}

export type Theme = "light" | "dark" | "system";

export interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export type PlanTier = "free" | "pro" | "scale" | "business";

export type TierOrder = Record<PlanTier, number>;

export type { ReactNode };
