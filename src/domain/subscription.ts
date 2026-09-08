export type PlanCode = "free" | "pro" | "business";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "cancelled" | "expired";

export interface Plan {
  id: string;
  code: PlanCode;
  name: string;
  description?: string | null;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlag {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  isPremium: boolean;
  requiresPlan?: PlanCode;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessSubscription {
  id: string;
  businessId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date | null;
  cancelledAt?: Date | null;
  stripeSubscriptionId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageQuota {
  id: string;
  businessId: string;
  featureCode: string;
  periodStart: Date;
  periodEnd: Date;
  usedCount: number;
  limitCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionEvent {
  id: string;
  businessId: string;
  subscriptionId: string;
  eventType: string;
  fromPlan?: PlanCode;
  toPlan?: PlanCode;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface EntitlementCheck {
  featureCode: string;
  allowed: boolean;
  reason?: string;
  limitCount?: number;
  usedCount?: number;
  remaining?: number;
}
