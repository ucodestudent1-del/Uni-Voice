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
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
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
