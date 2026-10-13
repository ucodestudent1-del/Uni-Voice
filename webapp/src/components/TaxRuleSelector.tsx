import { useEffect, useState, useRef } from "react";
import { getTaxRules, type ApiTaxRule } from "@/api/client";
import { ChevronDown, Plus, Trash2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";

interface TaxRuleSelectorProps {
  value?: string;
  onChange: (ruleId: string | undefined) => void;
  placeholder?: string;
}

export default function TaxRuleSelector({
  value,
  onChange,
  placeholder = "Select tax rule",
}: TaxRuleSelectorProps) {
  const [rules, setRules] = useState<ApiTaxRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadRules();
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
      const data = await getTaxRules({ limit: 200 });
      setRules(data.rules ?? []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }

  const selected = rules.find((r) => r.id === value);

  function formatRate(rate: string | number): string {
    const num = parseFloat(String(rate || "0")) * 100;
    if (num === 0) return "0%";
    return `${num.toFixed(2)}%`;
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="dropdown-toggle"
        onClick={() => {
          setOpen(!open);
          setEditingId(null);
        }}
      >
        <span className="truncate">
          {selected ? `${selected.name} (${formatRate(selected.rate)})` : placeholder}
        </span>
        <ChevronDown className="dropdown-chevron" />
      </div>

      {open && (
        <div className="dropdown-content max-h-60">
          {loading ? (
            <div className="p-3 text-sm text-secondary">Loading tax rules...</div>
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
                        {formatRate(rule.rate)} · {rule.countryCode ?? "Any country"}
                        {rule.region ? `, ${rule.region}` : ""}
                        {rule.conditions && rule.conditions.length > 0 && (
                          <span className="ml-1">· {rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""}</span>
                        )}
                      </p>
                    </div>
                    {rule.isDefault && (
                      <span className="text-xs bg-surface-alt text-tertiary px-2 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {rules.length === 0 && (
                <div className="p-3 text-sm text-tertiary">No tax rules configured</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
