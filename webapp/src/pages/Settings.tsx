import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBusiness, updateBusiness as apiUpdateBusiness, getNumberingConfig, updateNumberingConfig as apiUpdateNumberingConfig, getFeatures } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import SubscriptionCard from "../components/SubscriptionCard";
import TwoFactorManager from "../components/TwoFactorManager";
import type { ApiBusiness, FeatureFlag } from "../types/api";

export type SettingsTab = "business" | "numbering" | "subscription" | "security";

export default function Settings({ defaultTab = "business" }: { defaultTab?: SettingsTab }) {
  const { user } = useAuth();
  const { plan } = useSubscription();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);
  const [numbering, setNumbering] = useState<any>(null);
  const [features, setFeatures] = useState<FeatureFlag[]>([]);

  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", website: "", defaultCurrency: "USD",
    taxId: "", addressLine1: "", addressLine2: "", city: "",
    stateOrRegion: "", postalCode: "", countryCode: "US",
  });

  const [numberingData, setNumberingData] = useState({
    prefix: "INV",
    padding: 6,
    includesYear: true,
  });

  useEffect(() => {
    Promise.all([loadBusiness(), loadNumbering(), loadFeatures()]);
  }, []);

  async function loadBusiness() {
    try {
      const data = await getBusiness();
      setBusiness(data.business);
      setFormData({
        name: data.business.name || "",
        email: data.business.email || "",
        phone: data.business.phone || "",
        website: data.business.website || "",
        defaultCurrency: data.business.default_currency || "USD",
        taxId: data.business.tax_id || "",
        addressLine1: data.business.address_line_1 || "",
        addressLine2: data.business.address_line_2 || "",
        city: data.business.city || "",
        stateOrRegion: data.business.state_or_region || "",
        postalCode: data.business.postal_code || "",
        countryCode: data.business.country_code || "US",
      });
    } catch {}
  }

  async function loadNumbering() {
    try {
      const data = await getNumberingConfig();
      if (data.sequence) {
        setNumbering(data.sequence);
        setNumberingData({
          prefix: data.sequence.prefix,
          padding: data.sequence.padding,
          includesYear: data.sequence.includes_year,
        });
      }
    } catch {}
  }

  async function loadFeatures() {
    try {
      const data = await getFeatures();
      setFeatures(data.features ?? []);
    } catch {}
  }

  async function handleBusinessSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiUpdateBusiness(formData);
      alert("Settings saved!");
      loadBusiness();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleNumberingSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiUpdateNumberingConfig({
        prefix: numberingData.prefix,
        padding: numberingData.padding,
        includes_year: numberingData.includesYear,
      });
      alert("Numbering settings saved!");
      loadNumbering();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save numbering");
    }
  }

  useEffect(() => {
    if (!loading) return;
    setLoading(false);
  }, [loading]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("business")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "business"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Business
        </button>
        <button
          onClick={() => setActiveTab("numbering")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "numbering"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Numbering
        </button>
        <button
          onClick={() => setActiveTab("subscription")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "subscription"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Subscription
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "security"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Security
        </button>
      </div>

      {activeTab === "business" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Business Profile</h3>
          <form onSubmit={handleBusinessSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tax ID</label>
                <input
                  type="text"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Currency</label>
                <select
                  value={formData.defaultCurrency}
                  onChange={(e) => setFormData({ ...formData, defaultCurrency: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  placeholder="Street address"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="City"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.stateOrRegion}
                  onChange={(e) => setFormData({ ...formData, stateOrRegion: e.target.value })}
                  placeholder="State / Region"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  placeholder="Postal code"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <select
                  value={formData.countryCode}
                  onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="US">United States</option>
                  <option value="GB">United Kingdom</option>
                  <option value="CA">Canada</option>
                  <option value="AU">Australia</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="NL">Netherlands</option>
                  <option value="JP">Japan</option>
                  <option value="IN">India</option>
                  <option value="BR">Brazil</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "numbering" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Invoice Numbering</h3>
          <form onSubmit={handleNumberingSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prefix</label>
                <input
                  type="text"
                  value={numberingData.prefix}
                  onChange={(e) => setNumberingData({ ...numberingData, prefix: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Padding</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={numberingData.padding}
                  onChange={(e) => setNumberingData({ ...numberingData, padding: parseInt(e.target.value) || 6 })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={numberingData.includesYear}
                    onChange={(e) => setNumberingData({ ...numberingData, includesYear: e.target.checked })}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  Include year (e.g. INV-2026-000001)
                </label>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Save Numbering
              </button>
            </div>
          </form>
          {numbering && (
            <div className="mt-4 text-sm text-slate-500">
              Next number: <span className="font-medium text-slate-900">{numbering.next_number}</span>
            </div>
          )}
        </div>
      )}

      {activeTab === "subscription" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Current Plan</h3>
            <SubscriptionCard onUpgrade={() => navigate("/app/plans")} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Plan Features</h3>
            <div className="space-y-2">
              {features.map((f) => (
                <div key={f.code} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-700">{f.name}</span>
                  {f.is_premium && f.requires_plan && (
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                      {f.requires_plan}+
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Authentication</h3>
          <TwoFactorManager />
        </div>
      )}
    </div>
  );
}
