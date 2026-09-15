import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  getCustomers,
  archiveCustomer,
  restoreCustomer,
  createInvoice as apiCreateInvoice,
  type CustomerSearchParams,
} from "../api/client";
import FeatureGate from "../components/FeatureGate";
import UpgradePrompt from "../components/UpgradePrompt";
import CustomerStatusBadge from "../components/CustomerStatusBadge";
import CustomerForm from "../components/CustomerForm";
import CustomerImport from "../components/CustomerImport";
import { formatCurrency } from "../utils/format";
import { formatDate } from "../utils/format";
import type { ApiCustomer } from "../types/api";

const STATUS_OPTIONS = [
  { value: "all", label: "All Customers" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "created_at", label: "Created Date" },
  { value: "updated_at", label: "Updated Date" },
  { value: "email", label: "Email" },
  { value: "company_name", label: "Company" },
];

export default function Customers() {
  const { plan } = useSubscription();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<ApiCustomer | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [creatingInvoiceFor, setCreatingInvoiceFor] = useState<string | null>(null);

  const currentParams: CustomerSearchParams = {
    limit,
    offset,
    search: search || undefined,
    status: statusFilter === "all" ? undefined : (statusFilter as any),
    includeArchived: statusFilter === "archived" || includeArchived ? true : undefined,
    sortBy,
    sortOrder,
    enrich: true,
  };

  const loadCustomers = useCallback(async (params: CustomerSearchParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomers(params);
      const list = data.data ?? [];
      const enriched: ApiCustomer[] = list.map((c: any) => ({
        ...c,
        invoiceCount: c.invoiceCount ?? 0,
        totalOutstanding: c.totalOutstanding ?? "0",
        mostRecentInvoiceDate: c.mostRecentInvoiceDate ?? null,
      }));
      setCustomers(enriched);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load customers");
      setCustomers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers(currentParams);
  }, [loadCustomers, limit, offset, search, statusFilter, includeArchived, sortBy, sortOrder]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  function handlePage(page: number) {
    if (page < 1 || page > totalPages) return;
    setOffset((page - 1) * limit);
  }

  async function handleArchive(customer: ApiCustomer) {
    try {
      await archiveCustomer(customer.id);
      loadCustomers(currentParams);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to archive customer");
    }
  }

  async function handleRestore(customer: ApiCustomer) {
    try {
      await restoreCustomer(customer.id);
      loadCustomers(currentParams);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to restore customer");
    }
  }

  function handleEdit(customer: ApiCustomer) {
    setEditingCustomer(customer);
    setShowForm(true);
  }

  function handleView(customer: ApiCustomer) {
    navigate(`/app/customers/${customer.id}`);
  }

  async function handleCreateInvoice(customer: ApiCustomer) {
    setCreatingInvoiceFor(customer.id);
    try {
      const res = await apiCreateInvoice({
        customerId: customer.id,
        currency: customer.defaultCurrency || "USD",
        items: [{
          description: "",
          quantity: "1",
          unit: "each",
          unitPrice: "0.00",
          taxRate: "0",
          isTaxInclusive: false,
        }],
      });
      navigate(`/app/invoices/${res.invoiceId}/edit`);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create invoice");
    } finally {
      setCreatingInvoiceFor(null);
    }
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingCustomer(null);
  }

  function handleSaved() {
    setShowForm(false);
    setEditingCustomer(null);
    loadCustomers(currentParams);
  }

  const totalOutstanding = customers.reduce((sum, c) => sum + Number(c.totalOutstanding || 0), 0);

  if (loading && customers.length === 0) {
    return <div className="text-center py-20 text-slate-500">Loading customers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-600 mt-1">
            {total} customers • <span className="text-slate-900">{formatCurrency(totalOutstanding.toString(), "USD")}</span> total outstanding
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FeatureGate feature="customers.import" requiredPlan="free" fallback={null}>
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Import
            </button>
          </FeatureGate>
          <FeatureGate feature="customers.create" requiredPlan="free" fallback={null}>
            <button
              onClick={() => { setShowForm(true); setEditingCustomer(null); }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              + Add Customer
            </button>
          </FeatureGate>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Show archived
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          onClose={handleCloseForm}
          onSaved={handleSaved}
        />
      )}

      {showImport && (
        <CustomerImport
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); loadCustomers(currentParams); }}
        />
      )}

      {customers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <p className="mt-4 text-slate-500">
            {search || statusFilter !== "all" ? "No matching customers found" : "No customers yet"}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Add Customer
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Customer</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Contact</th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Invoices</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase py-3 px-4">Outstanding</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase py-3 px-4">Last Invoice</th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Status</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-slate-900">{c.name}</p>
                      {c.companyName && <p className="text-xs text-slate-500">{c.companyName}</p>}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {c.email && <p>{c.email}</p>}
                      {c.phone && <p>{c.phone}</p>}
                      {!c.email && !c.phone && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-slate-900">{c.invoiceCount ?? 0}</td>
                    <td className="py-3 px-4 text-right">
                      {Number(c.totalOutstanding || 0) > 0
                        ? formatCurrency(c.totalOutstanding || "0", c.defaultCurrency || "USD")
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-slate-600">
                      {c.mostRecentInvoiceDate ? formatDate(c.mostRecentInvoiceDate) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <CustomerStatusBadge status={c.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleView(c)}
                          className="text-xs text-slate-600 hover:text-slate-900"
                          title="View"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleEdit(c)}
                          className="text-xs text-slate-600 hover:text-slate-900"
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleCreateInvoice(c)}
                          disabled={creatingInvoiceFor === c.id}
                          className="text-xs text-primary-600 hover:text-primary-700"
                          title="Create Invoice"
                        >
                          {creatingInvoiceFor === c.id ? "..." : "Invoice"}
                        </button>
                        {c.status === "archived" ? (
                          <button
                            onClick={() => handleRestore(c)}
                            className="text-xs text-primary-600 hover:text-primary-700"
                            title="Restore"
                          >
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchive(c)}
                            className="text-xs text-red-500 hover:text-red-700"
                            title="Archive"
                          >
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page {currentPage} of {totalPages} • {total} customers
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {plan && !plan.code && (
        <UpgradePrompt feature="customers" requiredPlan="free" />
      )}
    </div>
  );
}
