import { Plus, Trash2, Copy, GripVertical } from "lucide-react";
import { FormField } from "@/components/ui";
import type { DocumentLineItem, TaxRateOption } from "./document-types";
import type { CalculationResult } from "@/types/calculation";

interface DocumentLineItemsProps {
  items: DocumentLineItem[];
  isFinalized: boolean;
  taxRateOptions: TaxRateOption[];
  showOptional?: boolean;
  showDuplicate?: boolean;
  onUpdate: (idx: number, field: keyof DocumentLineItem, value: unknown) => void;
  onRemove: (idx: number) => void;
  onDuplicate: (idx: number) => void;
  onAdd: () => void;
}

function LineTotalDisplay({
  calcResult,
  idx,
  isTaxInclusive,
}: {
  calcResult: CalculationResult | null;
  idx: number;
  isTaxInclusive: boolean;
}) {
  if (!calcResult) return <span className="text-tertiary">—</span>;
  const lineTotal = calcResult.lineItems[idx]?.lineTotal;
  if (!lineTotal) return <span className="text-tertiary">—</span>;
  const str = lineTotal.toFixed(2);
  if (isTaxInclusive) {
    return <span className="text-primary font-medium">{str}</span>;
  }
  const taxAmount = calcResult.lineItems[idx]?.taxAmount;
  const taxStr = taxAmount?.isZero() ? null : ` (+${taxAmount.toFixed(2)} tax)`;
  return (
    <span className="text-primary font-medium">
      {str}
      {taxStr}
    </span>
  );
}

export function DocumentLineItems({
  items,
  isFinalized,
  taxRateOptions,
  showOptional = false,
  showDuplicate = true,
  onUpdate,
  onRemove,
  onDuplicate,
  onAdd,
}: DocumentLineItemsProps) {
  if (items.length === 0 && !isFinalized) {
    return (
      <div className="text-center py-4 text-tertiary">
        <Plus className="h-6 w-6 mx-auto mb-2 opacity-30" />
        <p>No line items yet. Click "Add Item" to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <DocumentLineItemRow
          key={idx}
          idx={idx}
          item={item}
          isFinalized={isFinalized}
          taxRateOptions={taxRateOptions}
          showOptional={showOptional}
          showDuplicate={showDuplicate}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
        />
      ))}
      {!isFinalized && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      )}
    </div>
  );
}

export function DocumentLineItemRow({
  idx,
  item,
  isFinalized,
  taxRateOptions,
  showOptional = false,
  showDuplicate = true,
  calcResult,
  onUpdate,
  onRemove,
  onDuplicate,
}: DocumentLineItemProps) {
  return (
    <div className="grid grid-cols-12 gap-2 items-end p-3 border border-color rounded-lg bg-surface">
      <div className="col-span-1 flex items-center justify-center cursor-grab text-tertiary">
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="col-span-3">
        <FormField
          label="Description"
          value={item.description}
          onChange={(e) => onUpdate(idx, "description", e.target.value)}
          disabled={isFinalized}
          helperText={item.description ? "" : "Required"}
        />
      </div>

      <div className="col-span-1">
        <FormField
          label="Qty"
          value={item.quantity}
          onChange={(e) => onUpdate(idx, "quantity", e.target.value)}
          disabled={isFinalized}
        />
      </div>

      <div className="col-span-1">
        <FormField
          label="Unit"
          value={item.unit}
          onChange={(e) => onUpdate(idx, "unit", e.target.value)}
          disabled={isFinalized}
        />
      </div>

      <div className="col-span-2">
        <FormField
          label="Unit Price"
          value={item.unitPrice}
          onChange={(e) => onUpdate(idx, "unitPrice", e.target.value)}
          disabled={isFinalized}
        />
      </div>

      <div className="col-span-1">
        <FormField
          label="Disc"
          value={item.discount}
          onChange={(e) => onUpdate(idx, "discount", e.target.value)}
          disabled={isFinalized}
          helperText={
            item.discount && Number(item.discount) > 0
              ? item.discountType === "percentage"
                ? "%"
                : "$"
              : undefined
          }
        />
      </div>

      <div className="col-span-1">
        <FormField
          label="Disc Type"
          select
          value={item.discountType}
          onChange={(e) =>
            onUpdate(idx, "discountType", e.target.value as "fixed" | "percentage")
          }
          disabled={isFinalized}
        >
          <option value="percentage">%</option>
          <option value="fixed">$</option>
        </FormField>
      </div>

      <div className="col-span-1">
        <FormField
          label="Tax Rate"
          select
          value={item.taxRate}
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
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={item.isTaxInclusive}
              onChange={(e) => onUpdate(idx, "isTaxInclusive", e.target.checked)}
              disabled={isFinalized}
              className="h-3 w-3"
            />
            <span className="text-tertiary">Incl.</span>
          </label>
        </div>
      )}

      {!isFinalized && showOptional && (
        <div className="col-span-1 flex items-center mt-5">
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={item.isOptional}
              onChange={(e) => onUpdate(idx, "isOptional", e.target.checked)}
              disabled={isFinalized}
              className="h-3 w-3"
            />
            <span className="text-tertiary">Opt.</span>
          </label>
        </div>
      )}

      {!isFinalized && (
        <div className="col-span-1 flex items-center gap-1 mt-5">
          {showDuplicate && (
            <button
              type="button"
              onClick={() => onDuplicate(idx)}
              className="p-1 text-tertiary hover:text-primary hover:bg-surface-alt rounded"
              title="Duplicate item"
            >
              <Copy className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(idx)}
             className="p-1 text-error hover:bg-error-bg rounded"
            title="Remove item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

interface DocumentLineItemProps {
  idx: number;
  item: DocumentLineItem;
  isFinalized: boolean;
  taxRateOptions: TaxRateOption[];
  showOptional?: boolean;
  showDuplicate?: boolean;
  calcResult?: CalculationResult | null;
  onUpdate: (idx: number, field: keyof DocumentLineItem, value: unknown) => void;
  onRemove: (idx: number) => void;
  onDuplicate: (idx: number) => void;
}
