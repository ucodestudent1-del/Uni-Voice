import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { ALL_PRESETS, PresetTemplate } from "../document-model/templates/preset-templates";

export interface DocumentTemplateGalleryProps {
  onSelect: (templateKey: string) => void;
  selectedKey?: string;
}

const categoryConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
  blank: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", label: "Blank" },
  default: { bg: "bg-primary-50", text: "text-primary-700", border: "border-primary-200", label: "Professional" },
  industry: { bg: "bg-accent-50", text: "text-accent-700", border: "border-accent-200", label: "Industry" },
};

const iconFillColor: Record<string, string> = {
  blank: "text-slate-400",
  professional: "text-primary-600",
  construction: "text-amber-600",
  consulting: "text-sky-600",
  photography: "text-rose-600",
  freelancing: "text-indigo-600",
  legal: "text-purple-600",
  landscaping: "text-green-600",
  cleaning: "text-teal-600",
  automotive: "text-orange-600",
  retail: "text-pink-600",
  "professional-services": "text-cyan-600",
};

const silhouetteIcons: Record<string, React.ReactNode> = {
  blank: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6h12v12H6z" />,
  professional: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M8 14h8m-6 4h6m-8 4h8" />,
  construction: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7M7 16l5-5 5 5" />,
  consulting: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h18v10H3zM7 12h10" />,
  photography: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2 12l6-6 4 4 4-4 6 6v6H2z" />,
  freelancing: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16v8H4M7 8V4h10v4" />,
  legal: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3h14v2H5M5 21h14v-2H5M9 7v12M15 7v12" />,
  landscaping: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 17c0-4 3-7 7-7s7 3 7 7M8 17l2-3m4 3l2-2" />,
  cleaning: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 8c0-2 1-4 3-4s3 2 3 4M6 8l3 6m-6 0h12" />,
  automotive: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 12h16M6 12V8h12v4m-9 4a3 3 0 106 0 3 3 0 00-6 0z" />,
  retail: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16M8 8V4h8v4M6 8l2 8h10l2-8" />,
  "professional-services": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 8h8M8 12h8M8 16h8M6 4h12v2H6z" />,
};

function PresetSilhouette({ templateKey }: { templateKey: string }) {
  const Icon = silhouetteIcons[templateKey] ?? silhouetteIcons.professional;
  const fill = iconFillColor[templateKey] ?? iconFillColor.professional;

  return (
    <div
      className="relative mx-auto mb-3 flex h-28 w-20 items-end justify-center overflow-hidden rounded-lg bg-slate-50 p-2"
      aria-hidden="true"
    >
      <svg className={`h-16 w-16 ${fill}`} fill="none" viewBox="0 0 24 24">
        <rect x="3" y="2" width="18" height="20" rx="2" ry="2" strokeWidth={1.5} stroke="currentColor" opacity={0.15} />
        {Icon}
      </svg>
      <div className="absolute inset-x-3 top-2 h-2 w-8 rounded bg-black/5" />
      <div className="absolute inset-x-3 top-5 h-1.5 w-6 rounded bg-black/5" />
    </div>
  );
}

export default function DocumentTemplateGallery({ onSelect, selectedKey }: DocumentTemplateGalleryProps) {
  const count = ALL_PRESETS.length;
  const [focusedIndex, setFocusedIndex] = useState(0);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    cardRefs.current = Array(count).fill(null);
  }, [count]);

  useEffect(() => {
    const el = cardRefs.current[focusedIndex];
    if (el) el.focus();
  }, [focusedIndex]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((index + 1) % count);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((index - 1 + count) % count);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        onSelect(ALL_PRESETS[index].metadata.key);
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(count - 1);
        break;
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4" role="radiogroup" aria-label="Invoice templates">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">Choose a starting template</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick a blank canvas, the professional default, or an industry-specific preset.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ALL_PRESETS.map((template: PresetTemplate, index: number) => {
          const cfg = categoryConfig[template.metadata.category] ?? categoryConfig.industry;
          const isSelected = selectedKey === template.metadata.key;
          const isFocused = focusedIndex === index;
          const badgeLabel =
            template.metadata.category === "industry" && template.metadata.industry
              ? `Industry • ${template.metadata.industry}`
              : cfg.label;
          return (
            <button
              key={template.metadata.key}
              type="button"
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              onClick={() => onSelect(template.metadata.key)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onFocus={() => setFocusedIndex(index)}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${template.metadata.name}. ${template.metadata.description}`}
              tabIndex={-1}
              className={`relative flex flex-col rounded-xl border-2 bg-white p-5 text-left shadow-sm outline-none transition-all duration-150 hover:border-primary-400 hover:shadow
                ${isSelected ? "border-primary-600 ring-2 ring-primary-200" : "border-slate-200"}
                ${isFocused && !isSelected ? "border-primary-500 ring-2 ring-primary-100" : ""}
              `}
            >
              <PresetSilhouette templateKey={template.metadata.key} />
              <span
                className={`mb-2 inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
              >
                {badgeLabel}
              </span>
              <h3 className="text-lg font-semibold text-slate-900">{template.metadata.name}</h3>
              <p className="mt-1 text-sm text-slate-500 flex-1">{template.metadata.description}</p>
              <span className="mt-3 text-xs text-slate-400">Press Enter to select</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-6 text-xs text-slate-500">
        <span>← ↑ → ↓ navigate cards</span>
        <span>Enter select</span>
        <span>Esc to cancel</span>
      </div>
    </div>
  );
}
