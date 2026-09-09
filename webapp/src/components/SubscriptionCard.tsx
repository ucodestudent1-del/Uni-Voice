import { useSubscription } from "../contexts/SubscriptionContext";

interface SubscriptionCardProps {
  onUpgrade?: () => void;
  compact?: boolean;
}

export default function SubscriptionCard({ onUpgrade, compact = false }: SubscriptionCardProps) {
  const { plan, subscription } = useSubscription();

  if (!plan) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white p-6 ${compact ? "" : "text-center"}`}>
        <p className="text-sm text-slate-500">Loading plan...</p>
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
          {planIcon(plan.code)}
        </div>
        <div>
          <p className={`font-bold ${compact ? "text-center" : ""}`}>
            <span className="text-2xl text-slate-900">${compact ? (plan.priceMonthly || 0) : (plan.priceMonthly || 0)}</span>
            {!isFree && <span className="text-slate-500">/month</span>}
          </p>
          <p className={`text-sm text-slate-600 ${compact ? "text-center" : ""}`}>{plan.name}</p>
          {!isFree && plan.priceYearly > 0 && (
            <p className="text-xs text-slate-400">
              ${plan.priceYearly}/year ({Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100)}% savings)
            </p>
          )}
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

function planIcon(code: string): JSX.Element {
  switch (code) {
    case "free":
      return (
        <svg className="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
        </svg>
      );
    case "pro":
      return (
        <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 11V7a1 1 0 012 0v4m0 0h4a1 1 0 010 2h-4m-4-2a1 1 0 001 1h.01M9 15a3 3 0 106 0 3 3 0 01-6 0z" />
        </svg>
      );
    case "business":
      return (
        <svg className="h-6 w-6 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0h3m2 0h5m-2 0l-2-2m0 0l-2 2m2-2v-4" />
        </svg>
      );
    default:
      return <svg className="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>;
  }
}
