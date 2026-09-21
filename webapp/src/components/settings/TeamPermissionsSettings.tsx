import { useState } from "react";

export default function TeamPermissionsSettings() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const teamMembers = [
    { id: "current-user", name: "You (Owner)", email: "owner", role: "owner", status: "active" },
  ];

  async function invite() {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteError(null);
    try {
      setInviteError("Team management features are not yet available. Please check back later.");
    } catch (err: any) {
      setInviteError(err.message ?? "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Team &amp; Permissions</h2>
        <p className="text-sm text-secondary mt-1">
          Invite team members and control their roles and access levels.
        </p>
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Invite Team Member</h3>
        {inviteError && (
          <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text mb-4">{inviteError}</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-secondary mb-1">Email Address</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="admin">Admin — full access</option>
              <option value="member">Member — edit invoices and customers</option>
              <option value="viewer">Viewer — read-only access</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={invite}
              disabled={inviting || !inviteEmail}
              className="w-full rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
            >
              {inviting ? "Sending…" : "Send Invite"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Team Members</h3>
        {teamMembers.length === 0 ? (
          <div className="text-sm text-secondary">No team members yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr>
                  <th className="text-left font-medium text-secondary">Name</th>
                  <th className="text-left font-medium text-secondary">Email</th>
                  <th className="text-left font-medium text-secondary">Role</th>
                  <th className="text-left font-medium text-secondary">Status</th>
                  <th className="text-right font-medium text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((m) => (
                  <tr key={m.id} className="border-t border-color-subtle">
                    <td className="py-2 text-primary">{m.name}</td>
                    <td className="py-2 text-secondary">{m.email}</td>
                    <td className="py-2 text-secondary">{m.role}</td>
                    <td className="py-2">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium status-success-bg status-success-text">
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {m.role !== "owner" && (
                        <button className="text-xs font-medium status-error-text hover:status-error-text">
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Permissions Overview</h3>
        <div className="space-y-3 text-sm">
          <div>
            <span className="font-medium text-secondary">Owner</span>
            <span className="text-secondary"> — Full access to all features, billing, and team management.</span>
          </div>
          <div>
            <span className="font-medium text-secondary">Admin</span>
            <span className="text-secondary"> — Manage invoices, customers, products, and templates. No billing access.</span>
          </div>
          <div>
            <span className="font-medium text-secondary">Member</span>
            <span className="text-secondary"> — Create and edit invoices, customers, and products.</span>
          </div>
          <div>
            <span className="font-medium text-secondary">Viewer</span>
            <span className="text-secondary"> — Read-only access to invoices and reports.</span>
          </div>
        </div>
      </div>
    </div>
  );
}




