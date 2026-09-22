import { useEffect, useState, useCallback } from "react";
import {
  getTeam,
  inviteTeamMember,
  updateTeamMember,
  removeTeamMember,
  resendTeamInvite,
  type ApiTeamMember,
  type TeamRole,
} from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Trash2, Send, Shield, ShieldCheck } from "lucide-react";

const ROLES: { value: TeamRole; label: string; desc: string }[] = [
  { value: "owner", label: "Owner", desc: "Full access to all features, billing, and team management." },
  { value: "admin", label: "Admin", desc: "Manage invoices, customers, products, and templates. No billing access." },
  { value: "member", label: "Member", desc: "Create and edit invoices, customers, and products." },
  { value: "viewer", label: "Viewer", desc: "Read-only access to invoices and reports." },
];

export default function TeamPermissionsSettings() {
  const [team, setTeam] = useState<ApiTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("member");
  const [inviting, setInviting] = useState(false);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTeam();
      setTeam(data.team ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load team");
      setTeam([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  async function invite() {
    if (!inviteEmail) return;
    setInviting(true);
    setActionMessage(null);
    setError(null);
    try {
      await inviteTeamMember({ email: inviteEmail, role: inviteRole });
      setActionMessage(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      loadTeam();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(memberId: string, role: TeamRole) {
    try {
      await updateTeamMember(memberId, { role });
      setActionMessage("Role updated");
      loadTeam();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update role");
    }
  }

  async function remove(memberId: string) {
    if (!window.confirm("Remove this team member?")) return;
    try {
      await removeTeamMember(memberId);
      setActionMessage("Team member removed");
      loadTeam();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to remove team member");
    }
  }

  async function resend(memberId: string) {
    try {
      await resendTeamInvite(memberId);
      setActionMessage("Invitation resent");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to resend invitation");
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
        {error && (
          <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text mb-4">{error}</div>
        )}
        {actionMessage && (
          <div className="rounded-lg status-success-bg border status-success-border px-4 py-3 text-sm status-success-text mb-4">{actionMessage}</div>
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
              onChange={(e) => setInviteRole(e.target.value as TeamRole)}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button variant="primary" size="md" disabled={inviting || !inviteEmail} onClick={invite}>
              {inviting ? "Sending…" : "Send Invite"}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Team Members ({team.length})</h3>
        {loading ? (
          <p className="text-sm text-secondary">Loading team…</p>
        ) : team.length === 0 ? (
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
                {team.map((m) => (
                  <tr key={m.id} className="border-t border-color-subtle">
                    <td className="py-2 text-primary">{m.name ?? (m.email ?? "—")}</td>
                    <td className="py-2 text-secondary">{m.email}</td>
                    <td className="py-2">
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.id, e.target.value as TeamRole)}
                        className="rounded-lg border border-input-border bg-surface-alt px-2 py-1 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.status === "active"
                          ? "status-success-bg status-success-text"
                          : "status-warning-bg status-warning-text"
                      }`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {m.status === "invited" && (
                          <button
                            onClick={() => resend(m.id)}
                            className="text-xs text-secondary hover:text-primary"
                            title="Resend invite"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {m.role !== "owner" && (
                          <button
                            onClick={() => remove(m.id)}
                            className="text-xs text-secondary hover:status-error-text"
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Role Permissions</h3>
        <div className="space-y-3 text-sm">
          {ROLES.map((r) => (
            <div key={r.value} className="flex items-start gap-3">
              <Shield className="h-4 w-4 text-secondary mt-0.5" />
              <div>
                <span className="font-medium text-secondary">{r.label}</span>
                <span className="text-secondary"> — {r.desc}</span>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-4 w-4 text-secondary mt-0.5" />
            <div>
              <span className="font-medium text-secondary">Owner</span>
              <span className="text-secondary"> — Full access to all features, billing, and team management.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
