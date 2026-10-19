import { useSubscription } from "../contexts/SubscriptionContext";
import type { UpgradePromptProps } from "@/types/components";

export type { UpgradePromptProps };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function UpgradePrompt({ feature, requiredPlan, message, children }: UpgradePromptProps) {
  const { plan } = useSubscription();

  if (!plan || !requiredPlan) {
    return <>{children}</>;
  }

  const tierOrder = { free: 0, pro: 1 };
  const currentTier = tierOrder[plan.code as keyof typeof tierOrder] ?? 0;
  const requiredTier = tierOrder[requiredPlan as keyof typeof tierOrder] ?? 1;

  if (currentTier >= requiredTier) {
    return <>{children}</>;
  }

  return (
    <div className="rounded-xl border border-warning-border bg-warning-bg px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <span className="text-warning-text text-lg">⚠</span>
        </div>
        <div className="flex-1">
          <p className="text-sm text-warning-text">
            {message ?? `This feature requires a ${requiredPlan} plan. Upgrade to unlock it.`}
          </p>
          <div className="mt-2">
            <a href="/app/account?upgrade=true" className="text-sm font-medium text-warning-text underline hover:opacity-80">
              View Plans
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
