import { useEffect, useState, useRef } from "react";
import { getCustomers, createCustomer, type CustomerSearchParams } from "../api/client";
import type { ApiCustomer } from "../types/api";
import { validateCustomerForm, type CustomerFormValues } from "../schemas/customer";

interface CustomerSelectorProps {
  value?: string;
  onChange: (customerId: string | undefined) => void;
  onCustomerChange?: (customer: ApiCustomer | undefined) => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 300;

export default function CustomerSelector({ value, onChange, onCustomerChange, placeholder = "Select a customer" }: CustomerSelectorProps) {
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [createForm, setCreateForm] = useState<{ name: string; email: string; countryCode: string } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadCustomers({});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreateMode(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadCustomers(params: CustomerSearchParams) {
    setLoading(true);
    try {
      const data = await getCustomers(params);
      setCustomers(data.customers ?? data.data ?? []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }

  const selected = customers.find((c) => c.id === value);

  function handleSearchChange(term: string) {
    setSearchTerm(term);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadCustomers({ search: term, limit: 100, includeArchived: false });
    }, DEBOUNCE_MS);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    if (!createForm) return;

    try {
      validateCustomerForm(createForm);
    } catch (e: any) {
      setCreateError(e.errors?.[0]?.message || "Invalid form");
      return;
    }

    setCreateLoading(true);
    try {
      const res = await createCustomer(createForm);
      const newCustomer = res.customer;
      const updated = [...customers, newCustomer];
      setCustomers(updated);
      onChange(newCustomer.id);
      onCustomerChange?.(newCustomer);
      setCreateMode(false);
      setCreateForm(null);
      setCreateError(null);
      setOpen(false);
    } catch (err: any) {
      setCreateError(err.response?.data?.error || "Failed to create customer");
    } finally {
      setCreateLoading(false);
    }
  }

  const selectedDisplay = selected ? `${selected.name}${selected.email ? ` (${selected.email})` : ""}` : placeholder;

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center justify-between w-full px-3 py-2 border border-input-border rounded-lg bg-surface cursor-pointer focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500"
        onClick={() => { setOpen(!open); setCreateMode(false); }}
      >
        <span className="text-sm text-primary truncate" title={selectedDisplay}>
          {selectedDisplay}
        </span>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface border border-color-subtle rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {createMode ? (
            <div className="p-3 border-b border-color-subtle">
              <form onSubmit={handleCreate} className="space-y-2">
                <input
                  type="text"
                  placeholder="Customer name *"
                  required
                  value={createForm?.name ?? ""}
                  onChange={(e) => setCreateForm((prev) => prev ? { ...prev, name: e.target.value } : { name: e.target.value, email: "", countryCode: "US" })}
                  className="w-full px-2 py-1 text-sm border border-input-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={createForm?.email ?? ""}
                  onChange={(e) => setCreateForm((prev) => prev ? { ...prev, email: e.target.value } : { name: "", email: e.target.value, countryCode: "US" })}
                  className="w-full px-2 py-1 text-sm border border-input-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {createError && <p className="text-xs status-error-text">{createError}</p>}
                <button
                  type="submit"
                  disabled={createLoading}
                  className="w-full px-2 py-1 text-sm text-on-primary bg-primary-action rounded hover:bg-primary-hover disabled:opacity-50"
                >
                  {createLoading ? "Adding..." : "Add Customer"}
                </button>
              </form>
            </div>
          ) : (
            <div className="p-2 border-b border-color-subtle">
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-input-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {loading ? (
            <div className="p-3 text-sm text-secondary">Loading customers...</div>
          ) : (
            customers.map((c) => (
              <div
                key={c.id}
                className="p-3 cursor-pointer hover:bg-surface-alt border-b border-color-subtle last:border-b-0"
                onClick={() => {
                  onChange(c.id);
                  onCustomerChange?.(c);
                  setOpen(false);
                }}
              >
                <p className="font-medium text-sm text-primary">{c.name}</p>
                {c.companyName && <p className="text-xs text-secondary">{c.companyName}</p>}
                {c.email && <p className="text-xs text-tertiary">{c.email}</p>}
              </div>
            ))
          )}

          {!createMode && (
            <div
              className="p-3 text-sm text-primary-brand cursor-pointer hover:bg-surface-alt text-center border-t border-color-subtle"
              onClick={(e) => { e.stopPropagation(); setCreateMode(true); setCreateForm({ name: "", email: "", countryCode: "US" }); }}
            >
              + Add new customer
            </div>
          )}
        </div>
      )}
    </div>
  );
}




