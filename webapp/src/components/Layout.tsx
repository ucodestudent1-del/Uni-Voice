import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useState } from "react";

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
    { name: "Templates", to: "/app/templates" },
    { name: "Expenses", to: "/app/expenses", feature: "expenses.tracking", requiredPlan: "business" },
    { name: "Projects", to: "/app/projects", feature: "projects.enabled", requiredPlan: "free" },
    { name: "Reports", to: "/app/reports", feature: "reports.revenue", requiredPlan: "business" },
    { name: "Plans", to: "/app/plans" },
    { name: "Settings", to: "/app/settings" },
  ];

  const tierOrder = { free: 0, pro: 1, business: 2 };
  const currentTier = plan ? tierOrder[plan.code as keyof typeof tierOrder] ?? 0 : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="hidden md:flex md:flex-col md:w-64 md:border-r md:border-slate-200 md:bg-white md:shadow-sm">
        <div className="flex items-center h-16 px-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">InvoiceFlow</h1>
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
                          ? "bg-primary-50 text-primary-700"
                          : isLocked
                            ? "text-slate-400 cursor-not-allowed"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`
                    }
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-5" />
                      <span>{item.name}</span>
                    </span>
                    {item.requiredPlan && (
                      <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {item.requiredPlan}
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-slate-200 p-4">
          {plan && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm font-medium text-slate-700">{plan.name} Plan</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                plan.code === "free" ? "bg-slate-100 text-slate-800" :
                plan.code === "pro" ? "bg-primary-100 text-primary-800" :
                "bg-accent-100 text-accent-800"
              }`}>
                {plan.code}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg px-3 py-2"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
          <header className="hidden md:flex items-center justify-between h-16 border-b border-slate-200 bg-white px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              >
                <span className="block h-5 w-5">
                  <span className="block h-0.5 w-5 mb-1 bg-slate-600" />
                  <span className="block h-0.5 w-5 mb-1 bg-slate-600" />
                  <span className="block h-0.5 w-5 bg-slate-600" />
                </span>
              </button>
              <span className="text-sm text-slate-500">
                {user?.email}
              </span>
            </div>
            <Link
              to="/app/invoices/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <span aria-hidden="true">+</span>
              Create Invoice
            </Link>
          </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl overflow-y-auto">
            <div className="flex items-center h-16 px-6 border-b border-slate-200">
              <h1 className="text-xl font-bold text-slate-900">InvoiceFlow</h1>
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
                              ? "bg-primary-50 text-primary-700"
                              : isLocked
                                ? "text-slate-400 cursor-not-allowed"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`
                        }
                      >
                        <span>{item.name}</span>
                        {item.requiredPlan && (
                          <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {item.requiredPlan}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="border-t border-slate-200 p-4">
              <button
                onClick={handleLogout}
                className="w-full text-left text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg px-3 py-2"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

