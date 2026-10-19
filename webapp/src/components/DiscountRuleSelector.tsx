import { useEffect, useState, useRef } from "react";
import { getDiscountRules, type ApiDiscountRule } from "@/api/client";
import { ChevronDown, Percent, Tag } from "lucide-react";

interface DiscountRuleSelectorProps {
  value?: string;
  onChange: (ruleId: string | undefined) => void;
  scope?: "invoice" | "line_item";
  placeholder?: string;
}

export default function DiscountRuleSelector({
  value,
  onChange,
  scope,
  placeholder = "Select discount rule",
}: DiscountRuleSelectorProps) {
  const [rules, setRules] = useState<ApiDiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRules();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadRules() {
    try {
      const params: Record<string, unknown> = { limit: 200 };
      if (scope) {
        params.scope = scope;
      }
      const data = await getDiscountRules(params);
      setRules(data.rules ?? []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }

  const selected = rules.find((r) => r.id === value);

  function formatValue(rule: ApiDiscountRule): string {
    if (rule.type === "percentage") {
      return `${rule.value}%`;
    }
    return `$${rule.value}`;
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="dropdown-toggle"
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">
          {selected ? `${selected.name} (${formatValue(selected)})` : placeholder}
        </span>
        <ChevronDown className="dropdown-chevron" />
      </div>

      {open && (
        <div className="dropdown-content max-h-60">
          {loading ? (
            <div className="p-3 text-sm text-secondary">Loading discount rules...</div>
          ) : (
            <>
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 cursor-pointer hover:bg-surface-alt border-b border-color-subtle last:border-b-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(rule.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-primary">{rule.name}</p>
                      <p className="text-xs text-secondary">
                        {rule.type === "percentage" ? (
                          <span className="flex items-center gap-1">
                            <Percent className="w-3 h-3" />
                            {rule.value}% off
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            ${rule.value} off
                          </span>
                        )}
                        {" "}· Scope: {rule.scope}
                        {rule.minAmount && (
                          <span> · Min: ${rule.minAmount}</span>
                        )}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      rule.isActive
                        ? "bg-success-bg text-success-text"
                        : "bg-error-bg text-error-text"
                    }`}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
              {rules.length === 0 && (
                <div className="p-3 text-sm text-tertiary">No discount rules configured</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
