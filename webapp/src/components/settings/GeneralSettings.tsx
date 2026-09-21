import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getBusinessSettings, updateBusinessSettings, getMe, updateUserProfile } from "../../api/client";
import type { ApiBusinessSettings } from "../../types/api";
import FormField from "./FormField";
import SavedIndicator from "./SavedIndicator";

export default function GeneralSettings() {
  const { section } = useParams();
  const isAccount = section === "account";

  const [settings, setSettings] = useState<ApiBusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [prefsForm, setPrefsForm] = useState({
    defaultCurrency: "USD",
    timeZone: "UTC",
    locale: "en-US",
    dateFormat: "MM/DD/YYYY",
    language: "en",
  });

  const [accountForm, setAccountForm] = useState({ email: "" });

  useEffect(() => {
    async function load() {
      try {
        const s = await getBusinessSettings().catch(() => null);
        if (s?.settings) {
          setSettings(s.settings);
          setPrefsForm({
            defaultCurrency: s.settings.default_currency ?? "USD",
            timeZone: s.settings.time_zone ?? "UTC",
            locale: s.settings.locale ?? "en-US",
            dateFormat: "MM/DD/YYYY",
            language: "en",
          });
        }
        const me = await getMe().catch(() => null);
        if (me?.user?.email) {
          setAccountForm({ email: me.user.email });
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function savePrefs() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateBusinessSettings({
        default_currency: prefsForm.defaultCurrency,
        time_zone: prefsForm.timeZone,
        locale: prefsForm.locale,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  async function saveAccount() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateUserProfile({ email: accountForm.email });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save account");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-secondary">Loading settings…</div>;
  }

  if (isAccount) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-inverse">Account</h2>
          <p className="text-sm text-secondary text-tertiary mt-1">
            Manage your personal account details.
          </p>
        </div>

        {error && (
          <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text">{error}</div>
        )}

        <div className="rounded-xl border border-color-subtle border-color bg-surface p-6 space-y-6">
          <div>
            <h3 className="text-md font-semibold text-inverse mb-4">Profile</h3>
            <FormField label="Email Address" description="Your login email address.">
              <input
                type="email"
                value={accountForm.email}
                onChange={(e) => setAccountForm({ email: e.target.value })}
                className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </FormField>
          </div>
          <div className="flex items-center justify-between border-t border-color-subtle pt-4">
            <SavedIndicator show={saved} />
            <button
              onClick={saveAccount}
              disabled={saving}
              className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Account Settings"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-inverse">General</h2>
        <p className="text-sm text-secondary text-tertiary mt-1">
          Configure app-level preferences for your business.
        </p>
      </div>

      {error && (
        <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text">{error}</div>
      )}

      <div className="rounded-xl border border-color-subtle border-color bg-surface p-6 space-y-6">
        <FormField
          label="Default Currency"
          description="The default currency for new invoices."
        >
          <select
            value={prefsForm.defaultCurrency}
            onChange={(e) => setPrefsForm({ ...prefsForm, defaultCurrency: e.target.value })}
            className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — Pound Sterling</option>
            <option value="JPY">JPY — Japanese Yen</option>
            <option value="CAD">CAD — Canadian Dollar</option>
            <option value="AUD">AUD — Australian Dollar</option>
            <option value="CHF">CHF — Swiss Franc</option>
            <option value="CNY">CNY — Chinese Yuan</option>
          </select>
        </FormField>

        <FormField
          label="Time Zone"
          description="Your local time zone for displaying dates and scheduling."
        >
          <select
            value={prefsForm.timeZone}
            onChange={(e) => setPrefsForm({ ...prefsForm, timeZone: e.target.value })}
            className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern Time (America/New_York)</option>
            <option value="America/Chicago">Central Time (America/Chicago)</option>
            <option value="America/Denver">Mountain Time (America/Denver)</option>
            <option value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Europe/Paris">Europe/Paris</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
            <option value="Asia/Shanghai">Asia/Shanghai</option>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
            <option value="Australia/Sydney">Australia/Sydney</option>
          </select>
        </FormField>

        <FormField
          label="Locale"
          description="Locale for number and date formatting."
        >
          <select
            value={prefsForm.locale}
            onChange={(e) => setPrefsForm({ ...prefsForm, locale: e.target.value })}
            className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="de-DE">German (Germany)</option>
            <option value="fr-FR">French (France)</option>
            <option value="es-ES">Spanish (Spain)</option>
            <option value="ja-JP">Japanese (Japan)</option>
            <option value="zh-CN">Chinese (China)</option>
          </select>
        </FormField>

        <FormField
          label="Date Format"
          description="How dates are displayed throughout the app."
        >
          <select
            value={prefsForm.dateFormat}
            onChange={(e) => setPrefsForm({ ...prefsForm, dateFormat: e.target.value })}
            className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            <option value="DD.MM.YYYY">DD.MM.YYYY</option>
            <option value="DD MMM YYYY">DD MMM YYYY</option>
          </select>
        </FormField>

        <FormField
          label="Language"
          description="App display language."
        >
          <select
            value={prefsForm.language}
            onChange={(e) => setPrefsForm({ ...prefsForm, language: e.target.value })}
            className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
          </select>
        </FormField>
      </div>

      <div className="flex items-center justify-between pt-4">
        <SavedIndicator show={saved} />
        <button
          onClick={savePrefs}
          disabled={saving}
          className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}






