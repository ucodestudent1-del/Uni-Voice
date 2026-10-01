import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPlans, upgradeSubscription } from "../api/client";
import type { ApiPlan } from "../types/api";
import { useAuth } from "../contexts/AuthContext";
import { useMetaTags } from "../hooks/useMetaTags";

type TierKey = "free" | "pro";

interface PlanFeature {
  label: string;
  free: boolean;
  pro: boolean;
  footnote?: string;
}

const PLAN_FEATURES: PlanFeature[] = [
  { label: "Send unlimited invoices", free: true, pro: true },
  { label: "Up to 3 customers", free: true, pro: true, footnote: "Free: max 3 customers. Pro: unlimited." },
  { label: "Core invoice templates", free: true, pro: true },
  { label: "Multi-currency support", free: false, pro: true },
  { label: "Online payment collection", free: false, pro: true, footnote: "Stripe & other providers." },
  { label: "Recurring invoices", free: false, pro: true },
  { label: "Payment reminders & auto-followups", free: false, pro: true },
  { label: "Expense tracking", free: false, pro: true },
  { label: "Time tracking", free: false, pro: true },
  { label: "Project management", free: false, pro: true },
  { label: "Custom branding (logo, colors)", free: false, pro: true },
  { label: "Quotes & estimates", free: false, pro: true },
  { label: "Priority support", free: false, pro: true },
];

const TIER_COPY: Record<TierKey, { tagline: string; description: string }> = {
  free: {
    tagline: "Forever free. No credit card.",
    description:
      "Everything you need to create and send professional invoices. Perfect for freelancers and solopreneurs just getting started.",
  },
  pro: {
    tagline: "All features. Billed monthly.",
    description:
      "Full automation, expense tracking, multi-currency, and everything in Free — plus advanced project management, quotes, and financial reporting.",
  },
};

export default function Plans() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [allPlans, setAllPlans] = useState<ApiPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useMetaTags({
    title: "Simple, Transparent Pricing | InvoiceFlow",
    description: "One flat monthly rate. No per-invoice fees. Cancel anytime. Start with our forever-free plan or upgrade to Pro for full automation.",
  });

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

  const proPlan = allPlans.find(
    (p) => p.code === "pro"
  );

  const proPrice = proPlan ? Math.round(proPlan.price) : 30;
  const currencySymbol = proPlan?.currency === "USD" ? "$" : proPlan?.currency ?? "$";

  const handleUpgrade = async () => {
    if (!isAuthenticated) {
      navigate("/register");
      return;
    }
    setUpgrading(true);
    setError(null);
    try {
      const data = await upgradeSubscription("pro");
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to start upgrade");
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-primary sm:text-5xl">Simple, transparent pricing</h1>
          <p className="mt-4 text-lg text-secondary max-w-2xl mx-auto">
            One flat monthly rate. No per-invoice fees. Cancel anytime.
          </p>
        </div>

        {error && (
          <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text mb-6">
            {error}
          </div>
        )}

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Free card */}
          <div className="border border-color-subtle bg-surface rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-primary">Free</h2>
            <p className="mt-1 text-sm text-tertiary">{TIER_COPY.free.tagline}</p>
            <div className="mt-6">
              <span className="text-4xl font-bold text-primary">$0</span>
              <span className="text-sm text-tertiary"> / month</span>
            </div>
            <p className="mt-4 text-sm text-secondary">{TIER_COPY.free.description}</p>

            <div className="mt-8">
              <ul className="space-y-3 text-sm">
                {PLAN_FEATURES.filter((f) => f.free).map((f) => (
                  <li key={f.label} className="flex items-center gap-2">
                    <CheckIcon />
                    <span className="text-secondary">{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <Link
                to={isAuthenticated ? "/app" : "/register"}
                className="block w-full text-center rounded-lg border border-color-subtle bg-surface-alt px-4 py-2.5 text-sm font-medium text-primary hover:bg-surface-alt transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>

          {/* Pro card */}
          <div className="relative border-2 border-primary bg-surface rounded-2xl p-8 shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold bg-primary-action text-on-primary">
                Most Popular
              </span>
            </div>
            <h2 className="text-xl font-semibold text-primary">Pro</h2>
            <p className="mt-1 text-sm text-tertiary">{TIER_COPY.pro.tagline}</p>
            <div className="mt-6 flex items-baseline gap-2">
              {loadingPlans ? (
                <div className="h-9 w-16 bg-surface-alt rounded animate-pulse" />
              ) : (
                <span className="text-4xl font-bold text-primary">{currencySymbol}{proPrice}</span>
              )}
              <span className="text-sm text-tertiary"> / month</span>
            </div>
            <p className="mt-4 text-sm text-secondary">{TIER_COPY.pro.description}</p>

            <div className="mt-8">
              <ul className="space-y-3 text-sm">
                {PLAN_FEATURES.filter((f) => f.pro).map((f) => (
                  <li key={f.label} className="flex items-center gap-2">
                    <CheckIcon />
                    <span className="text-secondary">{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="w-full rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 transition-colors min-h-[44px]"
              >
                {upgrading ? "Redirecting…" : isAuthenticated ? "Upgrade to Pro" : "Start Pro Trial"}
              </button>
            </div>
          </div>
        </div>

        {/* Feature comparison table */}
        <div className="mt-16">
          <h3 className="text-center text-lg font-semibold text-primary mb-8">Feature comparison</h3>
          <div className="overflow-x-auto rounded-xl border border-color bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-color-subtle">
                  <th className="text-left py-4 px-5 font-medium text-tertiary uppercase tracking-wider">Feature</th>
                  <th className="text-center py-4 px-5 font-medium text-tertiary uppercase tracking-wider">Free</th>
                  <th className="text-center py-4 px-5 font-medium text-tertiary uppercase tracking-wider">Pro</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_FEATURES.map((f) => (
                  <tr key={f.label} className="border-b border-color-subtle last:border-b-0">
                    <td className="py-3 px-5 text-secondary">
                      {f.label}
                      {f.footnote && <p className="text-xs text-tertiary mt-0.5">{f.footnote}</p>}
                    </td>
                    <td className="py-3 px-5 text-center">
                      <CheckCell value={f.free} />
                    </td>
                    <td className="py-3 px-5 text-center">
                      <CheckCell value={f.pro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ CTA */}
        <div className="mt-16 text-center">
          <h3 className="text-lg font-semibold text-primary mb-3">Still have questions?</h3>
          <p className="text-sm text-secondary">
            Visit the{" "}
            <Link to="/faqs" className="text-primary-brand hover:text-primary-hover font-medium">
              FAQs
            </Link>{" "}
            or{" "}
            <Link to="/contact" className="text-primary-brand hover:text-primary-hover font-medium">
              contact us
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function CheckCell({ value }: { value: boolean }) {
  if (value) {
    return (
      <svg
        className="mx-auto h-5 w-5 text-success-text"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return <span className="text-tertiary mx-auto block">—</span>;
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 text-success-text flex-shrink-0"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
