import { Plus, Trash2 } from "lucide-react";
import { FormField } from "@/components/ui";
import type { DocumentFee, TaxRateOption } from "./document-types";

interface DocumentFeesProps {
  fees: DocumentFee[];
  isFinalized: boolean;
  taxRateOptions: TaxRateOption[];
  onUpdate: (idx: number, field: keyof DocumentFee, value: string) => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
}

export function DocumentFees({
  fees,
  isFinalized,
  taxRateOptions,
  onUpdate,
  onRemove,
  onAdd,
}: DocumentFeesProps) {
  if (fees.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80">
        <Plus className="h-4 w-4" />
        <button type="button" onClick={onAdd} disabled={isFinalized}>
          Add Fee
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {fees.map((fee, idx) => (
        <div
          key={idx}
          className="grid grid-cols-12 gap-2 items-end p-3 border border-color rounded-lg bg-surface"
        >
          <div className="col-span-5">
            <FormField
              label="Description"
              value={fee.description}
              onChange={(e) => onUpdate(idx, "description", e.target.value)}
              disabled={isFinalized}
            />
          </div>

          <div className="col-span-2">
            <FormField
              label="Amount"
              value={fee.amount}
              onChange={(e) => onUpdate(idx, "amount", e.target.value)}
              disabled={isFinalized}
            />
          </div>

          <div className="col-span-3">
            <FormField
              label="Tax Rate"
              select
              value={fee.taxRate}
              onChange={(e) => {
                const opt = taxRateOptions.find((o) => o.value === e.target.value);
                onUpdate(idx, "taxRate", e.target.value);
                onUpdate(idx, "taxName", opt?.name ?? "");
              }}
              disabled={isFinalized}
            >
              {taxRateOptions.map((opt) => (
                <option key={opt.taxId || opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </FormField>
          </div>

          {!isFinalized && (
            <div className="col-span-1 flex items-center mt-5">
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="p-1.5 text-error hover:bg-error/10 rounded"
                title="Remove fee"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ))}

      {!isFinalized && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80"
        >
          <Plus className="h-4 w-4" />
          Add Fee
        </button>
      )}
    </div>
  );
}
