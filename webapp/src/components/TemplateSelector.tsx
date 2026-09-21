import { useEffect, useState, useRef } from "react";
import { getTemplates } from "../api/client";
import type { ApiTemplate } from "../types/api";

interface TemplateSelectorProps {
  value?: string;
  onChange: (templateId: string | undefined) => void;
  placeholder?: string;
  showPreview?: boolean;
}

export default function TemplateSelector({ value, onChange, placeholder = "Select a template" }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadTemplates() {
    try {
      const data = await getTemplates({ limit: 50 });
      setTemplates(data.templates ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  const selected = templates.find((t) => t.id === value);

  const templatePreviews: Record<string, string> = {
    default: "Classic elegant invoice with clean lines and professional typography",
    minimal: "Minimalist design with ample whitespace and subtle accents",
    modern: "Contemporary layout with bold colors and geometric elements",
    corporate: "Traditional corporate style with letterhead and formal structure",
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center justify-between w-full px-3 py-2 border border-input-border rounded-lg bg-surface cursor-pointer focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500"
        onClick={() => { setOpen(!open); setShowCreate(false); }}
      >
        <span className="text-sm text-primary truncate">
          {selected ? selected.name : (value ? `Template (${value.slice(0, 8)})` : placeholder)}
        </span>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface border border-color-subtle rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-secondary">Loading templates...</div>
          ) : (
            <>
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={`p-3 cursor-pointer border-b border-color-subtle last:border-b-0 transition-colors ${
                    value === t.id ? "bg-primary-bg" : "hover:bg-surface-alt"
                  }`}
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                >
                  <p className="font-medium text-sm text-primary">{t.name}</p>
                  <p className="text-xs text-secondary mt-1">
                    {templatePreviews[t.name.toLowerCase()] ?? "Custom template"}
                  </p>
                  {t.is_default && (
                    <span className="inline-block mt-1 text-xs bg-surface-alt text-secondary px-2 py-0.5 rounded-full">
                      Default
                    </span>
                  )}
                </div>
              ))}
              {templates.length === 0 && (
                <div className="p-3 text-sm text-tertiary text-center">
                  No templates found. Create one to get started.
                </div>
              )}
              <div
                className="p-3 text-sm text-primary-brand cursor-pointer hover:bg-primary-bg text-center border-t border-color-subtle"
                onClick={() => setShowCreate(true)}
              >
                + Create new template
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}




