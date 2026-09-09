import { useEffect, useState } from "react";
import { useSubscription } from "../contexts/SubscriptionContext";
import { getPlans as apiGetPlans } from "../api/client";
import SubscriptionCard from "../components/SubscriptionCard";

interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
}

const TIER_ORDER = { free: 0, pro: 1, business: 2 };

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    "Up to 5 invoices per month",
    "5 customers",
    "Basic templates",
    "PDF generation & download",
    "Multiple currencies",
    "Basic customization",
  ],
  pro: [
    "Unlimited invoices",
    "Unlimited customers",
    "Custom branding (logo, colors, fonts)",
    "Premium templates",
    "Recurring invoices",
    "Scheduled invoices",
    "Automated payment reminders",
    "Payment links",
    "Invoice status tracking",
    "Invoice duplication",
    "CSV/Excel exports",
    "Custom payment terms",
    "Multiple tax rates",
    "Cloud backup & sync",
    "Automatic numbering",
    "Saved invoice presets",
  ],
  business: [
    "Everything in Pro",
    "Quotes & estimates",
    "Convert quotes to invoices",
    "Purchase orders",
    "Receipts",
    "Credit notes & refunds",
    "Customer statements",
    "Late payment tracking",
    "Revenue dashboards",
    "Paid/unpaid analytics",
    "Tax summaries",
    "Income reports",
    "Expense tracking",
    "Profit & loss reporting",
    "Product/service catalogs",
    "Multiple businesses/brands",
    "Custom invoice fields",
    "Custom document numbering",
    "Advanced PDF customization",
    "Bulk invoice creation/export",
    "Data backup/export",
    "API access",
  ],
};

export default function Plans() {
  const { plan, upgrade, downgrade, loading } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    apiGetPlans()
      .then((data) => setPlans(data.plans ?? []))
      .catch(() => {});
  }, []);

  function handleUpgrade(p: Plan) {
    const cycle = billingCycle;
    upgrade(p.code, cycle);
  }

  function handleDowngrade(p: Plan) {
    downgrade(p.code);
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Choose your plan</h1>
        <p className="text-slate-600 mt-2 max-w-2xl mx-auto">
          No per-invoice fees. No hidden costs. Cancel anytime.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-medium ${billingCycle === "monthly" ? "text-slate-900" : "text-slate-500"}`}>
          Monthly
        </span>
        <button
          onClick={() => setBillingCycle("yearly")}
          className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
            billingCycle === "yearly" ? "bg-primary-600" : "bg-slate-300"
          }`}
        >
          <span className={`absolute inset-0 flex items-center justify-between px-1`}></span>
          <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
            billingCycle === "yearly" ? "translate-x-6" : ""
          }`} />
        </button>
        <span className={`text-sm font-medium ${billingCycle === "yearly" ? "text-slate-900" : "text-slate-500"}`}>
          Annual
        </span>
        {billingCycle === "yearly" && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            Save up to 29%
          </span>
        )}
      </div>

      {loading && <div className="text-center py-10 text-slate-500">Loading plans...</div>}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 max-w-6xl mx-auto">
        {plans.map((p) => {
          const isCurrent = plan?.id === p.id;
          const planTier = TIER_ORDER[p.code as keyof typeof TIER_ORDER] ?? 0;
          const currentTier = plan ? TIER_ORDER[plan.code as keyof typeof TIER_ORDER] ?? 0 : -1;
          const isUpgrade = planTier > currentTier;
          const isDowngrade = planTier < currentTier;
          const price = billingCycle === "yearly" ? p.price_yearly : p.price_monthly;
          const isPro = p.code === "pro";
          const isBusiness = p.code === "business";
          const features = PLAN_FEATURES[p.code] ?? [];

          return (
            <div
              key={p.id}
              className={`relative rounded-xl border bg-white p-8 shadow-sm ${
                isPro
                  ? "border-2 border-primary-500 shadow-xl"
                  : isBusiness
                    ? "border-dashed border-slate-300"
                    : "border-slate-200"
              }`}
            >
              {isPro && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-primary-600 px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                </div>
              )}
              {isBusiness && (
                <div className="absolute -top-4 right-4">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    Beta — Invite only
                  </span>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-900">{p.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{p.description}</p>

                <div className="mt-6">
                  <span className="text-4xl font-bold text-slate-900">${price}</span>
                  <span className="text-slate-500">/{billingCycle === "yearly" ? "year" : "month"}</span>
                </div>
                {billingCycle === "yearly" && price > 0 && (
                  <p className="mt-1 text-xs text-slate-500">Billed annually</p>
                )}
                {isPro && billingCycle === "yearly" && (
                  <p className="mt-1 text-xs text-green-600 font-medium">
                    ${p.price_yearly}/year — save {Math.round((1 - p.price_yearly / (p.price_monthly * 12)) * 100)}%
                  </p>
                )}
              </div>

              <ul className="mt-8 space-y-3">
                {features.map((feat) => (
                  <li key={feat} className="flex items-start">
                    <svg className="h-5 w-5 text-green-400 mr-2 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-slate-600">{feat}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {isCurrent ? (
                  <button disabled className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-slate-300">
                    Current Plan
                  </button>
                ) : isUpgrade ? (
                  <button
                    onClick={() => handleUpgrade(p)}
                    className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white ${
                      isPro ? "bg-primary-600 hover:bg-primary-700" : "bg-slate-900 hover:bg-slate-800"
                    }`}
                  >
                    {isBusiness ? "Request Invite" : "Upgrade"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleDowngrade(p)}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300"
                  >
                    {isDowngrade ? "Downgrade" : "Select Plan"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="max-w-4xl mx-auto mt-12 bg-slate-50 rounded-xl p-6">
        <h3 className="text-center text-lg font-semibold text-slate-900 mb-4">No per-invoice fees</h3>
        <p className="text-center text-sm text-slate-600">
          Pay one flat monthly or annual subscription fee. Send as many invoices as you want.
          Upgrade or downgrade at any time. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
