import { useState } from "react";

export default function TeamPermissionsSettings() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const teamMembers = [
    { id: "1", name: "You (Owner)", email: "you@business.com", role: "owner", status: "active" },
  ];

  async function invite() {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteError(null);
    try {
      // Stub — team management is not yet fully wired in the backend
      alert(`Invitation sent to ${inviteEmail} as ${inviteRole}`);
      setInviteEmail("");
    } catch (err: any) {
      setInviteError(err.message ?? "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Team &amp; Permissions</h2>
        <p className="text-sm text-slate-600 mt-1">
          Invite team members and control their roles and access levels.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-md font-semibold text-slate-900 mb-4">Invite Team Member</h3>
        {inviteError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">{inviteError}</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {inviting ? "Sending…" : "Send Invite"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-md font-semibold text-slate-900 mb-4">Team Members</h3>
        {teamMembers.length === 0 ? (
          <div className="text-sm text-slate-500">No team members yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr>
                  <th className="text-left font-medium text-slate-500">Name</th>
                  <th className="text-left font-medium text-slate-500">Email</th>
                  <th className="text-left font-medium text-slate-500">Role</th>
                  <th className="text-left font-medium text-slate-500">Status</th>
                  <th className="text-right font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="py-2 text-slate-900">{m.name}</td>
                    <td className="py-2 text-slate-600">{m.email}</td>
                    <td className="py-2 text-slate-600">{m.role}</td>
                    <td className="py-2">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {m.role !== "owner" && (
                        <button className="text-xs font-medium text-red-600 hover:text-red-700">
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

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-md font-semibold text-slate-900 mb-4">Permissions Overview</h3>
        <div className="space-y-3 text-sm">
          <div>
            <span className="font-medium text-slate-700">Owner</span>
            <span className="text-slate-500"> — Full access to all features, billing, and team management.</span>
          </div>
          <div>
            <span className="font-medium text-slate-700">Admin</span>
            <span className="text-slate-500"> — Manage invoices, customers, products, and templates. No billing access.</span>
          </div>
          <div>
            <span className="font-medium text-slate-700">Member</span>
            <span className="text-slate-500"> — Create and edit invoices, customers, and products.</span>
          </div>
          <div>
            <span className="font-medium text-slate-700">Viewer</span>
            <span className="text-slate-500"> — Read-only access to invoices and reports.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
