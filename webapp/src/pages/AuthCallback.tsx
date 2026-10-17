import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function AuthCallback() {
  const [urlError, setUrlError] = useState("");
  const { isAuthenticated, isLoading, authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthErr = params.get("oauth_error");
    if (oauthErr) {
      setUrlError(oauthErr);
      window.history.replaceState({}, document.title, "/auth/callback");
    }
  }, [location.search]);

  useEffect(() => {
    if (!isLoading && !authError && !urlError) {
      if (isAuthenticated) {
        navigate("/app", { replace: true });
      } else {
        setUrlError("Authentication failed. Please try again.");
      }
    }
  }, [isLoading, isAuthenticated, navigate, authError, urlError]);

  const displayError = urlError || authError;

  if (displayError) {
    const isRateLimited =
      displayError.toLowerCase().includes("rate limit") ||
      displayError.toLowerCase().includes("too many requests");

    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text mb-4 max-w-sm">
            {displayError}
          </div>
          {isRateLimited ? (
            <p className="text-xs text-tertiary mb-4">
              You've made too many requests. Please wait a few minutes and try again.
            </p>
          ) : null}
          <button
            onClick={() => navigate("/login")}
            className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center text-secondary">Completing sign in…</div>
    </div>
  );
}
