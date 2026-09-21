import { useState, useEffect } from "react";
import {
  createCustomer,
  updateCustomer,
} from "../api/client";
import type { ApiCustomer } from "../types/api";
import { validateCustomerForm, type CustomerFormValues } from "../schemas/customer";
import { Button } from "./ui/Button";

interface CustomerFormProps {
  customer?: ApiCustomer | null;
  onClose: () => void;
  onSaved: () => void;
}

const COUNTRIES = [
  "US", "GB", "CA", "AU", "DE", "FR", "ES", "IT", "NL", "JP",
  "IN", "BR", "MX", "SG", "CH", "CN", "KR", "SE", "NO", "DK",
  "FI", "PL", "PT", "AT", "BE", "NL", "IE", "LU", "CZ", "HU",
];

const TAX_ID_TYPES = [
  { value: "vat", label: "VAT" },
  { value: "ein", label: "EIN" },
  { value: "gst", label: "GST" },
  { value: "hst", label: "HST" },
  { value: "other", label: "Other" },
];

const defaultValues: CustomerFormValues = {
  name: "",
  email: "",
  companyName: "",
  phone: "",
  taxId: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  stateOrRegion: "",
  postalCode: "",
  countryCode: "US",
  notes: "",
  status: "active",
  paymentTerms: undefined,
  defaultCurrency: undefined,
};

export default function CustomerForm({ customer, onClose, onSaved }: CustomerFormProps) {
  const [formData, setFormData] = useState<CustomerFormValues>(defaultValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || "",
        email: customer.email || "",
        companyName: customer.companyName || "",
        phone: customer.phone || "",
        taxId: customer.taxId || "",
        addressLine1: customer.address?.addressLine1 || "",
        addressLine2: customer.address?.addressLine2 || "",
        city: customer.address?.city || "",
        stateOrRegion: customer.address?.stateOrRegion || "",
        postalCode: customer.address?.postalCode || "",
        countryCode: customer.address?.countryCode || "US",
        notes: customer.notes || "",
        status: customer.status as any,
        paymentTerms: customer.paymentTerms ?? undefined,
        defaultCurrency: customer.defaultCurrency || undefined,
      });
    }
  }, [customer]);

  function handleChange(field: keyof CustomerFormValues, value: any) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  }

  function validateForm(): boolean {
    try {
      validateCustomerForm(formData);
      return true;
    } catch (e: any) {
      const msg = e.errors?.[0]?.message || "Please fix the errors in the form";
      setError(msg);
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setError(null);
    try {
      if (customer) {
        await updateCustomer(customer.id, formData);
      } else {
        await createCustomer(formData);
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save customer");
    } finally {
      setLoading(false);
    }
  }

  const isEditing = !!customer;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-3xl mx-4 my-8">
        <div className="p-6 border-b border-color-subtle">
          <h3 className="text-lg font-semibold text-primary">
            {isEditing ? "Edit Customer" : "Add Customer"}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 status-error-bg border status-error-border rounded-lg">
              <p className="text-sm status-error-text">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Company</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleChange("companyName", e.target.value)}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Tax ID</label>
            <input
              type="text"
              value={formData.taxId}
              onChange={(e) => handleChange("taxId", e.target.value)}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Payment Terms (Days)</label> Net
              <input
                type="number"
                min="0"
                step="1"
                value={formData.paymentTerms ?? ""}
                onChange={(e) => handleChange("paymentTerms", e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. 30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Default Currency</label>
              <select
                value={formData.defaultCurrency || ""}
                onChange={(e) => handleChange("defaultCurrency", e.target.value || undefined)}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Default</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
                <option value="JPY">JPY</option>
                <option value="CNY">CNY</option>
                <option value="INR">INR</option>
              </select>
            </div>
          </div>

          <fieldset className="border border-color-subtle rounded-lg p-4">
            <legend className="text-sm font-medium text-secondary px-1">Address</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Street address"
                  value={formData.addressLine1}
                  onChange={(e) => handleChange("addressLine1", e.target.value)}
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Street address 2"
                  value={formData.addressLine2}
                  onChange={(e) => handleChange("addressLine2", e.target.value)}
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="State / Region"
                  value={formData.stateOrRegion}
                  onChange={(e) => handleChange("stateOrRegion", e.target.value)}
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Postal code"
                  value={formData.postalCode}
                  onChange={(e) => handleChange("postalCode", e.target.value)}
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <select
                  value={formData.countryCode}
                  onChange={(e) => handleChange("countryCode", e.target.value)}
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Notes</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Additional notes for this customer..."
            />
          </div>
        </form>

        <div className="p-6 border-t border-color-subtle flex justify-end gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
            disabled={loading}
          >
            {loading ? "Saving..." : isEditing ? "Update" : "Add Customer"}
          </Button>
        </div>
      </div>
    </div>
  );
}




