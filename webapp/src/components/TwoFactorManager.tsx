import { useState, useEffect } from "react";
import {
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  getTwoFactorStatus,
  regenerateRecoveryCodes,
} from "../api/client";
import type {
  TwoFactorStatus,
  TwoFactorSetupResult,
  RecoveryCodeSummary,
} from "../types/api";

type ManageStep = "loading" | "disabled" | "pending" | "enabled";

interface TwoFactorManagerProps {
  className?: string;
}

export default function TwoFactorManager({ className }: TwoFactorManagerProps) {
  const [step, setStep] = useState<ManageStep>("loading");
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [recovery, setRecovery] = useState<RecoveryCodeSummary | null>(null);
  const [setupResult, setSetupResult] = useState<TwoFactorSetupResult | null>(null);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = async () => {
    try {
      const data = await getTwoFactorStatus();
      setStatus(data.status);
      setRecovery(data.recoveryCodes);
      setStep(data.status.enabled ? "enabled" : "disabled");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load 2FA status");
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  async function startSetup() {
    setError("");
    setSaving(true);
    try {
      const data = await setupTwoFactor();
      setSetupResult(data);
      setStep("pending");
      setCode("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to start 2FA setup");
    } finally {
      setSaving(false);
    }
  }

  async function confirmEnable() {
    if (code.replace(/\s/g, "").length < 6) {
      setError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await enableTwoFactor(code.replace(/\s/g, ""));
      setStep("enabled");
      setSetupResult(null);
      await loadStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || "Invalid verification code");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable() {
    if (!confirm("Disable two-factor authentication? You will need to set it up again to re-enable it.")) {
      return;
    }
    setError("");
    setSaving(true);
    try {
      await disableTwoFactor();
      setStatus((prev) => (prev ? { ...prev, enabled: false, confirmedAt: null } : prev));
      setRecovery(null);
      setStep("disabled");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to disable 2FA");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setError("");
    setSaving(true);
    try {
      const data = await regenerateRecoveryCodes();
      setSetupResult({ recoveryCodes: data.recoveryCodes, secret: "", otpauthUri: "" });
      await loadStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to regenerate recovery codes");
    } finally {
      setSaving(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (step === "loading") {
    return (
      <div className="flex items-center gap-3 text-secondary">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>Loading security settings…</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Two-Factor Authentication</h2>
          <p className="text-sm text-secondary mt-1">
            {status?.enabled
              ? "Extra security is enabled on your account."
              : "Add an extra layer of security to your account."}
          </p>
        </div>
        {status?.enabled ? (
          <span className="inline-flex items-center gap-1.5 rounded-full status-success-bg px-2.5 py-1 text-xs font-medium status-success-text">
            ✓ Enabled
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-1 text-xs font-medium text-secondary">
            Disabled
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text">{error}</div>
      )}

      {!status?.enabled && step === "disabled" && (
        <div className="rounded-xl border border-color-subtle bg-surface-alt p-6">
          <h3 className="font-semibold text-primary">Secure your account with an authenticator app</h3>
          <p className="mt-1 text-sm text-secondary">
            Scan the QR code below or enter the secret key in your authenticator app (Google
            Authenticator, Authy, Microsoft Authenticator, etc.), then verify with the code shown.
          </p>
          <button
            onClick={startSetup}
            disabled={saving}
            className="mt-4 inline-flex items-center rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Setting up…" : "Enable Two-Factor Authentication"}
          </button>
        </div>
      )}

      {step === "pending" && setupResult && (
        <div className="rounded-xl border border-color-subtle bg-surface p-6">
          <h3 className="font-semibold text-primary">Add to your authenticator app</h3>
          <p className="mt-1 text-sm text-secondary">
            Open your authenticator app and create a new account using the secret below, or paste
            the otpauth URI.
          </p>

          <div className="mt-4 rounded-lg bg-surface-alt border border-color-subtle p-4 break-all font-mono text-xs text-primary">
            {setupResult.otpauthUri}
            <button
              type="button"
              onClick={() => copy(setupResult.otpauthUri)}
              className="ml-2 inline-flex items-center gap-1 rounded-md bg-surface-alt px-1.5 py-0.5 text-xs text-secondary hover:bg-surface-alt300"
              title="Copy otpauth URI"
            >
                {copied ? "Copied" : "Copy URI"}
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-secondary mb-1">Secret key</label>
            <div className="flex items-center gap-2">
              <code className="block flex-1 rounded-lg bg-surface-alt border border-color-subtle px-3 py-2 font-mono text-base tracking-wider break-all">
                {setupResult.secret}
              </code>
              <button
                type="button"
                onClick={() => copy(setupResult.secret)}
                className="rounded-lg border border-input-border px-3 py-2 text-sm text-secondary hover:bg-surface-alt"
                title="Copy secret"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-secondary mb-1">
              Verification code
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-password"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-lg border border-input-border px-4 py-2.5 text-center text-2xl font-mono tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="—— ——"
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setStep("disabled")}
              className="flex-1 rounded-lg border border-input-border px-4 py-2.5 text-sm font-medium text-secondary hover:bg-surface-alt"
            >
              Cancel
            </button>
            <button
              onClick={confirmEnable}
              disabled={saving}
              className="flex-1 rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? "Enabling…" : "Verify & Enable"}
            </button>
          </div>

          {setupResult.recoveryCodes.length > 0 && (
            <RecoveryCodesDisplay codes={setupResult.recoveryCodes} onCopy={copy} />
          )}
        </div>
      )}

      {status?.enabled && step === "enabled" && (
        <div className="rounded-xl border border-color-subtle bg-surface p-6">
          <h3 className="font-semibold text-primary">Recovery codes</h3>
          {recovery && (
            <p className="mt-2 text-sm text-secondary">
              {recovery.remaining} of {recovery.total} recovery codes remaining. Each code can be used once
              if you lose access to your authenticator.
            </p>
          )}
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleRegenerate}
              disabled={saving}
              className="rounded-lg border border-input-border px-4 py-2.5 text-sm font-medium text-secondary hover:bg-surface-alt disabled:opacity-50"
            >
              {saving ? "Generating…" : "Regenerate recovery codes"}
            </button>
          </div>
          <button
            onClick={handleDisable}
            disabled={saving}
            className="mt-6 rounded-lg border status-error-border px-4 py-2.5 text-sm font-medium status-error-text hover:status-error-bg disabled:opacity-50"
          >
            {saving ? "Disabling…" : "Disable two-factor authentication"}
          </button>
        </div>
      )}

      {step === "pending" && setupResult?.recoveryCodes?.length === 0 && (
        <RecoveryCodesDisplay codes={setupResult.recoveryCodes} onCopy={copy} />
      )}
    </div>
  );
}

function RecoveryCodesDisplay({ codes, onCopy }: { codes: string[]; onCopy: (text: string) => void }) {
  const all = codes.join("\n");
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-secondary">Save these recovery codes</label>
        <button
          type="button"
          onClick={() => onCopy(all)}
          className="inline-flex items-center gap-1 text-sm text-primary-brand hover:text-primary-brand"
        >
          Copy all
        </button>
      </div>
      <p className="mt-1 text-xs text-warning-text">
        Store these in a safe place. You'll need them if you lose access to your authenticator.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {codes.map((c) => (
          <code key={c} className="rounded-lg bg-surface-alt border border-color-subtle px-3 py-2 font-mono text-center text-primary">
            {c}
          </code>
        ))}
      </div>
    </div>
  );
}





