import { Trash2, Plus } from "lucide-react";
import { getCurrencyMetadata } from "@/utils/currency";
import { Button } from "@/components/ui/Button";
import type { BuilderFee } from "./types";
import { DEFAULT_FEE, generateRowId } from "./types";

interface FeesSectionProps {
  fees: BuilderFee[];
  currency: string;
  onChange: (fees: BuilderFee[]) => void;
}

export function FeesSection({ fees, currency, onChange }: FeesSectionProps) {
  const meta = getCurrencyMetadata(currency);
  const step = meta.decimalPlaces === 0 ? "1" : "0.01";

  function updateFee(id: string, patch: Partial<BuilderFee>) {
    onChange(fees.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeFee(id: string) {
    onChange(fees.filter((f) => f.id !== id));
  }

  function addFee() {
    const newFee: BuilderFee = {
      id: generateRowId(),
      ...DEFAULT_FEE,
    };
    onChange([...fees, newFee]);
  }

  if (fees.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-secondary">Fees</h3>
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={addFee}
        >
          Add Fee
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-secondary">Fees</h3>

      {fees.length > 0 && (
        <div className="space-y-3">
          {fees.map((fee) => (
            <div
              key={fee.id}
              className="rounded-xl border border-color-subtle bg-surface p-4 shadow-sm"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                <div>
                  <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">
                    Description
                  </label>
                  <input
                    type="text"
                    value={fee.description}
                    onChange={(e) => updateFee(fee.id, { description: e.target.value })}
                    placeholder="Fee description"
                    className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">
                      Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary text-sm">{meta.symbol}</span>
                      <input
                        type="number"
                        value={fee.amount}
                        onChange={(e) => updateFee(fee.id, { amount: e.target.value })}
                        placeholder="0.00"
                        min="0"
                        step={step}
                        className="w-full rounded-lg border border-input-border bg-surface-alt px-8 py-1.5 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">
                      Tax Rate
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={fee.taxRate}
                        onChange={(e) => updateFee(fee.id, { taxRate: e.target.value })}
                        placeholder="0"
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 pr-8 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary text-sm">%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 border-t border-color-subtle pt-2.5">
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => removeFee(fee.id)}
                  className="w-full"
                >
                  Remove Fee
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        icon={<Plus className="h-4 w-4" />}
        onClick={addFee}
      >
        Add Another Fee
      </Button>
    </div>
  );
}
