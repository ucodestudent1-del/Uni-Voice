import React, { useState, useEffect, useCallback } from "react";
import { Tag, Plus, DollarSign, Clock, AlertCircle } from "lucide-react";
import { getFrequentlyInvoiced } from "../api/client";
import { useAnalytics } from "../hooks/useAnalytics";
import type { ApiFrequentlyInvoicedItem } from "../api/client";
import type { WorkspaceLineItem } from "./InvoiceWorkspace";

interface FrequentlyInvoicedChipsProps {
  onAddItem: (item: Omit<WorkspaceLineItem, "id">) => void;
  businessId: string;
  customerId?: string;
  limit?: number;
  maxVisible?: number;
}

const formatCurrency = (amount: string): string => {
  const num = parseFloat(amount);
  if (isNaN(num) || num === 0) return "";
  return `$${num.toFixed(2)}`;
};

const formatFrequency = (score: number): string => {
  if (score >= 4) return "Frequent";
  if (score >= 2) return "Often";
  if (score >= 1) return "Sometimes";
  return "Occasional";
};

export function FrequentlyInvoicedChips({
  onAddItem,
  businessId,
  customerId,
  limit = 12,
  maxVisible = 8,
}: FrequentlyInvoicedChipsProps) {
  const [items, setItems] = useState<ApiFrequentlyInvoicedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const { track, trackFrequentlyInvoicedUsed } = useAnalytics();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getFrequentlyInvoiced(limit);
      let filtered = res.items || [];
      if (customerId) {
        filtered = filtered.filter((it: any) => it.customerId === customerId || !it.customerId);
      }
      setItems(filtered);
    } catch (err: any) {
      setError(err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [limit, customerId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAddItem = async (item: ApiFrequentlyInvoicedItem) => {
    const itemKey = item.id || item.name;
    if (addingIds.has(itemKey)) return;
    setAddingIds((prev) => new Set([...prev, itemKey]));
    try {
      const newItem: Omit<WorkspaceLineItem, "id"> = {
        type: "service",
        description: item.name,
        quantity: "1",
        unit: item.unit,
        unitPrice: item.unitPrice,
        discount: "",
        discountType: "fixed",
        taxRate: item.taxRate,
        isTaxInclusive: false,
        productId: item.id,
      };
      onAddItem(newItem);
      trackFrequentlyInvoicedUsed({
        itemId: item.id,
        itemName: item.name,
      });
      track("item_added", {
        source: "frequent_chip",
        productId: item.id,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
      });
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemKey);
        return next;
      });
    }
  };

  const displayedItems = showAll ? items : items.slice(0, maxVisible);

  if (loading && items.length === 0) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-36 h-16 bg-slate-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return null;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">
            Frequently invoiced
          </span>
        </div>
        {!showAll && items.length > maxVisible && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Show all ({items.length})
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {displayedItems.map((item) => {
          const itemKey = item.id || item.name;
          const isAdding = addingIds.has(itemKey);
          return (
            <div
              key={itemKey}
              className="group flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
            >
              <div className="flex-1 min-w-[140px]">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {item.name}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  {formatCurrency(item.unitPrice) && (
                    <span className="inline-flex items-center gap-0.5">
                      <DollarSign className="h-3 w-3" />
                      {formatCurrency(item.unitPrice)}
                    </span>
                  )}
                  <span className="w-1 h-1 bg-slate-300 rounded-full" />
                  <span className="truncate">
                    {formatFrequency(item.frequencyScore)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleAddItem(item)}
                disabled={isAdding}
                className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add to invoice"
              >
                {isAdding ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {!showAll && items.length > maxVisible && (
        <button
          onClick={() => setShowAll(false)}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Show less
        </button>
      )}
    </div>
  );
}

export default FrequentlyInvoicedChips;
