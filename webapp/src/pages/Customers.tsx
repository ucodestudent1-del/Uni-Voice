import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "../contexts/SubscriptionContext";
import {
  getCustomers,
  archiveCustomer,
  restoreCustomer,
  createInvoice as apiCreateInvoice,
  exportCustomersCsv,
  type CustomerSearchParams,
} from "../api/client";
import FeatureGate from "../components/FeatureGate";
import UpgradePrompt from "../components/UpgradePrompt";
import CustomerStatusBadge from "../components/CustomerStatusBadge";
import CustomerForm from "../components/CustomerForm";
import CustomerImport from "../components/CustomerImport";
import CustomerQuickView from "../components/CustomerQuickView";
import { Plus, FileText, Upload, Download, Eye, Edit2, Archive, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import { getCustomerPrimaryContact, customerHasBalance } from "../utils/customer";
import type { ApiCustomer } from "../types/api";
import { Button } from "../components/ui/Button";

const STATUS_OPTIONS = [
  { value: "all", label: "All Customers" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "overdue", label: "Overdue (Has Balance)" },
  { value: "archived", label: "Archived" },
];

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "total_outstanding", label: "Outstanding" },
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
  const [quickViewCustomer, setQuickViewCustomer] = useState<ApiCustomer | null>(null);

  const currentParams: CustomerSearchParams = {
    limit,
    offset,
    search: search || undefined,
    status: statusFilter === "all" || statusFilter === "overdue" ? undefined : (statusFilter as any),
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

  async function handleExport() {
    try {
      const csv = await exportCustomersCsv();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "customers.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to export customers");
    }
  }

  function handleEdit(customer: ApiCustomer) {
    setEditingCustomer(customer);
    setShowForm(true);
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

  const totalOutstanding = customers.reduce(
    (sum, c) => sum + Number(c.totalOutstanding || 0),
    0
  );

  const effectiveRows =
    statusFilter === "overdue"
      ? customers.filter((c) => customerHasBalance(c))
      : customers;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-inverse">Customers</h1>
           <p className="text-sm text-secondary text-tertiary mt-1">
            {total} customers •{" "}
            <span className="text-primary font-medium">
              {totalOutstanding > 0
                ? formatCurrency(totalOutstanding.toString(), "USD")
                : formatCurrency(0, "USD")}
            </span>{" "}
            total outstanding
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FeatureGate feature="customers.import" requiredPlan="free" fallback={null}>
            <Button
              variant="secondary"
              size="md"
              icon={<Upload className="w-4 h-4" />}
              onClick={() => setShowImport(true)}
            >
              Import
            </Button>
          </FeatureGate>
          <FeatureGate feature="customers.export" requiredPlan="free" fallback={null}>
            <Button
              variant="secondary"
              size="md"
              icon={<Download className="w-4 h-4" />}
              onClick={handleExport}
            >
              Export
            </Button>
          </FeatureGate>
          <FeatureGate feature="customers.create" requiredPlan="free" fallback={null}>
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => { setShowForm(true); setEditingCustomer(null); }}
            >
              Add Customer
            </Button>
          </FeatureGate>
        </div>
      </div>

          <div className="bg-surface rounded-xl border border-color-subtle border-color p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Search customers by name, email, or company..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
                  className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
                  className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
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
                  className="w-full rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {SORT_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-secondary text-secondary">
                    <input
                      type="checkbox"
                      checked={includeArchived}
                      onChange={(e) => setIncludeArchived(e.target.checked)}
                      className="rounded border-input-border border-input-border text-primary-brand focus:ring-primary"
                    />
                    Show archived
                  </label>
                </div>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="rounded-lg border border-input-border border-input-border bg-surface-alt px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>
          </div>

      {error && (
        <div className="p-3 status-error-bg border status-error-border rounded-lg">
          <p className="text-sm status-error-text">{error}</p>
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

      {loading && customers.length === 0 ? (
        <div className="text-center py-20 text-secondary">Loading customers...</div>
      ) : effectiveRows.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-xl border border-color-subtle">
          <p className="mt-4 text-secondary">
            {search || statusFilter !== "all" ? "No matching customers found" : "No customers yet"}
          </p>
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowForm(true)}
            className="mt-2"
          >
            Add Customer
          </Button>
        </div>
      ) : (
        <>
          <div className="bg-surface rounded-xl border border-color-subtle border-color overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-color-subtle border-color">
                  <th className="text-left text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">Customer</th>
                  <th className="text-left text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">Contact</th>
                  <th className="text-center text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">Invoices</th>
                  <th className="text-right text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">Outstanding</th>
                  <th className="text-right text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">Last Invoice</th>
                  <th className="text-center text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">Status</th>
                  <th className="text-center text-xs font-medium text-secondary text-tertiary uppercase py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {effectiveRows.map((c) => {
                  const hasBalance = customerHasBalance(c);
                  return (
                     <tr
                       key={c.id}
                       className={`border-b border-color-subtle border-color last:border-b-0 hover:bg-surface-alt hover:bg-hover ${
                         hasBalance ? "border-l-2 border-l-red-400 status-error-bg/20" : ""
                       }`}
                     >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setQuickViewCustomer(c)}
                          className="text-left text-sm font-medium text-primary hover:text-primary-brand"
                          aria-label={`Quick view ${c.name}`}
                        >
                          {c.name}
                        </button>
                        {c.companyName && (
                          <p className="text-xs text-secondary">{c.companyName}</p>
                        )}
                        {!c.companyName && c.mostRecentInvoiceDate && (
                          <p className="text-xs text-tertiary">
                            Last activity: {formatDate(c.mostRecentInvoiceDate)}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-secondary">
                        {getCustomerPrimaryContact(c) ? (
                          <span className="break-all">{getCustomerPrimaryContact(c)}</span>
                        ) : (
                          <span className="text-tertiary">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-primary">
                        {c.invoiceCount ?? 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {hasBalance ? (
                          <span className="text-sm font-medium status-error-text">
                            {formatCurrency(c.totalOutstanding || "0", c.defaultCurrency || "USD")}
                          </span>
                        ) : (
                          <span className="text-sm text-tertiary">— paid</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-secondary">
                        {c.mostRecentInvoiceDate ? formatDate(c.mostRecentInvoiceDate) : <span className="text-tertiary">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <CustomerStatusBadge status={c.status} />
                      </td>
                       <td className="py-3 px-4">
                         <div className="flex items-center justify-center gap-1">
                           <Button
                             variant="ghost"
                             size="sm"
                             icon={<Eye className="w-3.5 h-3.5" />}
                             onClick={() => navigate(`/app/customers/${c.id}`)}
                             title="View customer"
                           />
                           <Button
                             variant="ghost"
                             size="sm"
                             icon={<Edit2 className="w-3.5 h-3.5" />}
                             onClick={() => handleEdit(c)}
                             title="Edit customer"
                           />
                           <FeatureGate feature="invoices.create" requiredPlan="free" fallback={null}>
                             <Button
                               variant="ghost"
                               size="sm"
                               icon={<FileText className="w-3.5 h-3.5" />}
                               onClick={() => handleCreateInvoice(c)}
                               disabled={creatingInvoiceFor === c.id}
                               title="Create invoice for this customer"
                               className="text-primary-brand text-primary-brand hover:text-primary-brand dark:hover:text-primary-brand"
                             >
                               {creatingInvoiceFor === c.id ? "..." : ""}
                             </Button>
                           </FeatureGate>
                           {c.status === "archived" ? (
                             <Button
                               variant="ghost"
                               size="sm"
                               icon={<RefreshCw className="w-3.5 h-3.5" />}
                               onClick={() => handleRestore(c)}
                               title="Restore customer"
                               className="text-primary-brand text-primary-brand hover:text-primary-brand dark:hover:text-primary-brand"
                             />
                           ) : (
                             <Button
                               variant="ghost"
                               size="sm"
                               icon={<Archive className="w-3.5 h-3.5" />}
                               onClick={() => handleArchive(c)}
                               title="Archive customer"
                               className="status-error-text hover:status-error-text"
                             />
                           )}
                         </div>
                       </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-secondary text-tertiary">
                Page {currentPage} of {totalPages} • {total} customers
              </p>
              <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1"
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1"
              >
                Next
              </Button>
              </div>
            </div>
          )}
        </>
      )}

      {plan && !plan.code && (
        <UpgradePrompt feature="customers" requiredPlan="free" />
      )}

      {quickViewCustomer && (
        <CustomerQuickView
          customerId={quickViewCustomer.id}
          customerName={quickViewCustomer.name}
          currency={quickViewCustomer.defaultCurrency || "USD"}
          onClose={() => setQuickViewCustomer(null)}
        />
      )}
    </div>
  );
}







