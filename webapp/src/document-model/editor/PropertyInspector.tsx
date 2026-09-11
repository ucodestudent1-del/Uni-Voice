import React from "react";
import { AnyComponent, ComponentId, ComponentType, StyleProps } from "../types";
import { getComponentDefinition, InspectorContext } from "../registry/index";

export interface PropertyInspectorProps {
  componentId: ComponentId | null;
  component: AnyComponent | null;
  onSelect: (id: ComponentId) => void;
  onUpdate: (componentId: ComponentId, props: Record<string, unknown>, style?: Partial<StyleProps>) => void;
  onDelete: (componentId: ComponentId) => void;
  onVisibilityToggle: (componentId: ComponentId) => void;
  document: any;
  business: any;
  customer: any;
  currency: string;
  locale: string;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  componentId,
  component,
  onSelect,
  onUpdate,
  onDelete,
  onVisibilityToggle,
  document,
  business,
  customer,
  currency,
  locale,
}) => {
  if (!component) {
    return (
      <div className="w-80 bg-white border-l border-slate-200 p-4 overflow-y-auto">
        <h3 className="text-sm font-semibold text-slate-500 mb-4">Properties</h3>
        <p className="text-sm text-slate-400">Select a component to edit its properties.</p>
      </div>
    );
  }

  const def = getComponentDefinition(component.type);
  if (!def) {
    return (
      <div className="w-80 bg-white border-l border-slate-200 p-4 overflow-y-auto">
        <p className="text-sm text-slate-500">Component definition not found.</p>
      </div>
    );
  }

  const inspectorContext: InspectorContext = {
    document,
    business,
    customer,
    currency,
    locale,
  };

  const handlePropsChange = (props: Partial<any>) => {
    onUpdate(component.id, props, undefined);
  };

  const handleStyleChange = (style: Partial<StyleProps>) => {
    onUpdate(component.id, {}, style);
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          {component.type} Properties
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => onVisibilityToggle(component.id)}
            title={component.visible === false ? "Show component" : "Hide component"}
            className={`p-1 rounded text-xs ${
              component.visible === false
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {component.visible === false ? "hidden" : "visible"}
          </button>
          <button
            onClick={() => onDelete(component.id)}
            title="Delete component"
            className="p-1 rounded text-xs bg-red-100 text-red-600 hover:bg-red-200"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">
          Component ID
        </label>
        <p className="text-xs text-slate-400 break-all">{component.id}</p>
      </div>

      <div className="border-b border-slate-200 mb-4">
        {def.inspector(component, handlePropsChange, inspectorContext)}
      </div>

      <div className="border-b border-slate-200 mb-4">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Style</h4>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Font Size</label>
              <input
                type="number"
                value={component.style.fontSize || ""}
                onChange={(e) => handleStyleChange({ fontSize: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="14"
                className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
              <input
                type="color"
                value={component.style.color || "#000000"}
                onChange={(e) => handleStyleChange({ color: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded-lg cursor-pointer p-0"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Font Weight</label>
            <select
              value={component.style.fontWeight || "normal"}
              onChange={(e) => {
                const v = e.target.value;
                handleStyleChange({ fontWeight: v === "normal" ? "normal" : parseInt(v) });
              }}
              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="normal">Normal</option>
              <option value="300">Light</option>
              <option value="400">Regular</option>
              <option value="500">Medium</option>
              <option value="600">Semibold</option>
              <option value="700">Bold</option>
              <option value="800">Extra Bold</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Text Align</label>
            <div className="flex gap-1">
              {(["left", "center", "right", "justify"] as const).map((align) => (
                <button
                  key={align}
                  onClick={() => handleStyleChange({ textAlign: align })}
                  className={`flex-1 py-1 text-xs rounded ${
                    component.style.textAlign === align
                      ? "bg-primary-100 text-primary-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {align}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Padding</label>
            <input
              type="text"
              value={component.style.padding || ""}
              onChange={(e) => handleStyleChange({ padding: e.target.value || undefined })}
              placeholder="e.g. 8px or 8px 16px"
              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Margin</label>
            <input
              type="text"
              value={component.style.margin || ""}
              onChange={(e) => handleStyleChange({ margin: e.target.value || undefined })}
              placeholder="e.g. 8px or 8px 16px"
              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyInspector;
