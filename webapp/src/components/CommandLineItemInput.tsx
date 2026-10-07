import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, Plus, X, Zap, AlertCircle } from "lucide-react";
import { parseCommandLineItem } from "../api/client";
import { useAnalytics } from "../hooks/useAnalytics";

interface CommandLineItemInputProps<T> {
  onAddItem: (item: Omit<T, "id">) => void;
  products?: any[];
  recentEntries?: string[];
  autoFocus?: boolean;
  compact?: boolean;
}

type ParsedResult = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  productId?: string | null;
  catalogMatch: { name: string; unitPrice: string; taxRate: string; confidence: number } | null;
};

export function CommandLineItemInput<T extends { id?: string }>({
  onAddItem,
  products = [],
  recentEntries = [],
  autoFocus = false,
  compact = false,
}: CommandLineItemInputProps<T>) {
  const [input, setInput] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(
    null
  );
  const [showRecent, setShowRecent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { track, trackCommandBarUsed } = useAnalytics();

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const parseInput = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsParsing(true);
    const startTime = Date.now();
    try {
      const res = await parseCommandLineItem(text);
      const parsed: ParsedResult = {
        description: res.parsed.description,
        quantity: res.parsed.quantity,
        unit: res.parsed.unit,
        unitPrice: res.parsed.unitPrice,
        taxRate: res.parsed.taxRate,
        productId: res.parsed.productId,
         catalogMatch: res.parsed.catalogMatch ?? null,
      };
      setParsedResult(parsed);
      const elapsed = (Date.now() - startTime) / 1000;
      trackCommandBarUsed({
        inputLength: text.length,
        parseTimeSeconds: elapsed,
        hasCatalogMatch: !!parsed.catalogMatch,
      });
    } catch (err) {
      setParsedResult(null);
    } finally {
      setIsParsing(false);
    }
  }, [track, trackCommandBarUsed]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (e.target.value.trim()) {
      const timer = setTimeout(() => parseInput(e.target.value), 300);
      return () => clearTimeout(timer);
    }
  };

  const handleAddItem = () => {
    if (!parsedResult) return;
    const newItem = {
      description: parsedResult.description,
      quantity: String(parsedResult.quantity),
      unit: parsedResult.unit,
      unitPrice: String(parsedResult.unitPrice),
      discount: "",
      discountType: "fixed",
      taxRate: String(parsedResult.taxRate),
      isTaxInclusive: false,
      productId: parsedResult.productId ?? null,
    } as unknown as Omit<T, "id">;
    onAddItem(newItem);
    setInput("");
    setParsedResult(null);
    track("item_added", {
      source: "command_bar",
      hasCatalogMatch: !!parsedResult.catalogMatch,
    });
  };

  const handleAddAndNew = () => {
    handleAddItem();
    inputRef.current?.focus();
  };

  const handleRecentSelect = (text: string) => {
    setInput(text);
    setShowRecent(false);
    parseInput(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && parsedResult) {
      e.preventDefault();
      handleAddAndNew();
    }
    if (e.key === "Escape") {
      setShowRecent(false);
    }
  };

  const formatPrice = (price: number): string => {
    if (price === 0) return "";
    return `$${price.toFixed(2)}`;
  };

  return (
    <div className={compact ? "w-full" : "w-full max-w-2xl"}>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => input.trim() && setShowRecent(true)}
            onBlur={() => setTimeout(() => setShowRecent(false), 200)}
            placeholder='Type a service, e.g. "2 x Logo design @ $150"'
            className={`w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors`}
            autoComplete="off"
          />
          {input && (
            <button
              onClick={() => {
                setInput("");
                setParsedResult(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {showRecent && recentEntries.length > 0 && !parsedResult && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">
              Recent entries
            </div>
            {recentEntries.map((entry, i) => (
              <button
                key={i}
                onClick={() => handleRecentSelect(entry)}
                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {entry}
              </button>
            ))}
          </div>
        )}

        {isParsing && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg p-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Zap className="h-4 w-4 animate-pulse text-blue-500" />
              Parsing...
            </div>
          </div>
        )}

        {parsedResult && !isParsing && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">
                  {parsedResult.description || "Service description"}
                </div>
                <div className="mt-1 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Quantity:</span>
                    <span className="text-slate-700 font-medium">{parsedResult.quantity}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Unit:</span>
                    <span className="text-slate-700 font-medium">{parsedResult.unit}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Price:</span>
                    <span className="text-slate-700 font-medium">
                      {formatPrice(parsedResult.unitPrice) || "Set price"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Tax:</span>
                    <span className="text-slate-700 font-medium">{parsedResult.taxRate}%</span>
                  </div>
                </div>
                {parsedResult.catalogMatch && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <AlertCircle className="h-3 w-3 text-blue-500" />
                    <span className="text-slate-600">
                      Matched: <span className="font-medium">{parsedResult.catalogMatch.name}</span>
                      {" "}
                      <span className={`inline-block px-1.5 py-0.25 rounded text-xs font-medium ${
                        parsedResult.catalogMatch.confidence > 0.8
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {Math.round(parsedResult.catalogMatch.confidence * 100)}%
                      </span>
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={handleAddItem}
                className="ml-3 shrink-0 inline-flex items-center justify-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddItem}
                className="flex-1 py-1.5 text-sm font-medium text-blue-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Add to invoice
              </button>
              <button
                onClick={handleAddAndNew}
                className="flex-1 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Add and + 
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommandLineItemInput;
