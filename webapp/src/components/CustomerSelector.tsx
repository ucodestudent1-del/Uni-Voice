import { useEffect, useState, useRef } from "react";
import { getCustomers, createCustomer } from "../api/client";
import type { ApiCustomer } from "../types/api";

interface CustomerSelectorProps {
  value?: string;
  onChange: (customerId: string | undefined) => void;
  onCustomerChange?: (customer: ApiCustomer | undefined) => void;
  placeholder?: string;
}

export default function CustomerSelector({ value, onChange, onCustomerChange, placeholder = "Select a customer" }: CustomerSelectorProps) {
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCustomers();
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

  async function loadCustomers() {
    try {
      const data = await getCustomers({ limit: 100 });
      setCustomers(data.customers ?? []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }

  const selected = customers.find((c) => c.id === value);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await createCustomer({
        name: createName,
        email: createEmail || null,
        companyName: null,
        addressLine1: "",
        city: "",
        stateOrRegion: "",
        postalCode: "",
        countryCode: "US",
      });
      const newCustomer = res.customer;
      const updated = [...customers, newCustomer];
      setCustomers(updated);
      onChange(newCustomer.id);
      onCustomerChange?.(newCustomer);
      setCreateMode(false);
      setCreateName("");
      setCreateEmail("");
      setOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create customer");
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center justify-between w-full px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500"
        onClick={() => { setOpen(!open); setCreateMode(false); }}
      >
        <span className="text-sm text-slate-900 truncate">
          {selected ? `${selected.name}${selected.email ? ` (${selected.email})` : ""}` : placeholder}
        </span>
        <svg className="h-5 w-5 text-slate-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {createMode ? (
            <div className="p-3 border-b border-slate-200">
              <form onSubmit={handleCreate} className="space-y-2">
                <input
                  type="text"
                  placeholder="Customer name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  className="w-full px-2 py-1 text-sm text-white bg-primary-600 rounded hover:bg-primary-700"
                >
                  Add Customer
                </button>
              </form>
            </div>
          ) : null}
          {loading ? (
            <div className="p-3 text-sm text-slate-500">Loading customers...</div>
          ) : (
            customers.map((c) => (
              <div
                key={c.id}
                className="p-3 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                onClick={() => {
                  onChange(c.id);
                  onCustomerChange?.(c);
                  setOpen(false);
                }}
              >
                <p className="font-medium text-sm text-slate-900">{c.name}</p>
                {c.company_name && <p className="text-xs text-slate-500">{c.company_name}</p>}
                {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
              </div>
            ))
          )}
          {!createMode && (
            <div
              className="p-3 text-sm text-primary-600 cursor-pointer hover:bg-slate-50 text-center border-t border-slate-200"
              onClick={() => setCreateMode(true)}
            >
              + Add new customer
            </div>
          )}
        </div>
      )}
    </div>
  );
}
