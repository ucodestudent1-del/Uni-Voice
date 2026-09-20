import { useState, useEffect } from "react";
import { createProject, updateProject, getCustomers, type ProjectSearchParams } from "../api/client";
import type { ApiProject, ApiCustomer } from "../types/api";
import { formatDate } from "../utils/format";
import { Button } from "./ui/Button";

interface ProjectFormProps {
  project?: ApiProject | null;
  customers?: ApiCustomer[];
  onClose: () => void;
  onSaved: () => void;
}

const COUNTRIES = [
  "US", "GB", "CA", "AU", "DE", "FR", "ES", "IT", "NL", "JP",
  "IN", "BR", "MX", "SG", "CH", "CN", "KR", "SE", "NO", "DK",
  "FI", "PL", "PT", "AT", "BE", "IE", "LU", "CZ", "HU",
];

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

const PRESET_TAGS = [
  { name: "Urgent", color: "#ef4444" },
  { name: "High Priority", color: "#f59e0b" },
  { name: "Client Review", color: "#3b82f6" },
  { name: "In Progress", color: "#10b981" },
];

export interface ProjectFormValues {
  name: string;
  description: string;
  customerId: string;
  status: string;
  startDate: string;
  dueDate: string;
  budget: string;
  currency: string;
  tags: { name: string; color: string }[];
}

const defaultValues: ProjectFormValues = {
  name: "",
  description: "",
  customerId: "",
  status: "planning",
  startDate: "",
  dueDate: "",
  budget: "",
  currency: "USD",
  tags: [],
};

export default function ProjectForm({ project, customers: propCustomers, onClose, onSaved }: ProjectFormProps) {
  const [formData, setFormData] = useState<ProjectFormValues>(defaultValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<ApiCustomer[]>(propCustomers ?? []);
  const [loadingCustomers, setLoadingCustomers] = useState(!propCustomers);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagColor, setTagColor] = useState("#6b7280");
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

  useEffect(() => {
    if (!propCustomers) {
      loadCustomers();
    }
  }, []);

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || "",
        description: project.description || "",
        customerId: project.customer_id || "",
        status: project.status,
        startDate: project.start_date ? new Date(project.start_date).toISOString().split("T")[0] : "",
        dueDate: project.due_date ? new Date(project.due_date).toISOString().split("T")[0] : "",
        budget: project.budget || "",
        currency: project.currency || "USD",
        tags: [],
      });
    }
  }, [project]);

  async function loadCustomers(search?: string) {
    setLoadingCustomers(true);
    try {
      const params: ProjectSearchParams = { limit: 100 };
      if (search) (params as any).search = search;
      const data = await getCustomers(params as any);
      setCustomers(data.customers ?? []);
    } catch {
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  }

  function handleChange(field: keyof ProjectFormValues, value: any) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  }

  function handleTagToggle(tag: { name: string; color: string }) {
    setFormData((prev) => {
      const exists = prev.tags.find((t) => t.name === tag.name);
      if (exists) {
        return { ...prev, tags: prev.tags.filter((t) => t.name !== tag.name) };
      }
      return { ...prev, tags: [...prev.tags, tag] };
    });
  }

  function handleAddCustomTag() {
    if (!tagInput.trim()) return;
    const tag = { name: tagInput.trim(), color: tagColor };
    setFormData((prev) => {
      if (prev.tags.find((t) => t.name === tag.name)) return prev;
      return { ...prev, tags: [...prev.tags, tag] };
    });
    setTagInput("");
    setTagDropdownOpen(false);
  }

  function handleRemoveTag(name: string) {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t.name !== name) }));
  }

  function validateForm(): boolean {
    if (!formData.name.trim()) {
      setError("Project name is required");
      return false;
    }
    if (formData.dueDate && formData.startDate && formData.dueDate < formData.startDate) {
      setError("Due date must be on or after start date");
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setError(null);
    try {
      if (project) {
        await updateProject(project.id, formData);
      } else {
        await createProject(formData);
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save project");
    } finally {
      setLoading(false);
    }
  }

  const isEditing = !!project;
  const filteredCustomers = customerSearch
    ? customers.filter((c) =>
        `${c.name} ${c.companyName || ""} ${c.email || ""}`.toLowerCase().includes(customerSearch.toLowerCase())
      )
    : customers;

  const selectedCustomer = formData.customerId
    ? customers.find((c) => c.id === formData.customerId) || propCustomers?.find((c) => c.id === formData.customerId)
    : null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 my-8">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            {isEditing ? "Edit Project" : "New Project"}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Project Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g. Website Redesign"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => handleChange("currency", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - Pound Sterling</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="CNY">CNY - Chinese Yuan</option>
                <option value="INR">INR - Indian Rupee</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
              <div className="relative">
                <div
                  className="flex items-center justify-between w-full px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer focus-within:ring-2 focus-within:ring-primary-500"
                  onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)}
                >
                  <span className="text-sm text-slate-900 truncate">
                    {selectedCustomer
                      ? `${selectedCustomer.name}${selectedCustomer.companyName ? ` (${selectedCustomer.companyName})` : ""}`
                      : "Select a customer"}
                  </span>
                </div>
                {formData.customerId && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChange("customerId", "");
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="Clear customer"
                  >
                    ×
                  </button>
                )}
                {customerDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {loadingCustomers ? (
                      <div className="p-3 text-sm text-slate-500">Loading customers...</div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleChange("customerId", c.id);
                            setCustomerDropdownOpen(false);
                          }}
                        >
                          <p className="font-medium text-sm text-slate-900">{c.name}</p>
                          {c.companyName && <p className="text-xs text-slate-500">{c.companyName}</p>}
                          {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                        </div>
                      ))
                    )}
                    {filteredCustomers.length === 0 && !loadingCustomers && (
                      <div className="p-3 text-sm text-slate-500">No customers found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Budget</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{formData.currency}</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.budget}
                  onChange={(e) => handleChange("budget", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pl-16 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleChange("startDate", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleChange("dueDate", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Project description, scope, objectives..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((t) => (
                  <span
                    key={t.name}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: `${t.color}20`, color: t.color }}
                  >
                    {t.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t.name)}
                      className="hover:opacity-70"
                      title="Remove tag"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomTag();
                    }
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Add a tag..."
                />
                <button
                  type="button"
                  onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  title="Presets"
                >
                  Presets
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomTag}
                  disabled={!tagInput.trim()}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              {tagDropdownOpen && (
                <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
                  {PRESET_TAGS.map((t) => (
                    <div
                      key={t.name}
                      className="px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center gap-2"
                      onClick={() => handleTagToggle(t)}
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="text-sm">{t.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
            disabled={loading}
          >
            {loading ? "Saving..." : isEditing ? "Update Project" : "Create Project"}
          </Button>
        </div>
      </div>
    </div>
  );
}
