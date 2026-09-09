import type { MouseEvent } from "react";
import { CheckIcon, TemplateIcon } from "./icons";
import type { TemplateModule } from "../../data/landing";

export interface TemplateGalleryProps {
  items: TemplateModule[];
  onSelect?: (item: TemplateModule) => void;
  selectedId?: string | null;
  className?: string;
}

const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  slate: { bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-700" },
  primary: { bg: "bg-primary-100", border: "border-primary-500", text: "text-primary-700" },
  teal: { bg: "bg-teal-100", border: "border-teal-500", text: "text-teal-700" },
  amber: { bg: "bg-amber-100", border: "border-amber-500", text: "text-amber-700" },
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
              className={`group relative flex flex-col text-left rounded-xl border-2 bg-white p-5 shadow-sm transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                isSelected ? `${colors.border} ring-2 ring-primary-500` : "border-slate-200"
              }`}
            >
              {isSelected && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-primary-600 px-2.5 py-1 text-xs font-medium text-white">
                  Selected
                </span>
              )}
              <div
                className={`mb-4 aspect-video rounded-lg border ${colors.bg} ${colors.border} flex items-center justify-center`}
              >
                <TemplateIcon className={`h-8 w-8 ${colors.text}`} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
              <p className="mt-1 text-sm text-slate-600 flex-1">{item.description}</p>
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <CheckIcon className="h-4 w-4 text-green-400" />
                <span>Responsive • Print-ready • Brandable</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
