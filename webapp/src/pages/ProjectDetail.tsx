import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getProject,
  archiveProject,
  restoreProject,
  updateProjectStatus,
  deleteProject,
  createInvoiceFromProject,
  getProjectInvoices,
  getProjectFinancialSummary,
  getProjectEvents,
  addProjectTag,
  removeProjectTag,
  type ProjectSearchParams,
} from "../api/client";
import { Edit2, Archive, RefreshCw, Trash2, Plus } from "lucide-react";
import type { ApiProject, ApiProjectTag, ApiProjectEvent, ApiProjectInvoice, ApiProjectFinancialSummary } from "../types/api";
import ProjectStatusBadge from "../components/ProjectStatusBadge";
import ProjectForm from "../components/ProjectForm";
import ProjectTagManager from "../components/ProjectTagManager";
import ProjectTimeTab from "../components/ProjectTimeTab";
import ProjectNotesTab from "../components/ProjectNotesTab";
import { formatDate, formatCurrency } from "../utils/format";
import { Button } from "../components/ui/Button";

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export default function ProjectDetail() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const onBack = () => navigate("/app/projects");
  const [project, setProject] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "activity" | "time" | "notes">("overview");

  const loadProject = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProject(projectId);
      setProject(data);
    } catch (err: any) {
      setError(err.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const handleArchive = async () => {
    if (!project) return;
    try {
      if (project.status === "archived") {
        await restoreProject(project.id);
      } else {
        await archiveProject(project.id);
      }
      loadProject();
    } catch (err: any) {
      setError(err.message || "Action failed");
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!project) return;
    try {
      await updateProjectStatus(project.id, status);
      loadProject();
    } catch (err: any) {
      setError(err.message || "Status update failed");
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    try {
      await deleteProject(project.id);
      onBack();
    } catch (err: any) {
      setError(err.message || "Delete failed");
    }
  };

  const handleCreateInvoice = async () => {
    if (!project) return;
    try {
      await createInvoiceFromProject(project.id, { includeUnbilledTime: true });
      loadProject();
    } catch (err: any) {
      setError(err.message || "Failed to create invoice");
    }
  };

  const handleSaved = () => {
    setShowForm(false);
    loadProject();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-alt rounded w-48" />
          <div className="h-4 bg-surface-alt rounded w-64" />
          <div className="h-64 bg-surface-alt rounded" />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <div className="p-4 status-error-bg border status-error-border rounded-lg">
          <p className="text-sm status-error-text">{error || "Project not found"}</p>
          <button
            onClick={onBack}
            className="mt-2 text-sm text-primary-brand hover:text-primary-brand"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-sm text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary"
        >
          ← Back
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            icon={<Edit2 className="w-4 h-4" />}
            onClick={() => setShowForm(true)}
          >
            Edit
          </Button>
          {project.status !== "archived" ? (
            <Button
              variant="secondary"
              size="md"
              icon={<Archive className="w-4 h-4" />}
              onClick={handleArchive}
            >
            Archive
          </Button>
          ) : (
            <Button
              variant="secondary"
              size="md"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={handleArchive}
            >
            Restore
          </Button>
          )}
          <Button
            variant="danger"
            size="md"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={handleDelete}
          />
        </div>
      </div>

      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-primary">{project.name}</h1>
          <div className="flex items-center gap-4 text-sm text-secondary">
            <ProjectStatusBadge status={project.status} />
            {project.customer_name && <span>Customer: {project.customer_name}</span>}
            {project.start_date && <span>Start: {formatDate(project.start_date)}</span>}
            {project.due_date && <span>Due: {formatDate(project.due_date)}</span>}
          </div>
          {project.description && <p className="text-sm text-secondary">{project.description}</p>}
        </div>
      </div>

      <div className="border border-color-subtle border-color rounded-lg">
        <nav className="flex gap-4 px-4 pt-3 border-b border-color-subtle border-color">
          <button
            onClick={() => setActiveTab("overview")}
            className={`text-sm font-medium pb-2 ${activeTab === "overview" ? "text-primary-brand border-b-2 border-primary-600" : "text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary"}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("invoices")}
            className={`text-sm font-medium pb-2 ${activeTab === "invoices" ? "text-primary-brand border-b-2 border-primary-600" : "text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary"}`}
          >
            Invoices
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`text-sm font-medium pb-2 ${activeTab === "activity" ? "text-primary-brand border-b-2 border-primary-600" : "text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary"}`}
          >
            Activity
          </button>
          <button
            onClick={() => setActiveTab("time")}
            className={`text-sm font-medium pb-2 ${activeTab === "time" ? "text-primary-brand border-b-2 border-primary-600" : "text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary"}`}
          >
            Time
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`text-sm font-medium pb-2 ${activeTab === "notes" ? "text-primary-brand border-b-2 border-primary-600" : "text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary"}`}
          >
            Notes
          </button>
        </nav>

        <div className="p-4">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-color-subtle rounded-lg p-4 bg-surface-alt">
                  <p className="text-xs text-secondary uppercase">Budget</p>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    {project.budget ? formatCurrency(project.budget, project.currency) : "-"}
                  </p>
                </div>
                <div className="border border-color-subtle rounded-lg p-4 bg-surface-alt">
                  <p className="text-xs text-secondary uppercase">Status</p>
                  <p className="mt-1">
                    <select
                      value={project.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className={`text-sm font-semibold bg-transparent border-none cursor-pointer ${
                        project.status === "completed" ? "status-success-text" :
                        project.status === "on_hold" ? "text-yellow-600" :
                        project.status === "archived" ? "text-secondary" :
                        "status-info-text"
                      }`}
                    >
                      {STATUS_OPTIONS.filter(s => s.value !== "archived").map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </p>
                </div>
                <div className="border border-color-subtle rounded-lg p-4 bg-surface-alt">
                  <p className="text-xs text-secondary uppercase">Financial Summary</p>
                  <p className="mt-1 text-sm text-secondary">
                    {project.financial_summary ? (
                      <span>
                        {project.financial_summary.amount_invoiced
                          ? `${formatCurrency(project.financial_summary.amount_invoiced, project.currency)} invoiced`
                          : "No invoices yet"}
                      </span>
                    ) : "Loading..."}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-secondary mb-3">Tags</h3>
                <ProjectTagManager
                  projectId={project.id}
                  initialTags={project.tags || []}
                  onTagsChange={loadProject}
                />
              </div>

              <div>
                <h3 className="text-sm font-medium text-secondary mb-3">Actions</h3>
                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={handleCreateInvoice}
                  >
                    Create Invoice
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "invoices" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-secondary">Project Invoices</h3>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={handleCreateInvoice}
                >
                  + New Invoice
                </Button>
              </div>
              <ProjectInvoices projectId={project.id} />
            </div>
          )}

          {activeTab === "activity" && (
            <ProjectActivity projectId={project.id} />
          )}

          {activeTab === "time" && (
            <ProjectTimeTab
              projectId={project.id}
              currency={project.currency}
              onEntriesChanged={loadProject}
            />
          )}

          {activeTab === "notes" && (
            <ProjectNotesTab
              projectId={project.id}
              onNotesChanged={loadProject}
            />
          )}
        </div>
      </div>

      {showForm && (
        <ProjectForm
          project={project}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function ProjectInvoices({ projectId }: { projectId: string }) {
  const [invoices, setInvoices] = useState<ApiProjectInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getProjectInvoices(projectId);
        setInvoices(data.invoices ?? []);
      } catch {
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (loading) {
    return <div className="text-sm text-secondary">Loading invoices...</div>;
  }

  if (invoices.length === 0) {
    return <p className="text-sm text-secondary">No invoices for this project</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-surface-alt border-b border-color-subtle">
        <tr>
          <th className="px-3 py-2 text-left text-xs font-medium text-secondary uppercase">Invoice #</th>
          <th className="px-3 py-2 text-left text-xs font-medium text-secondary uppercase">Date</th>
          <th className="px-3 py-2 text-right text-xs font-medium text-secondary uppercase">Amount</th>
          <th className="px-3 py-2 text-left text-xs font-medium text-secondary uppercase">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {invoices.map((inv) => (
          <tr key={inv.id}>
            <td className="px-3 py-2 text-sm font-medium text-primary">{inv.invoice_number || inv.id}</td>
            <td className="px-3 py-2 text-sm text-secondary">{inv.date ? formatDate(inv.date) : "-"}</td>
            <td className="px-3 py-2 text-sm text-primary text-right">{inv.total ? formatCurrency(inv.total, inv.currency || "USD") : "-"}</td>
            <td className="px-3 py-2">
              <span className="px-2 py-0.5 rounded-full text-xs" style={{
                backgroundColor: inv.status === "paid" ? "#dcfce8" : inv.status === "sent" || inv.status === "finalized" ? "#dbeafe" : "#fef3c7",
                color: inv.status === "paid" ? "#166534" : inv.status === "sent" || inv.status === "finalized" ? "#1d4ed8" : "#92400e",
              }}>
                {inv.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProjectActivity({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<ApiProjectEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getProjectEvents(projectId, { limit: 50 });
        setEvents(data.events ?? []);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (loading) {
    return <div className="text-sm text-secondary">Loading activity...</div>;
  }

  if (events.length === 0) {
    return <p className="text-sm text-secondary">No activity yet</p>;
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div key={event.id} className="flex gap-3 text-sm">
          <span className="text-xs text-tertiary w-16 flex-shrink-0">{formatDate(event.created_at)}</span>
          <span className="text-secondary">{event.description || event.event_type}</span>
        </div>
      ))}
    </div>
  );
}




