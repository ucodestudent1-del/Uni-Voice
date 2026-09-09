import { useEffect, useState } from "react";
import { useSubscription } from "../contexts/SubscriptionContext";
import { getPlans as apiGetPlans } from "../api/client";
import PricingTable from "../components/ui/PricingTable";
import type { PricingTier } from "../data/landing";

interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
}

const TIER_ORDER: Record<string, number> = { free: 0, pro: 1, business: 2 };

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

  useEffect(() => {
    apiGetPlans()
      .then((data) => setPlans(data.plans ?? []))
      .catch(() => {});
  }, []);

  function toTier(p: Plan): PricingTier {
    return {
      code: p.code,
      name: p.name,
      description: p.description ?? "",
      price: p.price,
      currency: p.currency ?? "USD",
      features: PLAN_FEATURES[p.code] ?? [],
      highlighted: p.code === "pro",
      badge: p.code === "pro" ? "Most Popular" : undefined,
      beta: p.code === "business",
      cta:
        p.code === "business" ? "Request Invite" :
        p.code === "free" ? "Get Started" :
        "Start free trial",
      ctaLink: "/register",
    };
  }

  function handleSelect(tier: PricingTier) {
    const current = plan ? TIER_ORDER[plan.code] ?? 0 : -1;
    const target = TIER_ORDER[tier.code] ?? 0;
    if (target > current) upgrade(tier.code);
    else if (target < current) downgrade(tier.code);
  }

  if (loading && !plans.length) {
    return <div className="text-center py-10 text-slate-500">Loading plans...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Choose your plan</h1>
        <p className="text-slate-600 mt-2 max-w-2xl mx-auto">
          No per-invoice fees. No hidden costs. Cancel anytime.
        </p>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-10 text-slate-500">No plans available right now.</div>
      ) : (
        <PricingTable
          tiers={plans.map(toTier)}
          onSelect={handleSelect}
          currentPlanCode={plan?.code}
          subtitle="No per-invoice fees. No hidden costs. Cancel anytime."
        />
      )}

      <div className="max-w-4xl mx-auto mt-12 bg-slate-50 rounded-xl p-6">
        <h3 className="text-center text-lg font-semibold text-slate-900 mb-2">No per-invoice fees</h3>
        <p className="text-center text-sm text-slate-600">
          Pay one flat monthly subscription fee. Send as many invoices as you want.
          Upgrade or downgrade at any time. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
