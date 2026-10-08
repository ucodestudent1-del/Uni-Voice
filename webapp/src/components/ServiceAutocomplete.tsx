import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, Package, Plus } from "lucide-react";
import { formatCurrency } from "../utils/format";
import type { ApiProduct } from "../types/api";

export interface ServiceAutocompleteProps {
  products: ApiProduct[];
  onSelect: (product: ApiProduct) => void;
  placeholder?: string;
  maxVisible?: number;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  id?: string;
}

const DEBOUNCE_MS = 0;

export function ServiceAutocomplete({
  products,
  onSelect,
  placeholder = "Search services...",
  maxVisible = 8,
  className,
  inputRef,
  onKeyDown,
  id,
}: ServiceAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return products.slice(0, maxVisible);
    const lower = query.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          (p.sku ?? "").toLowerCase().includes(lower) ||
          (p.description ?? "").toLowerCase().includes(lower)
      )
      .slice(0, maxVisible);
  }, [products, query, maxVisible]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setHighlightedIndex(-1);
    setIsOpen(true);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (onKeyDown) onKeyDown(e);

    if (!isOpen && filtered.length > 0) {
      setIsOpen(true);
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && filtered[highlightedIndex]) {
        handleSelect(filtered[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleSelect = useCallback(
    (product: ApiProduct) => {
      onSelect(product);
      setQuery("");
      setIsOpen(false);
      setHighlightedIndex(-1);
    },
    [onSelect]
  );

  const handleFocus = () => {
    if (filtered.length > 0) {
      setIsOpen(true);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!containerRef.current || !containerRef.current.contains(document.activeElement)) {
        setIsOpen(false);
      }
    }, 150);
  };

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary" />
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-lg border border-input-border bg-surface-alt pl-10 pr-4 py-2.5 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-owns={isOpen ? "service-autocomplete-list" : undefined}
        />
      </div>

      {isOpen && filtered.length > 0 && (
        <div
          id="service-autocomplete-list"
          role="listbox"
          className="absolute z-10 mt-1 w-full bg-surface border border-color-subtle rounded-lg shadow-lg max-h-64 overflow-y-auto"
      >
        {filtered.map((product, idx) => {
          const isHighlighted = idx === highlightedIndex;
          const unitPrice = parseFloat(product.defaultUnitPrice);
          const taxRate = product.defaultTaxRate ? parseFloat(product.defaultTaxRate) : undefined;
          return (
            <button
              key={product.id}
              type="button"
              role="option"
              aria-selected={isHighlighted}
              onMouseEnter={() => setHighlightedIndex(idx)}
              onMouseLeave={() => setHighlightedIndex(-1)}
              onClick={() => handleSelect(product)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-alt focus:outline-none focus:bg-surface-alt transition-colors ${
                isHighlighted ? "bg-surface-alt" : ""
              }`}
            >
              <Package className="h-4 w-4 text-tertiary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-primary truncate">{product.name}</div>
                <div className="flex items-center gap-2 text-xs text-tertiary">
                  <span className="text-primary font-tabular-nums">{formatCurrency(unitPrice, product.defaultCurrency)}</span>
                  {taxRate !== undefined && taxRate > 0 && (
                    <>
                      <span>•</span>
                      <span>{taxRate}% tax</span>
                    </>
                  )}
                  {product.sku && (
                    <>
                      <span>•</span>
                      <span>{product.sku}</span>
                    </>
                  )}
                </div>
              </div>
              <Plus className="h-3.5 w-3.5 text-tertiary group-hover:text-primary" />
            </button>
          );
        })}
      </div>
      )}

      {isOpen && filtered.length === 0 && query.trim() && (
        <div className="absolute z-10 mt-1 w-full bg-surface border border-color-subtle rounded-lg shadow-lg p-3 text-sm text-tertiary">
          No matching services found
        </div>
      )}
    </div>
  );
}

ServiceAutocomplete.displayName = "ServiceAutocomplete";
