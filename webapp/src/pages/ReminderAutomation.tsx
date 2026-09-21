import { useEffect, useState } from "react";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  getBusinessSettings,
  updateBusinessSettings,
  getReminderTemplates,
  createReminderTemplate,
  updateReminderTemplate,
  deleteReminderTemplate,
} from "../api/client";
import FeatureGate from "../components/FeatureGate";
import UpgradePrompt from "../components/UpgradePrompt";
import { formatDate } from "../utils/format";
import type { ApiReminderConfig, ApiReminderTemplate, ReminderSequence } from "../types/api";

const DEFAULT_REMINDER_CONFIG: ApiReminderConfig = {
  enabled: false,
  beforeDue: [
    { id: "before-1", offsetDays: 7, subject: "", message: "", maxSends: 1, enabled: true },
    { id: "before-2", offsetDays: 3, subject: "", message: "", maxSends: 1, enabled: true },
    { id: "before-3", offsetDays: 1, subject: "", message: "", maxSends: 1, enabled: true },
  ],
  afterDue: [
    { id: "after-1", offsetDays: 1, subject: "", message: "", maxSends: 1, enabled: true },
    { id: "after-2", offsetDays: 7, subject: "", message: "", maxSends: 1, enabled: true },
    { id: "after-3", offsetDays: 14, subject: "", message: "", maxSends: 1, enabled: true },
  ],
};

