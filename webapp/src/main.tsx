import React from "react";
import * as Sentry from "@sentry/react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { ThemeProvider, applyInitialTheme } from "./contexts/ThemeContext";
import { ToastProvider } from "./components/ui/ToastProvider";
import { initSentry } from "./lib/sentry";
import "./index.css";

initSentry();

const App = React.lazy(() => import("./App"));

try {
  applyInitialTheme();
} catch (err) {
  console.warn("Failed to apply initial theme:", err);
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  document.body.innerHTML =
    '<div style="padding:2rem;text-align:center;font-family:sans-serif">' +
    '<h1>Application Failed to Load</h1>' +
    "<p>The application container element is missing. This may be caused by direct access to a deep link without server-side SPA fallback, or a stale browser cache serving an old HTML page.</p>" +
    '<button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1rem">Reload</button>' +
    "</div>";
  throw new Error(
    "React Error #310: Target container is not a DOM element. " +
      "Ensure the server serves index.html for all routes (SPA fallback)."
  );
}

function AppLazy() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center h-screen text-secondary">Loading…</div>}>
      <App />
    </React.Suspense>
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SubscriptionProvider>
          <ThemeProvider>
            <ToastProvider>
              <Sentry.ErrorBoundary
                fallback={({ error, resetError }) => {
                  const message =
                    error instanceof Error ? error.message : String(error ?? "Unknown error");
                  return (
                  <div className="min-h-screen flex items-center justify-center bg-surface-alt">
                    <div className="text-center max-w-md px-6">
                      <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text mb-4">
                        Something went wrong. Please try again.
                      </div>
                      <p className="text-xs text-tertiary font-mono mb-4">
                        {message}
                      </p>
                      <button
                        onClick={resetError}
                        className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        Reload
                      </button>
                    </div>
                  </div>
                  );
                }}
              >
                <AppLazy />
              </Sentry.ErrorBoundary>
            </ToastProvider>
          </ThemeProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
