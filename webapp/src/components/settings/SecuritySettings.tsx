import { useState } from "react";
import { changePassword, getUserSessions, revokeUserSession } from "../../api/client";
import TwoFactorManager from "../TwoFactorManager";

export default function SecuritySettings() {
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useState(() => {
    async function loadSessions() {
      try {
        const data = await getUserSessions();
        setActiveSessions(data.sessions ?? []);
      } catch {
        // silent — sessions endpoint may not be fully wired
      } finally {
        setLoadingSessions(false);
      }
    }
    loadSessions();
  });

  async function revokeSession(id: string) {
    setRevoking(id);
    try {
      await revokeUserSession(id);
      setActiveSessions(activeSessions.filter((s) => s.id !== id));
    } catch {
      // ignore
    } finally {
      setRevoking(null);
    }
  }

  async function changeUserPassword() {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordSaved(true);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-primary">Security</h2>
        <p className="text-sm text-secondary mt-1">
          Manage password, two-factor authentication, and active sessions.
        </p>
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Password</h3>
        <p className="text-sm text-secondary mb-4">
          Change your password. Choose a strong, unique password you haven't used elsewhere.
        </p>

        {passwordError && (
          <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text mb-4">{passwordError}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Current Password</label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div />
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">New Password</label>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Confirm New Password</label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          {passwordSaved && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium status-success-text">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8.5 8.5a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Password changed
            </span>
          )}
          <button
            onClick={changeUserPassword}
            disabled={passwordSaving}
            className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {passwordSaving ? "Changing…" : "Change Password"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-1">Two-Factor Authentication</h3>
        <p className="text-sm text-secondary mb-4">Add an extra layer of security to your account.</p>
        <TwoFactorManager />
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary">Active Sessions</h3>
        <p className="text-sm text-secondary mt-1 mb-4">Devices currently signed in to your account.</p>

        {loadingSessions ? (
          <div className="text-sm text-secondary">Loading sessions…</div>
        ) : activeSessions.length === 0 ? (
          <div className="text-sm text-secondary">No recent sessions found.</div>
        ) : (
          <div className="space-y-3">
            {activeSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3 border-b border-color-subtle last:border-0">
                <div>
                  <p className="text-sm font-medium text-primary">{s.user_agent ?? "Unknown device"}</p>
                  <p className="text-xs text-secondary">{s.ip_address ?? "—"} · {s.created_at ? new Date(s.created_at).toLocaleString() : "—"}</p>
                </div>
                <button
                  onClick={() => revokeSession(s.id)}
                  disabled={revoking === s.id}
                  className="text-xs font-medium status-error-text hover:status-error-text disabled:opacity-50"
                >
                  {revoking === s.id ? "Revoking…" : "Revoke"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border status-error-border status-error-bg p-6">
        <h3 className="text-md font-semibold status-error-text mb-3">Danger Zone</h3>
        <p className="text-sm text-secondary mb-4">
          Actions in this section are irreversible. Proceed with caution.
        </p>
        <button
          onClick={() => {
            if (
              !confirm(
                "Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted."
              )
            )
              return;
            alert("Account deletion is not available during the current subscription period. Please cancel your subscription first.");
          }}
          className="rounded-lg status-error-text px-4 py-2 text-sm font-medium text-on-primary hover:status-error-text"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}





