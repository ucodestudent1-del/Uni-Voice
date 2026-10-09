import React, { useState, useEffect } from "react";
import { X, Save, RefreshCw } from "lucide-react";
import { Button } from "./ui/Button";
import { FormField } from "./ui/FormField";
import type { ApiBusinessSettings } from "@/types/api";
import { getCurrencyMetadata } from "@/types/currency";
import { toPercent, fromPercentage } from "@/utils/format";
import {
  PAYMENT_TERMS_OPTIONS,
  type PaymentTermsOption,
} from "./ui/PaymentTermsField";

const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "CNY",
  "CHF", "SEK", "NZD", "HKD", "SGD", "AED", "BRL",
] as const;

export interface SettingsAndDefaultsDrawerProps {
  open: boolean;
  onClose: () => void;
  businessSettings: Partial<ApiBusinessSettings>;
  businessName?: string;
  businessLogoUrl?: string | null;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onSettingsChange?: (data: Record<string, unknown>) => void;
}

interface DrawerState {
  default_currency: string;
  default_tax_rate: string;
  default_terms: string;
  default_notes: string;
  default_payment_instructions: string;
  late_fee_type: "none" | "fixed" | "percentage";
  late_fee_value: string;
  overdue_reminder_days: number;
  reminders_enabled: boolean;
  pdf_template_id: string;
}

const DEFAULT_STATE: DrawerState = {
  default_currency: "USD",
  default_tax_rate: "0",
  default_terms: "Net 30",
  default_notes: "",
  default_payment_instructions: "",
  late_fee_type: "none",
  late_fee_value: "0",
  overdue_reminder_days: 7,
  reminders_enabled: true,
  pdf_template_id: "default",
};

