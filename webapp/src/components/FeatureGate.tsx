import { ReactNode } from "react";
import { useSubscription } from "../contexts/SubscriptionContext";
import UpgradePrompt from "./UpgradePrompt";

interface FeatureGateProps {
  feature: string;
  requiredPlan?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function FeatureGate({ feature, requiredPlan, children, fallback }: FeatureGateProps) {
  const { plan, features } = useSubscription();

  if (!plan) {
    return <>{fallback ?? null}</>;
  }

  const featureFlag = features.find((f: any) => f.code === feature);
  if (!featureFlag) {
    return <>{children}</>;
  }

  const tierOrder = { free: 0, pro: 1, business: 2 };
  const currentTier = tierOrder[plan.code as keyof typeof tierOrder] ?? 0;
  const requiredTier = featureFlag.requires_plan ? tierOrder[featureFlag.requires_plan as keyof typeof tierOrder] ?? 2 : 0;

  if (currentTier >= requiredTier) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <UpgradePrompt feature={feature} requiredPlan={featureFlag.requires_plan} message={featureFlag.description || `Requires ${featureFlag.requires_plan} plan`} />
  );
}
