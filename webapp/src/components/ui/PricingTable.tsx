import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckIcon } from "./icons";
import type { PricingTier } from "../../data/landing";

export interface PricingTableProps {
  tiers: PricingTier[];
  billingCycle?: "monthly" | "yearly";
  onBillingCycleChange?: (cycle: "monthly" | "yearly") => void;
  onSelect?: (tier: PricingTier) => void;
  currentPlanCode?: string;
  showBillingToggle?: boolean;
  subtitle?: string;
  className?: string;
}

function annualSavings(monthly: number, yearly: number): number | null {
  if (monthly <= 0) return null;
  const monthlyAnnual = monthly * 12;
  if (yearly >= monthlyAnnual) return null;
  return Math.round((1 - yearly / monthlyAnnual) * 100);
}

const borderColor: Record<string, string> = {
  free: "border-slate-200",
  pro: "border-primary-500",
  business: "border-slate-300",
};

const badgeColor: Record<string, string> = {
  free: "bg-slate-100 text-slate-800",
  pro: "bg-primary-100 text-primary-800",
  business: "bg-slate-100 text-slate-800",
};

export default function PricingTable({
  tiers,
  billingCycle = "monthly",
  onBillingCycleChange,
  onSelect,
  currentPlanCode,
  showBillingToggle = true,
  subtitle,
  className,
}: PricingTableProps) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">(billingCycle);

  const handleToggle = (next: "monthly" | "yearly") => {
    setCycle(next);
    onBillingCycleChange?.(next);
  };

  return (
    <div className={className ?? ""}>
      {showBillingToggle && (
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm font-medium ${cycle === "monthly" ? "text-slate-900" : "text-slate-500"}`}>
            Monthly
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={cycle === "yearly"}
            onClick={() => handleToggle(cycle === "yearly" ? "monthly" : "yearly")}
            className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
              cycle === "yearly" ? "bg-primary-600" : "bg-slate-300"
            }`}
          >
            <span className="absolute inset-0 flex items-center justify-between px-1">
              <span className="h-3 w-3 rounded-full bg-white" />
              <span className="h-3 w-3 rounded-full bg-white" />
            </span>
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                cycle === "yearly" ? "translate-x-6" : ""
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${cycle === "yearly" ? "text-slate-900" : "text-slate-500"}`}>
            Annual
          </span>
          {cycle === "yearly" && (
            <AnnualSavingsBadge maxSavings={tiers.reduce((m, t) => Math.max(m, annualSavings(t.price.monthly, t.price.yearly) ?? 0), 0)} />
          )}
        </div>
      )}

      <p className="text-center text-slate-500 mb-10 max-w-2xl mx-auto">{subtitle}</p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {tiers.map((tier) => {
          const isCurrent = currentPlanCode === tier.id;
          const isHighlighted = tier.highlighted;
          const savings = annualSavings(tier.price.monthly, tier.price.yearly);
          const priceValue = cycle === "yearly" ? tier.price.yearly : tier.price.monthly;
          const priceLabel = cycle === "yearly" ? "/year" : "/month";

          const CTA = () => {
            const base =
              "mt-8 block text-center rounded-lg px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2";
            if (isCurrent) {
              return (
                <button type="button" disabled className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white bg-slate-300">
                  Current Plan
                </button>
              );
            }
            if (isHighlighted) {
              return (
                <button
                  type="button"
                  onClick={() => onSelect?.(tier)}
                  className={`${base} text-white bg-primary-600 hover:bg-primary-700 focus:ring-primary-500`}
                >
                  {tier.cta ?? "Get Started"}
                </button>
              );
            }
            const isFree = tier.id === "free";
            return tier.ctaLink ? (
              <Link
                to={tier.ctaLink}
                className={`${base} ${isFree ? "text-primary-700 bg-primary-50 hover:bg-primary-100 focus:ring-primary-500" : "text-slate-700 bg-slate-50 hover:bg-slate-100 focus:ring-slate-400"}`}
              >
                {tier.cta ?? "Select Plan"}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onSelect?.(tier)}
                className={`${base} ${isFree ? "text-primary-700 bg-primary-50 hover:bg-primary-100 focus:ring-primary-500" : "text-slate-700 bg-slate-50 hover:bg-slate-100 focus:ring-slate-400"}`}
              >
                {tier.cta ?? "Select Plan"}
              </button>
            );
          };

          return (
            <div
              key={tier.id}
              className={`relative flex flex-col rounded-xl border bg-white p-7 shadow-sm transition-shadow hover:shadow-md ${
                isHighlighted ? "border-2 border-primary-500 shadow-xl" : `${borderColor[tier.id] ?? "border-slate-200"}`
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span
                    className={`inline-flex items-center rounded-full px-3.5 py-1 text-xs font-semibold ${badgeColor[tier.id] ?? "bg-slate-100 text-slate-800"}`}
                  >
                    {tier.badge}
                  </span>
                </div>
              )}
              {tier.beta && (
                <div className="absolute -top-4 right-4">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {tier.betaLink ? <Link to={tier.betaLink} className="hover:underline">Beta — Invite only</Link> : "Beta — Invite only"}
                  </span>
                </div>
              )}

              <h3 className="text-2xl font-bold text-slate-900">{tier.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{tier.description}</p>

              <div className="mt-6">
                <span className="text-4xl font-bold text-slate-900">${priceValue}</span>
                <span className="text-slate-500">{priceLabel}</span>
                {cycle === "yearly" && savings != null && (
                  <span className="ml-2 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    Save {savings}%
                  </span>
                )}
                {tier.saveText && cycle === "yearly" && (
                  <p className="mt-1 text-xs text-slate-500">{tier.saveText}</p>
                )}
              </div>

              <ul className="mt-6 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-400 mr-2 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto">{CTA()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnnualSavingsBadge({ maxSavings }: { maxSavings: number }) {
  if (!maxSavings) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
      Save up to {maxSavings}%
    </span>
  );
}