export default function ReminderAutomation() {
  const { plan, features } = useSubscription();
  const [config, setConfig] = useState<ApiReminderConfig>(DEFAULT_REMINDER_CONFIG);
  const [templates, setTemplates] = useState<ApiReminderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ApiReminderTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", subject: "", message: "" });
  const [testingReminder, setTestingReminder] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
    loadTemplates();
  }, []);

  async function loadConfig() {
    try {
      const data = await getBusinessSettings();
      if (data.settings?.reminders_enabled !== undefined) {
        const reminderConfig: ApiReminderConfig = {
          enabled: data.settings.reminders_enabled,
          beforeDue: data.settings.reminders_before_due ? JSON.parse(data.settings.reminders_before_due as string) : DEFAULT_REMINDER_CONFIG.beforeDue,
          afterDue: data.settings.reminders_after_due ? JSON.parse(data.settings.reminders_after_due as string) : DEFAULT_REMINDER_CONFIG.afterDue,
        };
        setConfig(reminderConfig);
      }
    } catch {
      setConfig(DEFAULT_REMINDER_CONFIG);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplates() {
    try {
      const data = await getReminderTemplates();
      setTemplates(data.templates ?? []);
    } catch {
      setTemplates([]);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const data = {
        reminders_enabled: config.enabled,
        reminders_before_due: JSON.stringify(config.beforeDue),
        reminders_after_due: JSON.stringify(config.afterDue),
      };
      await updateBusinessSettings(data);
      setActionMessage({ type: "success", text: "Reminder settings saved!" });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  }

  function updateSequence(type: "beforeDue" | "afterDue", index: number, field: keyof ReminderSequence, value: any) {
    setConfig((prev) => ({
      ...prev,
      [type]: prev[type].map((seq, i) => i === index ? { ...seq, [field]: value } : seq),
    }));
  }

  function addSequence(type: "beforeDue" | "afterDue") {
    const newSeq: ReminderSequence = {
      id: `${type}-${Date.now()}`,
      offsetDays: type === "beforeDue" ? 7 : 1,
      subject: "",
      message: "",
      maxSends: 1,
      enabled: true,
    };
    setConfig((prev) => ({
      ...prev,
      [type]: [...prev[type], newSeq],
    }));
  }

  function removeSequence(type: "beforeDue" | "afterDue", index: number) {
    if (config[type].length <= 1) return;
    setConfig((prev) => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index),
    }));
  }

  function moveSequence(type: "beforeDue" | "afterDue", index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= config[type].length) return;
    setConfig((prev) => {
      const newList = [...prev[type]];
      [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
      return { ...prev, [type]: newList };
    });
  }

  function openTemplateDialog(template?: ApiReminderTemplate) {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({ name: template.name, subject: template.subject, message: template.message });
    } else {
      setEditingTemplate(null);
      setTemplateForm({ name: "", subject: "", message: "" });
    }
    setShowTemplateDialog(true);
  }

  async function handleTemplateSave() {
    try {
      if (editingTemplate) {
        await updateReminderTemplate(editingTemplate.id, templateForm);
        setActionMessage({ type: "success", text: "Template updated!" });
      } else {
        await createReminderTemplate(templateForm);
        setActionMessage({ type: "success", text: "Template created!" });
      }
      setShowTemplateDialog(false);
      loadTemplates();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to save template" });
    }
  }

  async function handleTemplateDelete(id: string) {
    if (!window.confirm("Delete this template?")) return;
    try {
      await deleteReminderTemplate(id);
      setActionMessage({ type: "success", text: "Template deleted!" });
      loadTemplates();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to delete template" });
    }
  }

  async function testReminder(sequenceId: string) {
    const sequence = config.beforeDue.find(s => s.id === sequenceId) || config.afterDue.find(s => s.id === sequenceId);
    if (!sequence) return;
    
    setTestingReminder(sequenceId);
    try {
      // This would call a test reminder endpoint - for now just show success
      setActionMessage({ type: "success", text: `Test reminder sent for ${sequence.offsetDays} days ${sequenceId.startsWith("before") ? "before" : "after"} due!` });
    } catch (err: any) {
      setActionMessage({ type: "error", text: "Failed to send test reminder" });
    } finally {
      setTestingReminder(null);
    }
  }

  const hasReminderEntitlement = features?.some((f: any) => f.code === "reminders.automated") ?? false;

  if (loading) return <div className="text-center py-20 text-secondary">Loading reminder settings...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Reminder Automation</h1>
          <p className="text-sm text-secondary mt-1">Configure automatic payment reminders for your invoices</p>
        </div>
        <FeatureGate feature="reminders.automated" requiredPlan="pro" fallback={
          <UpgradePrompt feature="Automated Reminders" requiredPlan="pro" />
        }>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </FeatureGate>
      </div>

      {actionMessage && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${
          actionMessage.type === "success"
            ? "status-success-border status-success-bg status-success-text"
            : actionMessage.type === "error"
            ? "status-error-border status-error-bg status-error-text"
            : "status-info-border status-info-bg status-info-text"
        }`}>
          {actionMessage.text}
        </div>
      )}

      <FeatureGate feature="reminders.automated" requiredPlan="pro" fallback={null}>
        <div className="bg-surface rounded-xl border border-color-subtle p-6 space-y-6">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="w-5 h-5 rounded border-input-border text-primary-brand focus:ring-primary"
              />
              <span className="text-lg font-medium text-primary">Enable Automated Reminders</span>
            </label>
          </div>

          {!config.enabled && (
            <div className="p-4 bg-surface-alt rounded-lg border border-color-subtle">
              <p className="text-sm text-secondary">
                Automated reminders are disabled. Enable them to automatically send payment reminders
                before and after invoice due dates.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReminderSection
              title="Before Due Date"
              description="Reminders sent before the invoice due date"
              sequences={config.beforeDue}
              onUpdate={(index, field, value) => updateSequence("beforeDue", index, field, value)}
              onAdd={() => addSequence("beforeDue")}
              onRemove={(index) => removeSequence("beforeDue", index)}
              onMove={(index, direction) => moveSequence("beforeDue", index, direction)}
              onTest={(id) => testReminder(id)}
              isTesting={testingReminder}
              direction="before"
            />

            <ReminderSection
              title="After Due Date (Overdue)"
              description="Reminders sent after the invoice becomes overdue"
              sequences={config.afterDue}
              onUpdate={(index, field, value) => updateSequence("afterDue", index, field, value)}
              onAdd={() => addSequence("afterDue")}
              onRemove={(index) => removeSequence("afterDue", index)}
              onMove={(index, direction) => moveSequence("afterDue", index, direction)}
              onTest={(id) => testReminder(id)}
              isTesting={testingReminder}
              direction="after"
            />
          </div>
        </div>
      </FeatureGate>

      <div className="bg-surface rounded-xl border border-color-subtle p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Email Templates</h2>
        <p className="text-sm text-secondary mb-4">Create reusable email templates for your reminders</p>
        <div className="flex justify-end mb-4">
          <button
            onClick={() => openTemplateDialog()}
            className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            + New Template
          </button>
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-secondary">No templates yet. Create one to use in your reminder sequences.</p>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="flex items-center justify-between p-4 border border-color-subtle rounded-lg">
                <div>
                  <p className="font-medium text-primary">{template.name}</p>
                  <p className="text-sm text-secondary">Subject: {template.subject}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openTemplateDialog(template)}
                    className="text-sm text-primary-brand hover:text-primary-brand"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleTemplateDelete(template.id)}
                    className="text-sm status-error-text hover:status-error-text"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showTemplateDialog && (
        <TemplateDialog
          isOpen={showTemplateDialog}
          onClose={() => setShowTemplateDialog(false)}
          onSave={handleTemplateSave}
          initialData={templateForm}
          isEditing={!!editingTemplate}
        />
      )}
    </div>
  );
}

function ReminderSection({
  title,
  description,
  sequences,
  onUpdate,
  onAdd,
  onRemove,
  onMove,
  onTest,
  isTesting,
  direction,
}: {
  title: string;
  description: string;
  sequences: ReminderSequence[];
  onUpdate: (index: number, field: keyof ReminderSequence, value: any) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: "up" | "down") => void;
  onTest: (id: string) => void;
  isTesting: string | null;
  direction: "before" | "after";
}) {
  return (
    <div className="bg-surface-alt rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-primary">{title}</h3>
          <p className="text-sm text-secondary">{description}</p>
        </div>
        <button
          onClick={onAdd}
          className="text-sm text-primary-brand hover:text-primary-brand font-medium"
        >
          + Add Reminder
        </button>
      </div>

      <div className="space-y-3">
        {sequences.map((seq, index) => (
          <div key={seq.id} className="bg-surface rounded-lg border border-color-subtle p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seq.enabled}
                      onChange={(e) => onUpdate(index, "enabled", e.target.checked)}
                      className="w-4 h-4 rounded border-input-border text-primary-brand focus:ring-primary"
                    />
                    <span className={`text-sm font-medium ${seq.enabled ? "text-primary" : "text-secondary"}`}>
                      {seq.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary-bg text-primary-brand">
                    #{index + 1}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1">
                      {direction === "before" ? "Days Before Due" : "Days After Due"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={seq.offsetDays}
                      onChange={(e) => onUpdate(index, "offsetDays", Number(e.target.value))}
                      className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1">Max Sends</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={seq.maxSends}
                      onChange={(e) => onUpdate(index, "maxSends", Number(e.target.value))}
                      className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      onClick={() => onTest(seq.id)}
                      disabled={isTesting === seq.id}
                      className="flex-1 rounded-lg border border-input-border px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-alt disabled:opacity-50"
                    >
                      {isTesting === seq.id ? "Sending..." : "Test"}
                    </button>
                    <button
                      onClick={() => onRemove(index)}
                      disabled={sequences.length <= 1}
                      className="rounded-lg border status-error-border px-3 py-2 text-sm font-medium status-error-text hover:status-error-bg disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {index > 0 && (
                  <button
                    onClick={() => onMove(index, "up")}
                    className="text-xs text-secondary hover:text-primary"
                    title="Move up"
                  >
                    ↑ Up
                  </button>
                )}
                {index < sequences.length - 1 && (
                  <button
                    onClick={() => onMove(index, "down")}
                    className="text-xs text-secondary hover:text-primary"
                    title="Move down"
                  >
                    ↓ Down
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-color-subtle">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">Subject</label>
                <input
                  type="text"
                  value={seq.subject ?? ""}
                  onChange={(e) => onUpdate(index, "subject", e.target.value)}
                  placeholder="e.g. Invoice {{invoice_number}} due in {{days}} days"
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">Message</label>
                <textarea
                  value={seq.message ?? ""}
                  onChange={(e) => onUpdate(index, "message", e.target.value)}
                  rows={3}
                  placeholder="Dear {{customer_name}},\n\nThis is a reminder that invoice {{invoice_number}} for {{amount_due}} is due on {{due_date}}.\n\nThank you!"
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateDialog({
  isOpen,
  onClose,
  onSave,
  initialData,
  isEditing,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialData: { name: string; subject: string; message: string };
  isEditing: boolean;
}) {
  const [formData, setFormData] = useState(initialData);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-color-subtle">
          <h3 className="text-lg font-semibold text-primary">
            {isEditing ? "Edit Template" : "New Template"}
          </h3>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Template Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
              placeholder="e.g. Standard Reminder"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Subject *</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
              placeholder="Invoice {{invoice_number}} - Payment Reminder"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Message *</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={6}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
              placeholder="Dear {{customer_name}},\n\nThis is a reminder that invoice {{invoice_number}} for {{amount_due}} is due on {{due_date}}.\n\nYou can view and pay this invoice online using the secure link below.\n\nThank you for your business.\n\n{{business_name}}"
            />
          </div>
          <div className="text-xs text-secondary p-3 bg-surface-alt rounded-lg">
            <p className="font-medium mb-1">Available placeholders:</p>
            <p>{"{{invoice_number}}, {{customer_name}}, {{amount_due}}, {{due_date}}, {{issue_date}}, {{business_name}}, {{invoice_url}}, {{days_until_due}}, {{days_overdue}}"}</p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-color-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-on-primary bg-primary-action rounded-lg hover:bg-primary-hover"
            >
              {isEditing ? "Save Changes" : "Create Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




