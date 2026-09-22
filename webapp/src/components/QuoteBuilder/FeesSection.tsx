import { Trash2 } from "lucide-react";
import { getCurrencyMetadata } from "../../utils/currency";
import type { BuilderFee } from "./types";

interface FeesSectionProps {
  fees: BuilderFee[];
  currency: string;
  onChange: (fees: BuilderFee[]) => void;
}

export function FeesSection({ fees, currency, onChange }: FeesSectionProps) {
  const meta = getCurrencyMetadata(currency);

  function updateFee(id: string, patch: Partial<BuilderFee>) {
    onChange(fees.map(f => f.id === id ? { ...f, ...patch } : f));
  }

  function removeFee(id: string) {
    onChange(fees.filter(f => f.id !== id));
  }

  function addFee() {
    const newFee: BuilderFee = {
      id: `fee_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      description: "",
      amount: "0.00",
      taxRate: "0",
    };
    onChange([...fees, newFee]);
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-secondary">Fees</h3>

      {fees.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-color-subtle text-left text-xs font-medium text-secondary uppercase">
              <th className="pb-2">Description</th>
              <th className="pb-2 text-right">Amount</th>
              <th className="pb-2 text-right">Tax %</th>
              <th className="pb-2 w-[8%]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fees.map((fee) => (
              <tr key={fee.id} className="border-b border-color-subtle/50">
                <td className="py-2">
                  <input
                    type="text"
                    value={fee.description}
                    onChange={(e) => updateFee(fee.id, { description: e.target.value })}
                    placeholder="Fee description"
                    className="w-full rounded-lg border border-input-border bg-surface-alt px-2 py-1 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </td>
                <td className="py-2">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-tertiary text-xs">{meta.symbol}</span>
                    <input
                      type="number"
                      min="0"
                      step={meta.decimalPlaces === 0 ? "1" : "0.01"}
                      value={fee.amount}
                      onChange={(e) => updateFee(fee.id, { amount: e.target.value })}
                      className="w-full rounded-lg border border-input-border bg-surface-alt px-6 py-1 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </td>
                <td className="py-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={fee.taxRate}
                    onChange={(e) => updateFee(fee.id, { taxRate: e.target.value })}
                    className="w-full rounded-lg border border-input-border bg-surface-alt px-2 py-1 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => removeFee(fee.id)}
                    className="rounded-lg p-1 text-tertiary hover:bg-error-bg hover:text-error-text"
                    title="Remove fee"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button
        type="button"
        onClick={addFee}
        className="inline-flex items-center gap-2 rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-xs font-medium text-secondary hover:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
      >
        + Add fee
      </button>
    </div>
  );
}
