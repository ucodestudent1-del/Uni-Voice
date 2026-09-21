import { useState, useEffect } from "react";
import { getProjectTags, addProjectTag, removeProjectTag } from "../api/client";

interface ProjectTagManagerProps {
  projectId: string;
  initialTags: { id: string; name: string; color: string }[];
  onTagsChange: () => void;
}

export default function ProjectTagManager({ projectId, initialTags = [], onTagsChange }: ProjectTagManagerProps) {
  const [projectTags, setProjectTags] = useState(initialTags);
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6b7280");

  useEffect(() => {
    setProjectTags(initialTags);
  }, [initialTags]);

  useEffect(() => {
    if (showAddDialog) {
      loadAllTags();
    }
  }, [showAddDialog]);

  async function loadAllTags() {
    setLoading(true);
    try {
      const data = await getProjectTags();
      const tags = (data.tags ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        color: t.color || "#6b7280",
      }));
      setAllTags(tags);
    } catch {
      setAllTags([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddExisting(tagId: string, tagName: string, tagColor: string) {
    setLoading(true);
    try {
      await addProjectTag(projectId, tagName, tagColor);
      setProjectTags((prev) => [
        ...prev,
        { id: tagId, name: tagName, color: tagColor },
      ]);
      onTagsChange();
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleAddNew() {
    if (!newTagName.trim()) return;
    setLoading(true);
    try {
      await addProjectTag(projectId, newTagName, newTagColor);
      setProjectTags((prev) => [
        ...prev,
        { id: newTagName, name: newTagName, color: newTagColor },
      ]);
      onTagsChange();
      setShowAddDialog(false);
      setNewTagName("");
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleRemove(tagId: string) {
    setLoading(true);
    try {
      await removeProjectTag(projectId, tagId);
      setProjectTags((prev) => prev.filter((t) => t.id !== tagId));
      onTagsChange();
    } catch {} finally {
      setLoading(false);
    }
  }

  const availableTags = allTags.filter((t) => !projectTags.some((pt) => pt.name === t.name));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-secondary">Project Tags</h4>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAddDialog(!showAddDialog)}
            className="text-sm text-primary-brand hover:text-primary-brand font-medium"
          >
            {showAddDialog ? "Cancel" : "Add Tag"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {projectTags.length === 0 ? (
          <span className="text-sm text-secondary">No tags assigned</span>
        ) : (
          projectTags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${t.color}20`, color: t.color }}
            >
              {t.name}
              <button
                type="button"
                onClick={() => handleRemove(t.id)}
                className="hover:opacity-70"
                title="Remove tag"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {showAddDialog && (
        <div className="border border-color-subtle rounded-lg p-3 bg-surface-alt">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Create New Tag</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name"
                  className="flex-1 rounded-lg border border-input-border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <button
                  type="button"
                  onClick={handleAddNew}
                  disabled={!newTagName.trim() || loading}
                  className="text-sm text-primary-brand hover:text-primary-brand disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            {availableTags.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">Existing Tags</label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleAddExisting(t.id, t.name, t.color)}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium hover:opacity-80"
                      style={{ backgroundColor: `${t.color}20`, color: t.color }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}




