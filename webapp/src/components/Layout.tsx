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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      <div className="hidden md:flex md:flex-col md:w-64 md:border-r md:border-slate-200 dark:md:border-slate-700 md:bg-white dark:md:bg-slate-900 md:shadow-sm">
        <div className="flex items-center h-16 px-6 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">InvoiceFlow</h1>
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
                           ? "bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-400"
                           : isLocked
                             ? "text-slate-400 cursor-not-allowed"
                             : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900"
                       }`
                     }
                   >
                     <span className="flex items-center gap-2">
                       <span className="w-5" />
                       <span>{item.name}</span>
                     </span>
                     {item.requiredPlan && (
                       <span className="ml-auto text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                         {item.requiredPlan}
                       </span>
                     )}
                   </NavLink>
                 </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-slate-200 dark:border-slate-700 p-4">
          {plan && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{plan.name} Plan</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                plan.code === "free" ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300" :
                plan.code === "pro" ? "bg-primary-100 dark:bg-primary-950 text-primary-800 dark:text-primary-300" :
                "bg-accent-100 dark:bg-accent-950 text-accent-800 dark:text-accent-300"
              }`}>
                {plan.code}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg px-3 py-2"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header - visible on mobile, hidden on desktop */}
          <header className="flex md:hidden items-center justify-between h-16 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {user?.email}
            </span>
            <Link
              to="/app/invoices/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors min-h-[44px]"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Create Invoice</span>
            </Link>
          </header>

          {/* Desktop header - hidden on mobile, visible on desktop */}
          <header className="hidden md:flex items-center justify-between h-16 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {user?.email}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
            <Link
              to="/app/invoices/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors min-h-[44px]"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Create Invoice
            </Link>
            </div>
          </header>
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
          <Outlet />
        </main>
      </div>

       {mobileMenuOpen && (
         <div className="fixed inset-0 z-40 md:hidden">
           <div className="fixed inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
           <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 shadow-xl overflow-y-auto">
             <div className="flex items-center h-16 px-6 border-b border-slate-200 dark:border-slate-700">
               <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">InvoiceFlow</h1>
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
                               ? "bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-400"
                               : isLocked
                                 ? "text-slate-400 cursor-not-allowed"
                                 : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900"
                           }`
                         }
                       >
                         <span>{item.name}</span>
                         {item.requiredPlan && (
                           <span className="ml-auto text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                             {item.requiredPlan}
                           </span>
                         )}
                       </NavLink>
                     </li>
                   );
                 })}
               </ul>
             </nav>
             <div className="border-t border-slate-200 dark:border-slate-700 p-4">
               <button
                 onClick={handleLogout}
                 className="w-full text-left text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg px-3 py-2"
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

