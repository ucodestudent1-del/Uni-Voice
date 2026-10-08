import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { register as apiRegister } from "../api/client";
import ThemeToggle from "../components/ThemeToggle";
export default function Register() {
    const [step, setStep] = useState("account");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [countryCode, setCountryCode] = useState("US");
    const [currency, setCurrency] = useState("USD");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const countries = [
        { code: "US", name: "United States" },
        { code: "GB", name: "United Kingdom" },
        { code: "CA", name: "Canada" },
        { code: "AU", name: "Australia" },
        { code: "DE", name: "Germany" },
        { code: "FR", name: "France" },
        { code: "ES", name: "Spain" },
        { code: "IT", name: "Italy" },
        { code: "NL", name: "Netherlands" },
        { code: "SE", name: "Sweden" },
        { code: "NO", name: "Norway" },
        { code: "DK", name: "Denmark" },
        { code: "FI", name: "Finland" },
        { code: "JP", name: "Japan" },
        { code: "IN", name: "India" },
        { code: "BR", name: "Brazil" },
        { code: "MX", name: "Mexico" },
        { code: "SG", name: "Singapore" },
        { code: "CH", name: "Switzerland" },
        { code: "IE", name: "Ireland" },
    ];
    const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "JPY", "INR", "BRL", "MXN", "SGD"];
    async function handleAccountSubmit(e) {
        e.preventDefault();
        setError("");
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }
        setStep("business");
    }
    async function handleBusinessSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const data = await apiRegister(email, password, businessName || "My Business", countryCode, currency);
            login(data.token, data.user);
            if (!data.user?.businessId) {
                navigate("/");
            }
            else {
                navigate("/app/invoices/new");
            }
        }
        catch (err) {
            setError(err.response?.data?.error || "Failed to create account");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "min-h-screen bg-surface-alt", children: _jsx("div", { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-8", children: _jsx("div", { className: "flex justify-center", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-primary", children: "Create your account" }), _jsx("p", { className: "text-tertiary mt-2", children: "Start creating professional invoices in under two minutes" })] }), _jsx("div", { className: "mb-6" }), step === "account" ? (_jsxs("form", { onSubmit: handleAccountSubmit, className: "space-y-4", children: [error && (_jsx("div", { className: "rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text", children: error })), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Email address" }), _jsx("input", { type: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value), className: "form-control", placeholder: "you@example.com" })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Password" }), _jsx("input", { type: "password", required: true, value: password, onChange: (e) => setPassword(e.target.value), className: "form-control", placeholder: "At least 8 characters" })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Confirm password" }), _jsx("input", { type: "password", required: true, value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), className: "form-control" })] }), _jsx("button", { type: "submit", className: "w-full rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover", children: "Continue" })] })) : (_jsxs("form", { onSubmit: handleBusinessSubmit, className: "space-y-4", children: [error && (_jsx("div", { className: "rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text", children: error })), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Business Name" }), _jsx("input", { type: "text", required: true, value: businessName, onChange: (e) => setBusinessName(e.target.value), className: "form-control", placeholder: "e.g. Acme Design Studio" })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Country / Region" }), _jsx("select", { value: countryCode, onChange: (e) => setCountryCode(e.target.value), className: "form-select", children: countries.map((c) => (_jsx("option", { value: c.code, children: c.name }, c.code))) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Default Currency" }), _jsx("select", { value: currency, onChange: (e) => setCurrency(e.target.value), className: "form-select", children: currencies.map((c) => (_jsx("option", { value: c, children: c }, c))) })] }), _jsx("button", { type: "submit", disabled: loading, className: "w-full rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50", children: loading ? "Creating your account..." : "Create Account & Invoice" })] })), _jsxs("div", { className: "mt-6 flex flex-col items-center gap-4 text-sm text-tertiary", children: [_jsx(ThemeToggle, {}), "Already have an account?", " ", _jsx(Link, { to: "/login", className: "text-primary-brand hover:text-primary font-medium", children: "Sign in" })] })] }) }) }) }));
}
