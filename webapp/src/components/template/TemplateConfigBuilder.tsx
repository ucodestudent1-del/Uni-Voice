import { useState } from "react";
import { FormField } from "@/components/ui";
import { ChevronDown, ChevronRight } from "lucide-react";

export type TemplateLayoutSection =
  | "header"
  | "customer_details"
  | "line_items"
  | "totals"
  | "payment_instructions"
  | "notes"
  | "footer";

export type TemplateLineItemColumn =
  | "description"
  | "quantity"
  | "unit"
  | "unit_price"
  | "discount"
  | "tax_rate"
  | "tax_amount"
  | "total";

export interface TemplateLayoutConfig {
  sections: Record<string, boolean>;
  lineItems: {
    visibleColumns: TemplateLineItemColumn[];
    hideColumns: TemplateLineItemColumn[];
  };
  style: {
    theme: string;
    accentColor: string;
    fontFamily: string;
    borderRadius: number;
    spacing: "compact" | "comfortable" | "normal";
  };
}

export interface TemplateConfigBuilderProps {
  config: TemplateLayoutConfig;
  onChange: (config: TemplateLayoutConfig) => void;
}

const layoutSections: { key: string; label: string; section: TemplateLayoutSection }[] = [
  { key: "header", label: "Header (Business info)", section: "header" },
  { key: "customer_details", label: "Customer Details", section: "customer_details" },
  { key: "line_items", label: "Line Items Table", section: "line_items" },
  { key: "totals", label: "Totals Summary", section: "totals" },
  { key: "payment_instructions", label: "Payment Instructions", section: "payment_instructions" },
  { key: "notes", label: "Notes & Terms", section: "notes" },
  { key: "footer", label: "Footer", section: "footer" },
];

const allColumns: { value: TemplateLineItemColumn; label: string }[] = [
  { value: "description", label: "Description" },
  { value: "quantity", label: "Quantity" },
  { value: "unit", label: "Unit" },
  { value: "unit_price", label: "Unit Price" },
  { value: "discount", label: "Discount" },
  { value: "tax_rate", label: "Tax Rate" },
  { value: "tax_amount", label: "Tax Amount" },
  { value: "total", label: "Line Total" },
];

const themeOptions = [
  { value: "modern", label: "Modern" },
  { value: "classic", label: "Classic" },
  { value: "minimal", label: "Minimal" },
  { value: "corporate", label: "Corporate" },
];

const fontOptions = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "System", label: "System" },
  { value: "Helvetica", label: "Helvetica" },
];

const spacingOptions = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "comfortable", label: "Comfortable" },
];

export function defaultTemplateConfig(): TemplateLayoutConfig {
  return {
    sections: {
      header: true,
      customer_details: true,
      line_items: true,
      totals: true,
      payment_instructions: false,
      notes: true,
      footer: false,
    },
    lineItems: {
      visibleColumns: ["description", "quantity", "unit_price", "total"],
      hideColumns: ["unit", "discount", "tax_rate", "tax_amount"],
    },
    style: {
      theme: "modern",
      accentColor: "#0070f3",
      fontFamily: "Inter",
      borderRadius: 8,
      spacing: "normal",
    },
  };
}

export function TemplateConfigBuilder({ config, onChange }: TemplateConfigBuilderProps) {
  const [sectionsOpen, setSectionsOpen] = useState(true);
  const [columnsOpen, setColumnsOpen] = useState(true);
  const [styleOpen, setStyleOpen] = useState(true);

  const toggleSection = (key: string) => {
    onChange({
      ...config,
      sections: { ...config.sections, [key]: !config.sections[key] },
    });
  };

  const toggleColumn = (col: TemplateLineItemColumn) => {
    const currentlyVisible = config.lineItems.visibleColumns.includes(col);
    const newVisible = currentlyVisible
      ? config.lineItems.visibleColumns.filter((c) => c !== col)
      : [...config.lineItems.visibleColumns, col];
    const newHidden = currentlyVisible
      ? [...config.lineItems.hideColumns, col]
      : config.lineItems.hideColumns.filter((c) => c !== col);

    onChange({
      ...config,
      lineItems: {
        visibleColumns: newVisible,
        hideColumns: newHidden,
      },
    });
  };

  const updateStyle = (key: keyof TemplateLayoutConfig["style"], value: unknown) => {
    onChange({
      ...config,
      style: { ...config.style, [key]: value },
    });
  };

  return (
    <div className="space-y-4">
      <div className="border border-color rounded-lg">
        <button
          type="button"
          onClick={() => setSectionsOpen(!sectionsOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="font-medium text-primary">Layout Sections</span>
          {sectionsOpen ? (
            <ChevronDown className="h-4 w-4 text-tertiary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-tertiary" />
          )}
        </button>

        {sectionsOpen && (
          <div className="px-4 pb-4 space-y-2 border-t border-color">
            {layoutSections.map((sec) => (
              <label key={sec.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.sections[sec.key] ?? false}
                  onChange={() => toggleSection(sec.key)}
                  className="h-3 w-3"
                />
                <span className="text-primary">{sec.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="border border-color rounded-lg">
        <button
          type="button"
          onClick={() => setColumnsOpen(!columnsOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="font-medium text-primary">Line Item Columns</span>
          {columnsOpen ? (
            <ChevronDown className="h-4 w-4 text-tertiary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-tertiary" />
          )}
        </button>

        {columnsOpen && (
          <div className="px-4 pb-4 space-y-2 border-t border-color">
            {allColumns.map((col) => (
              <label key={col.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.lineItems.visibleColumns.includes(col.value)}
                  onChange={() => toggleColumn(col.value)}
                  className="h-3 w-3"
                />
                <span className="text-primary">{col.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="border border-color rounded-lg">
        <button
          type="button"
          onClick={() => setStyleOpen(!styleOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="font-medium text-primary">Style</span>
          {styleOpen ? (
            <ChevronDown className="h-4 w-4 text-tertiary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-tertiary" />
          )}
        </button>

        {styleOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-color">
            <FormField
              label="Theme"
              select
              value={config.style.theme}
              onChange={(e) => updateStyle("theme", e.target.value)}
            >
              {themeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </FormField>

            <FormField
              label="Accent Color"
              value={config.style.accentColor}
              onChange={(e) => updateStyle("accentColor", e.target.value)}
            />

            <FormField
              label="Font Family"
              select
              value={config.style.fontFamily}
              onChange={(e) => updateStyle("fontFamily", e.target.value)}
            >
              {fontOptions.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </FormField>

            <FormField
              label="Border Radius (px)"
              value={String(config.style.borderRadius)}
              onChange={(e) => updateStyle("borderRadius", Number(e.target.value))}
              type="number"
            />

            <FormField
              label="Spacing"
              select
              value={config.style.spacing}
              onChange={(e) => updateStyle("spacing", e.target.value)}
            >
              {spacingOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </FormField>
          </div>
        )}
      </div>
    </div>
  );
}
