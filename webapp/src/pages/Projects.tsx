import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import {
  getProjects,
  archiveProject,
  restoreProject,
  updateProjectStatus,
  deleteProject,
  updateProject,
  type ProjectSearchParams,
  buildProjectSearchParams,
} from "../api/client";
import type { ApiProject, ApiCustomer } from "../types/api";
import ProjectStatusBadge from "../components/ProjectStatusBadge";
import ProjectForm from "../components/ProjectForm";
import ProjectTagManager from "../components/ProjectTagManager";
import { formatDate } from "../utils/format";
import { Button } from "../components/ui/Button";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";

interface ProjectsProps {
  customers?: ApiCustomer[];
}

const STATUS_FILTERS = [
  { value: "", label: "All Statuses" },
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

export default function Projects({ customers }: ProjectsProps) {  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<ApiProject | null>(null);
const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<"created_at" | "due_date" | "name">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const loadProjects = async (searchParams: ProjectSearchParams = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjects(searchParams);
      setProjects(data.projects ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = buildProjectSearchParams({
        search,
        status: statusFilter || undefined,
        includeArchived: showArchived,
        sortBy,
        sortOrder,
      });
      loadProjects(params);
    }, 300);

    return () => clearTimeout(handler);
  }, [search, statusFilter, showArchived, sortBy, sortOrder]);

  const handleCreate = () => {
    setEditingProject(null);
    setShowForm(true);
  };

  const handleEdit = (project: ApiProject) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProject(null);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingProject(null);
    loadProjects({
      search,
      status: statusFilter || undefined,
      includeArchived: showArchived,
      sortBy,
      sortOrder,
    });
  };

  const handleArchive = async (project: ApiProject) => {
    try {
      if (project.status === "archived") {
        await restoreProject(project.id);
      } else {
        await archiveProject(project.id);
      }
      loadProjects({
        search,
        status: statusFilter || undefined,
        includeArchived: showArchived,
        sortBy,
        sortOrder,
      });
    } catch (err: any) {
      setError(err.message || "Action failed");
    }
  };

  const handleStatusChange = async (project: ApiProject, newStatus: string) => {
    try {
      await updateProjectStatus(project.id, newStatus);
      loadProjects({
        search,
        status: statusFilter || undefined,
        includeArchived: showArchived,
        sortBy,
        sortOrder,
      });
    } catch (err: any) {
      setError(err.message || "Status update failed");
    }
  };

  const handleDelete = async (project: ApiProject) => {
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    try {
      await deleteProject(project.id);
      loadProjects({
        search,
        status: statusFilter || undefined,
        includeArchived: showArchived,
        sortBy,
        sortOrder,
      });
    } catch (err: any) {
      setError(err.message || "Delete failed");
    }
  };

  const handleSort = (field: "created_at" | "due_date" | "name") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <h1 className="text-2xl font-bold text-inverse">Projects</h1>
        <Button
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={handleCreate}
        >
          New Project
        </Button>
      </div>

      {error && (
        <div className="p-3 status-error-bg border status-error-border rounded-lg">
          <p className="text-sm status-error-text">{error}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full rounded-lg border border-input-border pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-secondary">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-input-border text-primary-brand focus:ring-primary"
            />
            Show archived
          </label>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-surface-alt rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-secondary text-tertiary mb-4">No projects found</p>
              <Button
                variant="primary"
                size="md"
                icon={<Plus className="w-4 h-4" />}
                onClick={handleCreate}
              >
                Create Your First Project
              </Button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-surface-alt dark:bg-surface-alt border-b border-color-subtle border-color">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-secondary text-tertiary uppercase">Project</th>
                  <th className="px-4 py-3 text-xs font-medium text-secondary text-tertiary uppercase">Customer</th>
                  <th className="px-4 py-3 text-xs font-medium text-secondary text-tertiary uppercase">Status</th>
                  <th
                    className="px-4 py-3 text-xs font-medium text-secondary text-tertiary uppercase cursor-pointer hover:bg-surface-alt hover:bg-hover"
                    onClick={() => handleSort("due_date")}
                  >
                    Due Date
                    {sortBy === "due_date" && (
                      <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>
                    )}
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-secondary text-tertiary uppercase">Tags</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-secondary text-tertiary uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-surface-alt hover:bg-hover">
                    <td className="px-4 py-3">
                      <p className="font-medium text-inverse">{project.name}</p>
                      {project.description && (
                        <p className="text-sm text-secondary text-tertiary line-clamp-1">{project.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-inverse">{project.customer?.name || project.customer_name || "-"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ProjectStatusBadge status={project.status} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-inverse">
                        {project.due_date ? formatDate(project.due_date) : "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(project.tags || []).slice(0, 3).map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                            style={{
                              backgroundColor: `${t.color || "#6b7280"}20`,
                              color: t.color || "#6b7280",
                            }}
                          >
                            {t.name}
                          </span>
                        ))}
                        {(project.tags || []).length > 3 && (
                          <span className="text-xs text-secondary">
                            +{(project.tags || []).length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Edit2 className="w-3.5 h-3.5" />}
                          onClick={() => handleEdit(project)}
                          title="Edit project"
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          onClick={() => handleDelete(project)}
                          title="Delete project"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showForm && (
        <ProjectForm
          project={editingProject}
          customers={customers}
          onClose={handleCloseForm}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}





