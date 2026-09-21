import { useState, useEffect } from "react";
import { getSubscription, getPlans, upgradeSubscription, cancelSubscription, getBillingInvoices } from "../../api/client";
import { useSubscription } from "../../contexts/SubscriptionContext";
import type { ApiPlan, ApiSubscription, ApiBillingInvoice } from "../../types/api";
import SubscriptionCard from "../SubscriptionCard";

export default function BillingSubscriptionSettings() {
  const { plan, subscription, features, loading: subLoading, refresh } = useSubscription();
  const [invoices, setInvoices] = useState<ApiBillingInvoice[]>([]);
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSaved, setActionSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [inv, pls] = await Promise.all([
          getBillingInvoices().catch(() => ({ invoices: [] })),
          getPlans().catch(() => ({ plans: [] })),
        ]);
        setInvoices(inv.invoices ?? []);
        setPlans(pls.plans ?? []);
      } catch {
        // silent
      } finally {
        setLoadingInvoices(false);
      }
    }
    load();
  }, []);

  async function handleUpgrade(planCode: string) {
    setActionError(null);
    try {
      const data = await upgradeSubscription(planCode);
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      setActionError(err.response?.data?.error || "Failed to upgrade");
    }
  }

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel your subscription? You will lose access to premium features at the end of the current billing period.")) return;
    setCancelling(true);
    setActionError(null);
    setActionSaved(false);
    try {
      await cancelSubscription();
      setActionSaved(true);
      setTimeout(() => setActionSaved(false), 2000);
      await refresh();
    } catch (err: any) {
      setActionError(err.response?.data?.error || "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  }

  if (subLoading) {
    return <div className="text-sm text-secondary">Loading subscription…</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-primary">Billing &amp; Subscription</h2>
        <p className="text-sm text-secondary mt-1">
          View your current plan, usage, payment method, billing history, and upgrade or
          cancellation options.
        </p>
      </div>

      {actionError && (
        <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text">{actionError}</div>
      )}

      {actionSaved && (
        <div className="rounded-lg status-success-bg border status-success-border px-4 py-3 text-sm status-success-text">
          Subscription cancelled. You will retain access through the current billing period.
        </div>
      )}

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Current Plan</h3>
        <SubscriptionCard onUpgrade={() => {}} />
        {plan && plan.code !== "free" && subscription?.status === "active" && (
          <div className="mt-4">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-sm font-medium status-error-text hover:status-error-text disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Cancel Subscription"}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Plan Details</h3>
        {plan ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-color-subtle">
              <span className="text-sm text-secondary">Plan</span>
              <span className="text-sm font-medium text-primary">{plan.name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-color-subtle">
              <span className="text-sm text-secondary">Price</span>
              <span className="text-sm font-medium text-primary">
                {plan.price > 0 ? `$${plan.price}/month` : "Free"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-color-subtle">
              <span className="text-sm text-secondary">Billing Cycle</span>
              <span className="text-sm font-medium text-primary">{subscription?.billingCycle ?? "Monthly"}</span>
            </div>
            {subscription?.currentPeriodStart && subscription?.currentPeriodEnd && (
              <div className="flex items-center justify-between py-2 border-b border-color-subtle">
                <span className="text-sm text-secondary">Current Period</span>
                <span className="text-sm font-medium text-primary">
                  {new Date(subscription.currentPeriodStart).toLocaleDateString()} — {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-2 border-b border-color-subtle">
              <span className="text-sm text-secondary">Status</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                subscription?.status === "active" ? "status-success-bg status-success-text" :
                subscription?.status === "past_due" ? "status-warning-bg status-warning-text" :
                subscription?.status === "cancelled" ? "status-error-bg status-error-text" :
                "bg-surface-alt text-primary"
              }`}>
                {subscription?.status ?? "Free"}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-secondary">No plan information available.</div>
        )}
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.id} className={`border rounded-xl p-4 text-center ${
              p.code === plan?.code ? "border-primary-600 bg-primary-bg" : "border-color-subtle"
            }`}>
              <h4 className="font-semibold text-primary">{p.name}</h4>
              <p className="text-2xl font-bold text-primary mt-2">${p.price || 0}<span className="text-sm text-secondary">/mo</span></p>
              <p className="text-xs text-secondary mt-2">{p.description}</p>
              {p.code !== plan?.code && p.code !== "free" && (
                <button
                  onClick={() => handleUpgrade(p.code)}
                  className="mt-3 w-full rounded-lg bg-primary-action px-3 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
                >
                  Upgrade
                </button>
              )}
              {p.code === plan?.code && (
                <span className="mt-3 inline-block text-xs font-medium text-primary-brand">Current Plan</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Billing History</h3>
        {loadingInvoices ? (
          <div className="text-sm text-secondary">Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div className="text-sm text-secondary">No billing invoices found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr>
                  <th className="text-left font-medium text-secondary">Date</th>
                  <th className="text-left font-medium text-secondary">Amount</th>
                  <th className="text-left font-medium text-secondary">Status</th>
                  <th className="text-right font-medium text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-color-subtle">
                    <td className="py-2 text-primary">{new Date(inv.created * 1000).toLocaleDateString()}</td>
                    <td className="py-2 text-primary">{inv.currency} ${(inv.amount / 100).toFixed(2)}</td>
                    <td className="py-2 text-secondary">{inv.status}</td>
                    <td className="py-2 text-right">
                      {inv.invoicePdf && (
                        <a
                          href={inv.invoicePdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-primary-brand hover:text-primary-brand"
                        >
                          View PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}





