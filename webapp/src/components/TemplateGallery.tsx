import React, { useState, useMemo } from "react";
import {
  ALL_PRESETS,
  BLANK_PRESET,
  PROFESSIONAL_PRESET,
  INDUSTRY_PRESETS,
  type PresetTemplate,
  type PresetCategory,
  getPresetTemplate,
} from "../document-model/templates/preset-templates";

export interface TemplateGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (presetKey: string) => void;
  selectedKey?: string;
}

const CATEGORY_LABELS: Record<PresetCategory, string> = {
  blank: "Blank",
  default: "Default Templates",
  industry: "Industry Presets",
};

const CATEGORY_ORDER: PresetCategory[] = ["blank", "default", "industry"];

const PresetCard: React.FC<{
  preset: PresetTemplate;
  isSelected?: boolean;
  onClick: () => void;
}> = ({ preset, isSelected, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group relative flex flex-col text-left rounded-xl border-2 p-4
        transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
        ${isSelected ? "border-primary-600 bg-primary-50" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"}
      `}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-200"
          aria-hidden="true"
        >
          {preset.metadata.category === "blank" ? "◇" : preset.metadata.category === "default" ? "★" : "◼"}
        </span>
        <span className="text-sm font-medium text-slate-500">
          {CATEGORY_LABELS[preset.metadata.category]}
        </span>
      </div>
      <h3 className="text-base font-semibold text-slate-900">{preset.metadata.name}</h3>
      <p className="mt-1 text-sm text-slate-500 flex-1">{preset.metadata.description}</p>
      {preset.metadata.industry && (
        <span className="mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">
          {preset.metadata.industry}
        </span>
      )}
    </button>
  );
};

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedKey,
}) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return ALL_PRESETS;
    return ALL_PRESETS.filter(
      (p) =>
        p.metadata.name.toLowerCase().includes(query) ||
        p.metadata.description.toLowerCase().includes(query) ||
        (p.metadata.industry?.toLowerCase().includes(query) ?? false)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const groups: Record<PresetCategory, PresetTemplate[]> = {
      blank: [],
      default: [],
      industry: [],
    };
    for (const preset of filtered) {
      groups[preset.metadata.category].push(preset);
    }
    return groups;
  }, [filtered]);

  const visibleCategories = CATEGORY_ORDER.filter((cat) => grouped[cat].length > 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-4xl flex-col gap-4 overflow-hidden rounded-xl bg-slate-50 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Template Gallery</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Close template gallery"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <input
          type="search"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />

        <div className="overflow-y-auto">
          <div className="space-y-6">
            {visibleCategories.map((category) => (
              <div key={category}>
                <h3 className="mb-2 text-sm font-medium text-slate-600">
                  {CATEGORY_LABELS[category]}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {grouped[category].map((preset) => (
                    <PresetCard
                      key={preset.metadata.key}
                      preset={preset}
                      isSelected={selectedKey === preset.metadata.key}
                      onClick={() => onSelect(preset.metadata.key)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSelect("professional");
              onClose();
            }}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Use Professional
          </button>
        </div>
      </div>
    </div>
  );
};

export { BLANK_PRESET, PROFESSIONAL_PRESET, INDUSTRY_PRESETS, getPresetTemplate };
export default TemplateGallery;
