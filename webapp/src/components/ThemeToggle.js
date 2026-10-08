import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
export default function ThemeToggle() {
    const { theme, resolvedTheme, setTheme } = useTheme();
    const icon = {
        light: _jsx(Sun, { className: "h-5 w-5" }),
        dark: _jsx(Moon, { className: "h-5 w-5" }),
        system: _jsx(Monitor, { className: "h-5 w-5" }),
    }[theme];
    const nextLabel = {
        light: "Switch to dark mode",
        dark: "Switch to light mode",
        system: "Switch to light mode",
    }[theme];
    return (_jsxs("div", { className: "flex items-center gap-1 rounded-lg bg-surface-alt text-tertiary p-1", children: [_jsx("button", { type: "button", onClick: () => setTheme("light"), "aria-label": "Light mode", className: `rounded-md p-1.5 text-sm transition-all ${resolvedTheme === "light" && theme === "light"
                    ? "bg-surface text-primary shadow"
                    : "text-tertiary hover:text-primary"}`, title: "Light", children: _jsx(Sun, { className: "h-4 w-4" }) }), _jsx("button", { type: "button", onClick: () => setTheme("dark"), "aria-label": "Dark mode", className: `rounded-md p-1.5 text-sm transition-all ${resolvedTheme === "dark" && theme === "dark"
                    ? "bg-surface text-primary shadow"
                    : "text-tertiary hover:text-primary"}`, title: "Dark", children: _jsx(Moon, { className: "h-4 w-4" }) }), _jsx("button", { type: "button", onClick: () => setTheme("system"), "aria-label": "System mode", className: `rounded-md p-1.5 text-sm transition-all ${theme === "system"
                    ? "bg-surface text-primary shadow"
                    : "text-tertiary hover:text-primary"}`, title: "System", children: _jsx(Monitor, { className: "h-4 w-4" }) })] }));
}
