import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

const OPTIONS = [
  { value: "light", label: "Light", description: "Always use light mode", icon: Sun },
  { value: "dark", label: "Dark", description: "Always use dark mode", icon: Moon },
  { value: "system", label: "System", description: "Follow your system preference", icon: Monitor },
] as const;

export default function ThemeSettings() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Appearance</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Choose how the application appearance is displayed.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Theme</label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Current system preference: {resolvedTheme === "dark" ? "Dark" : "Light"}
          </p>
        </div>

        <div className="flex gap-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={`flex-1 rounded-lg border px-4 py-3 text-center text-sm font-medium transition-all ${
                  isSelected
                    ? "border-primary-600 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-slate-900"
                    : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <Icon className="mx-auto mb-1 h-5 w-5" />
                {option.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
          Selected theme: <strong className="text-slate-700 dark:text-slate-300">{theme}</strong>
          {" "}
          (resolved to <strong className="text-slate-700 dark:text-slate-300">{resolvedTheme}</strong>)
        </p>
      </div>
    </div>
  );
}
