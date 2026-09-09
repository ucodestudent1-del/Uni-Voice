import { Link } from "react-router-dom";
import { CheckIcon } from "./icons";
import type { PricingTier } from "../../data/landing";

export interface PricingTableProps {
  tiers: PricingTier[];
  onSelect?: (tier: PricingTier) => void;
  currentPlanCode?: string;
  subtitle?: string;
  className?: string;
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
  onSelect,
  currentPlanCode,
  subtitle,
  className,
}: PricingTableProps) {
  return (
    <div className={className ?? ""}>
      <p className="text-center text-slate-500 mb-10 max-w-2xl mx-auto">{subtitle}</p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {tiers.map((tier) => {
          const isCurrent = currentPlanCode === tier.code;
          const isHighlighted = tier.highlighted;

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
            const isFree = tier.code === "free";
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
              key={tier.code}
              className={`relative flex flex-col rounded-xl border bg-white p-7 shadow-sm transition-shadow hover:shadow-md ${
                isHighlighted ? "border-2 border-primary-500 shadow-xl" : `${borderColor[tier.code] ?? "border-slate-200"}`
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span
                    className={`inline-flex items-center rounded-full px-3.5 py-1 text-xs font-semibold ${badgeColor[tier.code] ?? "bg-slate-100 text-slate-800"}`}
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
                <span className="text-4xl font-bold text-slate-900">${tier.price}</span>
                <span className="text-slate-500">/month</span>
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
