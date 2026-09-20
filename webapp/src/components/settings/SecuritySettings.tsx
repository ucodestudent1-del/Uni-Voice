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
        <h2 className="text-lg font-semibold text-slate-900">Security</h2>
        <p className="text-sm text-slate-600 mt-1">
          Manage password, two-factor authentication, and active sessions.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-md font-semibold text-slate-900 mb-4">Password</h3>
        <p className="text-sm text-slate-600 mb-4">
          Change your password. Choose a strong, unique password you haven't used elsewhere.
        </p>

        {passwordError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">{passwordError}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          {passwordSaved && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8.5 8.5a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Password changed
            </span>
          )}
          <button
            onClick={changeUserPassword}
            disabled={passwordSaving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {passwordSaving ? "Changing…" : "Change Password"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-md font-semibold text-slate-900 mb-1">Two-Factor Authentication</h3>
        <p className="text-sm text-slate-600 mb-4">Add an extra layer of security to your account.</p>
        <TwoFactorManager />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-md font-semibold text-slate-900">Active Sessions</h3>
        <p className="text-sm text-slate-500 mt-1 mb-4">Devices currently signed in to your account.</p>

        {loadingSessions ? (
          <div className="text-sm text-slate-500">Loading sessions…</div>
        ) : activeSessions.length === 0 ? (
          <div className="text-sm text-slate-500">No recent sessions found.</div>
        ) : (
          <div className="space-y-3">
            {activeSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{s.user_agent ?? "Unknown device"}</p>
                  <p className="text-xs text-slate-500">{s.ip_address ?? "—"} · {s.created_at ? new Date(s.created_at).toLocaleString() : "—"}</p>
                </div>
                <button
                  onClick={() => revokeSession(s.id)}
                  disabled={revoking === s.id}
                  className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {revoking === s.id ? "Revoking…" : "Revoke"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h3 className="text-md font-semibold text-red-900 mb-3">Danger Zone</h3>
        <p className="text-sm text-slate-600 mb-4">
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
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}
