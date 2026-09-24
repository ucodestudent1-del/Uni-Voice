import { ReactNode } from "react";
import { useSubscription } from "../contexts/SubscriptionContext";
import type { FeatureFlag } from "@/types/api";
import type { FeatureFlagProps } from "@/types/components";
import UpgradePrompt from "./UpgradePrompt";

export { FeatureFlagProps };

export default function FeatureGate({ feature, children, fallback }: FeatureFlagProps) {
  const { plan, features } = useSubscription();

  if (!plan) {
    return <>{fallback ?? null}</>;
  }

  const featureFlag = (features as FeatureFlag[]).find((f) => f.code === feature);
  if (!featureFlag) {
    return <>{children}</>;
  }

  const tierOrder = { free: 0, pro: 1, scale: 2, business: 3 };
  const currentTier = tierOrder[plan.code as keyof typeof tierOrder] ?? 0;
  const requiredTier = featureFlag.requires_plan ? tierOrder[featureFlag.requires_plan as keyof typeof tierOrder] ?? 2 : 0;

  if (currentTier >= requiredTier) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return <UpgradePrompt feature={feature} requiredPlan={featureFlag.requires_plan} message={featureFlag.description || `Requires ${featureFlag.requires_plan} plan`} />;
}
