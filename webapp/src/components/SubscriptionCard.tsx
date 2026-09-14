import { useSubscription } from "../contexts/SubscriptionContext";

interface SubscriptionCardProps {
  onUpgrade?: () => void;
  compact?: boolean;
}

export default function SubscriptionCard({ onUpgrade, compact = false }: SubscriptionCardProps) {
  const { plan, subscription, loading } = useSubscription();

  if (loading) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white p-6 ${compact ? "" : "text-center"}`}>
        <p className="text-sm text-slate-500">Loading plan...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white p-6 ${compact ? "text-center" : ""}`}>
        <div className={`flex items-center ${compact ? "justify-center flex-col" : "gap-4"}`}>
           <div className="rounded-full bg-slate-100 p-3">
             <span className="text-slate-600 text-xl">★</span>
           </div>
          <div className={compact ? "text-center" : ""}>
            <p className="text-lg font-semibold text-slate-900">Free Plan</p>
            <p className="text-sm text-slate-500">You are on the free plan</p>
          </div>
        </div>
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="mt-4 w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
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
    subscription?.status === "active" ? "bg-green-100 text-green-800" :
    subscription?.status === "trialing" ? "bg-blue-100 text-blue-800" :
    subscription?.status === "past_due" ? "bg-amber-100 text-amber-800" :
    subscription?.status === "cancelled" ? "bg-red-100 text-red-800" :
    "bg-slate-100 text-slate-800";

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 ${compact ? "text-center" : ""}`}>
      {!compact && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Current Plan</h3>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
            {subscription?.status ?? "free"}
          </span>
        </div>
      )}

      <div className={`flex items-center ${compact ? "justify-center flex-col" : "gap-4"}`}>
        <div className={`rounded-full ${isFree ? "bg-slate-100" : isPro ? "bg-primary-100" : "bg-accent-100"} p-3`}>
          {plan.code === "free" ? "★" : plan.code === "pro" ? "★" : "★"}
        </div>
          <div>
            <p className={`font-bold ${compact ? "text-center" : ""}`}>
              <span className="text-2xl text-slate-900">${plan.price || 0}</span>
              {!isFree && <span className="text-slate-500">/month</span>}
            </p>
            <p className={`text-sm text-slate-600 ${compact ? "text-center" : ""}`}>{plan.name}</p>
          </div>
      </div>

      {!compact && (
        <p className="mt-3 text-sm text-slate-600">{plan.description}</p>
      )}

      {isFree && onUpgrade && (
        <button
          onClick={onUpgrade}
          className="mt-4 w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Upgrade to Pro
        </button>
      )}
    </div>
  );
}
