import { useState, useEffect } from "react";
import { getBusinessSettings, updateBusinessSettings, getNumberingConfig, updateNumberingConfig } from "../../api/client";
import type { ApiBusinessSettings } from "../../types/api";
import FormField from "./FormField";
import SavedIndicator from "./SavedIndicator";

export default function InvoicingSettings() {
  const [settings, setSettings] = useState<ApiBusinessSettings | null>(null);
  const [numbering, setNumbering] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [numberingData, setNumberingData] = useState({
    prefix: "INV",
    padding: 6,
    includesYear: true,
  });

  const [settingsForm, setSettingsForm] = useState({
    defaultTaxRate: "0",
    defaultTerms: "Net 30",
    defaultNotes: "",
    remindersEnabled: true,
    overdueReminderDays: 7,
  });

  useEffect(() => {
    async function load() {
      try {
        const [s, n] = await Promise.all([
          getBusinessSettings().catch(() => null),
          getNumberingConfig().catch(() => null),
        ]);
        if (s?.settings) {
          const termMap: Record<string, string> = {
            "Net 7": "Net 7",
            "Net 14": "Net 14",
            "Net 30": "Net 30",
            "Due on receipt": "Due on receipt",
            "Net 60": "Net 60",
            "Net 90": "Net 90",
          };
          setSettingsForm({
            defaultTaxRate: s.settings.default_tax_rate ?? "0",
            defaultTerms: termMap[s.settings.default_terms ?? ""] ?? "Net 30",
            defaultNotes: s.settings.default_notes ?? "",
            remindersEnabled: s.settings.reminders_enabled ?? true,
            overdueReminderDays: s.settings.overdue_reminder_days ?? 7,
          });
          setSettings(s.settings);
        }
        if (n?.sequence) {
          setNumbering(n.sequence);
          setNumberingData({
            prefix: n.sequence.prefix,
            padding: n.sequence.padding,
            includesYear: n.sequence.includes_year,
          });
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await Promise.all([
        updateNumberingConfig({
          prefix: numberingData.prefix,
          padding: numberingData.padding,
          includes_year: numberingData.includesYear,
        }),
        updateBusinessSettings({
          default_tax_rate: settingsForm.defaultTaxRate,
          default_terms: settingsForm.defaultTerms,
          default_notes: settingsForm.defaultNotes,
          reminders_enabled: settingsForm.remindersEnabled,
          overdue_reminder_days: settingsForm.overdueReminderDays,
        }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save invoice settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-secondary">Loading invoice settings…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Invoicing</h2>
        <p className="text-sm text-secondary mt-1">
          Configure invoice numbering, invoice prefixes, default payment terms, due dates,
          late-payment rules, default notes, and PDF/email behavior.
        </p>
      </div>

      {error && (
        <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text">{error}</div>
      )}

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Invoice Numbering</h3>
        <p className="text-sm text-secondary mb-4">Configure how invoice numbers are generated and formatted.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Prefix" description="Text before the invoice number.">
            <input
              type="text"
              value={numberingData.prefix}
              onChange={(e) => setNumberingData({ ...numberingData, prefix: e.target.value })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField label="Padding" description="Minimum number of digits in the sequence.">
            <input
              type="number"
              min="1"
              max="10"
              value={numberingData.padding}
              onChange={(e) => setNumberingData({ ...numberingData, padding: parseInt(e.target.value) || 6 })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <div className="flex items-end">
            <FormField label="" description="">
              <label className="flex items-center gap-2 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={numberingData.includesYear}
                  onChange={(e) => setNumberingData({ ...numberingData, includesYear: e.target.checked })}
                  className="rounded border-input-border text-primary-brand focus:ring-primary"
                />
                Include year (e.g. INV-2026-000001)
              </label>
            </FormField>
          </div>
        </div>
        {numbering && (
          <div className="mt-4 text-sm text-secondary">
            Next number: <span className="font-medium text-primary">{numbering.next_number}</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Invoice Defaults</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Default Tax Rate" description="Applied when no line-item rate is specified.">
            <input
              type="number"
              min="0"
              max="1"
              step="0.0001"
              value={settingsForm.defaultTaxRate}
              onChange={(e) => setSettingsForm({ ...settingsForm, defaultTaxRate: e.target.value })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField label="Default Payment Terms" description="Net days before payment is due.">
            <select
              value={settingsForm.defaultTerms}
              onChange={(e) => setSettingsForm({ ...settingsForm, defaultTerms: e.target.value })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="Net 7">Net 7</option>
              <option value="Net 14">Net 14</option>
              <option value="Net 30">Net 30</option>
              <option value="Due on receipt">Due on receipt (0 days)</option>
              <option value="Net 60">Net 60</option>
              <option value="Net 90">Net 90</option>
              <option value={""}>None (manual due date)</option>
            </select>
          </FormField>
          <FormField label="Overdue Reminder Days" description="Days after the due date to send the first overdue reminder.">
            <input
              type="number"
              min="1"
              max="120"
              value={settingsForm.overdueReminderDays}
              onChange={(e) => setSettingsForm({ ...settingsForm, overdueReminderDays: parseInt(e.target.value) || 7 })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <div className="flex items-end">
            <FormField label="" description="">
              <label className="flex items-center gap-2 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={settingsForm.remindersEnabled}
                  onChange={(e) => setSettingsForm({ ...settingsForm, remindersEnabled: e.target.checked })}
                  className="rounded border-input-border text-primary-brand focus:ring-primary"
                />
                Enable automated reminders
              </label>
            </FormField>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Default Content</h3>
        <FormField label="Default Notes" description="Pre-filled notes shown on every new invoice.">
          <textarea
            value={settingsForm.defaultNotes}
            onChange={(e) => setSettingsForm({ ...settingsForm, defaultNotes: e.target.value })}
            rows={3}
            placeholder="Thank you for your business!"
            className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </FormField>
        <FormField
          label="PDF & Email Behavior"
          description="Attach a PDF to customer emails automatically when sending an invoice."
        >
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              defaultChecked
              onChange={() => {}}
              className="rounded border-input-border text-primary-brand focus:ring-primary"
            />
            Attach PDF to email notifications
          </label>
        </FormField>
      </div>

      <div className="flex items-center justify-between pt-4">
        <SavedIndicator show={saved} />
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}




