import { useEffect, useState } from "react";
import { useSubscription } from "../contexts/SubscriptionContext";
import { getCustomers, createCustomer as apiCreateCustomer, deleteCustomer as apiDeleteCustomer, updateCustomer as apiUpdateCustomer } from "../api/client";
import FeatureGate from "../components/FeatureGate";
import UpgradePrompt from "../components/UpgradePrompt";

interface Customer {
  id: string;
  name: string;
  email?: string;
  company_name?: string;
  created_at: string;
}

export default function Customers() {
  const { plan } = useSubscription();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", companyName: "" });

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      const data = await getCustomers({ limit: 200 });
      setCustomers(data.customers ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiCreateCustomer({
        name: formData.name,
        email: formData.email || null,
        companyName: formData.companyName || null,
        addressLine1: "",
        city: "",
        stateOrRegion: "",
        postalCode: "",
        countryCode: "US",
      });
      setShowForm(false);
      setFormData({ name: "", email: "", companyName: "" });
      loadCustomers();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create customer");
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

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
        <FeatureGate feature="customers.create" requiredPlan="free">
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            {showForm ? "Cancel" : "Add Customer"}
          </button>
        </FeatureGate>
      </div>

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Company Name</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
              />
            </div>
            <button type="submit" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
              Add Customer
            </button>
          </form>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {customers.map((cust) => (
            <li key={cust.id}>
              <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">{cust.name}</p>
                  <p className="text-sm text-gray-500">{cust.email} {cust.company_name ? `· ${cust.company_name}` : ""}</p>
                </div>
                <button onClick={() => handleDelete(cust.id)} className="text-sm text-red-600 hover:text-red-500">Delete</button>
              </div>
            </li>
          ))}
          {customers.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">No customers yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
