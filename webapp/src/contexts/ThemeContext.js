import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect } from "react";
const ThemeContext = createContext(null);
const THEME_STORAGE_KEY = "theme";
const THEME_ATTRIBUTE = "data-theme";
function getStoredTheme() {
    if (typeof window === "undefined")
        return "system";
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
        return stored;
    }
    return "system";
}
function getSystemTheme() {
    if (typeof window === "undefined")
        return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
export function resolveTheme(theme) {
    return theme === "system" ? getSystemTheme() : theme;
}
function applyThemeToHtml(resolved) {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTRIBUTE, resolved);
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
}
export function applyInitialTheme() {
    const theme = getStoredTheme();
    const resolved = resolveTheme(theme);
    applyThemeToHtml(resolved);
}
export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(() => {
        if (typeof window === "undefined")
            return "system";
        return getStoredTheme();
    });
    const [systemTheme, setSystemTheme] = useState(() => {
        if (typeof window === "undefined")
            return "light";
        return getSystemTheme();
    });
    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = (e) => {
            setSystemTheme(e.matches ? "dark" : "light");
        };
        mediaQuery.addEventListener("change", handler);
        return () => mediaQuery.removeEventListener("change", handler);
    }, []);
    const resolvedTheme = resolveTheme(theme === "system" ? (systemTheme === "dark" ? "system" : "light") : theme);
    useEffect(() => {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
        applyThemeToHtml(resolvedTheme);
    }, [theme, resolvedTheme]);
    const setTheme = (newTheme) => {
        setThemeState(newTheme);
    };
    const toggleTheme = () => {
        if (theme === "system") {
            setThemeState("light");
        }
        else if (theme === "light") {
            setThemeState("dark");
        }
        else {
            setThemeState("system");
        }
    };
    return (_jsx(ThemeContext.Provider, { value: { theme, resolvedTheme, setTheme, toggleTheme }, children: children }));
}
export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within ThemeProvider");
    }
    return context;
}
