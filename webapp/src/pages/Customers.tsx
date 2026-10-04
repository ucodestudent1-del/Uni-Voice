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
import { Plus, FileText, Upload, Download, Eye, Edit2, Archive, RefreshCw, MoreVertical, Search, Clock, Mail, Phone, Users } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import { getCustomerPrimaryContact, customerHasBalance, customerHasOverdue } from "../utils/customer";
import type { ApiCustomer } from "../types/api";
import { Button } from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { cn } from "../lib/utils";
import type { NavigateFunction } from "react-router-dom";

interface CustomerActionMenuProps {
  customer: ApiCustomer;
  hasOverdue: boolean;
  isCreating: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onNavigate: NavigateFunction;
  onEdit: (customer: ApiCustomer) => void;
  onArchive: (customer: ApiCustomer) => void;
  onRestore: (customer: ApiCustomer) => void;
  onCreateInvoice: (customer: ApiCustomer) => void;
  align?: "left" | "right";
}

function CustomerActionMenu({
  customer,
  isOpen,
  onToggle,
  onClose,
  onNavigate,
  onEdit,
  onArchive,
  onRestore,
  onCreateInvoice,
  isCreating,
  align = "right",
}: CustomerActionMenuProps) {
  return (
    <div className="relative flex justify-end">
      <Button
        variant="ghost"
        size="sm"
        icon={<MoreVertical className="h-4 w-4" />}
        onClick={onToggle}
        aria-label={`More actions for ${customer.name}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="px-2"
      />
      {isOpen && (
        <div
          data-action-menu={customer.id}
          role="menu"
          aria-label={`Actions for ${customer.name}`}
           className={cn(
             "menu-box min-w-[14rem]",
             align === "right" ? "right-0" : "left-0"
           )}
        >
          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => { onClose(); onNavigate(`/app/customers/${customer.id}`); }}
              className="menu-item"
            >
              <Eye className="h-4 w-4" />
              View Profile
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { onClose(); onEdit(customer); }}
              className="menu-item"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </button>
            <FeatureGate feature="invoices.create" requiredPlan="pro" fallback={null}>
              <button
                type="button"
                role="menuitem"
                onClick={() => { onClose(); onCreateInvoice(customer); }}
                disabled={isCreating}
                className="menu-item disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                {isCreating ? "Creating…" : "Create Invoice"}
              </button>
            </FeatureGate>
            <div className="menu-divider border-t" />
            {customer.status === "archived" ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => { onClose(); onRestore(customer); }}
                className="menu-item menu-item-danger"
              >
                <RefreshCw className="h-4 w-4" />
                Restore
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => { onClose(); onArchive(customer); }}
                className="menu-item menu-item-danger"
              >
                <Archive className="h-4 w-4" />
                Archive
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Customers" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "overdue", label: "Overdue" },
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
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

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
         totalOverdue: c.totalOverdue ?? "0",
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const openMenu = document.querySelector(`[data-action-menu="${actionMenuOpenId}"]`);
      if (actionMenuOpenId && openMenu && !openMenu.contains(target)) {
        setActionMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [actionMenuOpenId]);

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
      ? customers.filter((c) => customerHasOverdue(c))
      : customers;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-inverse">Customers</h1>
            <p className="text-sm text-secondary mt-1">
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

          <div className="filter-container">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
              <div className="lg:col-span-4">
                <label className="filter-label-secondary">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or company…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
                    className="filter-input pl-12"
                  />
                </div>
              </div>
              <div className="lg:col-span-3">
                <label className="filter-label-secondary">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
                  className="filter-select"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="filter-label-secondary">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="filter-select"
                >
                  {SORT_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-1.5">
                <label className="filter-label-secondary">Direction</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="filter-select"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
              <div className="lg:col-span-1.5 flex items-end">
                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(e) => setIncludeArchived(e.target.checked)}
                    className="rounded border-input-border text-primary-brand focus:ring-primary"
                  />
                  Show archived
                </label>
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
        <EmptyState variant="loading" title="Loading customers…" />
      ) : effectiveRows.length === 0 ? (
        <div className="bg-surface rounded-xl border border-color-subtle">
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title={search || statusFilter !== "all" ? "No matching customers found" : "No customers yet"}
            description={search || statusFilter !== "all" ? "Try adjusting your search or filters." : "Get started by adding your first customer."}
            actionLabel="Add Customer"
            onAction={() => setShowForm(true)}
          />
        </div>
      ) : (
        <>
          <div className="bg-surface rounded-xl border border-color-subtle border-color overflow-hidden">
            {/* Desktop table — hidden on small screens */}
            <table className="w-full table-fixed table-zebra hidden sm:table">
              <thead>
                <tr className="border-b border-color-subtle border-color bg-surface-alt/50">
                   <th className="text-left text-xs font-medium text-tertiary uppercase py-3 px-4 min-w-[180px]">Customer</th>
                   <th className="text-left text-xs font-medium text-tertiary uppercase py-3 px-4 min-w-[200px]">Contact</th>
                   <th className="text-center text-xs font-medium text-tertiary uppercase py-3 px-4 w-[80px]">Invoices</th>
                   <th className="text-right text-xs font-medium text-tertiary uppercase py-3 px-4 w-[130px]">Outstanding</th>
                   <th className="text-right text-xs font-medium text-tertiary uppercase py-3 px-4 w-[130px]">Last Invoice</th>
                   <th className="text-center text-xs font-medium text-tertiary uppercase py-3 px-4 w-[100px]">Status</th>
                   <th className="text-center text-xs font-medium text-tertiary uppercase py-3 px-2 w-[50px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {effectiveRows.map((c) => {
                  const hasBalance = customerHasBalance(c);
                  const hasOverdue = customerHasOverdue(c);
                  const isSelected = quickViewCustomer?.id === c.id;
                  const isCreating = creatingInvoiceFor === c.id;
                  return (
                     <tr
                        key={c.id}
                        aria-current={isSelected ? "true" : undefined}
                        className={`border-b border-color-subtle border-color last:border-b-0 ${
                          isSelected
                            ? "bg-primary-bg"
                            : hasOverdue
                            ? "border-l-2 border-l-error-text"
                            : ""
                        }`}
                      >
                        <td className="py-3.5 pr-4 align-top">
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-alt text-xs font-medium text-secondary ring-1 ring-color-subtle">
                              {c.name?.charAt(0)?.toUpperCase() ?? "?"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => setQuickViewCustomer(c)}
                                aria-label={`Show details for ${c.name}`}
                                className="text-left text-sm font-medium text-primary hover:text-primary-brand hover:underline"
                              >
                                <span className="truncate block">{c.name}</span>
                              </button>
                              {c.companyName ? (
                                <p className="text-xs text-tertiary mt-0.5 truncate">{c.companyName}</p>
                              ) : c.mostRecentInvoiceDate ? (
                                <p className="text-xs text-tertiary mt-0.5 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatDate(c.mostRecentInvoiceDate)}</span>
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                       <td className="py-3.5 pr-4 align-top">
                         {getCustomerPrimaryContact(c) ? (
                          <div className="text-sm text-secondary space-y-0.5">
                            {c.email && (
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3 h-3 text-tertiary flex-shrink-0" />
                                <span className="truncate break-all">{c.email}</span>
                              </div>
                            )}
                            {c.phone && (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-tertiary flex-shrink-0" />
                                <span className="truncate">{c.phone}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-tertiary text-sm">—</span>
                        )}
                       </td>
                        <td className="py-3.5 px-4 text-center text-sm text-primary align-top">
                         {c.invoiceCount ?? 0}
                       </td>
                       <td className="py-3.5 px-4 text-right align-top">
                         {hasBalance ? (
                           hasOverdue ? (
                             <span className="text-sm font-medium font-tabular-nums status-error-text">
                               {formatCurrency(c.totalOverdue || "0", c.defaultCurrency || "USD")}
                             </span>
                           ) : (
                             <span className="text-sm text-secondary font-tabular-nums">
                               {formatCurrency(c.totalOutstanding || "0", c.defaultCurrency || "USD")}
                             </span>
                           )
                         ) : (
                           <span className="text-sm text-tertiary">— paid</span>
                         )}
                       </td>
                       <td className="py-3.5 px-4 text-right text-sm text-secondary align-top">
                         {c.mostRecentInvoiceDate ? formatDate(c.mostRecentInvoiceDate) : <span className="text-tertiary">—</span>}
                       </td>
                       <td className="py-3.5 px-4 text-center align-top">
                         <CustomerStatusBadge status={c.status} />
                       </td>
                        <td className="py-3.5 px-2 align-top">
                          <CustomerActionMenu
                            customer={c}
                            hasOverdue={hasOverdue}
                            isCreating={isCreating}
                            isOpen={actionMenuOpenId === c.id}
                            onToggle={() => setActionMenuOpenId(actionMenuOpenId === c.id ? null : c.id)}
                            onClose={() => setActionMenuOpenId(null)}
                            onNavigate={navigate}
                            onEdit={handleEdit}
                            onArchive={handleArchive}
                            onRestore={handleRestore}
                            onCreateInvoice={handleCreateInvoice}
                          />
                        </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>

            {/* Mobile cards — visible only on small screens */}
            <div className="sm:hidden">
              {effectiveRows.map((c) => {
                const hasBalance = customerHasBalance(c);
                const hasOverdue = customerHasOverdue(c);
                const isSelected = quickViewCustomer?.id === c.id;
                const isCreating = creatingInvoiceFor === c.id;
                return (
                  <div
                    key={c.id}
                    aria-current={isSelected ? "true" : undefined}
                    className={`border-b border-color-subtle border-color last:border-b-0 ${isSelected ? "bg-primary-bg" : hasOverdue ? "bg-error-bg/20" : ""}`}
                  >
                    <div className="flex items-start justify-between p-4 gap-2">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-alt text-xs font-medium text-secondary ring-1 ring-color-subtle">
                          {c.name?.charAt(0)?.toUpperCase() ?? "?"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => setQuickViewCustomer(c)}
                            aria-label={`Show details for ${c.name}`}
                            className="text-left text-sm font-medium text-primary hover:text-primary-brand hover:underline"
                          >
                            <span className="truncate block">{c.name}</span>
                          </button>
                          <div className="mt-0.5 space-y-0.5">
                            {c.companyName && <p className="text-xs text-tertiary truncate">{c.companyName}</p>}
                            {c.email && (
                              <p className="text-xs text-tertiary truncate">{c.email}</p>
                            )}
                            {c.mostRecentInvoiceDate && (
                              <p className="text-xs text-tertiary flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatDate(c.mostRecentInvoiceDate)}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <CustomerActionMenu
                        customer={c}
                        hasOverdue={hasOverdue}
                        isCreating={isCreating}
                        isOpen={actionMenuOpenId === c.id}
                        onToggle={() => setActionMenuOpenId(actionMenuOpenId === c.id ? null : c.id)}
                        onClose={() => setActionMenuOpenId(null)}
                        onNavigate={navigate}
                        onEdit={handleEdit}
                        onArchive={handleArchive}
                        onRestore={handleRestore}
                        onCreateInvoice={handleCreateInvoice}
                        align="right"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 pb-3 text-sm">
                      <div>
                        <span className="text-xs text-tertiary">Invoices</span>
                        <span className="text-sm text-primary ml-1">{c.invoiceCount ?? 0}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-tertiary">Outstanding</span>
                        <span className={cn("ml-1 font-tabular-nums", hasBalance ? (hasOverdue ? "status-error-text font-medium" : "text-secondary") : "text-tertiary")}>
                          {hasBalance
                            ? formatCurrency(hasOverdue ? (c.totalOverdue || "0") : (c.totalOutstanding || "0"), c.defaultCurrency || "USD")
                            : "— paid"}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-tertiary">Last Invoice</span>
                        <span className="text-sm text-secondary ml-1">
                          {c.mostRecentInvoiceDate ? formatDate(c.mostRecentInvoiceDate) : "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-tertiary">Status</span>
                        <span className="ml-1"><CustomerStatusBadge status={c.status} /></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

           {totalPages > 1 && (
             <div className="flex items-center justify-between mt-4 pt-4 border-t border-color-subtle">
                <p className="text-sm text-secondary">
                  Page {currentPage} of {totalPages} • {total} customers
                </p>
               <div className="flex items-center gap-2">
               <Button
                 variant="secondary"
                 size="sm"
                 onClick={() => handlePage(currentPage - 1)}
                 disabled={currentPage === 1}
               >
                 Previous
               </Button>
               <Button
                 variant="secondary"
                 size="sm"
                 onClick={() => handlePage(currentPage + 1)}
                 disabled={currentPage === totalPages}
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
          customer={quickViewCustomer}
          onClose={() => setQuickViewCustomer(null)}
          onEdit={(c) => {
            setQuickViewCustomer(null);
            handleEdit(c);
          }}
        />
      )}
    </div>
  );
}







