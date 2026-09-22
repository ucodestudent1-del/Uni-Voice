import { Trash2 } from "lucide-react";
import { Decimal } from "decimal.js";
import { formatCurrency } from "../../utils/format";
import { getCurrencyMetadata } from "../../utils/currency";
import type { BuilderLineItem } from "./types";
import { LINE_ITEM_UNITS } from "./types";

interface LineItemsTableProps {
  items: BuilderLineItem[];
  currency: string;
  onChange: (items: BuilderLineItem[]) => void;
}

function parseDecimal(value: string): Decimal {
  try {
    const d = new Decimal(value || "0");
    return d.isNaN() ? new Decimal(0) : d;
  } catch {
    return new Decimal(0);
  }
}

function lineTotal(item: BuilderLineItem): Decimal {
  const qty = parseDecimal(item.quantity);
  const price = parseDecimal(item.unitPrice);
  let total = qty.mul(price);
  const discount = parseDecimal(item.discount);
  if (!discount.isZero()) {
    if (item.discountType === "percentage") {
      total = total.minus(total.mul(discount.div(100)));
    } else {
      total = total.minus(discount);
    }
  }
  if (total.isNegative()) total = new Decimal(0);
  return total;
}

export function LineItemsTable({ items, currency, onChange }: LineItemsTableProps) {
  const meta = getCurrencyMetadata(currency);

  function updateItem(id: string, patch: Partial<BuilderLineItem>) {
    onChange(items.map(item => item.id === id ? { ...item, ...patch } : item));
  }

  function handleDelete(id: string) {
    onChange(items.filter(item => item.id !== id));
  }

  function handleAdd() {
    const newItem: BuilderLineItem = {
      id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      productId: null,
      description: "",
      quantity: "1",
      unit: "each",
      unitPrice: "0.00",
      discount: "0",
      discountType: "fixed",
      taxRate: "0",
      isTaxInclusive: false,
    };
    onChange([...items, newItem]);
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-color-subtle text-left text-xs font-medium text-secondary uppercase">
              <th className="pb-2 pl-8 w-[20%]">Description</th>
              <th className="pb-2 w-[8%] text-right">Qty</th>
              <th className="pb-2 w-[10%]">Unit</th>
              <th className="pb-2 w-[12%] text-right">Rate</th>
              <th className="pb-2 w-[10%]">Disc.</th>
              <th className="pb-2 w-[8%]">Type</th>
              <th className="pb-2 w-[8%]">Tax %</th>
              <th className="pb-2 w-[8%] flex items-center">
                <input type="checkbox" className="rounded border-input-border" />
                <span className="ml-1">Inc.</span>
              </th>
              <th className="pb-2 w-[10%] text-right">Total</th>
              <th className="pb-2 w-[8%]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const lt = lineTotal(item);
              return (
                <tr key={item.id} className="border-b border-color-subtle/50">
                  <td className="py-2 pl-8">
                    <textarea
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      placeholder="Item description"
                      rows={2}
                      className="w-full min-h-[40px] resize-y border border-input-border rounded-lg px-2 py-1 text-sm text-primary bg-surface focus:outline-none focus:ring-1 focus:ring-primary overflow-hidden"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="number"
                      min="0.01"
                      step={meta.decimalPlaces === 0 ? "1" : "0.01"}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                      className="w-full rounded-lg border border-input-border bg-surface-alt px-2 py-1 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </td>
                  <td className="py-2">
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                      className="w-full rounded-lg border border-input-border bg-surface-alt px-2 py-1 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {LINE_ITEM_UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-tertiary text-xs">{meta.symbol}</span>
                      <input
                        type="number"
                        min="0"
                        step={meta.decimalPlaces === 0 ? "1" : "0.01"}
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, { unitPrice: e.target.value })}
                        className="w-full rounded-lg border border-input-border bg-surface-alt px-6 py-1 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </td>
                  <td className="py-2">
                    <input
                      type="number"
                      min="0"
                      step={meta.decimalPlaces === 0 ? "1" : "0.01"}
                      value={item.discount}
                      onChange={(e) => updateItem(item.id, { discount: e.target.value })}
                      className="w-full rounded-lg border border-input-border bg-surface-alt px-2 py-1 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </td>
                  <td className="py-2">
                    <select
                      value={item.discountType}
                      onChange={(e) => updateItem(item.id, { discountType: e.target.value as "fixed" | "percentage" })}
                      className="w-full rounded-lg border border-input-border bg-surface-alt px-2 py-1 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="fixed">Fixed</option>
                      <option value="percentage">%</option>
                    </select>
                  </td>
                  <td className="py-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.taxRate}
                      onChange={(e) => updateItem(item.id, { taxRate: e.target.value })}
                      className="w-full rounded-lg border border-input-border bg-surface-alt px-2 py-1 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </td>
                  <td className="py-2 text-center">
                    <input
                      type="checkbox"
                      checked={item.isTaxInclusive ?? false}
                      onChange={(e) => updateItem(item.id, { isTaxInclusive: e.target.checked })}
                      className="rounded border-input-border text-primary-brand focus:ring-primary"
                    />
                  </td>
                  <td className="py-2 text-right font-medium text-primary">
                    {formatCurrency(lt, currency)}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="rounded-lg p-1 text-tertiary hover:bg-error-bg hover:text-error-text"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex items-center gap-2 rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-xs font-medium text-secondary hover:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
      >
        + Add line item
      </button>

      {items.length === 0 && (
        <p className="text-sm text-tertiary">No line items yet. Add one to get started.</p>
      )}
    </div>
  );
}
