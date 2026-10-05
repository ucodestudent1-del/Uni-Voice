import { useEffect, useState } from "react";
import { Edit2, Trash2, Plus, FileText, Receipt, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getProducts, createProduct as apiCreateProduct, deleteProduct as apiDeleteProduct, updateProduct as apiUpdateProduct, createInvoiceFromProduct, createQuoteFromProduct, createCreditNoteFromProduct } from "../api/client";
import type { ApiProduct } from "../types/api";
import { Button } from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { useToast } from "../components/ui/ToastProvider";

export default function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ApiProduct | null>(null);
  const [formData, setFormData] = useState({
    name: "", description: "", sku: "", defaultUnitPrice: 0,
    defaultTaxRate: 0, unit: "each", defaultCurrency: "USD",
  });

  const { toast } = useToast();

  const handleCreateInvoice = async (product: ApiProduct) => {
    try {
      const res = await createInvoiceFromProduct(product.id);
      navigate(`/app/invoices/${res.invoiceId}/edit`);
    } catch {
      toast("Failed to create invoice from product", { type: "error" });
    }
  };

  const handleCreateQuote = async (product: ApiProduct) => {
    try {
      const res = await createQuoteFromProduct(product.id);
      navigate(`/app/quotes/${res.quoteId}`);
    } catch {
      toast("Failed to create quote from product", { type: "error" });
    }
  };

  const handleCreateCreditNote = async (product: ApiProduct) => {
    try {
      await createCreditNoteFromProduct(product.id);
      toast("Credit note created. You can edit it from the Credit Notes page.", { type: "success" });
      navigate(`/app/credit-notes`);
    } catch {
      toast("Failed to create credit note from product", { type: "error" });
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const data = await getProducts({ limit: 200 });
      setProducts(data.products ?? []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingProduct) {
        await apiUpdateProduct(editingProduct.id, formData);
      } else {
        await apiCreateProduct(formData);
      }
      setShowForm(false);
      setEditingProduct(null);
      setFormData({ name: "", description: "", sku: "", defaultUnitPrice: 0, defaultTaxRate: 0, unit: "each", defaultCurrency: "USD" });
      loadProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save product");
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

  function handleEdit(product: ApiProduct) {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      sku: product.sku || "",
      defaultUnitPrice: parseFloat(product.defaultUnitPrice),
      defaultTaxRate: parseFloat(product.defaultTaxRate),
      unit: product.unit,
      defaultCurrency: product.defaultCurrency,
    });
    setShowForm(true);
  }

  if (loading) return <div className="text-center py-20 text-secondary">Loading products...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Products / Services</h1>
          <p className="text-sm text-secondary mt-1">{products.length} products</p>
        </div>
        <Button
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setShowForm(true)}
        >
          Add Product
        </Button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-color-subtle">
              <h3 className="text-lg font-semibold text-primary">
                {editingProduct ? "Edit Product" : "Add Product"}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-secondary mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Unit Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.defaultUnitPrice}
                    onChange={(e) => setFormData({ ...formData, defaultUnitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Default Tax Rate</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.defaultTaxRate}
                    onChange={(e) => setFormData({ ...formData, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-tertiary mt-0.5">e.g. 0.1 for 10%</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="each">Each</option>
                    <option value="hour">Hour</option>
                    <option value="day">Day</option>
                    <option value="month">Month</option>
                    <option value="week">Week</option>
                    <option value="year">Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Currency</label>
                  <select
                    value={formData.defaultCurrency}
                    onChange={(e) => setFormData({ ...formData, defaultCurrency: e.target.value })}
                    className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                    <option value="CAD">CAD</option>
                    <option value="AUD">AUD</option>
                  </select>
                </div>
              </div>
            </form>
            <div className="p-6 border-t border-color-subtle flex justify-end gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => { setShowForm(false); setEditingProduct(null); }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
              >
                {editingProduct ? "Update" : "Add Product"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add your first product or service to start building your catalog."
          actionLabel="Add Product"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="bg-surface rounded-xl border border-color-subtle overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-color-subtle">
                <th className="text-left text-xs font-medium text-secondary uppercase py-3 px-4">Name</th>
                <th className="text-left text-xs font-medium text-secondary uppercase py-3 px-4">SKU</th>
                <th className="text-right text-xs font-medium text-secondary uppercase py-3 px-4">Price</th>
                <th className="text-right text-xs font-medium text-secondary uppercase py-3 px-4">Tax Rate</th>
                <th className="text-right text-xs font-medium text-secondary uppercase py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-color-subtle last:border-b-0 hover:bg-surface-alt">
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium text-primary">{p.name}</p>
                    {p.description && <p className="text-xs text-secondary">{p.description}</p>}
                  </td>
                  <td className="py-3 px-4 text-sm text-secondary">{p.sku || "—"}</td>
                  <td className="py-3 px-4 text-right text-sm font-medium text-primary">${parseFloat(p.defaultUnitPrice).toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-sm text-secondary">{(parseFloat(p.defaultTaxRate) * 100).toFixed(0)}%</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<FileText className="w-3.5 h-3.5" />}
                        onClick={() => handleCreateInvoice(p)}
                        title="Create invoice from this product"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Receipt className="w-3.5 h-3.5" />}
                        onClick={() => handleCreateQuote(p)}
                        title="Create quote from this product"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<CreditCard className="w-3.5 h-3.5" />}
                        onClick={() => handleCreateCreditNote(p)}
                        title="Create credit note from this product"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Edit2 className="w-3.5 h-3.5" />}
                        onClick={() => handleEdit(p)}
                        title="Edit product"
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        onClick={() => handleDelete(p.id)}
                        title="Delete product"
                      />
                    </div>
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




