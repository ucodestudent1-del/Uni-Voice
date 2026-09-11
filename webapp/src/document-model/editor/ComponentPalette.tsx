import React from "react";
import { ComponentType } from "../types";
import { PaletteItem, getPaletteItems } from "../registry/index";

export interface PaletteCategory {
  id: string;
  label: string;
  items: PaletteItem[];
}

export const getCategories = (): PaletteCategory[] => {
  const allItems = getPaletteItems();

  const categories: PaletteCategory[] = [
    {
      id: "structure",
      label: "Layout",
      items: allItems.filter((i) => i.category === "structure"),
    },
    {
      id: "business",
      label: "Invoice Fields",
      items: allItems.filter((i) => i.category === "business"),
    },
    {
      id: "totals",
      label: "Totals",
      items: allItems.filter((i) => i.category === "totals"),
    },
    {
      id: "content",
      label: "Content",
      items: allItems.filter((i) => i.category === "content"),
    },
  ];

  return categories.filter((cat) => cat.items.length > 0);
};

export interface ComponentPaletteProps {
  paletteDraggableIdPrefix?: string;
}

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ paletteDraggableIdPrefix = "palette" }) => {
  const categories = getCategories();

  return (
    <div className="w-64 bg-slate-50 border-r border-slate-200 p-4 overflow-y-auto">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">Components</h2>
      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category.id}>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {category.label}
            </h3>
            <div className="space-y-1">
              {category.items.map((item) => (
                <PaletteItemCard
                  key={item.type}
                  item={item}
                  paletteDraggableId={`${paletteDraggableIdPrefix}-${item.type}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface PaletteItemCardProps {
  item: PaletteItem;
  paletteDraggableId: string;
}

const PaletteItemCard: React.FC<PaletteItemCardProps> = ({ item, paletteDraggableId }) => {
  return (
    <div
      id={paletteDraggableId}
      data-palette-id={paletteDraggableId}
      className="
        flex items-center gap-3 p-2 rounded-lg
        bg-white border border-slate-200
        hover:border-primary-300 hover:bg-primary-50
        cursor-grab
        transition-all duration-150
      "
    >
      <span className="text-lg">{getComponentIcon(item.type)}</span>
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-900">{item.label}</div>
        <div className="text-xs text-slate-500">{item.description}</div>
      </div>
    </div>
  );
};

function getComponentIcon(type: ComponentType): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    text: "📝",
    image: "🖼️",
    logo: "🏢",
    customerInfo: "👤",
    invoiceNumber: "#️",
    date: "📅",
    lineItems: "📋",
    subtotal: "💰",
    tax: "🧾",
    discount: "✂️",
    paymentTerms: "📄",
    signature: "✍️",
    customField: "⚙️",
    notes: "📝",
    terms: "📄",
    paymentInstructions: "🏦",
    fees: "➕",
    total: "💵",
    amountDue: "➡️",
    businessInfo: "🏪",
    spacer: "␣",
    divider: "—",
    section: "📦",
    row: "➖",
    column: "⬛",
  };
  return icons[type] ?? "•";
}

export default ComponentPalette;
