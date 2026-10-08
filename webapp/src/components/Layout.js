import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useState } from "react";
import BottomTabBar from "./BottomTabBar";
import ThemeToggle from "./ThemeToggle";
import { Menu } from "lucide-react";
export default function Layout() {
    const { logout, user } = useAuth();
    const { plan } = useSubscription();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    function handleLogout() {
        logout();
        navigate("/login");
    }
    const navItems = [
        { name: "Dashboard", to: "/app", feature: undefined, requiredPlan: undefined },
        { name: "Invoices", to: "/app/invoices" },
        { name: "Customers", to: "/app/customers" },
        { name: "Products", to: "/app/products" },
        { name: "Quotes", to: "/app/quotes", feature: "quotes.create", requiredPlan: "pro" },
        { name: "Payments", to: "/app/payments" },
        { name: "Receipts", to: "/app/receipts", feature: "receipts.create", requiredPlan: "pro" },
        { name: "Templates", to: "/app/templates", feature: "templates.enabled", requiredPlan: "pro" },
        { name: "Projects", to: "/app/projects", feature: "projects.enabled", requiredPlan: "free" },
        { name: "Reports", to: "/app/reports", feature: "reports.revenue", requiredPlan: "pro" },
        { name: "Credit Notes", to: "/app/credit-notes", feature: "credit_notes.create", requiredPlan: "pro" },
        { name: "Plans", to: "/app/plans" },
        { name: "Settings", to: "/app/settings" },
    ];
    const tierOrder = { free: 0, pro: 1 };
    const currentTier = plan ? tierOrder[plan.code] ?? 0 : 0;
    return (_jsxs("div", { className: "min-h-screen bg-page flex", children: [_jsxs("div", { className: "hidden md:flex md:flex-col md:w-64 md:border-r md:border-color md:bg-surface md:shadow-sm", children: [_jsx("div", { className: "flex items-center h-16 px-6 border-b border-color", children: _jsx("h1", { className: "text-xl font-bold text-primary", children: "InvoiceFlow" }) }), _jsx("nav", { className: "flex-1 overflow-y-auto py-4", children: _jsx("ul", { className: "space-y-1 px-3", children: navItems.map((item) => {
                                const required = item.requiredPlan ?? "free";
                                const reqTier = tierOrder[required] ?? 0;
                                const hasAccess = currentTier >= reqTier;
                                const isLocked = !hasAccess;
                                return (_jsx("li", { children: _jsxs(NavLink, { to: item.to, end: item.to === "/app", className: ({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive
                                            ? "bg-primary-bg text-on-primary-strong"
                                            : isLocked
                                                ? "text-tertiary cursor-not-allowed"
                                                : "text-secondary hover:bg-surface-alt hover:text-primary"}`, children: [_jsxs("span", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-5" }), _jsx("span", { children: item.name })] }), item.requiredPlan && (_jsx("span", { className: "ml-auto text-xs bg-surface-alt text-tertiary px-1.5 py-0.5 rounded", children: item.requiredPlan }))] }) }, item.to));
                            }) }) }), _jsxs("div", { className: "border-t border-color p-4", children: [plan && (_jsxs("div", { className: "mb-3 flex items-center justify-between rounded-lg bg-surface-alt px-3 py-2", children: [_jsxs("span", { className: "text-sm font-medium text-secondary", children: [plan.name, " Plan"] }), _jsx("span", { className: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${plan.code === "free" ? "bg-surface-alt text-tertiary" :
                                            "bg-primary-bg text-on-primary"}`, children: plan.code })] })), _jsx("button", { onClick: handleLogout, className: "w-full text-left text-sm font-medium text-secondary hover:text-primary hover:bg-surface-alt rounded-lg px-3 py-2", children: "Sign out" })] })] }), _jsxs("div", { className: "flex-1 flex flex-col min-w-0", children: [_jsxs("header", { className: "flex md:hidden items-center justify-between h-16 border-b border-color bg-surface px-4", children: [_jsx("button", { onClick: () => setMobileMenuOpen(true), className: "rounded-lg p-2 text-secondary hover:bg-surface-alt md:hidden", "aria-label": "Open navigation menu", children: _jsx(Menu, { className: "h-5 w-5" }) }), _jsx("span", { className: "text-sm text-tertiary truncate", children: user?.email })] }), _jsxs("header", { className: "hidden md:flex items-center justify-between h-16 border-b border-color bg-surface px-6", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("button", { onClick: () => setMobileMenuOpen(true), className: "rounded-lg p-2 text-secondary hover:bg-surface-alt md:hidden", children: _jsx(Menu, { className: "h-5 w-5" }) }), _jsx("span", { className: "text-sm text-tertiary", children: user?.email })] }), _jsx("div", { className: "flex items-center gap-4", children: _jsx(ThemeToggle, {}) })] }), _jsx("main", { className: "flex-1 overflow-y-auto p-6 bg-page", children: _jsx(Outlet, {}) })] }), mobileMenuOpen && (_jsxs("div", { className: "fixed inset-0 z-40 md:hidden", children: [_jsx("div", { className: "fixed inset-0 bg-overlay", onClick: () => setMobileMenuOpen(false) }), _jsxs("div", { className: "fixed inset-y-0 left-0 w-64 bg-surface shadow-xl overflow-y-auto", children: [_jsx("div", { className: "flex items-center h-16 px-6 border-b border-color", children: _jsx("h1", { className: "text-xl font-bold text-primary", children: "InvoiceFlow" }) }), _jsx("nav", { className: "py-4", children: _jsx("ul", { className: "space-y-1 px-3", children: navItems.map((item) => {
                                        const required = item.requiredPlan ?? "free";
                                        const reqTier = tierOrder[required] ?? 0;
                                        const isLocked = currentTier < reqTier;
                                        return (_jsx("li", { children: _jsxs(NavLink, { to: item.to, end: item.to === "/app", onClick: () => setMobileMenuOpen(false), className: ({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive
                                                    ? "bg-primary-bg text-on-primary-strong"
                                                    : isLocked
                                                        ? "text-tertiary cursor-not-allowed"
                                                        : "text-secondary hover:bg-surface-alt hover:text-primary"}`, children: [_jsx("span", { children: item.name }), item.requiredPlan && (_jsx("span", { className: "ml-auto text-xs bg-surface-alt text-tertiary px-1.5 py-0.5 rounded", children: item.requiredPlan }))] }) }, item.to));
                                    }) }) }), _jsx("div", { className: "border-t border-color p-4", children: _jsx("button", { onClick: handleLogout, className: "w-full text-left text-sm font-medium text-secondary hover:text-primary hover:bg-surface-alt rounded-lg px-3 py-2", children: "Sign out" }) })] })] })), _jsx(BottomTabBar, {})] }));
}
