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
                   <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                     <path d="M22.56 12.54c0-.73-.06-1.44-.17-2.12H12v4.07h6.18c-.28 1.34-1.14 2.47-2.4 3.23l-.01 1.35c2.05-1.21 3.47-3.1 3.47-5.53z" />
                     <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-.01-1.35c-.44.59-1 .93-1.72 1.21-1.21.69-2.77 1.09-4.55 1.09-3.5 0-6.47-2.35-7.53-5.55l-.01.6C4.23 17.67 5.67 19.56 8 20.53c1.54.72 3.3.98 5.25.98z" />
                     <path d="M4.47 9.02C4.05 10.02 3.8 11.14 3.8 12.3c0 1.15.24 2.27.67 3.27l-.01.6c0 2.08 1.48 3.8 3.44 4.14-.14.29-.28.57-.44.84-.62.99-1.87 1.69-3.17 1.69-1.14 0-2.2-.4-3.03-1.07l-.01-.6C.99 19.44 0 17.93 0 15.96c0-.87.16-1.73.44-2.57l3.6-2.93z" />
                     <path fill="none" d="M0 0h24v24H0z" />
                     <path d="M12 2.5c1.53 0 2.97.58 4.05 1.56l2.95-2.95C17.67 1.1 14.98 0 12 0 8.34 0 5.09 1.52 3.14 3.92l3.62 2.85C9.42 4.21 10.65 2.5 12 2.5z" />
                   </svg>
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
