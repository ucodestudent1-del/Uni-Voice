import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const icon = {
    light: <Sun className="h-5 w-5" />,
    dark: <Moon className="h-5 w-5" />,
    system: <Monitor className="h-5 w-5" />,
  }[theme];

  const nextLabel = {
    light: "Switch to dark mode",
    dark: "Switch to light mode",
    system: "Switch to light mode",
  }[theme];

  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 p-1">
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-label="Light mode"
        className={`rounded-md p-1.5 text-sm transition-all ${
          resolvedTheme === "light" && theme === "light"
            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow"
            : "hover:text-slate-900 dark:hover:text-slate-100"
        }`}
        title="Light"
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-label="Dark mode"
        className={`rounded-md p-1.5 text-sm transition-all ${
          resolvedTheme === "dark" && theme === "dark"
            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow"
            : "hover:text-slate-900 dark:hover:text-slate-100"
        }`}
        title="Dark"
      >
        <Moon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("system")}
        aria-label="System mode"
        className={`rounded-md p-1.5 text-sm transition-all ${
          theme === "system"
            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow"
            : "hover:text-slate-900 dark:hover:text-slate-100"
        }`}
        title="System"
      >
        <Monitor className="h-4 w-4" />
      </button>
    </div>
  );
}
