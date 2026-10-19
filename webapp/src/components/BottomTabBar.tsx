import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Plus,
  CreditCard,
} from "lucide-react";

export default function BottomTabBar() {
  const items = [
    { name: "Dashboard", to: "/app", icon: LayoutDashboard },
    { name: "Documents", to: "/app/documents", icon: FileText },
    { name: "Create", to: "/app/create", icon: Plus },
    { name: "Templates", to: "/app/templates", icon: FileText },
    { name: "Account", to: "/app/account", icon: CreditCard },
  ];

  return (
    <>
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
                    : "text-tertiary hover:text-primary"
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
