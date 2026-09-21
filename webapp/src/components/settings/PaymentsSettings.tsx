import { useState, useEffect } from "react";
import { getBusinessSettings, updateBusinessSettings } from "../../api/client";
import type { ApiBusinessSettings } from "../../types/api";
import FormField from "./FormField";
import SavedIndicator from "./SavedIndicator";

export default function PaymentsSettings() {
  const [settings, setSettings] = useState<ApiBusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    paymentProvider: "stub",
    paymentInstructions: "",
    remindersEnabled: true,
    overdueReminderDays: 7,
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await getBusinessSettings();
        if (data?.settings) {
          const config = (data.settings.payment_provider_config as Record<string, unknown>) ?? {};
          setForm({
            paymentProvider: data.settings.payment_provider ?? "stub",
            paymentInstructions: (config.payment_instructions as string) ?? "",
            remindersEnabled: data.settings.reminders_enabled ?? true,
            overdueReminderDays: data.settings.overdue_reminder_days ?? 7,
          });
          setSettings(data.settings);
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
      await updateBusinessSettings({
        payment_provider: form.paymentProvider,
        payment_provider_config: { payment_instructions: form.paymentInstructions },
        reminders_enabled: form.remindersEnabled,
        overdue_reminder_days: form.overdueReminderDays,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save payment settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-secondary">Loading payment settings…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Payments</h2>
        <p className="text-sm text-secondary mt-1">
          Configure connected payment providers, accepted payment methods, payment instructions,
          and payout information.
        </p>
      </div>

      {error && (
        <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text">{error}</div>
      )}

      <div className="rounded-xl border border-color-subtle bg-surface p-6 space-y-6">
        <h3 className="text-md font-semibold text-primary">Payment Providers</h3>

        <FormField label="Payment Provider" description="The provider used to process customer payments.">
          <select
            value={form.paymentProvider}
            onChange={(e) => setForm({ ...form, paymentProvider: e.target.value })}
            className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="stub">Built-in (Test Mode)</option>
            <option value="stripe" disabled>
              Stripe — Coming soon
            </option>
            <option value="paypal" disabled>
              PayPal — Coming soon
            </option>
          </select>
        </FormField>

        <FormField
          label="Payment Instructions"
          description="Instructions shown to customers when paying invoices manually (e.g. bank transfer details)."
        >
          <textarea
            value={form.paymentInstructions}
            onChange={(e) => setForm({ ...form, paymentInstructions: e.target.value })}
            rows={4}
            placeholder="Bank: 1234 5678 90&#10;Account: 987654321"
            className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </FormField>

        <div className="border-t border-color-subtle pt-4 space-y-4">
          <h4 className="text-sm font-medium text-secondary">Automated Reminders</h4>

          <FormField
            label="Enable Automated Reminders"
            description="Send automated payment reminders to customers who haven't paid."
          >
            <label className="flex items-center gap-2 text-sm text-secondary">
              <input
                type="checkbox"
                checked={form.remindersEnabled}
                onChange={(e) => setForm({ ...form, remindersEnabled: e.target.checked })}
                className="rounded border-input-border text-primary-brand focus:ring-primary"
              />
              Enable automated reminders
            </label>
          </FormField>

          <FormField
            label="Overdue Reminder Days"
            description="Days after the due date to send the first overdue reminder."
          >
            <input
              type="number"
              min="1"
              max="120"
              value={form.overdueReminderDays}
              onChange={(e) => setForm({ ...form, overdueReminderDays: parseInt(e.target.value) || 7 })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
        </div>
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Accepted Payment Methods</h3>
        <div className="space-y-3">
          {["Credit / Debit Card", "Bank Transfer", "Check", "Cash"].map((method) => (
            <div key={method} className="flex items-center justify-between py-2 border-b border-color-subtle last:border-0">
              <span className="text-sm text-secondary">{method}</span>
              <label className="relative inline-flex h-5 w-9 items-center rounded-full">
                <input type="checkbox" defaultChecked className="h-0 w-0 opacity-0" />
                <span className="inline-block h-5 w-9 rounded-full bg-primary-action">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-surface translate-x-5" />
                </span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Payout Information</h3>
        <p className="text-sm text-secondary">
          Payout details for funds received from customers are managed through your connected
          payment provider. Connect Stripe to configure payout schedules and bank accounts.
        </p>
      </div>

      <div className="flex items-center justify-between pt-4">
        <SavedIndicator show={saved} />
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Payment Settings"}
        </button>
      </div>
    </div>
  );
}




