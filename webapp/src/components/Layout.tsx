import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { Fragment, useState } from "react";

interface NavItem {
  name: string;
  to: string;
  icon: React.ReactNode;
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
    { name: "Dashboard", to: "/app", icon: <DashboardIcon />, feature: undefined, requiredPlan: undefined },
    { name: "Invoices", to: "/app/invoices", icon: <InvoiceIcon /> },
    { name: "Customers", to: "/app/customers", icon: <CustomerIcon /> },
    { name: "Products", to: "/app/products", icon: <ProductIcon /> },
    { name: "Templates", to: "/app/templates", icon: <TemplateIcon /> },
    { name: "Expenses", to: "/app/expenses", icon: <ExpenseIcon />, feature: "expenses.tracking", requiredPlan: "business" },
    { name: "Reports", to: "/app/reports", icon: <ReportIcon />, feature: "reports.revenue", requiredPlan: "business" },
    { name: "Plans", to: "/app/plans", icon: <PlanIcon /> },
    { name: "Settings", to: "/app/settings", icon: <SettingIcon /> },
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
                    {item.icon}
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
              <MenuIcon />
            </button>
            <span className="text-sm text-slate-500">
              {user?.email}
            </span>
          </div>
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
                        {item.icon}
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

function DashboardIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
    </svg>
  );
}

function InvoiceIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m2 0a2 2 0 100-4 2 2 0 000 4zm3 6a3 3 0 11-6 0 3 3 0 016 0zM9 7h6" />
    </svg>
  );
}

function CustomerIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7h-.01z" />
    </svg>
  );
}

function ProductIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10a2 2 0 01-4 0M4 7v10a2 2 0 004 0V7" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function ExpenseIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4.21.76-5.83 2H12v5.83a7.95 7.95 0 005.83-2V10a6 6 0 00-5.83-2z" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function SettingIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
