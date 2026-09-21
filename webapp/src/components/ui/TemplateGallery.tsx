import type { MouseEvent } from "react";
import type { TemplateModule } from "../../data/landing";

export interface TemplateGalleryProps {
  items: TemplateModule[];
  onSelect?: (item: TemplateModule) => void;
  selectedId?: string | null;
  className?: string;
}

const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  slate: { bg: "bg-surface-alt", border: "border-input-border", text: "text-secondary" },
  primary: { bg: "bg-primary-bg", border: "border-primary-500", text: "text-primary-brand" },
  teal: { bg: "bg-teal-100", border: "border-teal-500", text: "text-teal-700" },
  amber: { bg: "status-warning-bg", border: "border-warning-border", text: "text-warning-text" },
};

export default function TemplateGallery({
  items,
  onSelect,
  selectedId,
  className,
}: TemplateGalleryProps) {
  const handleSelect = (item: TemplateModule) => (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onSelect?.(item);
  };

  return (
    <div className={className ?? ""}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const colors = colorMap[item.color] ?? colorMap.slate;
          const isSelected = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={handleSelect(item)}
               className={`group relative flex flex-col text-left rounded-xl border-2 bg-surface p-5 shadow-sm transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary ${
                isSelected ? `${colors.border} ring-2 ring-primary-500` : "border-color-subtle border-color"
              }`}
            >
              {isSelected && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-primary-action px-2.5 py-1 text-xs font-medium text-on-primary">
                  Selected
                </span>
              )}
               <div
                className={`mb-4 aspect-video rounded-lg border ${colors.bg} ${colors.border} flex items-center justify-center`}
              >
               </div>
               <h3 className="text-lg font-semibold text-inverse">{item.name}</h3>
               <p className="mt-1 text-sm text-secondary text-tertiary flex-1">{item.description}</p>
               <div className="mt-4 flex items-center gap-2 text-sm text-secondary text-tertiary">
                 <span className="status-success-text">✓</span>
                 <span>Responsive • Print-ready • Brandable</span>
               </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}







