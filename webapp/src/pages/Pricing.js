import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPlans, upgradeSubscription } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useMetaTags } from "../hooks/useMetaTags";
const PLAN_FEATURES = [
    { label: "Send unlimited invoices", free: true, pro: true },
    { label: "Up to 3 customers", free: true, pro: true, footnote: "Free: max 3 customers. Pro: unlimited." },
    { label: "Core invoice templates", free: true, pro: true },
    { label: "Multi-currency support", free: false, pro: true },
    { label: "Online payment collection", free: false, pro: true, footnote: "Stripe & other providers." },
    { label: "Payment reminders & auto-followups", free: false, pro: true },
    { label: "Time tracking", free: false, pro: true },
    { label: "Project management", free: false, pro: true },
    { label: "Custom branding (logo, colors)", free: false, pro: true },
    { label: "Quotes & estimates", free: false, pro: true },
    { label: "Priority support", free: false, pro: true },
];
const TIER_COPY = {
    free: {
        tagline: "Forever free. No credit card.",
        description: "Everything you need to create and send professional invoices. Perfect for freelancers and solopreneurs just getting started.",
    },
    pro: {
        tagline: "All features. Billed monthly.",
        description: "Full automation, multi-currency, and everything in Free — plus advanced project management, quotes, and financial reporting.",
    },
};
export default function Plans() {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [allPlans, setAllPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [upgrading, setUpgrading] = useState(false);
    const [error, setError] = useState(null);
    useMetaTags({
        title: "Simple, Transparent Pricing | InvoiceFlow",
        description: "One flat monthly rate. No per-invoice fees. Cancel anytime. Start with our forever-free plan or upgrade to Pro for full automation.",
    });
    useEffect(() => {
        async function loadPlans() {
            try {
                const data = await getPlans();
                setAllPlans(data.plans ?? []);
            }
            catch {
                setAllPlans([]);
            }
            finally {
                setLoadingPlans(false);
            }
        }
        loadPlans();
    }, []);
    const proPlan = allPlans.find((p) => p.code === "pro");
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
        }
        catch (err) {
            setError(err?.response?.data?.error || "Failed to start upgrade");
        }
        finally {
            setUpgrading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-page py-16", children: _jsxs("div", { className: "container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl", children: [_jsxs("div", { className: "text-center mb-12", children: [_jsx("h1", { className: "text-4xl font-bold text-primary sm:text-5xl", children: "Simple, transparent pricing" }), _jsx("p", { className: "mt-4 text-lg text-secondary max-w-2xl mx-auto", children: "One flat monthly rate. No per-invoice fees. Cancel anytime." })] }), error && (_jsx("div", { className: "rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text mb-6", children: error })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-8", children: [_jsxs("div", { className: "border border-color-subtle bg-surface rounded-2xl p-8 shadow-sm", children: [_jsx("h2", { className: "text-xl font-semibold text-primary", children: "Free" }), _jsx("p", { className: "mt-1 text-sm text-tertiary", children: TIER_COPY.free.tagline }), _jsxs("div", { className: "mt-6", children: [_jsx("span", { className: "text-4xl font-bold text-primary", children: "$0" }), _jsx("span", { className: "text-sm text-tertiary", children: " / month" })] }), _jsx("p", { className: "mt-4 text-sm text-secondary", children: TIER_COPY.free.description }), _jsx("div", { className: "mt-8", children: _jsx("ul", { className: "space-y-3 text-sm", children: PLAN_FEATURES.filter((f) => f.free).map((f) => (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(CheckIcon, {}), _jsx("span", { className: "text-secondary", children: f.label })] }, f.label))) }) }), _jsx("div", { className: "mt-8", children: _jsx(Link, { to: isAuthenticated ? "/app" : "/register", className: "block w-full text-center rounded-lg border border-color-subtle bg-surface-alt px-4 py-2.5 text-sm font-medium text-primary hover:bg-surface-alt transition-colors", children: "Get Started" }) })] }), _jsxs("div", { className: "relative border-2 border-primary bg-surface rounded-2xl p-8 shadow-lg", children: [_jsx("div", { className: "absolute -top-3 left-1/2 -translate-x-1/2", children: _jsx("span", { className: "inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold bg-primary-action text-on-primary", children: "Most Popular" }) }), _jsx("h2", { className: "text-xl font-semibold text-primary", children: "Pro" }), _jsx("p", { className: "mt-1 text-sm text-tertiary", children: TIER_COPY.pro.tagline }), _jsxs("div", { className: "mt-6 flex items-baseline gap-2", children: [loadingPlans ? (_jsx("div", { className: "h-9 w-16 bg-surface-alt rounded animate-pulse" })) : (_jsxs("span", { className: "text-4xl font-bold text-primary", children: [currencySymbol, proPrice] })), _jsx("span", { className: "text-sm text-tertiary", children: " / month" })] }), _jsx("p", { className: "mt-4 text-sm text-secondary", children: TIER_COPY.pro.description }), _jsx("div", { className: "mt-8", children: _jsx("ul", { className: "space-y-3 text-sm", children: PLAN_FEATURES.filter((f) => f.pro).map((f) => (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(CheckIcon, {}), _jsx("span", { className: "text-secondary", children: f.label })] }, f.label))) }) }), _jsx("div", { className: "mt-8", children: _jsx("button", { onClick: handleUpgrade, disabled: upgrading, className: "w-full rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 transition-colors min-h-[44px]", children: upgrading ? "Redirecting…" : isAuthenticated ? "Upgrade to Pro" : "Start Pro Trial" }) })] })] }), _jsxs("div", { className: "mt-16", children: [_jsx("h3", { className: "text-center text-lg font-semibold text-primary mb-8", children: "Feature comparison" }), _jsx("div", { className: "overflow-x-auto rounded-xl border border-color bg-surface", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-color-subtle", children: [_jsx("th", { className: "text-left py-4 px-5 font-medium text-tertiary uppercase tracking-wider", children: "Feature" }), _jsx("th", { className: "text-center py-4 px-5 font-medium text-tertiary uppercase tracking-wider", children: "Free" }), _jsx("th", { className: "text-center py-4 px-5 font-medium text-tertiary uppercase tracking-wider", children: "Pro" })] }) }), _jsx("tbody", { children: PLAN_FEATURES.map((f) => (_jsxs("tr", { className: "border-b border-color-subtle last:border-b-0", children: [_jsxs("td", { className: "py-3 px-5 text-secondary", children: [f.label, f.footnote && _jsx("p", { className: "text-xs text-tertiary mt-0.5", children: f.footnote })] }), _jsx("td", { className: "py-3 px-5 text-center", children: _jsx(CheckCell, { value: f.free }) }), _jsx("td", { className: "py-3 px-5 text-center", children: _jsx(CheckCell, { value: f.pro }) })] }, f.label))) })] }) })] }), _jsxs("div", { className: "mt-16 text-center", children: [_jsx("h3", { className: "text-lg font-semibold text-primary mb-3", children: "Still have questions?" }), _jsxs("p", { className: "text-sm text-secondary", children: ["Visit the", " ", _jsx(Link, { to: "/#faq", className: "text-primary-brand hover:text-primary-hover font-medium", children: "FAQs" }), " ", "or", " ", _jsx("a", { href: "mailto:support@invoiceflow.com", className: "text-primary-brand hover:text-primary-hover font-medium", children: "contact us" }), "."] })] })] }) }));
}
function CheckCell({ value }) {
    if (value) {
        return (_jsx("svg", { className: "mx-auto h-5 w-5 text-success-text", fill: "currentColor", viewBox: "0 0 20 20", "aria-hidden": "true", children: _jsx("path", { fillRule: "evenodd", d: "M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z", clipRule: "evenodd" }) }));
    }
    return _jsx("span", { className: "text-tertiary mx-auto block", children: "\u2014" });
}
function CheckIcon() {
    return (_jsx("svg", { className: "h-4 w-4 text-success-text flex-shrink-0", fill: "currentColor", viewBox: "0 0 20 20", "aria-hidden": "true", children: _jsx("path", { fillRule: "evenodd", d: "M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z", clipRule: "evenodd" }) }));
}
