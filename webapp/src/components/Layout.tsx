import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useTheme } from "../contexts/ThemeContext";
import { useState } from "react";
import BottomTabBar from "./BottomTabBar";
import ThemeToggle from "./ThemeToggle";
import { Menu, Plus } from "lucide-react";

interface NavItem {
  name: string;
  to: string;
  feature?: string;
  requiredPlan?: string;
}

export default function Layout() {
  const { logout, user } = useAuth();
  const { plan } = useSubscription();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const navItems: NavItem[] = [
    { name: "Dashboard", to: "/app", feature: undefined, requiredPlan: undefined },
    { name: "Invoices", to: "/app/invoices" },
    { name: "Customers", to: "/app/customers" },
    { name: "Products", to: "/app/products" },
    { name: "Payments", to: "/app/payments" },
    { name: "Templates", to: "/app/templates", feature: "templates.enabled", requiredPlan: "pro" },
    { name: "Expenses", to: "/app/expenses", feature: "expenses.tracking", requiredPlan: "business" },
    { name: "Projects", to: "/app/projects", feature: "projects.enabled", requiredPlan: "free" },
    { name: "Reports", to: "/app/reports", feature: "reports.revenue", requiredPlan: "business" },
    { name: "Plans", to: "/app/plans" },
    { name: "Settings", to: "/app/settings" },
  ];

  const tierOrder = { free: 0, pro: 1, business: 2 };
  const currentTier = plan ? tierOrder[plan.code as keyof typeof tierOrder] ?? 0 : 0;

  return (
    <div className="min-h-screen bg-page flex">
      <div className="hidden md:flex md:flex-col md:w-64 md:border-r md:border-color md:bg-surface md:shadow-sm">
        <div className="flex items-center h-16 px-6 border-b border-color">
          <h1 className="text-xl font-bold text-primary">InvoiceFlow</h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const required = item.requiredPlan ?? "free";
              const reqTier = tierOrder[required as keyof typeof tierOrder] ?? 0;
              const hasAccess = currentTier >= reqTier;
              const isLocked = !hasAccess;
              return (
                <li key={item.to}>
                   <NavLink
                     to={item.to}
                     end={item.to === "/app"}
                     className={({ isActive }) =>
                       `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                         isActive
                           ? "bg-primary-bg text-on-primary-strong"
                           : isLocked
                             ? "text-tertiary cursor-not-allowed"
                             : "text-secondary hover-bg-hover hover:text-primary"
                       }`
                     }
                   >
                     <span className="flex items-center gap-2">
                       <span className="w-5" />
                       <span>{item.name}</span>
                     </span>
                     {item.requiredPlan && (
                       <span className="ml-auto text-xs bg-surface-alt text-tertiary px-1.5 py-0.5 rounded">
                         {item.requiredPlan}
                       </span>
                     )}
                   </NavLink>
                 </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-color p-4">
          {plan && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-surface-alt px-3 py-2">
              <span className="text-sm font-medium text-secondary">{plan.name} Plan</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                plan.code === "free" ? "bg-surface-alt text-tertiary" :
                plan.code === "pro" ? "bg-primary-bg text-on-primary" :
                "bg-info-bg text-info-text"
              }`}>
                {plan.code}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm font-medium text-secondary hover:text-primary hover-bg-hover rounded-lg px-3 py-2"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header - visible on mobile, hidden on desktop */}
          <header className="flex md:hidden items-center justify-between h-16 border-b border-color bg-surface px-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-secondary hover-bg-hover md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm text-tertiary truncate">
              {user?.email}
            </span>
            <Link
              to="/app/invoices/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-3 py-1.5 text-sm font-medium text-on-primary focus:outline-none focus:ring-2 focus:ring-2 focus:ring-primary transition-colors min-h-[44px]"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Create Invoice</span>
            </Link>
          </header>

          {/* Desktop header - hidden on mobile, visible on desktop */}
          <header className="hidden md:flex items-center justify-between h-16 border-b border-color bg-surface px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg p-2 text-secondary hover-bg-hover md:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="text-sm text-tertiary">
                {user?.email}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
            <Link
              to="/app/invoices/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary focus:outline-none focus:ring-2 focus:ring-primary transition-colors min-h-[44px]"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Create Invoice
            </Link>
            </div>
          </header>
        <main className="flex-1 overflow-y-auto p-6 bg-page">
          <Outlet />
        </main>
      </div>

       {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="fixed inset-0 bg-overlay" onClick={() => setMobileMenuOpen(false)} />
            <div className="fixed inset-y-0 left-0 w-64 bg-surface shadow-xl overflow-y-auto">
              <div className="flex items-center h-16 px-6 border-b border-color">
                <h1 className="text-xl font-bold text-primary">InvoiceFlow</h1>
              </div>
              <nav className="py-4">
                <ul className="space-y-1 px-3">
                  {navItems.map((item) => {
                    const required = item.requiredPlan ?? "free";
                    const reqTier = tierOrder[required as keyof typeof tierOrder] ?? 0;
                    const isLocked = currentTier < reqTier;
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.to === "/app"}
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-primary-bg text-on-primary-strong"
                                : isLocked
                                  ? "text-tertiary cursor-not-allowed"
                                  : "text-secondary hover-bg-hover hover:text-primary"
                            }`
                          }
                        >
                          <span>{item.name}</span>
                          {item.requiredPlan && (
                            <span className="ml-auto text-xs bg-surface-alt text-tertiary px-1.5 py-0.5 rounded">
                              {item.requiredPlan}
                            </span>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="border-t border-color p-4">
                <button
                  onClick={handleLogout}
                  className="w-full text-left text-sm font-medium text-secondary hover:text-primary hover-bg-hover rounded-lg px-3 py-2"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
       {/* Mobile bottom tab bar + FAB (field-optimized nav) */}
       <BottomTabBar />
    </div>
  );
}
