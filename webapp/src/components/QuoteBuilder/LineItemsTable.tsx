import { Plus, FileText } from "lucide-react";
import type { BuilderLineItem } from "./types";
import { DEFAULT_LINE_ITEM, generateRowId } from "./types";
import { QuoteLineCard } from "./QuoteLineCard";
import { Button } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import type { CalculationResult } from "@/utils/calculation";

interface LineItemsTableProps {
  items: BuilderLineItem[];
  currency: string;
  calcResult: CalculationResult | null;
  onChange: (items: BuilderLineItem[]) => void;
}

export function LineItemsTable({ items, currency, calcResult, onChange }: LineItemsTableProps) {
  function updateItem(id: string, patch: Partial<BuilderLineItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function handleDelete(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function handleAdd() {
    const newItem: BuilderLineItem = {
      id: generateRowId(),
      ...DEFAULT_LINE_ITEM,
    };
    onChange([...items, newItem]);
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          variant="compact"
          title="No line items yet"
          description="Add your first product or service to build your quote."
          icon={<FileText className="h-8 w-8" />}
          actionLabel="Add Line Item"
          onAction={handleAdd}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <QuoteLineCard
          key={item.id}
          item={item}
          index={index}
          currency={currency}
          calcResult={calcResult}
          onChange={(patch) => updateItem(item.id, patch)}
          onDelete={() => handleDelete(item.id)}
        />
      ))}

      <div className="pt-2">
        <Button
          variant="primary"
          size="md"
          icon={<Plus className="h-5 w-5" />}
          onClick={handleAdd}
          className="w-full sm:w-auto"
        >
          Add Line Item
        </Button>
      </div>
    </div>
  );
}
