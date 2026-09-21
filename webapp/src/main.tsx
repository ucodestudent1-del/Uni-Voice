import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { ThemeProvider, applyInitialTheme } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

applyInitialTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
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
