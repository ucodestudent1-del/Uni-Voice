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
        <h2 className="text-lg font-semibold text-primary">Appearance</h2>
        <p className="text-sm text-secondary mt-1">
          Choose how the application appearance is displayed.
        </p>
      </div>

      <div className="rounded-xl border border-color bg-surface p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-secondary">Theme</label>
          <p className="text-xs text-tertiary">
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
                    ? "border-primary bg-primary-bg text-on-primary-strong ring-2 ring-primary ring-offset-2"
                    : "border-color text-secondary hover:bg-hover"
                }`
              }
              >
                <Icon className="mx-auto mb-1 h-5 w-5" />
                {option.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-tertiary mt-4">
          Selected theme: <strong className="text-secondary">{theme}</strong>
          {" "}
          (resolved to <strong className="text-secondary">{resolvedTheme}</strong>)
        </p>
      </div>
    </div>
  );
}
