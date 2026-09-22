import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { ThemeProvider, applyInitialTheme } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

try {
  applyInitialTheme();
} catch {
  // Proceed with default theme if pre-render theme application fails
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

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <SubscriptionProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
