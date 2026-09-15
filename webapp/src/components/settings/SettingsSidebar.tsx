import { NavLink } from "react-router-dom";
import type { SettingsSection } from "../../types/settings";

interface SettingsSidebarProps {
  sections: SettingsSection[];
  accountSection: SettingsSection;
}

export default function SettingsSidebar({ sections, accountSection }: SettingsSidebarProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 py-6">
      <nav className="flex-1 space-y-6">
        {sections.map((group) => (
          <div key={group.id} className={group.heading ? "mb-4" : ""}>
            {group.heading && (
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                {group.heading}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.id}>
                  <NavLink
                    to={`/app/settings/${item.id}`}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary-50 text-primary-700"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`
                    }
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 pt-4">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Account
        </p>
        <ul className="space-y-1">
          {accountSection.items.map((item) => (
            <li key={item.id}>
              <NavLink
                to={`/app/settings/${item.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
