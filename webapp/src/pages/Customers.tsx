import { useEffect, useState } from "react";
import { useSubscription } from "../contexts/SubscriptionContext";
import { getCustomers, createCustomer as apiCreateCustomer, deleteCustomer as apiDeleteCustomer, updateCustomer as apiUpdateCustomer } from "../api/client";
import FeatureGate from "../components/FeatureGate";
import UpgradePrompt from "../components/UpgradePrompt";
import type { ApiCustomer } from "../types/api";

export default function Customers() {
  const { plan } = useSubscription();
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<ApiCustomer | null>(null);
  const [formData, setFormData] = useState({
    name: "", email: "", companyName: "", phone: "",
    addressLine1: "", addressLine2: "", city: "", stateOrRegion: "",
    postalCode: "", countryCode: "US", notes: "",
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      const data = await getCustomers({ limit: 200 });
      setCustomers(data.customers ?? []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await apiUpdateCustomer(editingCustomer.id, formData);
      } else {
        await apiCreateCustomer(formData);
      }
      setShowForm(false);
      setEditingCustomer(null);
      setFormData({
        name: "", email: "", companyName: "", phone: "",
        addressLine1: "", addressLine2: "", city: "", stateOrRegion: "",
        postalCode: "", countryCode: "US", notes: "",
      });
      loadCustomers();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save customer");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this customer?")) return;
    try {
      await apiDeleteCustomer(id);
      loadCustomers();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete");
    }
  }

  function handleEdit(customer: ApiCustomer) {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || "",
      companyName: customer.company_name || "",
      phone: customer.phone || "",
      addressLine1: customer.address_line_1 || "",
      addressLine2: customer.address_line_2 || "",
      city: customer.city || "",
      stateOrRegion: customer.state_or_region || "",
      postalCode: customer.postal_code || "",
      countryCode: customer.country_code || "US",
      notes: customer.notes || "",
    });
    setShowForm(true);
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Loading customers...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-600 mt-1">{customers.length} customers</p>
        </div>
        <FeatureGate feature="customers.create" requiredPlan="free">
          <button
            onClick={() => { setShowForm(true); setEditingCustomer(null); }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            + Add Customer
          </button>
        </FeatureGate>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingCustomer ? "Edit Customer" : "Add Customer"}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
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
                    <option value="US">US</option>
                    <option value="GB">GB</option>
                    <option value="CA">CA</option>
                    <option value="AU">AU</option>
                    <option value="DE">DE</option>
                    <option value="FR">FR</option>
                    <option value="ES">ES</option>
                    <option value="IT">IT</option>
                    <option value="NL">NL</option>
                    <option value="JP">JP</option>
                    <option value="IN">IN</option>
                    <option value="BR">BR</option>
                    <option value="MX">MX</option>
                    <option value="SG">SG</option>
                    <option value="CH">CH</option>
                  </select>
                </div>
              </div>
            </form>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingCustomer(null); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="customer-form"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
              >
                {editingCustomer ? "Update" : "Add Customer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {customers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a6 6 0 00-6 6h12a6 6 0 00-6-6z" />
          </svg>
          <p className="mt-4 text-slate-500">No customers yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Add Customer
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Name</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Email</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Company</th>
                <th className="text-right text-xs font-medium text-slate-500 uppercase py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium text-slate-900">{c.name}</p>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600">{c.email || "—"}</td>
                  <td className="py-3 px-4 text-sm text-slate-600">{c.company_name || "—"}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleEdit(c)}
                      className="text-xs text-slate-600 hover:text-slate-900 mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs text-red-500 hover:text-red-700"
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
  );
}
