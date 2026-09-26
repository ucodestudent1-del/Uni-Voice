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
    onlinePaymentsEnabled: true,
    acceptedMethods: {
      creditCard: true,
      bankTransfer: true,
      check: false,
      cash: false,
    },
    lateFeeType: "none" as "none" | "fixed" | "percentage",
    lateFeeValue: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await getBusinessSettings();
        if (data?.settings) {
          const config = (data.settings.payment_provider_config as Record<string, unknown>) ?? {};
          const methods = (config.accepted_methods as Record<string, boolean>) ?? {};
          setForm({
            paymentProvider: data.settings.payment_provider ?? "stub",
            paymentInstructions: (config.payment_instructions as string) ?? "",
            remindersEnabled: data.settings.reminders_enabled ?? true,
            overdueReminderDays: data.settings.overdue_reminder_days ?? 7,
            onlinePaymentsEnabled: (config.online_payments_enabled as boolean) ?? true,
            acceptedMethods: {
              creditCard: methods.credit_card ?? true,
              bankTransfer: methods.bank_transfer ?? true,
              check: methods.check ?? false,
              cash: methods.cash ?? false,
            },
            lateFeeType: (data.settings.late_fee_type as "none" | "fixed" | "percentage") ?? "none",
            lateFeeValue: data.settings.late_fee_value ?? "",
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

  function toggleMethod(method: keyof typeof form.acceptedMethods) {
    setForm({
      ...form,
      acceptedMethods: {
        ...form.acceptedMethods,
        [method]: !form.acceptedMethods[method],
      },
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateBusinessSettings({
        payment_provider: form.paymentProvider,
        payment_provider_config: {
          payment_instructions: form.paymentInstructions,
          online_payments_enabled: form.onlinePaymentsEnabled,
          accepted_methods: {
            credit_card: form.acceptedMethods.creditCard,
            bank_transfer: form.acceptedMethods.bankTransfer,
            check: form.acceptedMethods.check,
            cash: form.acceptedMethods.cash,
          },
        },
        reminders_enabled: form.remindersEnabled,
        overdue_reminder_days: form.overdueReminderDays,
        late_fee_type: form.lateFeeType,
        late_fee_value: form.lateFeeValue,
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

        <FormField
          label="Online Payments"
          description="Allow customers to pay invoices online using the configured payment provider."
        >
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              checked={form.onlinePaymentsEnabled}
              onChange={(e) => setForm({ ...form, onlinePaymentsEnabled: e.target.checked })}
              className="rounded border-input-border text-primary-brand focus:ring-primary"
            />
            Enable online payments
          </label>
        </FormField>
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Accepted Payment Methods</h3>
        <div className="space-y-3">
          {[
            { key: "creditCard", label: "Credit / Debit Card" },
            { key: "bankTransfer", label: "Bank Transfer" },
            { key: "check", label: "Check" },
            { key: "cash", label: "Cash" },
          ].map((method) => {
            const checked = form.acceptedMethods[method.key as keyof typeof form.acceptedMethods];
            return (
              <div key={method.key} className="flex items-center justify-between py-2 border-b border-color-subtle last:border-0">
                <span className="text-sm text-secondary">{method.label}</span>
                <label className="relative inline-flex h-5 w-9 items-center rounded-full">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMethod(method.key as keyof typeof form.acceptedMethods)}
                    className="h-0 w-0 opacity-0"
                  />
                  <span
                    className={`inline-block h-5 w-9 rounded-full transition-colors ${
                      checked ? "bg-primary-action" : "bg-surface-alt"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${
                        checked ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6 space-y-6">
        <h3 className="text-md font-semibold text-primary">Late Payment Fees</h3>

        <FormField label="Late Fee Type" description="How late fees are calculated for overdue invoices.">
          <select
            value={form.lateFeeType}
            onChange={(e) => setForm({ ...form, lateFeeType: e.target.value as "none" | "fixed" | "percentage" })}
            className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="none">No late fee</option>
            <option value="fixed">Fixed amount</option>
            <option value="percentage">Percentage of total</option>
          </select>
        </FormField>

        {form.lateFeeType !== "none" && (
          <FormField
            label="Late Fee Value"
            description={
              form.lateFeeType === "percentage"
                ? "Percentage added to the invoice total when it becomes overdue."
                : "Fixed amount added to the invoice total when it becomes overdue."
            }
          >
            <div className="relative">
              <input
                type="number"
                min="0"
                step={form.lateFeeType === "percentage" ? "0.01" : "0.01"}
                value={form.lateFeeValue}
                onChange={(e) => setForm({ ...form, lateFeeValue: e.target.value })}
                className="w-full rounded-lg border border-input-border px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={form.lateFeeType === "percentage" ? "e.g. 5" : "e.g. 25.00"}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-secondary">
                {form.lateFeeType === "percentage" ? "%" : "$"}
              </span>
            </div>
          </FormField>
        )}
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6 space-y-6">
        <h3 className="text-md font-semibold text-primary">Automated Reminders</h3>

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
