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
        className="flex items-center justify-between w-full px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500"
        onClick={() => { setOpen(!open); setShowCreate(false); }}
      >
        <span className="text-sm text-slate-900 truncate">
          {selected ? selected.name : (value ? `Template (${value.slice(0, 8)})` : placeholder)}
        </span>
        <svg className="h-5 w-5 text-slate-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-slate-500">Loading templates...</div>
          ) : (
            <>
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={`p-3 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors ${
                    value === t.id ? "bg-primary-50" : "hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                >
                  <p className="font-medium text-sm text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {templatePreviews[t.name.toLowerCase()] ?? "Custom template"}
                  </p>
                  {t.is_default && (
                    <span className="inline-block mt-1 text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                      Default
                    </span>
                  )}
                </div>
              ))}
              {templates.length === 0 && (
                <div className="p-3 text-sm text-slate-400 text-center">
                  No templates found. Create one to get started.
                </div>
              )}
              <div
                className="p-3 text-sm text-primary-600 cursor-pointer hover:bg-primary-50 text-center border-t border-slate-200"
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
