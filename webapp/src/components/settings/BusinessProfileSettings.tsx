import { useState, useEffect } from "react";
import { getBusiness, updateBusiness } from "../../api/client";
import type { ApiBusiness } from "../../types/api";
import FormField from "./FormField";
import SavedIndicator from "./SavedIndicator";

type BusinessField =
  | "name"
  | "legal_name"
  | "email"
  | "phone"
  | "website"
  | "tax_id"
  | "registration_number"
  | "address_line_1"
  | "address_line_2"
  | "city"
  | "state_or_region"
  | "postal_code"
  | "country_code"
  | "default_currency"
  | "logo_url";

const currencyOptions = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — Pound Sterling" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "CHF", label: "CHF — Swiss Franc" },
  { value: "CNY", label: "CNY — Chinese Yuan" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "BRL", label: "BRL — Brazilian Real" },
  { value: "MXN", label: "MXN — Mexican Peso" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
  { value: "HKD", label: "HKD — Hong Kong Dollar" },
  { value: "NZD", label: "NZD — New Zealand Dollar" },
  { value: "SEK", label: "SEK — Swedish Krona" },
  { value: "NOK", label: "NOK — Norwegian Krone" },
  { value: "DKK", label: "DKK — Danish Krone" },
  { value: "PLN", label: "PLN — Polish Złoty" },
  { value: "CZK", label: "CZK — Czech Koruna" },
  { value: "HUF", label: "HUF — Hungarian Forint" },
  { value: "TRY", label: "TRY — Turkish Lira" },
  { value: "RUB", label: "RUB — Russian Ruble" },
  { value: "ZAR", label: "ZAR — South African Rand" },
  { value: "KRW", label: "KRW — South Korean Won" },
  { value: "THB", label: "THB — Thai Baht" },
  { value: "IDR", label: "IDR — Indonesian Rupiah" },
  { value: "MYR", label: "MYR — Malaysian Ringgit" },
  { value: "PHP", label: "PHP — Philippine Peso" },
  { value: "VND", label: "VND — Vietnamese Đồng" },
];

const countryOptions = [
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "NL", label: "Netherlands" },
  { value: "JP", label: "Japan" },
  { value: "IN", label: "India" },
  { value: "BR", label: "Brazil" },
  { value: "CH", label: "Switzerland" },
  { value: "CN", label: "China" },
  { value: "MX", label: "Mexico" },
  { value: "SG", label: "Singapore" },
  { value: "HK", label: "Hong Kong" },
  { value: "NZ", label: "New Zealand" },
];

export default function BusinessProfileSettings() {
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    legalName: "",
    email: "",
    phone: "",
    website: "",
    taxId: "",
    registrationNumber: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    stateOrRegion: "",
    postalCode: "",
    countryCode: "US",
    defaultCurrency: "USD",
    logoUrl: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await getBusiness();
        setBusiness(data.business);
        setForm({
          name: data.business?.name || "",
          legalName: data.business?.legal_name || "",
          email: data.business?.email || "",
          phone: data.business?.phone || "",
          website: data.business?.website || "",
          taxId: data.business?.tax_id || "",
          registrationNumber: data.business?.registration_number || "",
          addressLine1: data.business?.address_line_1 || "",
          addressLine2: data.business?.address_line_2 || "",
          city: data.business?.city || "",
          stateOrRegion: data.business?.state_or_region || "",
          postalCode: data.business?.postal_code || "",
          countryCode: data.business?.country_code || "US",
          defaultCurrency: data.business?.default_currency || "USD",
          logoUrl: data.business?.logo_url || "",
        });
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load business profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function updateForm(patch: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function saveField(field: BusinessField, value: unknown) {
    setSaving(true);
    setError(null);
    setSavedField(null);
    try {
      await updateBusiness({ [field]: value });
      setSavedField(field);
      setTimeout(() => setSavedField(null), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-secondary">Loading business profile…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Business Profile</h2>
        <p className="text-sm text-secondary mt-1">
          Configure your business name, logo, address, contact information, tax and registration
          details, and default currency.
        </p>
      </div>

      {error && (
        <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Business Name" description="Your public business name as shown on invoices.">
              <input
                type="text"
                value={form.name}
                onChange={(e) => { updateForm({ name: e.target.value }); saveField("name", e.target.value); }}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </FormField>
            <FormField label="Legal Name" description="Full legal name for tax and contractual purposes.">
              <input
                type="text"
                value={form.legalName}
                onChange={(e) => { updateForm({ legalName: e.target.value }); saveField("legal_name", e.target.value); }}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </FormField>
            <FormField label="Email Address" description="Primary business email for customer communications.">
              <input
                type="email"
                value={form.email}
                onChange={(e) => { updateForm({ email: e.target.value }); saveField("email", e.target.value); }}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </FormField>
            <FormField label="Phone">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => { updateForm({ phone: e.target.value }); saveField("phone", e.target.value); }}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Website" description="Your business website URL.">
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => { updateForm({ website: e.target.value }); saveField("website", e.target.value); }}
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </FormField>
            </div>
            <FormField label="Tax ID / VAT" description="Tax identification number for tax calculations.">
              <input
                type="text"
                value={form.taxId}
                onChange={(e) => { updateForm({ taxId: e.target.value }); saveField("tax_id", e.target.value); }}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </FormField>
            <FormField label="Registration Number" description="Official company registration number.">
              <input
                type="text"
                value={form.registrationNumber}
                onChange={(e) => { updateForm({ registrationNumber: e.target.value }); saveField("registration_number", e.target.value); }}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </FormField>
          </div>

          <FormField label="Default Currency" description="The primary currency for invoices and financial documents.">
            <select
              value={form.defaultCurrency}
              onChange={(e) => { updateForm({ defaultCurrency: e.target.value }); saveField("default_currency", e.target.value); }}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {currencyOptions.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Address" description="Your business address as it appears on invoices.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  value={form.addressLine1}
                  onChange={(e) => { updateForm({ addressLine1: e.target.value }); saveField("address_line_1", e.target.value); }}
                  placeholder="Street address"
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={form.addressLine2}
                  onChange={(e) => { updateForm({ addressLine2: e.target.value }); saveField("address_line_2", e.target.value); }}
                  placeholder="Apt, suite, unit (optional)"
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => { updateForm({ city: e.target.value }); saveField("city", e.target.value); }}
                  placeholder="City"
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={form.stateOrRegion}
                  onChange={(e) => { updateForm({ stateOrRegion: e.target.value }); saveField("state_or_region", e.target.value); }}
                  placeholder="State / Region"
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={form.postalCode}
                  onChange={(e) => { updateForm({ postalCode: e.target.value }); saveField("postal_code", e.target.value); }}
                  placeholder="Postal code"
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <select
                  value={form.countryCode}
                  onChange={(e) => { updateForm({ countryCode: e.target.value }); saveField("country_code", e.target.value); }}
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {countryOptions.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </FormField>
        </div>

        <div className="space-y-6">
          <FormField label="Business Logo" description="Upload or paste a logo URL.">
            <div className="flex flex-col items-center gap-3">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Business logo" className="h-24 w-24 rounded-lg border border-color-subtle object-cover" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-color-subtle text-tertiary">
                  <span className="text-xs">No logo</span>
                </div>
              )}
              <input
                type="url"
                value={form.logoUrl}
                onChange={(e) => { updateForm({ logoUrl: e.target.value }); saveField("logo_url", e.target.value); }}
                placeholder="Logo URL"
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </FormField>
          <div className="text-right">
            <SavedIndicator show={savedField === "logo_url"} />
          </div>
        </div>
      </div>
    </div>
  );
}



