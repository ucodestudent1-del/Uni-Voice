import { useSubscription } from "../contexts/SubscriptionContext";

interface UpgradePromptProps {
  feature: string;
  requiredPlan?: string;
  message?: string;
  children?: React.ReactNode;
}

export default function UpgradePrompt({ feature, requiredPlan, message, children }: UpgradePromptProps) {
  const { plan } = useSubscription();

  if (!plan || !requiredPlan) {
    return <>{children}</>;
  }

  const tierOrder = { free: 0, pro: 1, business: 2 };
  const currentTier = tierOrder[plan.code as keyof typeof tierOrder] ?? 0;
  const requiredTier = tierOrder[requiredPlan as keyof typeof tierOrder] ?? 2;

  if (currentTier >= requiredTier) {
    return <>{children}</>;
  }

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <span className="text-yellow-400 text-xl">⚠</span>
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700">
            {message ?? `This feature requires a ${requiredPlan} plan. Upgrade to unlock it.`}
          </p>
          <div className="mt-2">
            <a href="/plans" className="text-sm font-medium text-yellow-700 underline hover:text-yellow-600">
              View Plans
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
