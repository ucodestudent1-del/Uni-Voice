import { useState } from "react";
import { Search, X, Calendar, Filter } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EXPENSE_CATEGORY_OPTIONS } from "./ExpenseCategoryBadge";
import type { ExpenseSearchParams } from "@/types/api";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

export interface ExpenseFiltersProps {
  params: ExpenseSearchParams;
  onChange: (params: ExpenseSearchParams) => void;
  onReset: () => void;
  showAdvanced?: boolean;
}

export default function ExpenseFilters({
  params,
  onChange,
  onReset,
  showAdvanced = false,
}: ExpenseFiltersProps) {
  const [advancedOpen, setAdvancedOpen] = useState(showAdvanced);

  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    onChange({ ...params, search: value || undefined, offset: 0 });
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSetSearch(e.target.value);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...params,
      category: e.target.value || undefined,
      offset: 0,
    });
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...params,
      dateFrom: e.target.value || undefined,
      offset: 0,
    });
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...params,
      dateTo: e.target.value || undefined,
      offset: 0,
    });
  };

  const handleClearFilters = () => {
    onReset();
    setAdvancedOpen(false);
  };

  const hasActiveFilters =
    !!params.search ||
    !!params.category ||
    !!params.dateFrom ||
    !!params.dateTo;

  return (
    <div className="bg-surface rounded-xl border border-color p-4 space-y-3">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-tertiary mb-1">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
            <input
              type="text"
              placeholder="Search expenses..."
              defaultValue={params.search ?? ""}
              onChange={handleSearchChange}
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 pl-10 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="w-48">
          <label className="block text-xs font-medium text-tertiary mb-1">
            Category
          </label>
          <select
            value={params.category ?? ""}
            onChange={handleCategoryChange}
            className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant={advancedOpen ? "secondary" : "ghost"}
          size="sm"
          icon={<Filter className="w-4 h-4" />}
          iconPosition="left"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="self-end"
        >
          <span className="hidden sm:inline">
            {advancedOpen ? "Less Filters" : "More Filters"}
          </span>
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            icon={<X className="w-4 h-4" />}
            onClick={handleClearFilters}
            className="self-end"
          />
        )}
      </div>

      {advancedOpen && (
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-color-subtle">
          <div>
            <label className="block text-xs font-medium text-tertiary mb-1">
              From Date
            </label>
            <input
              type="date"
              value={params.dateFrom ?? ""}
              onChange={handleDateFromChange}
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-tertiary mb-1">
              To Date
            </label>
            <input
              type="date"
              value={params.dateTo ?? ""}
              onChange={handleDateToChange}
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {hasActiveFilters && (
        <div className="flex items-center gap-2 pt-2 border-t border-color-subtle">
          <Calendar className="w-4 h-4 text-tertiary" />
          <span className="text-xs text-tertiary">
            Active filters applied
          </span>
        </div>
      )}
    </div>
  );
}
