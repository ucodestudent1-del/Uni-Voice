import { useEffect, useState } from "react";
import { getPlans, upgradeSubscription, cancelSubscription } from "../api/client";
import { useSubscription } from "../contexts/SubscriptionContext";
import type { ApiPlan } from "../types/api";
import UpgradePrompt from "../components/UpgradePrompt";

const PLAN_FEATURES: Record<string, { label: string; available: boolean }[]> = {
  free: [
    { label: "Unlimited invoices", available: true },
    { label: "Up to 5 customers", available: true },
    { label: "Basic templates", available: true },
    { label: "Online payments", available: false },
    { label: "Recurring invoices", available: false },
  ],
  pro: [
    { label: "Unlimited invoices", available: true },
    { label: "Unlimited customers", available: true },
    { label: "All templates", available: true },
    { label: "Online payments", available: true },
    { label: "Recurring invoices", available: true },
  ],
};

export default function Plans() {
  const { plan, subscription, loading: subLoading, refresh } = useSubscription();
  const [allPlans, setAllPlans] = useState<ApiPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tierOrder = { free: 0, pro: 1 };
  const sortedPlans = [...allPlans].sort(
    (a, b) => (tierOrder[a.code as keyof typeof tierOrder] ?? 99) - (tierOrder[b.code as keyof typeof tierOrder] ?? 99),
  );

  useEffect(() => {
    async function loadPlans() {
      try {
        const data = await getPlans();
        setAllPlans(data.plans ?? []);
      } catch {
        setAllPlans([]);
      } finally {
        setLoadingPlans(false);
      }
    }
    loadPlans();
  }, []);

  const handleUpgrade = async (planCode: string) => {
    setUpgrading(planCode);
    setError(null);
    try {
      const data = await upgradeSubscription(planCode);
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to start upgrade");
    } finally {
      setUpgrading(null);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSubscription();
      await refresh();
    } catch {
      setError("Failed to cancel subscription");
    }
  };

  if (subLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-secondary">Loading subscription…</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary">Plans & Pricing</h1>
        <p className="text-sm text-secondary mt-1">
          {plan ? `You are currently on the ${plan.name} plan.` : "You are on the Free plan. Upgrade to unlock more features."}
        </p>
      </div>

      {error && (
        <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text">
          {error}
        </div>
      )}

      {subscription?.status === "cancelled" && (
        <div className="rounded-lg status-warning-bg border status-warning-border px-4 py-3 text-sm text-secondary">
          Your subscription is cancelled and will expire at the end of the current billing period.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loadingPlans
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-color-subtle bg-surface p-6 animate-pulse">
                <div className="h-4 bg-surface-alt rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-surface-alt rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-surface-alt rounded w-full mb-6"></div>
                <div className="h-8 bg-surface-alt rounded w-full"></div>
              </div>
            ))
          : sortedPlans.map((p) => {
              const isCurrent = p.code === plan?.code;
              const isFree = p.code === "free";
              const tierIndex = tierOrder[p.code as keyof typeof tierOrder] ?? 0;
              const currentTierIndex = plan ? (tierOrder[plan.code as keyof typeof tierOrder] ?? 0) : 0;
              const canDowngrade = tierIndex < currentTierIndex;
              const canUpgrade = tierIndex > currentTierIndex && !isFree;

              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-6 transition-all ${
                    isCurrent
                      ? "border-2 border-primary-600 bg-primary-bg"
                      : "border-color-subtle bg-surface hover:border-color-strong"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-primary">{p.name}</h3>
                    {isCurrent && (
                      <span className="text-xs font-medium text-primary-brand">Current</span>
                    )}
                  </div>

                  <div className="mt-4">
                    <span className="text-3xl font-bold text-primary">${p.price || 0}</span>
                    {!isFree && <span className="text-sm text-secondary">/month</span>}
                  </div>

                  {p.description && (
                    <p className="mt-2 text-sm text-secondary">{p.description}</p>
                  )}

                  <div className="mt-4 space-y-2">
                    {(PLAN_FEATURES[p.code] ?? PLAN_FEATURES.free).map((f) => (
                      <div key={f.label} className="flex items-center gap-2">
                        <span
                          className={`text-xs ${f.available ? "status-success-text" : "text-muted"}`}
                        >
                          {f.available ? "✓" : "✕"}
                        </span>
                        <span className="text-sm text-secondary">{f.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    {isCurrent ? (
                      <button
                        onClick={canDowngrade ? handleCancel : undefined}
                        className={`w-full rounded-lg px-4 py-2 text-sm font-medium ${
                          canDowngrade
                            ? "border border-color-subtle text-secondary hover:bg-surface-alt"
                            : "bg-surface-alt text-secondary cursor-default"
                        }`}
                      >
                        {canDowngrade ? "Downgrade" : "Current Plan"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(p.code)}
                        disabled={upgrading === p.code}
                        className="w-full rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
                      >
                        {upgrading === p.code ? "Redirecting…" : isFree ? "Use Free" : "Upgrade"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
      </div>

      {!plan && <UpgradePrompt feature="upgrade to a paid plan" />}
    </div>
  );
}
