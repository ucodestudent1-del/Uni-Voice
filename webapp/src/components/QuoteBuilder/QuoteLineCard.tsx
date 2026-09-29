import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/utils/format";
import { getCurrencyMetadata } from "@/utils/currency";
import { Button } from "@/components/ui/Button";
import type { BuilderLineItem } from "./types";
import { LINE_ITEM_UNITS } from "./types";
import type { CalculationResult } from "@/utils/calculation";

interface QuoteLineCardProps {
  item: BuilderLineItem;
  index: number;
  currency: string;
  calcResult: CalculationResult | null;
  onChange: (item: Partial<BuilderLineItem>) => void;
  onDelete: () => void;
}

export function QuoteLineCard({ item, index, currency, calcResult, onChange, onDelete }: QuoteLineCardProps) {
  const meta = getCurrencyMetadata(currency);
  const step = meta.decimalPlaces === 0 ? "1" : "0.01";

  const lineTotal = calcResult?.lineItems[index]?.lineTotal ?? null;
  const lineTotalDisplay = lineTotal ? formatCurrency(lineTotal, currency) : formatCurrency("0", currency);

  const handleDescriptionChange = (value: string) => {
    onChange({ description: value });
  };

  const handleNumberChange = (field: keyof BuilderLineItem, value: string) => {
    onChange({ [field]: value });
  };

  return (
    <div className="group rounded-xl border border-color-subtle bg-surface p-4 shadow-sm transition-colors hover:border-color-strong">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center rounded-full bg-surface-alt px-2 py-0.5 text-xs font-medium text-tertiary">
            #{index + 1}
          </span>
          <span className="text-sm font-medium text-primary">Line Total</span>
        </div>
        <span className="text-xl font-bold text-primary font-tabular-nums">
          {lineTotalDisplay}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_1fr]">
        {/* Description — takes 60% width, largest field */}
        <div>
          <label className="block text-xs font-medium text-tertiary uppercase mb-1">
            Description
          </label>
          <textarea
            value={item.description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Describe the product or service..."
            rows={3}
            className="w-full min-h-[80px] resize-y rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-y font-tabular-nums"
          />
        </div>

        {/* Numeric fields — compact 2-column grid on the right */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-tertiary uppercase mb-1">
              Quantity
            </label>
            <input
              type="number"
              min="0.01"
              step={meta.decimalPlaces === 0 ? "1" : "0.01"}
              value={item.quantity}
              onChange={(e) => handleNumberChange("quantity", e.target.value)}
              className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-tertiary uppercase mb-1">
              Unit
            </label>
            <select
              value={item.unit}
              onChange={(e) => handleNumberChange("unit", e.target.value)}
              className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary capitalize"
            >
              {LINE_ITEM_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-tertiary uppercase mb-1">
              Unit Price
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary text-sm">{meta.symbol}</span>
              <input
                type="number"
                min="0"
                step={step}
                value={item.unitPrice}
                onChange={(e) => handleNumberChange("unitPrice", e.target.value)}
                className="w-full rounded-lg border border-input-border bg-surface-alt px-8 py-2 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-tertiary uppercase mb-1">
              Discount
            </label>
            <input
              type="number"
              min="0"
              step={step}
              value={item.discount}
              onChange={(e) => handleNumberChange("discount", e.target.value)}
              className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-tertiary uppercase mb-1">
              Discount Type
            </label>
            <select
              value={item.discountType}
              onChange={(e) => handleNumberChange("discountType", e.target.value as "fixed" | "percentage")}
              className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="fixed">Fixed</option>
              <option value="percentage">Percentage</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-tertiary uppercase mb-1">
              Tax Rate
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={item.taxRate}
                onChange={(e) => handleNumberChange("taxRate", e.target.value)}
                className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-2 pr-8 text-sm text-primary text-right focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary text-sm">%</span>
            </div>
          </div>

          <div className="flex items-end">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id={`tax-inclusive-${item.id}`}
                checked={item.isTaxInclusive ?? false}
                onChange={(e) => onChange({ isTaxInclusive: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-input-border text-primary-brand focus:ring-primary"
              />
              <label
                htmlFor={`tax-inclusive-${item.id}`}
                className="block text-xs font-medium text-tertiary uppercase"
              >
                Tax Inclusive
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Delete button — full width, below the fields */}
      <div className="mt-4 border-t border-color-subtle pt-3">
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 className="h-4 w-4" />}
          onClick={onDelete}
          className="w-full"
        >
          Remove Line Item
        </Button>
      </div>
    </div>
  );
}
