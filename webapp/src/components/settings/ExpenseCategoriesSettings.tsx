import { useState, useEffect } from "react";
import {
  getExpenseCustomCategories,
  createExpenseCustomCategory,
  updateExpenseCustomCategory,
  deleteExpenseCustomCategory,
} from "@/api/client";
import { Button } from "@/components/ui/Button";

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
  is_active: boolean;
  sort_order: number;
}

const colorOptions: { value: string; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "primary", label: "Primary" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "tertiary", label: "Tertiary" },
  { value: "secondary", label: "Secondary" },
];

const emptyForm = { name: "", color: "info", icon: "" };

export default function ExpenseCategoriesSettings() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const data = await getExpenseCustomCategories();
      setCategories(data.categories ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(cat: CategoryRow) {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      color: cat.color ?? "info",
      icon: cat.icon ?? "",
    });
  }

  async function saveCategory() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateExpenseCustomCategory(editingId, {
          name: form.name.trim(),
          color: form.color,
          icon: form.icon || null,
          is_active: true,
        });
      } else {
        await createExpenseCustomCategory({
          name: form.name.trim(),
          color: form.color,
          icon: form.icon || null,
        });
      }
      await loadCategories();
      setEditingId(null);
      setForm(emptyForm);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to save category");
    } finally {
      setSaving(false);
    }
  }

  async function removeCategory(id: string) {
    if (!confirm("Delete this category? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteExpenseCustomCategory(id);
      setCategories(categories.filter((c) => c.id !== id));
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to delete category");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <div className="text-sm text-secondary">Loading categories…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Expense Categories</h2>
        <p className="text-sm text-secondary mt-1">
          Manage custom categories for your expenses. System categories cannot be deleted.
        </p>
      </div>

      {error && (
        <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text">{error}</div>
      )}

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">
          {editingId ? "Edit Category" : "Add Custom Category"}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="text-xs font-medium text-tertiary uppercase">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Office Supplies"
              className="form-control w-full"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-tertiary uppercase">Color</label>
            <select
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="form-select w-full"
            >
              {colorOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-tertiary uppercase">Icon</label>
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="e.g. truck, tag, calendar"
              className="form-control w-full"
            />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          {editingId && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => { setEditingId(null); setForm(emptyForm); }}
            >
              Cancel
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={saveCategory}
            disabled={saving || !form.name.trim()}
          >
            {saving ? "Saving…" : editingId ? "Update Category" : "Add Category"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-primary">Custom Categories</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={startCreate}
          >
            + Add Category
          </Button>
        </div>
        {categories.length === 0 ? (
          <div className="text-center py-8 text-secondary">
            <p>No custom categories yet.</p>
            <p className="text-sm mt-1">Create a custom category to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr>
                  <th className="text-left font-medium text-secondary">Name</th>
                  <th className="text-left font-medium text-secondary">Color</th>
                  <th className="text-left font-medium text-secondary">Icon</th>
                  <th className="text-right font-medium text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id} className="border-t border-color-subtle">
                    <td className="py-2 text-primary">{cat.name}</td>
                    <td className="py-2 text-secondary">{cat.color ?? "—"}</td>
                    <td className="py-2 text-secondary">{cat.icon || "—"}</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => startEdit(cat)}
                        className="text-xs font-medium text-primary-brand hover:text-primary-brand"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeCategory(cat.id)}
                        disabled={deletingId === cat.id}
                        className="ml-2 text-xs font-medium status-error-text hover:status-error-text disabled:opacity-50"
                      >
                        {deletingId === cat.id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
