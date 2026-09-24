import { useSubscription } from "../contexts/SubscriptionContext";
import type { SubscriptionCardProps } from "@/types/components";

export { SubscriptionCardProps };

export default function SubscriptionCard({ onUpgrade, compact = false }: SubscriptionCardProps) {
  const { plan, subscription, loading } = useSubscription();

  if (loading) {
    return (
      <div className={`rounded-xl border border-color-subtle bg-surface p-6 ${compact ? "" : "text-center"}`}>
        <p className="text-sm text-secondary">Loading plan...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className={`rounded-xl border border-color-subtle bg-surface p-6 ${compact ? "text-center" : ""}`}>
        <div className={`flex items-center ${compact ? "justify-center flex-col" : "gap-4"}`}>
          <div className="rounded-full bg-surface-alt p-3">
            <span className="text-secondary text-xl">★</span>
          </div>
          <div className={compact ? "text-center" : ""}>
            <p className="text-lg font-semibold text-primary">Free Plan</p>
            <p className="text-sm text-secondary">You are on the free plan</p>
          </div>
        </div>
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="mt-4 w-full rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            Upgrade to Pro
          </button>
        )}
      </div>
    );
  }

  const isFree = plan.code === "free";
  const isPro = plan.code === "pro";
  const isBusiness = plan.code === "business";

  const statusColor =
    subscription?.status === "active" ? "status-success-bg status-success-text" :
    subscription?.status === "trialing" ? "status-info-bg status-info-text" :
    subscription?.status === "past_due" ? "status-warning-bg status-warning-text" :
    subscription?.status === "cancelled" ? "status-error-bg status-error-text" :
    "bg-surface-alt text-primary";

  return (
    <div className={`rounded-xl border border-color-subtle bg-surface p-6 ${compact ? "text-center" : ""}`}>
      {!compact && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-primary">Current Plan</h3>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
            {subscription?.status ?? "free"}
          </span>
        </div>
      )}

      <div className={`flex items-center ${compact ? "justify-center flex-col" : "gap-4"}`}>
        <div className={`rounded-full ${isFree ? "bg-surface-alt" : isPro ? "bg-primary-bg" : "bg-info-bg"} p-3`}>
          {plan.code === "free" ? "★" : plan.code === "pro" ? "★" : "★"}
        </div>
        <div>
          <p className={`font-bold ${compact ? "text-center" : ""}`}>
            <span className="text-2xl text-primary">${plan.price || 0}</span>
            {!isFree && <span className="text-secondary">/month</span>}
          </p>
          <p className={`text-sm text-secondary ${compact ? "text-center" : ""}`}>{plan.name}</p>
        </div>
      </div>

      {!compact && (
        <p className="mt-3 text-sm text-secondary">{plan.description}</p>
      )}

      {isFree && onUpgrade && (
        <button
          onClick={onUpgrade}
          className="mt-4 w-full rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
        >
          Upgrade to Pro
        </button>
      )}
    </div>
  );
}
