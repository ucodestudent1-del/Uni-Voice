import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, Users, Plus, Receipt, } from "lucide-react";
export default function BottomTabBar() {
    const items = [
        { name: "Dashboard", to: "/app", icon: LayoutDashboard },
        { name: "Invoices", to: "/app/invoices", icon: FileText },
        { name: "Customers", to: "/app/customers", icon: Users },
        { name: "Payments", to: "/app/payments", icon: Receipt },
    ];
    return (_jsxs(_Fragment, { children: [_jsx(Link, { to: "/app/invoices/new", "aria-label": "New invoice", className: "fixed bottom-16 left-1/2 -translate-x-1/2 z-50 md:hidden flex items-center justify-center w-14 h-14 rounded-full bg-primary-action text-on-primary shadow-xl hover-bg-primary-action focus-ring-primary transition-colors", children: _jsx(Plus, { className: "w-6 h-6" }) }), _jsx("nav", { className: "fixed inset-x-0 bottom-0 z-40 md:hidden bg-surface border-t border-color-subtle border-color shadow-sm backdrop-blur-sm", "aria-label": "Mobile navigation", children: _jsx("div", { className: "flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom,0px)]", children: items.map((item) => (_jsx(NavLink, { to: item.to, end: item.to === "/app", className: ({ isActive }) => `flex flex-col items-center justify-center flex-1 pt-1 text-xs font-medium transition-colors ${isActive
                            ? "text-primary-brand"
                            : "text-tertiary hover:text-primary"}`, children: ({ isActive }) => {
                            const Icon = item.icon;
                            return (_jsxs(_Fragment, { children: [_jsx("span", { className: `rounded-lg w-10 h-10 flex items-center justify-center mb-0.5 ${isActive ? "bg-primary-bg text-primary-brand" : "text-tertiary"}`, children: _jsx(Icon, { className: "w-5 h-5" }) }), item.name] }));
                        } }, item.to))) }) })] }));
}
