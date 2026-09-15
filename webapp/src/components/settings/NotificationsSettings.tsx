import { useState, useEffect } from "react";
import FormField from "./FormField";
import SavedIndicator from "./SavedIndicator";

export interface NotificationSettings {
  emailNotifications: boolean;
  paymentConfirmations: boolean;
  invoiceReminders: boolean;
  overdueReminders: boolean;
  reminderDays: string;
  invoiceSent: boolean;
  invoiceViewed: boolean;
}

const STORAGE_KEY = "invoice-notifications-settings";

const DEFAULTS: NotificationSettings = {
  emailNotifications: true,
  paymentConfirmations: true,
  invoiceReminders: true,
  overdueReminders: true,
  reminderDays: "3, 1",
  invoiceSent: true,
  invoiceViewed: true,
};

export default function NotificationsSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSettings({ ...DEFAULTS, ...JSON.parse(stored) });
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  function update(patch: Partial<NotificationSettings>) {
    setSettings((s) => ({ ...s, ...patch }));
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
        <p className="text-sm text-slate-600 mt-1">
          Control email notifications, payment confirmations, invoice reminders, and overdue
          reminders.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Email Notifications</p>
            <p className="text-xs text-slate-500">Enable email notifications from InvoiceFlow.</p>
          </div>
          <label className="relative inline-flex h-5 w-9 items-center rounded-full">
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={(e) => update({ emailNotifications: e.target.checked })}
              className="h-0 w-0 opacity-0"
            />
            <span
              className={`inline-block h-5 w-9 rounded-full transition ${
                settings.emailNotifications ? "bg-primary-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  settings.emailNotifications ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </span>
          </label>
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-4">
          <FormField
            label="Payment Confirmations"
            description="Send an email when a customer pays an invoice."
          >
            <ToggleSwitch
              checked={settings.emailNotifications && settings.paymentConfirmations}
              onChange={(v) => update({ paymentConfirmations: v })}
              disabled={!settings.emailNotifications}
            />
          </FormField>

          <FormField
            label="Invoice Sent"
            description="Send an email notification when you send an invoice."
          >
            <ToggleSwitch
              checked={settings.emailNotifications && settings.invoiceSent}
              onChange={(v) => update({ invoiceSent: v })}
              disabled={!settings.emailNotifications}
            />
          </FormField>

          <FormField
            label="Invoice Viewed"
            description="Notify when a customer views an invoice for the first time."
          >
            <ToggleSwitch
              checked={settings.emailNotifications && settings.invoiceViewed}
              onChange={(v) => update({ invoiceViewed: v })}
              disabled={!settings.emailNotifications}
            />
          </FormField>

          <FormField
            label="Invoice Reminders"
            description="Send reminders for unpaid invoices before they are due."
          >
            <ToggleSwitch
              checked={settings.emailNotifications && settings.invoiceReminders}
              onChange={(v) => update({ invoiceReminders: v })}
              disabled={!settings.emailNotifications}
            />
          </FormField>

          <FormField
            label="Overdue Reminders"
            description="Send reminders for invoices that are past due."
          >
            <ToggleSwitch
              checked={settings.emailNotifications && settings.overdueReminders}
              onChange={(v) => update({ overdueReminders: v })}
              disabled={!settings.emailNotifications}
            />
          </FormField>

          {settings.overdueReminders && (
            <FormField
              label="Overdue Reminder Schedule"
              description="Comma-separated days after due date to send reminders (e.g. 3, 7, 14)."
            >
              <input
                type="text"
                value={settings.reminderDays}
                onChange={(e) => update({ reminderDays: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </FormField>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <SavedIndicator show={saved} />
        <button
          onClick={save}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Save Notification Settings
        </button>
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="relative inline-flex h-5 w-9 items-center rounded-full">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-0 w-0 opacity-0 disabled:cursor-not-allowed"
      />
      <span
        className={`inline-block h-5 w-9 rounded-full transition ${
          disabled ? "bg-slate-200" : checked ? "bg-primary-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </span>
    </label>
  );
}
