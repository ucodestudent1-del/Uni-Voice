import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTemplates, createTemplate as apiCreateTemplate, updateTemplate as apiUpdateTemplate, deleteTemplate as apiDeleteTemplate } from "../api/client";
import type { ApiTemplate } from "../types/api";
import { DEFAULT_INVOICE_TEMPLATE } from "../constants/defaultTemplate";

interface TemplateForm {
  name: string;
  htmlTemplate: string;
}

export default function Templates() {
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateForm>({ name: "", htmlTemplate: "" });

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await getTemplates({ limit: 50 });
      const all = [...(data.templates ?? [])];
      if (!all.some((t) => t.is_default)) {
        all.unshift({
          id: "default",
          business_id: "",
          name: "Default Template",
          is_default: true,
          config: {},
          html_template: DEFAULT_INVOICE_TEMPLATE,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      setTemplates(all);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingId && editingId !== "default") {
        await apiUpdateTemplate(editingId, formData);
      } else {
        await apiCreateTemplate({
          name: formData.name,
          htmlTemplate: formData.htmlTemplate,
          isDefault: false,
        });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: "", htmlTemplate: "" });
      loadTemplates();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save template");
    }
  }

  function handleEdit(template: ApiTemplate) {
    setEditingId(template.id);
    setFormData({ name: template.name, htmlTemplate: template.html_template });
    setShowForm(true);
  }

  async function handleDelete(template: ApiTemplate) {
    if (template.id === "default" || template.is_default) return;
    if (!confirm("Delete this template?")) return;
    try {
      await apiDeleteTemplate(template.id);
      loadTemplates();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete");
    }
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Loading templates...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setFormData({ name: "New Template", htmlTemplate: DEFAULT_INVOICE_TEMPLATE }); }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          + New Template
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {editingId && editingId !== "default" ? "Edit" : "Create"} Template
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Template Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">HTML Template</label>
              <textarea
                value={formData.htmlTemplate}
                onChange={(e) => setFormData({ ...formData, htmlTemplate: e.target.value })}
                rows={10}
                className="w-full font-mono text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Save Template
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">{t.name}</h3>
              {t.is_default && (
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">Default</span>
              )}
            </div>
            <div className="bg-slate-50 rounded-lg h-32 mb-3 flex items-center justify-center text-slate-400">
              <span className="text-xs">Template preview</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(t)}
                disabled={t.id === "default"}
                className="text-xs text-slate-600 hover:text-slate-900 disabled:opacity-50"
              >
                Edit
              </button>
              {t.id !== "default" && (
                <button
                  onClick={() => handleDelete(t)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
