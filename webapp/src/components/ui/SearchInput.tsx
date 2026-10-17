import { type InputHTMLAttributes, useState } from "react";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "placeholder"> {
  onSearch?: (value: string) => void;
  placeholder?: string;
  showClearButton?: boolean;
}

export function SearchInput({
  className,
  onSearch,
  placeholder = "Search…",
  showClearButton = true,
  value,
  onChange,
  ...props
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState("");
  const isControlled = value !== undefined;
  const currentValue = isControlled ? (value as string) : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(e);
    onSearch?.(newValue);
  };

  const handleClear = () => {
    if (!isControlled) {
      setInternalValue("");
    } else {
      onChange?.({
        target: { value: "" },
        currentTarget: { value: "" },
      } as React.ChangeEvent<HTMLInputElement>);
    }
    onSearch?.("");
  };

  return (
    <div className="relative">
      <label className="sr-only">Search</label>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary"
        aria-hidden="true"
      />
      <input
        type="search"
        value={currentValue}
        onChange={handleChange}
        placeholder={`Search… ${placeholder}`.trim()}
        className={cn(
          "search-input pl-10 pr-4",
          showClearButton && currentValue && "pr-8",
          className
        )}
        {...props}
      />
      {showClearButton && currentValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-tertiary hover:text-primary hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

SearchInput.displayName = "SearchInput";
