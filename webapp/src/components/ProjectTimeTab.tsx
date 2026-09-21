import { useState, useEffect } from "react";
import type { ApiProjectTimeEntry, ApiProjectTimeEntrySummary } from "../types/api";
import {
  getTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  startTimer,
  stopTimer,
  getTimeEntrySummary,
  formatDuration,
} from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";

interface ProjectTimeTabProps {
  projectId: string;
  currency: string;
  onEntriesChanged?: () => void;
}

interface TimeEntryFormProps {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
  editingEntry?: ApiProjectTimeEntry | null;
}

function TimeEntryForm({ projectId, onClose, onSaved, editingEntry = null }: TimeEntryFormProps) {
  const [description, setDescription] = useState(editingEntry?.description ?? "");
  const [billable, setBillable] = useState(editingEntry?.billable ?? true);
  const [durationMinutes, setDurationMinutes] = useState(
    editingEntry?.duration_minutes?.toString() ?? ""
  );
  const [billableRate, setBillableRate] = useState(
    editingEntry?.billable_rate ?? "0"
  );
  const [startTime, setStartTime] = useState(
    editingEntry?.start_time ? editingEntry.start_time.slice(0, 16) : ""
  );
  const [endTime, setEndTime] = useState(
    editingEntry?.end_time ? editingEntry.end_time.slice(0, 16) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (editingEntry) {
        await updateTimeEntry(editingEntry.id, {
          description,
          billable,
          durationMinutes: durationMinutes ? Number(durationMinutes) : null,
          billableRate,
          startTime: startTime || null,
          endTime: endTime || null,
        });
      } else {
        await createTimeEntry(projectId, {
          description,
          billable,
          durationMinutes: durationMinutes ? Number(durationMinutes) : null,
          billableRate,
          startTime: startTime || null,
          endTime: endTime || null,
        });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to save time entry");
    } finally {
      setLoading(false);
    }
  };

  const handleTimerMode = () => {
    setStartTime("");
    setEndTime("");
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setStartTime(`${now.toISOString().split("T")[0]}T${timeStr}`);
    setEndTime("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="p-3 status-error-bg border status-error-border rounded-lg">
          <p className="text-sm status-error-text">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-secondary mb-1">Description *</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="What did you work on?"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">Duration (minutes)</label>
          <input
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="e.g. 90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">Rate</label>
          <input
            type="number"
            value={billableRate}
            onChange={(e) => setBillableRate(e.target.value)}
            className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="e.g. 75"
            step="0.01"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">Start time</label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">End time</label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="billable"
          checked={billable}
          onChange={(e) => setBillable(e.target.checked)}
          className="rounded border-input-border text-primary-brand focus:ring-primary"
        />
        <label htmlFor="billable" className="text-sm text-secondary">
          Billable
        </label>
        <button
          type="button"
          onClick={handleTimerMode}
          className="ml-auto text-xs text-secondary hover:text-secondary underline"
        >
          Use current time
        </button>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-input-border px-3 py-1.5 text-sm text-secondary hover:bg-surface-alt"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary-action px-4 py-1.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "Saving..." : editingEntry ? "Update" : "Save"}
        </button>
      </div>
    </form>
  );
}

export default function ProjectTimeTab({ projectId, currency, onEntriesChanged }: ProjectTimeTabProps) {
  const [entries, setEntries] = useState<ApiProjectTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ApiProjectTimeEntry | null>(null);
  const [summary, setSummary] = useState<ApiProjectTimeEntrySummary | null>(null);
  const [runningTimerId, setRunningTimerId] = useState<string | null>(null);

  const loadEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTimeEntries(projectId);
      setEntries(data.entries ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to load time entries");
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await getTimeEntrySummary(projectId, currency);
      setSummary(data.summary ?? null);
    } catch {
      setSummary(null);
    }
  };

  useEffect(() => {
    loadEntries();
    loadSummary();
  }, [projectId, currency]);

  const handleSaved = () => {
    setShowForm(false);
    setEditingEntry(null);
    loadEntries();
    loadSummary();
    onEntriesChanged?.();
  };

  const handleEdit = (entry: ApiProjectTimeEntry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = async (entry: ApiProjectTimeEntry) => {
    if (!confirm(`Delete time entry "${entry.description}"?`)) return;
    try {
      await deleteTimeEntry(entry.id);
      loadEntries();
      loadSummary();
      onEntriesChanged?.();
    } catch (err: any) {
      setError(err.message || "Failed to delete entry");
    }
  };

  const handleStartTimer = async () => {
    try {
      const data = await startTimer(projectId, {
        description: "Running timer",
        billable: true,
        billableRate: "0",
      });
      const entry = data.entry;
      setRunningTimerId(entry.id);
      loadEntries();
    } catch (err: any) {
      setError(err.message || "Failed to start timer");
    }
  };

  const handleStopTimer = async (entryId: string) => {
    try {
      await stopTimer(entryId);
      setRunningTimerId(null);
      loadEntries();
      loadSummary();
      onEntriesChanged?.();
    } catch (err: any) {
      setError(err.message || "Failed to stop timer");
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 status-error-bg border status-error-border rounded-lg">
          <p className="text-sm status-error-text">{error}</p>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border border-color-subtle rounded-lg p-3 bg-surface-alt">
            <p className="text-xs text-secondary uppercase">Billable Hours</p>
            <p className="mt-1 text-lg font-semibold text-primary">
              {formatDuration(summary.billable_minutes)}
            </p>
          </div>
          <div className="border border-color-subtle rounded-lg p-3 bg-surface-alt">
            <p className="text-xs text-secondary uppercase">Unbilled Billable</p>
            <p className="mt-1 text-lg font-semibold status-warning-text">
              {formatDuration(summary.unbilled_billable_minutes)}
            </p>
          </div>
          <div className="border border-color-subtle rounded-lg p-3 bg-surface-alt">
            <p className="text-xs text-secondary uppercase">Unbilled Amount</p>
            <p className="mt-1 text-lg font-semibold text-primary">
              {formatCurrency(summary.unbilled_billable_amount, currency)}
            </p>
          </div>
          <div className="border border-color-subtle rounded-lg p-3 bg-surface-alt">
            <p className="text-xs text-secondary uppercase">Total Billable</p>
            <p className="mt-1 text-lg font-semibold text-primary">
              {formatCurrency(summary.total_billable_amount, currency)}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingEntry(null);
              setShowForm(true);
            }}
            className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            + Log Time
          </button>
          {!runningTimerId && (
            <button
              onClick={handleStartTimer}
              className="rounded-lg border status-success-border px-4 py-2 text-sm font-medium status-success-text hover:status-success-bg"
            >
              Start Timer
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">
              {editingEntry ? "Edit Time Entry" : "Log Time Entry"}
            </h2>
            <TimeEntryForm
              projectId={projectId}
              onClose={() => {
                setShowForm(false);
                setEditingEntry(null);
              }}
              onSaved={handleSaved}
              editingEntry={editingEntry}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-surface-alt rounded-lg animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-secondary">No time entries logged yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt border-b border-color-subtle">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-secondary uppercase">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-secondary uppercase">Description</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-secondary uppercase">Duration</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-secondary uppercase">Rate</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-secondary uppercase">Amount</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-secondary uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-surface-alt">
                  <td className="px-3 py-2 text-sm text-secondary">
                    {formatDate(entry.start_time ?? entry.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        entry.billable ? "status-success-text" : "bg-surface-alt400"
                      }`} />
                      <span className="text-sm text-primary">{entry.description}</span>
                      {entry.is_invoiced && (
                        <span className="text-xs text-tertiary">(Invoiced)</span>
                      )}
                      {runningTimerId === entry.id && (
                        <span className="text-xs status-success-text font-medium">● Running</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-sm text-primary">
                    {entry.duration_minutes
                      ? formatDuration(entry.duration_minutes)
                      : "0h 0m"}
                  </td>
                  <td className="px-3 py-2 text-right text-sm text-primary">
                    {entry.billable ? formatCurrency(entry.billable_rate, currency) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right text-sm text-primary">
                    {entry.billable ? formatCurrency(entry.billable_amount, currency) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {runningTimerId === entry.id ? (
                      <button
                        onClick={() => handleStopTimer(entry.id)}
                        className="text-xs status-success-text hover:status-success-text"
                      >
                        Stop
                      </button>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="text-xs text-secondary hover:text-primary"
                        >
                          Edit
                        </button>
                        {!entry.is_invoiced && (
                          <button
                            onClick={() => handleDelete(entry)}
                            className="text-xs status-error-text hover:status-error-text"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}