export function SettingsAndDefaultsDrawer({
  open,
  onClose,
  businessSettings,
  businessName,
  businessLogoUrl,
  onSave,
  onSettingsChange,
}: SettingsAndDefaultsDrawerProps) {
  const [state, setState] = useState<DrawerState>(DEFAULT_STATE);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!open) return;
    const rawTemplateId = businessSettings.pdf_template_id;
    const initial: DrawerState = {
      default_currency: businessSettings.default_currency ?? "USD",
      default_tax_rate: businessSettings.default_tax_rate ?? "0",
      default_terms: businessSettings.default_terms ?? "Net 30",
      default_notes: businessSettings.default_notes ?? "",
      default_payment_instructions:
        (businessSettings.payment_provider_config as Record<string, unknown> | undefined | null)
          ?.default_payment_instructions as string | undefined ??
        (businessSettings.payment_provider_config as Record<string, unknown> | undefined | null)
          ?.payment_instructions as string | undefined ??
        "",
      late_fee_type: (businessSettings.late_fee_type ?? "none") as DrawerState["late_fee_type"],
      late_fee_value: businessSettings.late_fee_value ?? "0",
      overdue_reminder_days: businessSettings.overdue_reminder_days ?? 7,
      reminders_enabled: businessSettings.reminders_enabled ?? true,
      pdf_template_id: rawTemplateId ? String(rawTemplateId) : "",
    };
    setState(initial);
    setHasChanges(false);
  }, [open, businessSettings]);

  const handleChange = (field: keyof DrawerState, value: unknown) => {
    setState((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    onSettingsChange?.({ [field]: value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        default_currency: state.default_currency,
        default_tax_rate: state.default_tax_rate,
        default_terms: state.default_terms,
        default_notes: state.default_notes,
        pdf_template_id: state.pdf_template_id || undefined,
        late_fee_type: state.late_fee_type,
        late_fee_value: state.late_fee_value,
        reminders_enabled: state.reminders_enabled,
        overdue_reminder_days: state.overdue_reminder_days,
        payment_provider_config: {
          payment_instructions: state.default_payment_instructions,
        },
      };
      await onSave(payload);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges && !confirm("Discard unsaved changes to defaults?")) return;
    onClose();
  };

  if (!open) return null;

  const currencyMeta = getCurrencyMetadata(state.default_currency);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
      <div
        className="relative w-full max-w-3xl rounded-xl border bg-surface shadow-xl outline-none"
        onKeyDown={(e) => e.key === "Escape" && handleClose()}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-color px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-primary">
              Settings &amp; Defaults
            </h2>
            {businessName && (
              <p className="text-sm text-secondary">{businessName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-tertiary hover:bg-surface-alt hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-6 py-5 space-y-6">
          {/* Business profile (read-only) */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-tertiary mb-3">
              Business Profile
            </h3>
            <div className="flex items-start gap-4">
              {businessLogoUrl ? (
                <img
                  src={businessLogoUrl}
                  alt={businessName || "Business logo"}
                  className="h-16 w-16 rounded-xl object-contain"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary-bg text-2xl font-bold text-primary">
                  {businessName?.charAt(0) ?? "?"}
                </div>
              )}
              <div className="flex-1 space-y-3">
                <FormField
                  label="Business name"
                  value={businessName ?? ""}
                  disabled
                  readOnly
                />
                <FormField
                  label="Logo"
                  value={businessLogoUrl ?? "Not set"}
                  disabled
                  helperText="Update via Business Settings page"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-tertiary">
              To edit business details, go to Settings → Business Profile.
            </p>
          </section>

          {/* Invoice defaults */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-tertiary mb-3">
              Invoice Defaults
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Default currency"
                select
                value={state.default_currency}
                onChange={(e) => handleChange("default_currency", e.target.value)}
                className="sm:col-span-2"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c} ({getCurrencyMetadata(c).symbol})
                  </option>
                ))}
              </FormField>

              <div>
                <label className="form-label-secondary">Default tax rate</label>
                <div className="mt-1 relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={toPercent(state.default_tax_rate)}
                    onChange={(e) =>
                      handleChange("default_tax_rate", fromPercentage(e.target.value.replace(/[^\d.]/g, "")))
                    }
                    className="input-with-prefix w-full font-tabular-nums"
                    placeholder="0.00"
                  />
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tertiary text-xs">
                    {currencyMeta.symbol}
                  </span>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-tertiary">
                    %
                  </span>
                </div>
              </div>

              <FormField
                label="Default payment terms"
                select
                value={state.default_terms}
                onChange={(e) => handleChange("default_terms", e.target.value)}
              >
                {PAYMENT_TERMS_OPTIONS.map((opt: PaymentTermsOption) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </FormField>
            </div>
          </section>

          {/* Payment defaults */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-tertiary mb-3">
              Payment Defaults
            </h3>
            <div className="space-y-4">
              <FormField
                label="Default payment instructions"
                helperText="These instructions appear on all customer invoices by default."
              >
                <textarea
                  value={state.default_payment_instructions}
                  onChange={(e) => handleChange("default_payment_instructions", e.target.value)}
                  rows={3}
                  placeholder="Bank transfer: account #..."
                  className="form-control resize-y"
                />
              </FormField>

              <FormField
                label="Default notes"
                helperText="Appears at the bottom of every invoice unless overridden."
              >
                <textarea
                  value={state.default_notes}
                  onChange={(e) => handleChange("default_notes", e.target.value)}
                  rows={3}
                  placeholder="Thank you for your business..."
                  className="form-control resize-y"
                />
              </FormField>
            </div>
          </section>

          {/* Late fees */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-tertiary mb-3">
              Late Fees
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                label="Type"
                select
                value={state.late_fee_type}
                onChange={(e) =>
                  handleChange("late_fee_type", e.target.value as DrawerState["late_fee_type"])
                }
              >
                <option value="none">None</option>
                <option value="fixed">Fixed amount</option>
                <option value="percentage">Percentage</option>
              </FormField>

              {state.late_fee_type !== "none" && (
                <>
                  <FormField
                    label="Value"
                    value={toPercent(state.late_fee_value)}
                    onChange={(e) => handleChange("late_fee_value", fromPercentage(e.target.value.replace(/[^\d.]/g, "")))}
                    helperText={state.late_fee_type === "percentage" ? "Percentage of overdue balance" : "Fixed amount"}
                  />
                  <FormField
                    label="Grace period (days)"
                    type="number"
                    min={0}
                    value={state.overdue_reminder_days}
                    onChange={(e) => handleChange("overdue_reminder_days", parseInt(e.target.value, 10) || 0)}
                  />
                </>
              )}
            </div>
          </section>

          {/* Reminders */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-tertiary mb-3">
              Reminders
            </h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.reminders_enabled}
                onChange={(e) => handleChange("reminders_enabled", e.target.checked)}
                className="h-4 w-4 rounded border-input-border text-primary-brand focus:ring-primary"
              />
              <span className="text-primary">Enable automatic payment reminders</span>
            </label>
          </section>

          {/* Templates */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-tertiary mb-3">
              PDF Template
            </h3>
            <FormField
              label="Template"
              select
              value={state.pdf_template_id}
              onChange={(e) => handleChange("pdf_template_id", e.target.value)}
            >
              <option value="default">Default (Standard)</option>
              <option value="minimal">Minimal</option>
              <option value="professional" disabled>
                Professional (coming soon)
              </option>
            </FormField>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-color px-6 py-4">
          <div className="flex items-center gap-2 text-sm">
            {!hasChanges && <Save className="h-4 w-4 text-success-text" />}
            {hasChanges && (
              <>
                <RefreshCw className="h-4 w-4 text-tertiary animate-spin" />
                <span className="text-tertiary">Unsaved changes</span>
              </>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Save className="h-4 w-4" />}
              iconPosition="left"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              loading={isSaving}
            >
              {isSaving ? "Saving..." : "Save defaults"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

SettingsAndDefaultsDrawer.displayName = "SettingsAndDefaultsDrawer";

export default SettingsAndDefaultsDrawer;
