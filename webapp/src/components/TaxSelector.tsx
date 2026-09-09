import { useEffect, useState, useRef } from "react";
import { getTaxRates } from "../api/client";

interface TaxRate {
  id: string;
  name: string;
  code?: string;
  rate: string;
  country_code?: string;
  region?: string;
  is_compound: boolean;
}

interface TaxSelectorProps {
  value?: string;
  onChange: (rate: string) => void;
  allowNone?: boolean;
  placeholder?: string;
}

export default function TaxSelector({ value, onChange, allowNone = true, placeholder = "Select tax rate" }: TaxSelectorProps) {
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRates();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadRates() {
    try {
      const data = await getTaxRates();
      setRates(data.taxRates ?? []);
    } catch {
      setRates([]);
    } finally {
      setLoading(false);
    }
  }

  const selected = rates.find((r) => r.rate === value) ?? (value ? { id: "", name: value, rate: value } : null);

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center justify-between w-full px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm text-slate-900 truncate">
          {selected ? `${selected.name} (${formatRate(selected.rate)})` : placeholder}
        </span>
        <svg className="h-5 w-5 text-slate-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-slate-500">Loading tax rates...</div>
          ) : (
            <>
              {allowNone && (
                <div
                  className="p-3 cursor-pointer hover:bg-slate-50 border-b border-slate-100 text-sm"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  No tax
                </div>
              )}
              {rates.map((r) => (
                <div
                  key={r.id}
                  className="p-3 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                  onClick={() => {
                    onChange(r.rate);
                    setOpen(false);
                  }}
                >
                  <p className="font-medium text-sm text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-500">{formatRate(r.rate)} · {r.country_code}{r.region ? `, ${r.region}` : ""}</p>
                </div>
              ))}
              {rates.length === 0 && (
                <div className="p-3 text-sm text-slate-400">No tax rates configured</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatRate(rate: string): string {
  const num = parseFloat(rate || "0") * 100;
  if (num === 0) return "0%";
  return `${num.toFixed(2)}%`;
}
