import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { login as apiLogin } from "../api/client";
import ThemeToggle from "../components/ThemeToggle";
export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [step, setStep] = useState("credentials");
    const [twoFactorEmail, setTwoFactorEmail] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [oauthError, setOauthError] = useState("");
    const { login, verifyTwoFactor } = useAuth();
    const navigate = useNavigate();
    const codeInputRef = useRef(null);
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
    async function handleCredentialsSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const data = await apiLogin(email, password);
            if (data.requiresTwoFactor) {
                setTwoFactorEmail(data.user?.email ?? email);
                setStep("two-factor");
                setError("");
            }
            else {
                login(data.token, data.user);
                navigate("/app");
            }
        }
        catch (err) {
            setError(err.response?.data?.error || "Authentication failed");
        }
        finally {
            setLoading(false);
        }
    }
    async function handleTwoFactorSubmit(e) {
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
        }
        catch (err) {
            const message = err.response?.data?.error || "Invalid code";
            if (err.response?.data?.code === "TOO_MANY_ATTEMPTS") {
                setError("Too many failed attempts. Try a recovery code or wait 15 minutes.");
            }
            else {
                setError(message);
            }
        }
        finally {
            setLoading(false);
            setCode("");
        }
    }
    function handleCodeChange(value) {
        const digits = value.replace(/\D/g, "").slice(0, 6);
        const formatted = digits.length <= 3 ? digits : `${digits.slice(0, 3)} ${digits.slice(3)}`;
        setCode(formatted);
        if (digits.length === 6) {
            codeInputRef.current?.blur();
            void handleTwoFactorSubmit(new Event("submit"));
        }
    }
    return (_jsx("div", { className: "min-h-screen bg-surface-alt", children: _jsx("div", { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-16", children: _jsx("div", { className: "flex justify-center", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-primary", children: step === "two-factor" ? "Two-factor authentication" : "Sign in to your account" }), _jsx("p", { className: "text-xs text-tertiary mt-2", children: "InvoiceFlow \u2014 Professional invoices without the accounting headache" })] }), step === "credentials" && (_jsxs("form", { onSubmit: handleCredentialsSubmit, className: "space-y-4", children: [error && (_jsx("div", { className: "rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text", children: error })), oauthError && (_jsx("div", { className: "rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text", children: oauthError })), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Email address" }), _jsx("input", { type: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value), className: "form-control w-full", placeholder: "you@example.com" })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Password" }), _jsx("input", { type: "password", required: true, value: password, onChange: (e) => setPassword(e.target.value), className: "form-control w-full", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), _jsx("button", { type: "submit", disabled: loading, className: "w-full rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50", children: loading ? "Signing in..." : "Sign In" }), _jsxs("div", { className: "relative my-6", children: [_jsx("div", { className: "absolute inset-0 flex items-center", children: _jsx("div", { className: "w-full border-t border-input-border" }) }), _jsx("div", { className: "relative flex justify-center text-sm", children: _jsx("span", { className: "px-3 bg-surface-alt text-tertiary font-medium", children: "Or sign in with" }) })] }), _jsxs("button", { type: "button", onClick: () => (window.location.href = "/api/auth/oauth/google"), className: "w-full inline-flex items-center justify-center gap-3 rounded-lg border border-input-border bg-surface-alt px-4 py-2.5 text-sm font-medium text-secondary hover:bg-hover transition-colors", children: [_jsx("span", { className: "flex h-5 w-5 items-center justify-center rounded status-info-bg status-info-text font-bold text-xs", children: "G" }), "Sign in with Google"] })] })), step === "two-factor" && (_jsxs("form", { onSubmit: handleTwoFactorSubmit, className: "space-y-4", children: [error && (_jsx("div", { className: "rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text", children: error })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-secondary mb-1", children: "Authentication code" }), _jsxs("p", { className: "text-xs text-tertiary mb-2", children: ["Enter the 6-digit code from your authenticator app for", " ", _jsx("span", { className: "font-medium text-secondary", children: twoFactorEmail }), ". You can also enter a recovery code."] }), _jsx("input", { ref: codeInputRef, type: "text", inputMode: "numeric", autoComplete: "one-time-password", required: true, value: code, onChange: (e) => handleCodeChange(e.target.value), className: "w-full rounded-lg border border-input-border bg-surface-alt px-4 py-2.5 text-center text-2xl tracking-[0.3em] font-mono text-primary focus:outline-none focus:ring-2 focus: ring-primary", placeholder: "\u2014\u2014 \u2014\u2014", maxLength: 7 })] }), _jsx("button", { type: "submit", disabled: loading || code.replace(/\s/g, "").length < 6, className: "w-full rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50", children: loading ? "Verifying..." : "Verify & Sign In" }), _jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("button", { type: "button", onClick: () => setStep("credentials"), className: "text-sm text-tertiary hover:text-primary", children: "\u2190 Use a different account" }), _jsx(Link, { to: "/login", className: "text-sm text-tertiary hover:text-primary", children: "Didn't receive a code?" })] })] })), step === "credentials" && (_jsxs("div", { className: "mt-6 text-center text-sm text-tertiary", children: ["Don't have an account?", " ", _jsx(Link, { to: "/register", className: "text-primary-brand text-primary-brand hover:text-primary-brand dark:hover:text-primary-brand font-medium", children: "Create your account" })] })), step === "credentials" && (_jsx("div", { className: "mt-6 flex items-center justify-center", children: _jsx(ThemeToggle, {}) })), _jsx("div", { className: "mt-4 text-center", children: _jsx(Link, { to: "/", className: "text-sm text-tertiary hover:text-secondary", children: "\u2190 Back to homepage" }) })] }) }) }) }));
}
