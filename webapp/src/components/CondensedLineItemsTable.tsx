import React, { useState } from "react";
import { Plus, Trash2, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { Decimal } from "decimal.js";
import { formatCurrency, fromPercentage, toPercent } from "@/utils/format";
import { getCurrencyMetadata } from "@/types/currency";
import type { WorkspaceInvoiceData, WorkspaceLineItem, LineItemType } from "./InvoiceWorkspace";
import { cn } from "@/lib/utils";

export interface CondensedLineItemsTableProps {
  invoice: WorkspaceInvoiceData;
  calc: ReturnType<typeof import("@/utils/calculation").calculationEngine.calculate> | null;
  onItemChange: (id: string, patch: Partial<WorkspaceLineItem>) => void;
  onAdd: (type?: LineItemType) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  defaultTaxRate: string;
}

const LINE_ITEM_UNITS = ["each", "hour", "day", "week", "month", "fixed"] as const;

export function CondensedLineItemsTable({
  invoice,
  calc,
  onItemChange,
  onAdd,
  onDuplicate,
  onRemove,
  defaultTaxRate,
}: CondensedLineItemsTableProps) {
  const c = invoice.currency;
  const meta = getCurrencyMetadata(c);
  const step = meta.decimalPlaces === 0 ? "1" : "0.01";
  const lineTotals = calc?.lineItems ?? [];

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const focusNextDescription = (currentIndex: number) => {
    const next = currentIndex + 1;
    const nextId = invoice.items[next]?.id;
    if (nextId) {
      const el = document.getElementById(`desc-${nextId}`) as HTMLTextAreaElement | null;
      el?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, itemId: string, index: number) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      focusNextDescription(index);
    }
    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      if (index === invoice.items.length - 1) {
        e.preventDefault();
        onAdd("service");
      }
    }
  };

  if (invoice.items.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-dashed border-color-subtle bg-surface py-10 text-center">
        <FileText className="mx-auto h-10 w-10 text-tertiary/40" />
        <h3 className="mt-3 text-sm font-semibold text-primary">No line items added yet</h3>
        <p className="mt-1 max-w-sm text-center text-xs text-tertiary">
          Add a product or service so your invoice has something to bill for.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
          <button
            type="button"
            onClick={() => onAdd("service")}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <Plus className="h-4 w-4" />
            Add a line item
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-2">
      {invoice.items.map((item, i) => {
        const lineTotal = lineTotals[i]?.lineTotal ?? null;
        const isExpanded = item.id ? expandedRows.has(item.id) : false;
        const itemId = item.id ?? `li_${i}`;

        return (
          <div
            key={itemId}
            className="rounded-xl border border-color bg-surface shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Collapsed summary row */}
            <div className="flex items-center gap-2 p-3">
              <button
                type="button"
                onClick={() => toggleRow(itemId)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-tertiary hover:bg-surface-alt hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>

              <textarea
                id={`desc-${itemId}`}
                value={item.description}
                onChange={(e) => onItemChange(item.id ?? String(i), { description: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, itemId, i)}
                placeholder="What did you do?"
                rows={isExpanded ? 2 : 1}
                className={cn(
                  "flex-1 resize-y border-0 bg-transparent text-sm text-primary placeholder-tertiary focus:outline-none",
                  "focus:ring-0",
                  item.description ? "font-medium" : "italic"
                )}
                style={{ minHeight: "2rem", maxHeight: "6rem" }}
              />

              {lineTotal !== null && (
                <span className="w-24 shrink-0 text-right text-sm font-medium text-primary font-tabular-nums">
                  {formatCurrency(lineTotal, c)}
                </span>
              )}

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onDuplicate(item.id ?? String(i))}
                  title="Duplicate line"
                  className="rounded p-1.5 text-tertiary hover:bg-surface-alt hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <FileText className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(item.id ?? String(i))}
                  title="Remove line"
                  className="rounded p-1.5 text-tertiary hover:bg-error-bg hover:text-error-text focus:outline-none focus:ring-1 focus:ring-error"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Expanded detail row */}
            {isExpanded && (
              <div className="border-t border-color-subtle px-3 pb-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_80px_1fr_100px] sm:items-end">
                  {/* Quantity */}
                  <div>
                    <label className="form-label-secondary">Qty</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => onItemChange(item.id ?? String(i), { quantity: e.target.value || "1" })}
                      min={1}
                      step="any"
                      className="form-control-sm w-full text-right font-tabular-nums"
                    />
                  </div>

                  {/* Unit */}
                  <div>
                    <label className="form-label-secondary">Unit</label>
                    <select
                      value={item.unit}
                      onChange={(e) => onItemChange(item.id ?? String(i), { unit: e.target.value })}
                      className="form-control-sm w-full"
                      title="Unit"
                    >
                      {LINE_ITEM_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Rate */}
                  <div className="relative">
                    <label className="form-label-secondary">Rate</label>
                    <span className="pointer-events-none absolute left-3 top-5 text-tertiary text-xs">
                      {meta.symbol}
                    </span>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => onItemChange(item.id ?? String(i), { unitPrice: e.target.value || "0" })}
                      min={0}
                      step={step}
                      className="input-with-prefix w-full text-right font-tabular-nums"
                    />
                  </div>

                  {/* Tax */}
                  <div>
                    <label className="form-label-secondary">Tax %</label>
                    <div className="mt-1 relative">
                      <input
                        type="number"
                        value={toPercent(item.taxRate ?? defaultTaxRate)}
                        onChange={(e) =>
                          onItemChange(item.id ?? String(i), {
                            taxRate: fromPercentage(e.target.value.replace(/[^\d.]/g, "")),
                          })
                        }
                        min={0}
                        max={100}
                        step="0.01"
                        className="form-control-sm w-full text-right font-tabular-nums pr-8"
                        placeholder={toPercent(defaultTaxRate)}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-tertiary text-xs">
                        %
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-tertiary">
                        <input
                          type="checkbox"
                          checked={item.isTaxInclusive ?? false}
                          onChange={(e) =>
                            onItemChange(item.id ?? String(i), {
                              isTaxInclusive: e.target.checked,
                            })
                          }
                          className="h-3 w-3 rounded border-input-border text-primary-brand focus:ring-primary"
                        />
                        Inclusive
                      </label>
                    </div>
                  </div>
                </div>

                {/* Discount */}
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_80px]">
                  <div className="relative">
                    <label className="form-label-secondary">Discount</label>
                    <span className="pointer-events-none absolute left-3 top-5 text-tertiary text-xs">
                      {item.discountType === "percentage" ? "%" : meta.symbol}
                    </span>
                    <input
                      type="number"
                      value={
                        item.discountType === "percentage"
                          ? toPercent(item.discount ?? "0")
                          : item.discount ?? ""
                      }
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/[^\d.]/g, "");
                        onItemChange(item.id ?? String(i), {
                          discount:
                            item.discountType === "percentage"
                              ? rawValue
                              : rawValue || "",
                        });
                      }}
                      min={0}
                      step="0.01"
                      className="input-with-prefix w-full text-right font-tabular-nums"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="form-label-secondary">Type</label>
                    <select
                      value={item.discountType ?? "fixed"}
                      onChange={(e) =>
                        onItemChange(item.id ?? String(i), {
                          discountType: e.target.value as "fixed" | "percentage",
                        })
                      }
                      className="form-control-sm w-full"
                      title="Discount type"
                    >
                      <option value="fixed">Fixed</option>
                      <option value="percentage">%</option>
                    </select>
                  </div>
                </div>

                {/* Computed line total with tax breakdown */}
                {lineTotal !== null && (
                  <div className="mt-3 border-t border-color-subtle pt-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-tertiary">Line subtotal</span>
                      <span className="font-tabular-nums text-primary">
                        {formatCurrency(
                          new Decimal(item.quantity || "1").mul(item.unitPrice || "0"),
                          c
                        )}
                      </span>
                    </div>
                    {item.discount && Number(item.discount) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-tertiary">Discount</span>
                        <span className="text-success-text font-tabular-nums">
                          −
                          {item.discountType === "percentage"
                            ? `${formatCurrency(
                                new Decimal(item.quantity || "1")
                                  .mul(item.unitPrice || "0")
                                  .mul(new Decimal(item.discount).div(100)),
                                c
                              )} (${item.discount}%)`
                            : formatCurrency(item.discount, c)}
                        </span>
                      </div>
                    )}
                    {item.taxRate && Number(item.taxRate) > 0 && (
                      <div className="flex justify-between">
                      <span className="text-tertiary">
                        Tax ({toPercent(item.taxRate)}%)
                        {item.taxName && ` (${item.taxName})`}
                        {item.isTaxInclusive && " (incl.)"}
                      </span>
                        <span className="font-tabular-nums text-primary">
                          {formatCurrency(
                            lineTotals[i]?.taxAmount ?? 0,
                            c
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add another line */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => onAdd("service")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-color bg-surface-alt px-3 py-1.5 text-sm text-secondary hover:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another line
        </button>
      </div>
    </div>
  );
}

CondensedLineItemsTable.displayName = "CondensedLineItemsTable";

export default CondensedLineItemsTable;
