import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function AuthCallback() {
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const token = params.get("token");
    const userId = params.get("userId") ?? "";
    const email = params.get("email") ?? "";

    if (token) {
      login(token, { id: userId, email });
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      navigate("/app", { replace: true });
    } else {
      setError("No authentication token received.");
    }
  }, [login, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text mb-4">{error}</div>
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



