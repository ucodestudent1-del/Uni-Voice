import { useState, useEffect } from "react";
import type { ApiProjectNote } from "../types/api";
import { addProjectNote, getProjectNotes, deleteProjectNote } from "../api/client";
import { formatDate } from "../utils/format";

interface ProjectNotesTabProps {
  projectId: string;
  onNotesChanged?: () => void;
}

export default function ProjectNotesTab({ projectId, onNotesChanged }: ProjectNotesTabProps) {
  const [notes, setNotes] = useState<ApiProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectNotes(projectId);
      setNotes(data.notes ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await addProjectNote(projectId, { title: title || undefined, content });
      setTitle("");
      setContent("");
      setShowForm(false);
      loadNotes();
      onNotesChanged?.();
    } catch (err: any) {
      setError(err.message || "Failed to add note");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (note: ApiProjectNote) => {
    if (!confirm("Delete this note?")) return;
    try {
      await deleteProjectNote(projectId, note.id);
      loadNotes();
      onNotesChanged?.();
    } catch (err: any) {
      setError(err.message || "Failed to delete note");
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 status-error-bg border status-error-border rounded-lg">
          <p className="text-sm status-error-text">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-secondary">Project Notes</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-primary-action px-3 py-1.5 text-sm font-medium text-on-primary hover:bg-primary-hover"
        >
          + Add Note
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 p-4 border border-color-subtle rounded-lg bg-surface-alt">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Brief title for this note..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Note *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Add a note about this project..."
              rows={4}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-input-border px-3 py-1.5 text-sm text-secondary hover:bg-surface-alt"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="rounded-lg bg-primary-action px-4 py-1.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Note"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          <div className="h-16 bg-surface-alt rounded-lg animate-pulse" />
          <div className="h-16 bg-surface-alt rounded-lg animate-pulse" />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-secondary">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="border border-color-subtle rounded-lg p-4 bg-surface">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  {note.title && (
                    <h4 className="font-medium text-primary">{note.title}</h4>
                  )}
                  <p className="text-sm text-secondary whitespace-pre-wrap">{note.content}</p>
                  <p className="text-xs text-secondary">
                    {formatDate(note.created_at)}
                    {note.user_id && " · by team member"}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(note)}
                  className="text-xs status-error-text hover:status-error-text"
                  title="Delete note"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




