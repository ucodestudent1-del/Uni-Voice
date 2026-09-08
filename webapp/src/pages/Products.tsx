import { useEffect, useState } from "react";
import { getProducts, createProduct as apiCreateProduct, deleteProduct as apiDeleteProduct, updateProduct as apiUpdateProduct } from "../api/client";

interface Product {
  id: string;
  name: string;
  description?: string;
  default_unit_price: string;
  default_tax_rate: string;
  unit: string;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", defaultUnitPrice: 0, defaultTaxRate: 0, unit: "each" });

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const data = await getProducts({ limit: 200 });
      setProducts(data.products ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiCreateProduct({
        name: formData.name,
        description: formData.description || null,
        defaultUnitPrice: formData.defaultUnitPrice,
        defaultTaxRate: formData.defaultTaxRate,
        unit: formData.unit,
        defaultCurrency: "USD",
      });
      setShowForm(false);
      setFormData({ name: "", description: "", defaultUnitPrice: 0, defaultTaxRate: 0, unit: "each" });
      loadProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create product");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    try {
      await apiDeleteProduct(id);
      loadProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete");
    }
  }

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Products / Services</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? "Cancel" : "Add Product"}
        </button>
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
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Unit Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.defaultUnitPrice}
                  onChange={(e) => setFormData({ ...formData, defaultUnitPrice: parseFloat(e.target.value) || 0 })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tax Rate (0-1)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.defaultTaxRate}
                  onChange={(e) => setFormData({ ...formData, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>
            </div>
            <button type="submit" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
              Add Product
            </button>
          </form>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {products.map((prod) => (
            <li key={prod.id}>
              <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">{prod.name}</p>
                  <p className="text-sm text-gray-500">
                    {prod.description} · ${Number(prod.default_unit_price).toFixed(2)} / {prod.unit} · Tax: {(Number(prod.default_tax_rate) * 100).toFixed(1)}%
                  </p>
                </div>
                <button onClick={() => handleDelete(prod.id)} className="text-sm text-red-600 hover:text-red-500">Delete</button>
              </div>
            </li>
          ))}
          {products.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">No products yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
