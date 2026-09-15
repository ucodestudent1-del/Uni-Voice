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
    return <div className="text-sm text-slate-500">Loading subscription…</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Billing &amp; Subscription</h2>
        <p className="text-sm text-slate-600 mt-1">
          View your current plan, usage, payment method, billing history, and upgrade or
          cancellation options.
        </p>
      </div>

      {actionError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      {actionSaved && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Subscription cancelled. You will retain access through the current billing period.
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-md font-semibold text-slate-900 mb-4">Current Plan</h3>
        <SubscriptionCard onUpgrade={() => {}} />
        {plan && plan.code !== "free" && subscription?.status === "active" && (
          <div className="mt-4">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-sm font-medium text-red-700 hover:text-red-800 disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Cancel Subscription"}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-md font-semibold text-slate-900 mb-4">Plan Details</h3>
        {plan ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Plan</span>
              <span className="text-sm font-medium text-slate-900">{plan.name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Price</span>
              <span className="text-sm font-medium text-slate-900">
                {plan.price > 0 ? `$${plan.price}/month` : "Free"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Billing Cycle</span>
              <span className="text-sm font-medium text-slate-900">{subscription?.billingCycle ?? "Monthly"}</span>
            </div>
            {subscription?.currentPeriodStart && subscription?.currentPeriodEnd && (
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Current Period</span>
                <span className="text-sm font-medium text-slate-900">
                  {new Date(subscription.currentPeriodStart).toLocaleDateString()} — {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Status</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                subscription?.status === "active" ? "bg-green-100 text-green-800" :
                subscription?.status === "past_due" ? "bg-amber-100 text-amber-800" :
                subscription?.status === "cancelled" ? "bg-red-100 text-red-800" :
                "bg-slate-100 text-slate-800"
              }`}>
                {subscription?.status ?? "Free"}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">No plan information available.</div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-md font-semibold text-slate-900 mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.id} className={`border rounded-xl p-4 text-center ${
              p.code === plan?.code ? "border-primary-600 bg-primary-50" : "border-slate-200"
            }`}>
              <h4 className="font-semibold text-slate-900">{p.name}</h4>
              <p className="text-2xl font-bold text-slate-900 mt-2">${p.price || 0}<span className="text-sm text-slate-500">/mo</span></p>
              <p className="text-xs text-slate-500 mt-2">{p.description}</p>
              {p.code !== plan?.code && p.code !== "free" && (
                <button
                  onClick={() => handleUpgrade(p.code)}
                  className="mt-3 w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  Upgrade
                </button>
              )}
              {p.code === plan?.code && (
                <span className="mt-3 inline-block text-xs font-medium text-primary-700">Current Plan</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-md font-semibold text-slate-900 mb-4">Billing History</h3>
        {loadingInvoices ? (
          <div className="text-sm text-slate-500">Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div className="text-sm text-slate-500">No billing invoices found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr>
                  <th className="text-left font-medium text-slate-500">Date</th>
                  <th className="text-left font-medium text-slate-500">Amount</th>
                  <th className="text-left font-medium text-slate-500">Status</th>
                  <th className="text-right font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-slate-100">
                    <td className="py-2 text-slate-900">{new Date(inv.created * 1000).toLocaleDateString()}</td>
                    <td className="py-2 text-slate-900">{inv.currency} ${(inv.amount / 100).toFixed(2)}</td>
                    <td className="py-2 text-slate-600">{inv.status}</td>
                    <td className="py-2 text-right">
                      {inv.invoicePdf && (
                        <a
                          href={inv.invoicePdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-primary-600 hover:text-primary-700"
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
