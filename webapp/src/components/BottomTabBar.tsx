import { Link, NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Users,
  Plus,
  Receipt,
} from "lucide-react";

export default function BottomTabBar() {
  const items = [
    { name: "Dashboard", to: "/app", icon: LayoutDashboard },
    { name: "Invoices", to: "/app/invoices", icon: FileText },
    { name: "Customers", to: "/app/customers", icon: Users },
    { name: "Payments", to: "/app/payments", icon: Receipt },
  ];

return (
    <>
      {/* Floating primary action */}
      <Link
        to="/app/invoices/new"
        aria-label="New invoice"
        className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 md:hidden flex items-center justify-center w-14 h-14 rounded-full bg-primary-action text-on-primary shadow-xl hover-bg-primary-action focus-ring-primary transition-colors"
      >
        <Plus className="w-6 h-6" />
      </Link>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 md:hidden bg-surface border-t border-color-subtle border-color shadow-sm backdrop-blur-sm"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom,0px)]">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/app"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 pt-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-primary-brand"
                    : "text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary"
                }`
              }
            >
              {({ isActive }) => {
                const Icon = item.icon;
                return (
                  <>
<span
                      className={`rounded-lg w-10 h-10 flex items-center justify-center mb-0.5 ${
                        isActive ? "bg-primary-bg text-primary-brand" : "text-tertiary"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                    {item.name}
                  </>
                );
              }}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}




