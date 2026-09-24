import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Theme, ThemeContextType } from "@/types/app";

export type { Theme, ThemeContextType };

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_STORAGE_KEY = "theme";
const THEME_ATTRIBUTE = "data-theme";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyThemeToHtml(resolved: "light" | "dark") {
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return getStoredTheme();
  });
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return getSystemTheme();
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
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

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    if (theme === "system") {
      setThemeState("light");
    } else if (theme === "light") {
      setThemeState("dark");
    } else {
      setThemeState("system");
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
