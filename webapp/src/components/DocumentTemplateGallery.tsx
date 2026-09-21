import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { ALL_PRESETS, PresetTemplate } from "../document-model/templates/preset-templates";

export interface DocumentTemplateGalleryProps {
  onSelect: (templateKey: string) => void;
  selectedKey?: string;
}

const categoryConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
  blank: { bg: "bg-surface-alt", text: "text-secondary", border: "border-color-subtle", label: "Blank" },
  default: { bg: "bg-primary-bg", text: "text-primary-brand", border: "border-primary-200", label: "Professional" },
  industry: { bg: "bg-accent-50", text: "text-info-text", border: "border-accent-200", label: "Industry" },
};

const iconFillColor: Record<string, string> = {
  blank: "text-tertiary",
  professional: "text-primary-brand",
  construction: "status-warning-text",
  consulting: "text-sky-600",
  photography: "text-rose-600",
  freelancing: "status-info-text",
  legal: "text-purple-600",
  landscaping: "status-success-text",
  cleaning: "text-teal-600",
  automotive: "text-orange-600",
  retail: "text-pink-600",
  "professional-services": "text-cyan-600",
};

function PresetSilhouette({ templateKey }: { templateKey: string }) {
  const fill = iconFillColor[templateKey] ?? iconFillColor.professional;

  return (
    <div
      className="relative mx-auto mb-3 flex h-28 w-20 items-end justify-center overflow-hidden rounded-lg bg-surface-alt p-2"
      aria-hidden="true"
    >
      <div className={`h-16 w-16 flex items-center justify-center ${fill} text-3xl font-bold`}>
        {templateKey.charAt(0).toUpperCase()}
      </div>
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
        <h2 className="text-2xl font-semibold text-primary">Choose a starting template</h2>
        <p className="mt-1 text-sm text-secondary">
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
              className={`relative flex flex-col rounded-xl border-2 bg-surface p-5 text-left shadow-sm outline-none transition-all duration-150 hover:border-primary-400 hover:shadow
                ${isSelected ? "border-primary-600 ring-2 ring-primary-200" : "border-color-subtle"}
                ${isFocused && !isSelected ? "border-primary-500 ring-2 ring-primary-100" : ""}
              `}
            >
              <PresetSilhouette templateKey={template.metadata.key} />
              <span
                className={`mb-2 inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
              >
                {badgeLabel}
              </span>
              <h3 className="text-lg font-semibold text-primary">{template.metadata.name}</h3>
              <p className="mt-1 text-sm text-secondary flex-1">{template.metadata.description}</p>
              <span className="mt-3 text-xs text-tertiary">Press Enter to select</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-6 text-xs text-secondary">
        <span>← ↑ → ↓ navigate cards</span>
        <span>Enter select</span>
        <span>Esc to cancel</span>
      </div>
    </div>
  );
}





