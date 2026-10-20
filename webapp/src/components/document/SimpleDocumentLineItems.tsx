import { useState } from "react";
import { Plus, Trash2, Copy, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { FormField, Button } from "@/components/ui";
import type { DocumentLineItem, TaxRateOption } from "./document-types";

interface SimpleDocumentLineItemsProps {
  items: DocumentLineItem[];
  isFinalized: boolean;
  taxRateOptions: TaxRateOption[];
  onUpdate: (idx: number, field: keyof DocumentLineItem, value: unknown) => void;
  onRemove: (idx: number) => void;
  onDuplicate: (idx: number) => void;
  onAdd: () => void;
}

export function SimpleDocumentLineItems({
  items,
  isFinalized,
  taxRateOptions,
  onUpdate,
  onRemove,
  onDuplicate,
  onAdd,
}: SimpleDocumentLineItemsProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const getLineTotal = (item: DocumentLineItem) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return (qty * price).toFixed(2);
  };

  if (items.length === 0 && !isFinalized) {
    return (
      <div className="text-center py-6 text-tertiary">
        <Plus className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No line items yet.</p>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={onAdd}>
          Add First Item
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="border border-color rounded-lg bg-surface overflow-hidden"
        >
          <div className="grid grid-cols-12 gap-2 items-end p-3">
            <div className="col-span-1 flex items-center justify-center cursor-grab text-tertiary">
              <GripVertical className="h-4 w-4" />
            </div>

            <div className="col-span-4">
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

            <div className="col-span-2">
              <FormField
                label="Unit Price"
                value={item.unitPrice}
                onChange={(e) => onUpdate(idx, "unitPrice", e.target.value)}
                disabled={isFinalized}
              />
            </div>

            <div className="col-span-2 text-right">
              <span className="text-xs text-tertiary">Total</span>
              <div className="text-lg font-medium text-primary">
                ${getLineTotal(item)}
              </div>
            </div>

            {!isFinalized && (
              <div className="col-span-2 flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => toggleRow(idx)}
                  className="p-1 text-tertiary hover:text-primary rounded"
                  title="More options"
                >
                  {expandedRows.has(idx) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate(idx)}
                  className="p-1 text-tertiary hover:text-primary hover:bg-surface-alt rounded"
                  title="Duplicate item"
                >
                  <Copy className="h-4 w-4" />
                </button>
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

          {!isFinalized && expandedRows.has(idx) && (
            <div className="px-3 pb-3 border-t border-color grid grid-cols-2 gap-4">
              <FormField
                label="Unit"
                value={item.unit}
                onChange={(e) => onUpdate(idx, "unit", e.target.value)}
                disabled={isFinalized}
              />
              <FormField
                label="Discount"
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
              <FormField
                label="Discount Type"
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
              <div className="flex items-end">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={item.isTaxInclusive}
                    onChange={(e) => onUpdate(idx, "isTaxInclusive", e.target.checked)}
                    disabled={isFinalized}
                    className="h-3 w-3"
                  />
                  <span className="text-tertiary">Tax Inclusive</span>
                </label>
              </div>
            </div>
          )}
        </div>
      ))}

      {!isFinalized && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 text-sm text-primary font-medium hover:underline"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      )}
    </div>
  );
}

