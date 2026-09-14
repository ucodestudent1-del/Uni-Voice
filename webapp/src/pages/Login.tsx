import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { login as apiLogin } from "../api/client";

type LoginStep = "credentials" | "two-factor";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [twoFactorEmail, setTwoFactorEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthError, setOauthError] = useState("");
  const { login, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthErr = params.get("oauth_error");
    if (oauthErr) {
      setOauthError(oauthErr);
      window.history.replaceState({}, document.title, "/login");
    }
  }, []);

  useEffect(() => {
    if (step === "two-factor") {
      codeInputRef.current?.focus();
    }
  }, [step]);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiLogin(email, password);
      if (data.requiresTwoFactor) {
        setTwoFactorEmail(data.user?.email ?? email);
        setStep("two-factor");
        setError("");
      } else {
        login(data.token, data.user);
        navigate("/app");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleTwoFactorSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (code.replace(/\s/g, "").length < 6) {
      setError("Please enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      await verifyTwoFactor(twoFactorEmail, code.replace(/\s/g, ""));
      navigate("/app");
    } catch (err: any) {
      const message = err.response?.data?.error || "Invalid code";
      if (err.response?.data?.code === "TOO_MANY_ATTEMPTS") {
        setError("Too many failed attempts. Try a recovery code or wait 15 minutes.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
      setCode("");
    }
  }

  function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    const formatted = digits.length <= 3 ? digits : `${digits.slice(0, 3)} ${digits.slice(3)}`;
    setCode(formatted);
    if (digits.length === 6) {
      codeInputRef.current?.blur();
      void handleTwoFactorSubmit(new Event("submit") as unknown as React.FormEvent);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-slate-900">
                {step === "two-factor" ? "Two-factor authentication" : "Sign in to your account"}
              </h1>
              <p className="text-slate-600 mt-2">InvoiceFlow — Professional invoices without the accounting headache</p>
            </div>

               {step === "credentials" && (
               <form onSubmit={handleCredentialsSubmit} className="space-y-5">
                 {error && (
                   <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
                 )}
                 {oauthError && (
                   <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{oauthError}</div>
                 )}
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                   <input
                     type="email"
                     required
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                     placeholder="you@example.com"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                   <input
                     type="password"
                     required
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                     placeholder="••••••••"
                   />
                 </div>
                 <button
                   type="submit"
                   disabled={loading}
                   className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                 >
                   {loading ? "Signing in..." : "Sign In"}
                 </button>

                 <div className="relative my-6">
                   <div className="absolute inset-0 flex items-center">
                     <div className="w-full border-t border-slate-300" />
                   </div>
                   <div className="relative flex justify-center text-sm">
                     <span className="px-3 bg-white text-slate-500">Or sign in with</span>
                   </div>
                 </div>

                  <button
                    type="button"
                    onClick={() => (window.location.href = "/api/auth/oauth/google")}
                    className="w-full inline-flex items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-blue-600 font-bold text-xs">G</span>
                    Sign in with Google
                  </button>
               </form>
             )}

            {step === "two-factor" && (
              <form onSubmit={handleTwoFactorSubmit} className="space-y-5">
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Authentication code
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Enter the 6-digit code from your authenticator app for{" "}
                    <span className="font-medium text-slate-700">{twoFactorEmail}</span>
                    . You can also enter a recovery code.
                  </p>
                  <input
                    ref={codeInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-password"
                    required
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-center text-2xl tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="—— ——"
                    maxLength={7}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || code.replace(/\s/g, "").length < 6}
                  className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => setStep("credentials")}
                    className="text-sm text-slate-600 hover:text-slate-900"
                  >
                    ← Use a different account
                  </button>
                  <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900">
                    Didn't receive a code?
                  </Link>
                </div>
              </form>
            )}

            {step === "credentials" && (
              <div className="mt-6 text-center text-sm text-slate-600">
                Don't have an account?{" "}
                <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                  Create your account
                </Link>
              </div>
            )}

            <div className="mt-4 text-center">
              <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">
                ← Back to homepage
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
