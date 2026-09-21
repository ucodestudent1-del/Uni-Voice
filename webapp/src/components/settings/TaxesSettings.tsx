import { useState, useEffect } from "react";
import { getTaxRates, createTaxRate, updateTaxRate, deleteTaxRate } from "../../api/client";
import type { ApiTaxRate } from "../../types/api";
import FormField from "./FormField";

export default function TaxesSettings() {
  const [taxRates, setTaxRates] = useState<ApiTaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emptyForm = { name: "", code: "", rate: "", type: "percentage", countryCode: "", region: "", isCompound: false, enabled: true };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadTaxRates();
  }, []);

  async function loadTaxRates() {
    try {
      const data = await getTaxRates();
      setTaxRates(data.taxRates ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(rate: ApiTaxRate) {
    setEditingId(rate.id);
    setForm({
      name: rate.name,
      code: rate.code ?? "",
      rate: rate.rate,
      type: rate.type,
      countryCode: rate.country_code ?? "",
      region: rate.region ?? "",
      isCompound: rate.is_compound,
      enabled: rate.enabled,
    });
  }

  async function saveRate() {
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateTaxRate(editingId, {
          name: form.name,
          code: form.code,
          rate: form.rate,
          type: form.type,
          country_code: form.countryCode,
          region: form.region,
          is_compound: form.isCompound,
          enabled: form.enabled,
        });
      } else {
        await createTaxRate({
          name: form.name,
          code: form.code,
          rate: form.rate,
          type: form.type,
          country_code: form.countryCode,
          region: form.region,
          is_compound: form.isCompound,
          enabled: form.enabled,
        });
      }
      await loadTaxRates();
      setEditingId(null);
      setForm(emptyForm);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save tax rate");
    } finally {
      setSaving(false);
    }
  }

  async function removeRate(id: string) {
    if (!confirm("Delete this tax rate? This cannot be undone.")) return;
    try {
      await deleteTaxRate(id);
      setTaxRates(taxRates.filter((r) => r.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete tax rate");
    }
  }

  if (loading) {
    return <div className="text-sm text-secondary">Loading tax rates…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Taxes</h2>
        <p className="text-sm text-secondary mt-1">
          Configure tax rates and default tax behavior for your business.
        </p>
      </div>

      {error && (
        <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm status-error-text">{error}</div>
      )}

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">
          {editingId ? "Edit Tax Rate" : "Add Tax Rate"}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Name" description="A descriptive name for this tax rate.">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField label="Code" description="Short identifier (e.g. VAT, GST, SALES_TAX).">
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField label="Rate" description="Tax rate as a decimal (e.g. 0.0825 for 8.25%).">
            <input
              type="number"
              min="0"
              max="1"
              step="0.0001"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField label="Type">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed</option>
            </select>
          </FormField>
          <FormField label="Country">
            <select
              value={form.countryCode}
              onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All countries</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="IN">India</option>
              <option value="BR">Brazil</option>
            </select>
          </FormField>
          <FormField label="Region" description="State/province code for regional tax rates.">
            <input
              type="text"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <div className="flex items-end gap-6">
            <FormField label="" description="">
              <label className="flex items-center gap-2 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={form.isCompound}
                  onChange={(e) => setForm({ ...form, isCompound: e.target.checked })}
                  className="rounded border-input-border text-primary-brand focus:ring-primary"
                />
                Compound tax (apply on top of other taxes)
              </label>
            </FormField>
            <FormField label="" description="">
              <label className="flex items-center gap-2 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="rounded border-input-border text-primary-brand focus:ring-primary"
                />
                Enabled
              </label>
            </FormField>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          {editingId && (
            <button
              onClick={() => { setEditingId(null); setForm(emptyForm); }}
              className="rounded-lg border border-input-border px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
            >
              Cancel
            </button>
          )}
          <button
            onClick={saveRate}
            disabled={saving || !form.name || !form.rate}
            className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Saving…" : editingId ? "Update Rate" : "Add Rate"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-color-subtle bg-surface p-6">
        <h3 className="text-md font-semibold text-primary mb-4">Tax Rates</h3>
        {taxRates.length === 0 ? (
          <div className="text-center py-8 text-secondary">
            <p>No tax rates configured yet.</p>
            <p className="text-sm mt-1">Click "Add Tax Rate" above to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr>
                  <th className="text-left font-medium text-secondary">Name</th>
                  <th className="text-left font-medium text-secondary">Code</th>
                  <th className="text-left font-medium text-secondary">Rate</th>
                  <th className="text-left font-medium text-secondary">Type</th>
                  <th className="text-left font-medium text-secondary">Country</th>
                  <th className="text-left font-medium text-secondary">Compound</th>
                  <th className="text-right font-medium text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {taxRates.map((t) => (
                  <tr key={t.id} className="border-t border-color-subtle">
                    <td className="py-2 text-primary">{t.name}</td>
                    <td className="py-2 text-secondary">{t.code ?? "—"}</td>
                    <td className="py-2 text-secondary">{(Number(t.rate) * 100).toFixed(2)}%</td>
                    <td className="py-2 text-secondary">{t.type}</td>
                    <td className="py-2 text-secondary">{t.country_code ?? "All"}</td>
                    <td className="py-2 text-secondary">{t.is_compound ? "Yes" : "No"}</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => startEdit(t)}
                        className="text-xs font-medium text-primary-brand hover:text-primary-brand"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeRate(t.id)}
                        className="ml-2 text-xs font-medium status-error-text hover:status-error-text"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}




