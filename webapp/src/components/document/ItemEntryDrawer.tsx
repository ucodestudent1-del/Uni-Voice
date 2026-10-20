import { useState } from "react";
import { FormField, Button } from "@/components/ui";
import type { DocumentLineItem, TaxRateOption } from "./document-types";
import type { ApiProduct } from "@/types/api";

interface ItemEntryDrawerProps {
  open: boolean;
  onClose: () => void;
  item: DocumentLineItem | null;
  onSave: (item: DocumentLineItem) => void;
  taxRateOptions: TaxRateOption[];
  products: ApiProduct[];
}

export function ItemEntryDrawer({
  open,
  onClose,
  item,
  onSave,
  taxRateOptions,
  products,
}: ItemEntryDrawerProps) {
  const [draft, setDraft] = useState<DocumentLineItem>({
    description: "",
    quantity: "1",
    unit: "each",
    unitPrice: "0.00",
    taxRate: "",
    taxName: "",
    isTaxInclusive: false,
    discount: "0",
    discountType: "fixed",
    productId: null,
    isOptional: false,
    ...item,
  });

  const handleSave = () => {
    if (!draft.description) return;
    onSave(draft);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full sm:max-w-md bg-surface border-l border-color shadow-xl z-50 overflow-y-auto">
        <div className="p-5">
          <h3 className="text-lg font-semibold text-primary mb-4">
            {item ? "Edit Item" : "Add Item"}
          </h3>

          <div className="space-y-4">
            <FormField
              label="Description"
              placeholder="Item description..."
              value={draft.description}
              onChange={(e) => setDraft((p: DocumentLineItem) => ({ ...p, description: e.target.value }))}
              helperText={!draft.description ? "Required" : ""}
            />

            <FormField
              label="Product"
              select
              value={draft.productId ?? ""}
              onChange={(e) => {
                const selected = products.find((p) => p.id === e.target.value);
                if (selected) {
                  setDraft((p: DocumentLineItem) => ({
                    ...p,
                    productId: selected.id,
                    description: selected.name,
                    unitPrice: selected.defaultUnitPrice ?? "0.00",
                    unit: selected.unit ?? "each",
                    taxRate: selected.defaultTaxRate ?? "",
                  }));
                }
              }}
            >
              <option value="">Select a product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Quantity"
                value={draft.quantity}
                onChange={(e) => setDraft((p) => ({ ...p, quantity: e.target.value }))}
              />
              <FormField
                label="Unit"
                value={draft.unit}
                onChange={(e) => setDraft((p) => ({ ...p, unit: e.target.value }))}
              />
            </div>

            <FormField
              label="Unit Price"
              value={draft.unitPrice}
              onChange={(e) => setDraft((p) => ({ ...p, unitPrice: e.target.value }))}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Discount"
                value={draft.discount}
                onChange={(e) => setDraft((p) => ({ ...p, discount: e.target.value }))}
              />
              <FormField
                label="Type"
                select
                value={draft.discountType}
                onChange={(e) =>
                  setDraft((p: DocumentLineItem) => ({ ...p, discountType: e.target.value as "fixed" | "percentage" }))
                }
              >
                <option value="percentage">%</option>
                <option value="fixed">$</option>
              </FormField>
            </div>

            <FormField
              label="Tax Rate"
              select
              value={draft.taxRate}
              onChange={(e) => {
                const opt = taxRateOptions.find((o) => o.value === e.target.value);
                setDraft((p: DocumentLineItem) => ({
                  ...p,
                  taxRate: e.target.value,
                  taxName: opt?.name ?? "",
                }));
              }}
            >
              <option value="">No tax</option>
              {taxRateOptions.map((opt) => (
                <option key={opt.taxId || opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </FormField>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.isTaxInclusive}
                onChange={(e) => setDraft((p) => ({ ...p, isTaxInclusive: e.target.checked }))}
                className="h-4 w-4"
              />
              <span className="text-tertiary">Tax Inclusive</span>
            </label>
          </div>

          <div className="flex gap-2 mt-6 pt-4 border-t border-color">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              {item ? "Update" : "Add"} Item
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
