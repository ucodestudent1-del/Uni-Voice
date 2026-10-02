import { useState } from "react";
import { Calendar, Filter, Search, X, Users, Tag, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import type { ReportFiltersParams } from "@/types/api";
import { EXPENSE_CATEGORY_OPTIONS } from "@/components/expenses/ExpenseCategoryBadge";

export type ReportFilterPreset = "custom" | "last_7" | "last_30" | "last_quarter" | "ytd" | "last_12";

const PRESETS: Array<{ value: ReportFilterPreset; label: string }> = [
  { value: "last_7", label: "Last 7 days" },
  { value: "last_30", label: "Last 30 days" },
  { value: "last_quarter", label: "Last quarter" },
  { value: "ytd", label: "Year to date" },
  { value: "last_12", label: "Last 12 months" },
  { value: "custom", label: "Custom range" },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

export interface ReportFiltersProps {
  filters: ReportFiltersParams;
  onChange: (filters: ReportFiltersParams) => void;
  onReset: () => void;
  availableFilters?: {
    showDateRange?: boolean;
    showCustomer?: boolean;
    showProject?: boolean;
    showStatus?: boolean;
    showCategory?: boolean;
    showProvider?: boolean;
    showSearch?: boolean;
  };
  presets?: boolean;
}

export default function ReportFilters({
  filters,
  onChange,
  onReset,
  availableFilters = {
    showDateRange: true,
    showCustomer: false,
    showProject: false,
    showStatus: false,
    showCategory: false,
    showProvider: false,
    showSearch: true,
  },
  presets = true,
}: ReportFiltersProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    onChange({ ...filters, search: value || undefined, offset: 0 });
  }, 300);

  const handlePresetChange = (preset: ReportFilterPreset) => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    switch (preset) {
      case "last_7":
        start.setDate(now.getDate() - 7);
        break;
      case "last_30":
        start.setDate(now.getDate() - 30);
        break;
      case "last_quarter":
        start.setMonth(now.getMonth() - 3);
        break;
      case "ytd":
        start.setMonth(0, 1);
        break;
      case "last_12":
        start.setFullYear(now.getFullYear() - 1);
        break;
      case "custom":
        return;
      default:
        return;
    }

    onChange({
      ...filters,
      dateFrom: start.toISOString().split("T")[0],
      dateTo: now.toISOString().split("T")[0],
      offset: 0,
    });
  };

  const activePreset = (): ReportFilterPreset => {
    if (!filters.dateFrom || !filters.dateTo) return "custom";
    const days = (new Date(filters.dateTo).getTime() - new Date(filters.dateFrom).getTime()) / (1000 * 60 * 60 * 24);
    if (days === 7) return "last_7";
    if (days === 30) return "last_30";
    if (Math.abs(days - 90) < 5) return "last_quarter";
    return "custom";
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, dateFrom: e.target.value || undefined, offset: 0 });
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, dateTo: e.target.value || undefined, offset: 0 });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onChange({ ...filters, status: val || undefined, offset: 0 });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onChange({ ...filters, category: val || undefined, offset: 0 });
  };

  const handleReset = () => {
    onReset();
  };

  const hasActiveFilters =
    !!filters.dateFrom ||
    !!filters.dateTo ||
    !!filters.customerId ||
    !!filters.projectId ||
    !!filters.status ||
    !!filters.category ||
    !!filters.provider ||
    !!filters.search;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {presets && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-tertiary uppercase">Quick range:</span>
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handlePresetChange(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activePreset() === p.value
                      ? "bg-primary-bg text-on-primary"
                      : "text-tertiary hover:text-secondary hover:bg-surface-alt"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="h-8 w-px bg-color-subtle self-center" />
          </>
        )}

        {availableFilters.showDateRange && (
          <>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-tertiary" />
              <input
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={handleDateFromChange}
                className="form-control-sm"
                placeholder="From date"
              />
              <span className="text-xs text-tertiary">to</span>
              <input
                type="date"
                value={filters.dateTo ?? ""}
                onChange={handleDateToChange}
                className="form-control-sm"
                placeholder="To date"
              />
            </div>
            <div className="h-8 w-px bg-color-subtle self-center" />
          </>
        )}

        {availableFilters.showSearch && (
          <div className="relative">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Search..."
              defaultValue={filters.search ?? ""}
              onChange={(e) => debouncedSetSearch(e.target.value)}
              className="search-input"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-color px-3 py-2 text-sm font-medium text-secondary hover:bg-surface-alt transition-colors h-10"
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center w-1.5 h-1.5 rounded-full bg-primary-action text-on-primary" />
          )}
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 rounded-lg text-sm font-medium text-secondary hover:text-primary hover:bg-surface-alt transition-colors h-10 px-3"
          >
            <X className="w-4 h-4" />
            Reset
          </button>
        )}
      </div>

      {advancedOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {availableFilters.showStatus && (
            <div className="space-y-1.5">
              <label className="form-label-secondary">Status</label>
              <select
                value={filters.status ? (Array.isArray(filters.status) ? filters.status[0] : filters.status) : ""}
                onChange={handleStatusChange}
                className="form-select"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {availableFilters.showCategory && (
            <div className="space-y-1.5">
              <label className="form-label-secondary">Category</label>
              <select
                value={filters.category ?? ""}
                onChange={handleCategoryChange}
                className="form-select"
              >
                <option value="">All categories</option>
                {EXPENSE_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {availableFilters.showCustomer && (
            <div className="space-y-1.5">
              <label className="form-label-secondary flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                Customer
              </label>
              <input
                type="text"
                placeholder="Customer name"
                value={filters.customerId ?? ""}
                onChange={(e) =>
                  onChange({ ...filters, customerId: e.target.value || undefined, offset: 0 })
                }
                className="form-control"
              />
            </div>
          )}

          {availableFilters.showProject && (
            <div className="space-y-1.5">
              <label className="form-label-secondary flex items-center gap-1">
                <LayoutGrid className="w-3.5 h-3.5" />
                Project
              </label>
              <input
                type="text"
                placeholder="Project name"
                value={filters.projectId ?? ""}
                onChange={(e) =>
                  onChange({ ...filters, projectId: e.target.value || undefined, offset: 0 })
                }
                className="form-control"
              />
            </div>
          )}

          {availableFilters.showProvider && (
            <div className="space-y-1.5">
              <label className="form-label-secondary flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                Provider
              </label>
              <input
                type="text"
                placeholder="Payment provider"
                value={filters.provider ?? ""}
                onChange={(e) =>
                  onChange({ ...filters, provider: e.target.value || undefined, offset: 0 })
                }
                className="form-control"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
