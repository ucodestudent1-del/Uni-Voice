import { CheckCircle } from "lucide-react";
import type { MouseEvent } from "react";
import type { TemplateModule } from "@/types/landing";

export interface TemplateGalleryProps {
  items: TemplateModule[];
  onSelect?: (item: TemplateModule) => void;
  selectedId?: string | null;
  className?: string;
}

const accentBorderMap: Record<string, string> = {
  slate: "border-slate-400 dark:border-slate-500",
  primary: "border-primary-500",
  teal: "border-teal-500",
  amber: "border-amber-500",
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
          const isSelected = selectedId === item.id;
          const borderColor = accentBorderMap[item.color] ?? accentBorderMap.slate;
          return (
            <button
              key={item.id}
              type="button"
              onClick={handleSelect(item)}
              className={`group relative flex flex-col text-left rounded-xl border-2 bg-surface p-5 shadow-sm transition-colors hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary ${
                isSelected ? `${borderColor} ring-2 ring-primary-500` : "border-color-subtle"
              }`}
            >
              {isSelected && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-primary-action px-2.5 py-1 text-xs font-medium text-on-primary">
                  Selected
                </span>
              )}
              <div className="mb-4 rounded-lg overflow-hidden border border-color-subtle">
                {item.preview}
              </div>
              <h3 className="text-lg font-semibold text-primary">{item.name}</h3>
              <p className="mt-1 text-sm text-secondary flex-1">{item.description}</p>
              <div className="mt-4 flex items-center gap-2 text-sm text-secondary">
                <CheckCircle className="h-4 w-4 text-success-text" />
                <span>Responsive • Print-ready • Brandable</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
