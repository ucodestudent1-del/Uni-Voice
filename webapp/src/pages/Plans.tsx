import { useEffect, useState } from "react";
import { useSubscription } from "../contexts/SubscriptionContext";
import { getPlans as apiGetPlans } from "../api/client";

interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string;
  price_monthly: number;
  price_yearly: number;
}

export default function Plans() {
  const { plan, upgrade, downgrade, loading } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [upgrading, setUpgrading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    apiGetPlans().then((data) => setPlans(data.plans ?? [])).catch(() => {});
  }, []);

  async function handleUpgrade(planCode: string) {
    setUpgrading(true);
    try {
      await upgrade(planCode, billingCycle);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to start checkout");
    } finally {
      setUpgrading(false);
    }
  }

  async function handleDowngrade(planCode: string) {
    setUpgrading(true);
    try {
      await downgrade(planCode);
      alert("Plan downgraded successfully!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to downgrade");
    } finally {
      setUpgrading(false);
    }
  }

  const tierOrder = { free: 0, pro: 1, business: 2 };
  const currentTier = plan ? tierOrder[plan.code as keyof typeof tierOrder] ?? 0 : -1;

  const features = {
    free: ["Create unlimited invoices (up to 10)", "Add customers", "Basic templates", "PDF generation", "Multiple currencies"],
    pro: ["Unlimited invoices", "Unlimited customers", "Custom branding", "Premium templates", "Recurring invoices", "Automated reminders", "Payment links", "CSV/Excel export", "Automatic numbering"],
    business: ["Everything in Pro", "Quotes/Estimates", "Purchase Orders", "Receipts", "Credit Notes", "Customer Statements", "Revenue Dashboards", "Tax Summaries", "Expense Tracking", "P&L Reports", "API Access", "Multiple Businesses"],
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Choose Your Plan</h2>

      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">Billing cycle:</label>
        <select
          value={billingCycle}
          onChange={(e) => setBillingCycle(e.target.value as "monthly" | "yearly")}
          className="border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm"
        >
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      {loading && <div className="text-center py-10">Loading...</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = plan?.id === p.id;
          const planTier = tierOrder[p.code as keyof typeof tierOrder] ?? 0;
          const isUpgrade = planTier > currentTier;
          const isDowngrade = planTier < currentTier;
          const price = billingCycle === "yearly" ? p.price_yearly : p.price_monthly;
          const period = billingCycle === "yearly" ? "/year" : "/month";

          return (
            <div key={p.id} className={`bg-white rounded-lg shadow-lg border-2 ${isCurrent ? "border-blue-500" : "border-gray-200"}`}>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900">{p.name}</h3>
                <p className="mt-2 text-sm text-gray-500">{p.description}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">${price}</span>
                  <span className="text-gray-500">{period}</span>
                </div>
                {billingCycle === "yearly" && p.price_yearly > 0 && (
                  <p className="mt-1 text-xs text-gray-500">Billed annually (${p.price_yearly}/year)</p>
                )}
                <ul className="mt-6 space-y-3">
                  {(features[p.code as keyof typeof features] ?? []).map((feat) => (
                    <li key={feat} className="flex items-start">
                      <svg className="h-5 w-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-600">{feat}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCurrent ? (
                    <button disabled className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600">
                      Current Plan
                    </button>
                  ) : isUpgrade ? (
                    <button
                      onClick={() => handleUpgrade(p.code)}
                      disabled={upgrading}
                      className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {upgrading ? "Processing..." : "Upgrade"}
                    </button>
                  ) : isDowngrade ? (
                    <button
                      onClick={() => handleDowngrade(p.code)}
                      disabled={upgrading}
                      className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      {upgrading ? "Processing..." : "Downgrade"}
                    </button>
                  ) : (
                    <button disabled className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-400">
                      Select
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
